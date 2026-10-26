use std::{
    collections::{HashMap, HashSet},
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
    error::{self, CommandError, CommandErrorCode, CommandResult},
    mod_file_info,
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
    pub async fn rebuild_mod_catalog(&self) -> CommandResult<CatalogSnapshotDto> {
        tracing::info!("rebuilding mod catalog");
        let roots = self.source_roots()?;
        let canonical_source_roots = canonical_source_roots(&roots);
        let source = FsModSource::new(roots);
        let mut workspace = self.read_state()?.workspace.clone();
        let report = workspace
            .scan_mods(&source, &rimr_core::ScanOpts::default())
            .await
            .inspect_err(|e| tracing::error!(error = ?e, "mod metadata scan failed"))
            .map_err(error::core_error)?;

        let dto = dto::catalog_snapshot(&report.catalog, &report.diagnostics);
        tracing::info!(
            mods_found = dto.catalog.mods.len(),
            diagnostics = dto.diagnostics.len(),
            "mod catalog rebuild complete"
        );
        let mut state = self.write_state()?;
        state.workspace = workspace;
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
    ) -> CommandResult<ModPreviewDto> {
        tracing::info!(source_key = %request.source_key, "loading mod preview");
        let (source_key, mod_path, mod_icon_path, cached, canonical_source_roots) = {
            let state = self.read_state()?;
            let metadata = source_metadata_for_source_key(&state, &request.source_key)?;
            (
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
        .map_err(|error| CommandError::new(CommandErrorCode::Internal, error.to_string()))??;

        tracing::info!(
            source_key = %loaded.dto.source_key,
            cache_hit,
            "mod preview loaded"
        );
        let mut state = self.write_state()?;
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
    ) -> CommandResult<ModFolderSizeDto> {
        tracing::info!(source_key = %request.source_key, "loading mod folder size");
        let (source_key, mod_path, cached, canonical_source_roots) = {
            let state = self.read_state()?;
            let metadata = source_metadata_for_source_key(&state, &request.source_key)?;
            (
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
        .map_err(|error| CommandError::new(CommandErrorCode::Internal, error.to_string()))??;

        tracing::info!(
            source_key = %loaded.dto.source_key,
            folder_size_bytes = loaded.dto.folder_size_bytes,
            cache_hit,
            "mod folder size loaded"
        );
        let mut state = self.write_state()?;
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
    ) -> CommandResult<ModCleanupPreviewDto> {
        tracing::info!(kind = ?request.kind, "previewing mod cleanup");
        self.rebuild_mod_catalog().await?;
        let (catalog, roots) = {
            let state = self.read_state()?;
            (
                state.workspace.catalog().cloned().ok_or_else(|| {
                    CommandError::new(CommandErrorCode::StateMissing, "catalog is not loaded")
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
    /// Returns an error if catalog access, candidate inspection, or cache invalidation fails; individual trash failures are reported as skipped entries.
    pub async fn clean_mods(
        &self,
        request: CleanModsRequest,
    ) -> CommandResult<ModCleanupResultDto> {
        tracing::info!(
            kind = ?request.kind,
            requested = request.source_keys.len(),
            "cleaning mods"
        );
        let requested: Vec<String> = request.source_keys.into_iter().collect();
        let requested_set: HashSet<String> = requested.iter().cloned().collect();
        let (catalog, roots) = {
            let state = self.read_state()?;
            (
                state.workspace.catalog().cloned().ok_or_else(|| {
                    CommandError::new(CommandErrorCode::StateMissing, "catalog is not loaded")
                })?,
                canonical_source_roots_for_state(&state)?,
            )
        };

        let eligible = cleanup_candidates(&catalog, request.kind, &roots)
            .await?
            .into_iter()
            .filter(|candidate| requested_set.contains(&candidate.source_key))
            .map(|candidate| (candidate.source_key.clone(), candidate))
            .collect::<HashMap<_, _>>();

        let mut cleaned = Vec::new();
        let mut skipped = Vec::new();
        for source_key in requested {
            let Some(candidate) = eligible.get(&source_key).cloned() else {
                let path = catalog
                    .get_by_source_key(&ModSourceKey::new(source_key.as_str()))
                    .map(|metadata| metadata.source_key.as_str().to_string());
                skipped.push(ModCleanupSkippedDto {
                    source_key,
                    path,
                    message: "mod is no longer eligible for cleanup".to_string(),
                });
                continue;
            };

            let path = PathBuf::from(&candidate.path);
            match trash_mod_folder(path.clone()).await {
                Ok(()) => cleaned.push(candidate),
                Err(message) => skipped.push(ModCleanupSkippedDto {
                    source_key,
                    path: Some(path.to_string_lossy().into_owned()),
                    message,
                }),
            }
        }

        if !cleaned.is_empty() {
            self.clear_session_cache()?;
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
    pub fn resolve_mod_folder_path(&self, source_key: &str) -> CommandResult<PathBuf> {
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
    ) -> CommandResult<String> {
        tracing::debug!(source_key = %request.source_key, target = ?request.target, "resolving Steam Workshop URL");
        let state = self.read_state()?;
        let metadata = source_metadata_for_source_key(&state, &request.source_key)?;
        if metadata.source_kind != SourceKind::Workshop {
            return Err(CommandError::new(
                CommandErrorCode::PathInvalid,
                "sourceKey does not refer to a Steam Workshop mod",
            )
            .with_source_key(request.source_key));
        }
        let roots = canonical_source_roots_for_state(&state)?;
        ensure_mod_path_in_roots(&metadata.mod_path, &roots)?;
        let file_id = workshop_file_id_from_mod_path(&metadata.mod_path).ok_or_else(|| {
            CommandError::new(
                CommandErrorCode::PathInvalid,
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

async fn cleanup_candidates(
    catalog: &ModCatalog,
    kind: ModCleanupKindDto,
    roots: &CanonicalSourceRoots,
) -> CommandResult<Vec<ModCleanupCandidateDto>> {
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
) -> CommandResult<Option<ModCleanupCandidateDto>> {
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

async fn count_regular_files(path: PathBuf) -> CommandResult<u64> {
    tokio::task::spawn_blocking(move || count_regular_files_blocking(&path))
        .await
        .map_err(|error| CommandError::new(CommandErrorCode::Internal, error.to_string()))?
        .map_err(|error| command_source_io(&error))
}

async fn texture_only_file_count(path: PathBuf) -> CommandResult<Option<u64>> {
    tokio::task::spawn_blocking(move || texture_only_file_count_blocking(&path))
        .await
        .map_err(|error| CommandError::new(CommandErrorCode::Internal, error.to_string()))?
        .map_err(|error| command_source_io(&error))
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

async fn trash_mod_folder(path: PathBuf) -> Result<(), String> {
    tokio::task::spawn_blocking(move || trash::delete(&path))
        .await
        .map_err(|error| error.to_string())?
        .map_err(|error| error.to_string())
}

fn command_source_io(error: &std::io::Error) -> CommandError {
    CommandError::new(CommandErrorCode::SourceIo, error.to_string())
}

fn source_metadata_for_source_key(
    state: &SessionState,
    source_key: &str,
) -> CommandResult<SourceMetadataIndexEntry> {
    let catalog = state.workspace.catalog().ok_or_else(|| {
        CommandError::new(CommandErrorCode::StateMissing, "catalog is not loaded")
    })?;
    catalog
        .get_by_source_key(&ModSourceKey::new(source_key))
        .map(|metadata| SourceMetadataIndexEntry {
            mod_path: PathBuf::from(metadata.source_key.as_str()),
            source_kind: metadata.source_kind,
            mod_icon_path: metadata.mod_icon_path.as_deref().map(str::to_string),
        })
        .ok_or_else(|| {
            CommandError::new(
                CommandErrorCode::PathInvalid,
                "sourceKey is not in the current catalog",
            )
            .with_source_key(source_key.to_string())
        })
}

fn canonical_source_roots_for_state(state: &SessionState) -> CommandResult<CanonicalSourceRoots> {
    state
        .canonical_source_roots
        .clone()
        .ok_or_else(|| CommandError::new(CommandErrorCode::StateMissing, "catalog is not loaded"))
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

fn ensure_mod_path_in_roots(mod_path: &Path, roots: &CanonicalSourceRoots) -> CommandResult<()> {
    let mod_path = canonicalize_for_check(mod_path)?;
    for root in &roots.roots {
        if mod_path.starts_with(root) {
            return Ok(());
        }
    }
    Err(CommandError::new(
        CommandErrorCode::PathInvalid,
        "sourceKey is outside configured mod roots",
    )
    .with_path(mod_path))
}

fn canonicalize_for_check(path: &Path) -> CommandResult<PathBuf> {
    std::fs::canonicalize(path).map_err(|error| {
        CommandError::new(CommandErrorCode::PathInvalid, error.to_string())
            .with_path(path.to_path_buf())
    })
}
