use crate::fs_utils::resolve_path_case_insensitive;
use async_trait::async_trait;
use rimr_core::{
    ModFeatures, ModSource, ModSourceEntry, ModSourceKey, SourceError, SourceFile, SourceKind,
};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct SourceRoots {
    pub game_dir: PathBuf,
    pub data_dir: PathBuf,
    pub local_mods_dir: Option<PathBuf>,
    pub workshop_mods_dir: Option<PathBuf>,
}

#[derive(Debug, Clone)]
pub struct FsModSource {
    roots: SourceRoots,
}

impl FsModSource {
    pub fn new(roots: SourceRoots) -> Self {
        Self { roots }
    }

    fn mods_config_path(&self) -> PathBuf {
        self.roots.data_dir.join("Config").join("ModsConfig.xml")
    }
}

#[async_trait]
impl ModSource for FsModSource {
    async fn discover_mods(&self) -> Result<Vec<ModSourceEntry>, SourceError> {
        tracing::info!(
            game_dir = ?self.roots.game_dir,
            local_mods_dir = ?self.roots.local_mods_dir,
            workshop_mods_dir = ?self.roots.workshop_mods_dir,
            "discovering mods"
        );
        let mut entries = Vec::new();
        discover_children(
            &self.roots.game_dir.join("Data"),
            SourceKind::Expansion,
            &mut entries,
        )
        .await?;
        if let Some(root) = &self.roots.local_mods_dir {
            discover_children(root, SourceKind::Local, &mut entries).await?;
        }
        if let Some(root) = &self.roots.workshop_mods_dir {
            discover_children(root, SourceKind::Workshop, &mut entries).await?;
        }
        tracing::info!(count = entries.len(), "mod discovery complete");
        Ok(entries)
    }

    async fn read_about_xml(&self, key: &ModSourceKey) -> Result<Option<SourceFile>, SourceError> {
        let mod_dir = PathBuf::from(key.as_str());
        let Some(about) = resolve_path_case_insensitive(&mod_dir, Path::new("About/About.xml"))
        else {
            tracing::debug!(path = ?mod_dir, "About.xml not found");
            return Ok(None);
        };
        tracing::debug!(path = ?about, "reading About.xml");
        match tokio::fs::read(&about).await {
            Ok(bytes) => Ok(Some(SourceFile::new(
                Some(key.clone()),
                about.to_string_lossy().into_owned(),
                bytes,
            ))),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                tracing::debug!(path = ?about, "About.xml not found");
                Ok(None)
            }
            Err(e) => {
                tracing::error!(path = ?about, error = %e, "failed to read About.xml");
                Err(SourceError::Io {
                    source_key: key.clone(),
                    message: e.to_string(),
                })
            }
        }
    }

    async fn read_mods_config(&self) -> Result<Option<SourceFile>, SourceError> {
        let path = self.mods_config_path();
        tracing::info!(path = ?path, "reading ModsConfig.xml");
        match tokio::fs::read(&path).await {
            Ok(bytes) => Ok(Some(SourceFile::new(
                Some(ModSourceKey::new(path.to_string_lossy().into_owned())),
                path.to_string_lossy().into_owned(),
                bytes,
            ))),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                tracing::info!(path = ?path, "ModsConfig.xml not found");
                Ok(None)
            }
            Err(e) => {
                tracing::error!(path = ?path, error = %e, "failed to read ModsConfig.xml");
                Err(SourceError::Io {
                    source_key: ModSourceKey::new(path.to_string_lossy().into_owned()),
                    message: e.to_string(),
                })
            }
        }
    }

    async fn write_mods_config(&self, bytes: Vec<u8>) -> Result<(), SourceError> {
        let path = self.mods_config_path();
        tracing::info!(path = ?path, "writing ModsConfig.xml");
        if let Some(parent) = path.parent()
            && let Err(e) = tokio::fs::create_dir_all(parent).await
        {
            tracing::error!(path = ?parent, error = %e, "failed to create ModsConfig.xml parent dir");
            return Err(SourceError::Io {
                source_key: ModSourceKey::new(parent.to_string_lossy().into_owned()),
                message: e.to_string(),
            });
        }

        let temp_path = path.with_extension("xml.rimr-tmp");
        if let Err(e) = tokio::fs::write(&temp_path, bytes).await {
            tracing::error!(path = ?temp_path, error = %e, "failed to write temporary ModsConfig.xml");
            return Err(SourceError::Io {
                source_key: ModSourceKey::new(temp_path.to_string_lossy().into_owned()),
                message: e.to_string(),
            });
        }
        tokio::fs::rename(&temp_path, &path)
            .await
            .inspect_err(
                |e| tracing::error!(path = ?path, error = %e, "failed to rename ModsConfig.xml"),
            )
            .map_err(|e| SourceError::Io {
                source_key: ModSourceKey::new(path.to_string_lossy().into_owned()),
                message: e.to_string(),
            })
    }

    async fn read_mod_features(&self, key: &ModSourceKey) -> Result<ModFeatures, SourceError> {
        let mod_path = PathBuf::from(key.as_str());
        tracing::debug!(source_key = %key.as_str(), "reading mod features");
        let mut has_assemblies = assemblies_has_dll(&mod_path.join("Assemblies")).await;
        if !has_assemblies && let Ok(mut read_dir) = tokio::fs::read_dir(&mod_path).await {
            while let Ok(Some(entry)) = read_dir.next_entry().await {
                let path = entry.path();
                if matches!(entry.file_type().await, Ok(t) if t.is_dir())
                    && assemblies_has_dll(&path.join("Assemblies")).await
                {
                    has_assemblies = true;
                    break;
                }
            }
        }
        Ok(ModFeatures { has_assemblies })
    }
}

async fn assemblies_has_dll(dir: &Path) -> bool {
    let mut read_dir = match tokio::fs::read_dir(dir).await {
        Ok(rd) => rd,
        Err(_) => return false,
    };
    while let Ok(Some(entry)) = read_dir.next_entry().await {
        if entry
            .path()
            .extension()
            .and_then(|e| e.to_str())
            .is_some_and(|ext| ext.eq_ignore_ascii_case("dll"))
        {
            return true;
        }
    }
    false
}

async fn discover_children(
    root: &Path,
    kind: SourceKind,
    entries: &mut Vec<ModSourceEntry>,
) -> Result<(), SourceError> {
    tracing::debug!(root = ?root, ?kind, "discovering mod children");
    let mut read_dir = match tokio::fs::read_dir(root).await {
        Ok(read_dir) => read_dir,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            tracing::debug!(root = ?root, "mod source root not found");
            return Ok(());
        }
        Err(e) => {
            tracing::error!(root = ?root, error = %e, "failed to read mod source root");
            return Err(SourceError::Io {
                source_key: ModSourceKey::new(root.to_string_lossy().into_owned()),
                message: e.to_string(),
            });
        }
    };

    while let Some(entry) = read_dir.next_entry().await.map_err(|e| SourceError::Io {
        source_key: ModSourceKey::new(root.to_string_lossy().into_owned()),
        message: e.to_string(),
    })? {
        let file_type = entry.file_type().await.map_err(|e| SourceError::Io {
            source_key: ModSourceKey::new(entry.path().to_string_lossy().into_owned()),
            message: e.to_string(),
        })?;
        if file_type.is_dir() {
            let path = entry.path();
            entries.push(ModSourceEntry {
                key: ModSourceKey::new(path.to_string_lossy().into_owned()),
                kind,
                display_name_hint: path
                    .file_name()
                    .map(|name| std::sync::Arc::<str>::from(name.to_string_lossy())),
            });
        }
    }
    Ok(())
}
