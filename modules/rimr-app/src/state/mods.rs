use std::{
    collections::HashSet,
    path::{Path, PathBuf},
};

use rimr_core::{ModCatalog, ModMetadata, ModSourceKey, SourceKind};
use rimr_steam::{WorkshopLinks, workshop_file_id_from_mod_path};

use super::{AppState, CanonicalSourceRoots, SessionState};
use crate::{
    dto::{
        self, CatalogSnapshotDto, CleanModsRequest, LoadModFolderSizeRequest,
        LoadModPreviewRequest, ModCleanupCandidateDto, ModCleanupKindDto, ModCleanupPreviewDto,
        ModCleanupPreviewRequest, ModCleanupReasonDto, ModCleanupResultDto, ModCleanupSkippedDto,
        ModFolderSizeDto, ModPreviewDto, OpenSteamWorkshopPageRequest, SteamWorkshopOpenTarget,
    },
    error::{AppError, AppErrorCode, AppResult},
    mod_file_info,
    ports::ModSource,
    source::{FsModSource, SourceRoots},
};

#[derive(Debug, Clone)]
struct SourceMetadataIndexEntry {
    mod_path: PathBuf,
    source_kind: SourceKind,
    mod_icon_path: Option<String>,
}

impl AppState {
    /// Scans configured sources and replaces the cached catalog.
    ///
    /// # Errors
    /// Returns an error if paths are missing, scanning fails, or session access fails.
    pub async fn rebuild_mod_catalog(&self) -> AppResult<CatalogSnapshotDto> {
        let _operation = self.operations.lock().await;
        tracing::info!("rebuilding mod catalog");
        let roots = self.source_roots()?;
        let canonical_source_roots = canonical_source_roots(&roots);
        let source = FsModSource::new(roots);
        let game_version = source.target_game_version().await;
        let version_unknown = game_version.is_unknown();
        let opts = crate::ScanOpts {
            compile: rimr_core::CompileOpts {
                game_version,
                prefer_versioned: true,
            },
            ..crate::ScanOpts::default()
        };
        let mut report = crate::services::scan_mod_metadata(&source, &opts).await?;

        if version_unknown {
            report.diagnostics.push(rimr_core::Diagnostic::new(
                rimr_core::Severity::Warning,
                rimr_core::DiagnosticCode::GameVersionUnknown,
                "Target game version is unknown; version-specific mod rules could not be selected",
            ));
        }
        let dto = dto::catalog_snapshot(&report.catalog, &report.diagnostics);
        tracing::info!(
            mods_found = dto.catalog.mods.len(),
            diagnostics = dto.diagnostics.len(),
            "mod catalog rebuild complete"
        );
        let mut state = self.write_state()?;
        state.generation += 1;
        state.workspace.replace_catalog(report.catalog);
        state.canonical_source_roots = Some(canonical_source_roots);
        state.mod_previews.clear();
        state.mod_folder_sizes.clear();
        Ok(dto)
    }

    /// Loads and caches the preview for a catalog entry.
    ///
    /// # Errors
    /// Returns an error for an unknown or inaccessible source path, a failed task, or session access failure.
    pub async fn load_mod_preview(
        &self,
        request: LoadModPreviewRequest,
    ) -> AppResult<ModPreviewDto> {
        tracing::info!(source_key = %request.source_key, "loading mod preview");
        let (generation, source_key, mod_path, mod_icon_path, cached, canonical_source_roots) = {
            let state = self.read_state()?;
            let metadata = source_metadata_for_source_key(&state, &request.source_key)?;
            (
                state.generation,
                request.source_key.clone(),
                metadata.mod_path.clone(),
                metadata.mod_icon_path,
                state.mod_previews.get(request.source_key.as_str()).cloned(),
                canonical_source_roots_for_state(&state)?,
            )
        };

        ensure_mod_path_in_roots(&mod_path, &canonical_source_roots)?;
        let cache_hit = cached.is_some();
        let loaded = tokio::task::spawn_blocking(move || {
            mod_file_info::load_mod_preview(source_key, &mod_path, mod_icon_path, cached)
        })
        .await
        .map_err(|error| {
            AppError::new(AppErrorCode::Internal, "operation failed").with_source(error)
        })??;

        tracing::info!(
            source_key = %loaded.dto.source_key,
            cache_hit,
            "mod preview loaded"
        );
        let mut state = self.write_state()?;
        if generation != state.generation {
            return Err(super::conflict());
        }
        state
            .mod_previews
            .insert(loaded.dto.source_key.clone(), loaded.cache);
        Ok(loaded.dto)
    }

    /// Loads and caches the folder size for a catalog entry.
    ///
    /// # Errors
    /// Returns an error for an unknown or inaccessible source path, a failed task, or session access failure.
    pub async fn load_mod_folder_size(
        &self,
        request: LoadModFolderSizeRequest,
    ) -> AppResult<ModFolderSizeDto> {
        tracing::info!(source_key = %request.source_key, "loading mod folder size");
        let (generation, source_key, mod_path, cached, canonical_source_roots) = {
            let state = self.read_state()?;
            let metadata = source_metadata_for_source_key(&state, &request.source_key)?;
            (
                state.generation,
                request.source_key.clone(),
                metadata.mod_path,
                state
                    .mod_folder_sizes
                    .get(request.source_key.as_str())
                    .cloned(),
                canonical_source_roots_for_state(&state)?,
            )
        };

        ensure_mod_path_in_roots(&mod_path, &canonical_source_roots)?;
        let cache_hit = cached.is_some();
        let loaded = tokio::task::spawn_blocking(move || {
            mod_file_info::load_mod_folder_size(source_key, &mod_path, cached)
        })
        .await
        .map_err(|error| {
            AppError::new(AppErrorCode::Internal, "operation failed").with_source(error)
        })??;

        tracing::info!(
            source_key = %loaded.dto.source_key,
            folder_size_bytes = loaded.dto.folder_size_bytes,
            cache_hit,
            "mod folder size loaded"
        );
        let mut state = self.write_state()?;
        if generation != state.generation {
            return Err(super::conflict());
        }
        state
            .mod_folder_sizes
            .insert(loaded.dto.source_key.clone(), loaded.cache);
        Ok(loaded.dto)
    }

    /// Rescans sources and lists invalid mods eligible for cleanup.
    ///
    /// # Errors
    /// Returns an error if scanning, path validation, file inspection, or session access fails.
    pub async fn preview_mod_cleanup(
        &self,
        request: ModCleanupPreviewRequest,
    ) -> AppResult<ModCleanupPreviewDto> {
        tracing::info!(kind = ?request.kind, "previewing mod cleanup");
        self.rebuild_mod_catalog().await?;
        let (catalog, roots) = {
            let state = self.read_state()?;
            (
                state.workspace.catalog().cloned().ok_or_else(|| {
                    AppError::new(AppErrorCode::StateMissing, "catalog is not loaded")
                })?,
                canonical_source_roots_for_state(&state)?,
            )
        };
        let candidates = cleanup_candidates(&catalog, request.kind, &roots).await?;
        tracing::info!(
            kind = ?request.kind,
            candidates = candidates.len(),
            "mod cleanup preview complete"
        );
        Ok(ModCleanupPreviewDto {
            kind: request.kind,
            candidates,
        })
    }

    /// Revalidates requested cleanup candidates and moves eligible folders to trash.
    ///
    /// # Errors
    /// Returns an error if catalog access or cache invalidation fails; individual inspection and trash failures are reported as skipped entries.
    pub async fn clean_mods(&self, request: CleanModsRequest) -> AppResult<ModCleanupResultDto> {
        let _operation = self.operations.lock().await;
        tracing::info!(
            kind = ?request.kind,
            requested = request.source_keys.len(),
            "cleaning mods"
        );
        let source = FsModSource::new(self.source_roots()?);
        let (requested, roots) = {
            let state = self.read_state()?;
            let catalog = state.workspace.catalog().ok_or_else(|| {
                AppError::new(AppErrorCode::StateMissing, "catalog is not loaded")
            })?;
            (
                select_cleanup_sources(catalog, request.source_keys),
                canonical_source_roots_for_state(&state)?,
            )
        };

        let mut cleaned = Vec::new();
        let mut skipped = Vec::new();
        for selected in requested {
            let metadata = match selected {
                Ok(metadata) => metadata,
                Err(entry) => {
                    skipped.push(entry);
                    continue;
                },
            };
            let source_key = metadata.source_key.as_str().to_string();
            let candidate = match revalidate_cleanup_candidate(
                &metadata,
                request.kind,
                &roots,
                &source,
            )
            .await
            {
                Ok(Some(candidate)) => candidate,
                result => {
                    skipped.push(ModCleanupSkippedDto {
                        source_key,
                        path: Some(metadata.source_key.as_str().to_string()),
                        message: match result {
                            Err(error) => error.report(),
                            _ => "mod is no longer eligible for cleanup".to_string(),
                        },
                    });
                    continue;
                },
            };

            let path = PathBuf::from(&candidate.path);
            match trash_mod_folder(path.clone()).await {
                Ok(()) => cleaned.push(candidate),
                Err(error) => skipped.push(ModCleanupSkippedDto {
                    source_key,
                    path: Some(path.to_string_lossy().into_owned()),
                    message: error.report(),
                }),
            }
        }

        if !cleaned.is_empty() {
            let mut state = self.write_state()?;
            super::invalidate(&mut state);
        }

        tracing::info!(
            kind = ?request.kind,
            cleaned = cleaned.len(),
            skipped = skipped.len(),
            "mod cleanup complete"
        );
        Ok(ModCleanupResultDto {
            kind: request.kind,
            cleaned,
            skipped,
        })
    }

    /// Resolves a catalog source key inside the configured mod roots.
    ///
    /// # Errors
    /// Returns an error if the catalog is missing or the source path is unknown, inaccessible, or outside the roots.
    pub fn resolve_mod_folder_path(&self, source_key: &str) -> AppResult<PathBuf> {
        let state = self.read_state()?;
        let metadata = source_metadata_for_source_key(&state, source_key)?;
        let roots = canonical_source_roots_for_state(&state)?;
        ensure_mod_path_in_roots(&metadata.mod_path, &roots)?;
        Ok(metadata.mod_path)
    }

    /// Resolves a catalog Workshop entry to its requested Steam URL.
    ///
    /// # Errors
    /// Returns an error if session access fails or the source is missing, outside the roots, or lacks a valid Workshop identifier.
    pub fn resolve_steam_workshop_url(
        &self,
        request: OpenSteamWorkshopPageRequest,
    ) -> AppResult<String> {
        tracing::debug!(source_key = %request.source_key, target = ?request.target, "resolving Steam Workshop URL");
        let state = self.read_state()?;
        let metadata = source_metadata_for_source_key(&state, &request.source_key)?;
        if metadata.source_kind != SourceKind::Workshop {
            return Err(AppError::new(
                AppErrorCode::PathInvalid,
                "sourceKey does not refer to a Steam Workshop mod",
            )
            .with_source_key(request.source_key));
        }
        let roots = canonical_source_roots_for_state(&state)?;
        ensure_mod_path_in_roots(&metadata.mod_path, &roots)?;
        let file_id = workshop_file_id_from_mod_path(&metadata.mod_path).ok_or_else(|| {
            AppError::new(
                AppErrorCode::PathInvalid,
                "Steam Workshop mod path does not end with a numeric Workshop file id",
            )
            .with_path(metadata.mod_path.clone())
        })?;
        let links = WorkshopLinks::new(file_id);
        Ok(match request.target {
            SteamWorkshopOpenTarget::SteamClient => links.steam_client_url(),
            SteamWorkshopOpenTarget::Web => links.web_url(),
        })
    }
}

fn select_cleanup_sources(
    catalog: &ModCatalog,
    requested: Vec<String>,
) -> Vec<Result<ModMetadata, ModCleanupSkippedDto>> {
    let mut seen = HashSet::new();
    requested
        .into_iter()
        .map(|source_key| {
            let metadata = catalog.get_by_source_key(&ModSourceKey::new(source_key.as_str()));
            let message = if !seen.insert(source_key.clone()) {
                "sourceKey was requested more than once"
            } else if let Some(metadata) = metadata {
                return Ok(metadata.clone());
            } else {
                "sourceKey is not in the current catalog"
            };
            Err(ModCleanupSkippedDto {
                path: metadata.map(|metadata| metadata.source_key.as_str().to_string()),
                source_key,
                message: message.to_string(),
            })
        })
        .collect()
}

async fn revalidate_cleanup_candidate(
    metadata: &ModMetadata,
    kind: ModCleanupKindDto,
    roots: &CanonicalSourceRoots,
    source: &dyn ModSource,
) -> AppResult<Option<ModCleanupCandidateDto>> {
    if metadata.valid
        || !matches!(
            metadata.source_kind,
            SourceKind::Local | SourceKind::Workshop
        )
    {
        return Ok(None);
    }
    ensure_mod_path_in_roots(Path::new(metadata.source_key.as_str()), roots)?;

    // A preview can become stale while Steam completes a download or About.xml is repaired.
    // Keep read failures distinct from genuinely absent or malformed metadata.
    let current = match source.read_about_xml(&metadata.source_key).await? {
        Some(file) => match rimr_core::parse_about_xml(&file.bytes) {
            Ok(raw) => rimr_core::compile_metadata(
                raw,
                metadata.source_key.clone(),
                metadata.source_kind,
                // Cleanup only uses validity, which is independent of versioned rules.
                &rimr_core::CompileOpts::default(),
            ),
            Err(_) => ModMetadata::invalid(metadata.source_key.clone(), metadata.source_kind),
        },
        None => ModMetadata::invalid(metadata.source_key.clone(), metadata.source_kind),
    };
    cleanup_candidate(&current, kind, roots).await
}

async fn cleanup_candidates(
    catalog: &ModCatalog,
    kind: ModCleanupKindDto,
    roots: &CanonicalSourceRoots,
) -> AppResult<Vec<ModCleanupCandidateDto>> {
    let mut candidates = Vec::new();
    for (_, metadata) in catalog.iter() {
        if let Some(candidate) = cleanup_candidate(metadata, kind, roots).await? {
            candidates.push(candidate);
        }
    }
    candidates.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(candidates)
}

async fn cleanup_candidate(
    metadata: &ModMetadata,
    kind: ModCleanupKindDto,
    roots: &CanonicalSourceRoots,
) -> AppResult<Option<ModCleanupCandidateDto>> {
    if metadata.valid {
        return Ok(None);
    }
    if !matches!(
        metadata.source_kind,
        SourceKind::Local | SourceKind::Workshop
    ) {
        return Ok(None);
    }

    let mod_path = PathBuf::from(metadata.source_key.as_str());
    ensure_mod_path_in_roots(&mod_path, roots)?;
    let file_count = match kind {
        ModCleanupKindDto::Invalid => count_regular_files(mod_path.clone()).await?,
        ModCleanupKindDto::TextureOnlyInvalid => {
            let Some(file_count) = texture_only_file_count(mod_path.clone()).await? else {
                return Ok(None);
            };
            file_count
        },
    };

    Ok(Some(ModCleanupCandidateDto {
        source_key: metadata.source_key.as_str().to_string(),
        source_kind: dto::source_kind(metadata.source_kind),
        path: mod_path.to_string_lossy().into_owned(),
        package_id: metadata.package_id.as_str().to_string(),
        name: metadata.name.as_deref().map(str::to_string),
        reason: match kind {
            ModCleanupKindDto::TextureOnlyInvalid => ModCleanupReasonDto::TextureOnlyInvalid,
            ModCleanupKindDto::Invalid => ModCleanupReasonDto::InvalidMetadata,
        },
        file_count,
    }))
}

async fn count_regular_files(path: PathBuf) -> AppResult<u64> {
    tokio::task::spawn_blocking(move || count_regular_files_blocking(&path))
        .await
        .map_err(|error| {
            AppError::new(AppErrorCode::Internal, "operation failed").with_source(error)
        })?
        .map_err(command_source_io)
}

async fn texture_only_file_count(path: PathBuf) -> AppResult<Option<u64>> {
    tokio::task::spawn_blocking(move || texture_only_file_count_blocking(&path))
        .await
        .map_err(|error| {
            AppError::new(AppErrorCode::Internal, "operation failed").with_source(error)
        })?
        .map_err(command_source_io)
}

fn count_regular_files_blocking(path: &Path) -> std::io::Result<u64> {
    let mut count = 0;
    let mut stack = vec![path.to_path_buf()];
    while let Some(dir) = stack.pop() {
        for entry in std::fs::read_dir(&dir)? {
            let entry = entry?;
            let file_type = entry.file_type()?;
            if file_type.is_dir() {
                stack.push(entry.path());
            } else if file_type.is_file() {
                count += 1;
            }
        }
    }
    Ok(count)
}

fn texture_only_file_count_blocking(path: &Path) -> std::io::Result<Option<u64>> {
    let mut count = 0;
    let mut stack = vec![path.to_path_buf()];
    while let Some(dir) = stack.pop() {
        for entry in std::fs::read_dir(&dir)? {
            let entry = entry?;
            let file_type = entry.file_type()?;
            if file_type.is_symlink() {
                return Ok(None);
            }
            if file_type.is_dir() {
                stack.push(entry.path());
            } else if file_type.is_file() {
                if !is_texture_residue_file(&entry.path()) {
                    return Ok(None);
                }
                count += 1;
            } else {
                return Ok(None);
            }
        }
    }
    Ok((count > 0).then_some(count))
}

fn is_texture_residue_file(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            extension.eq_ignore_ascii_case("dds") || extension.eq_ignore_ascii_case("zstd")
        })
}

async fn trash_mod_folder(path: PathBuf) -> AppResult<()> {
    tokio::task::spawn_blocking(move || trash::delete(&path))
        .await
        .map_err(|error| {
            AppError::new(AppErrorCode::Internal, "cleanup task failed").with_source(error)
        })?
        .map_err(|error| {
            AppError::new(AppErrorCode::SourceIo, "moving mod folder to trash failed")
                .with_source(error)
        })
}

fn command_source_io(error: std::io::Error) -> AppError {
    AppError::new(AppErrorCode::SourceIo, "operation failed").with_source(error)
}

fn source_metadata_for_source_key(
    state: &SessionState,
    source_key: &str,
) -> AppResult<SourceMetadataIndexEntry> {
    let catalog = state
        .workspace
        .catalog()
        .ok_or_else(|| AppError::new(AppErrorCode::StateMissing, "catalog is not loaded"))?;
    catalog
        .get_by_source_key(&ModSourceKey::new(source_key))
        .map(|metadata| SourceMetadataIndexEntry {
            mod_path: PathBuf::from(metadata.source_key.as_str()),
            source_kind: metadata.source_kind,
            mod_icon_path: metadata.mod_icon_path.as_deref().map(str::to_string),
        })
        .ok_or_else(|| {
            AppError::new(
                AppErrorCode::PathInvalid,
                "sourceKey is not in the current catalog",
            )
            .with_source_key(source_key.to_string())
        })
}

fn canonical_source_roots_for_state(state: &SessionState) -> AppResult<CanonicalSourceRoots> {
    state
        .canonical_source_roots
        .clone()
        .ok_or_else(|| AppError::new(AppErrorCode::StateMissing, "catalog is not loaded"))
}

fn canonical_source_roots(roots: &SourceRoots) -> CanonicalSourceRoots {
    let roots = [
        Some(roots.game_dir.join("Data")),
        roots.local_mods_dir.clone(),
        roots.workshop_mods_dir.clone(),
    ]
    .into_iter()
    .flatten()
    .filter_map(|root| std::fs::canonicalize(root).ok())
    .collect();
    CanonicalSourceRoots { roots }
}

fn ensure_mod_path_in_roots(mod_path: &Path, roots: &CanonicalSourceRoots) -> AppResult<()> {
    let mod_path = canonicalize_for_check(mod_path)?;
    for root in &roots.roots {
        if mod_path.starts_with(root) {
            return Ok(());
        }
    }
    Err(AppError::new(
        AppErrorCode::PathInvalid,
        "sourceKey is outside configured mod roots",
    )
    .with_path(mod_path))
}

fn canonicalize_for_check(path: &Path) -> AppResult<PathBuf> {
    std::fs::canonicalize(path).map_err(|error| {
        AppError::new(AppErrorCode::PathInvalid, "operation failed")
            .with_source(error)
            .with_path(path.to_path_buf())
    })
}

#[cfg(test)]
mod tests;
