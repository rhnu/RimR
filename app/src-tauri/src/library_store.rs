use async_trait::async_trait;
use rimr_core::migrations::{DocumentKind, migrate_document};
use rimr_core::{
    LibraryError, LibrarySettings, LibraryStore, ModList, ModListIndex, RIMR_FORMAT_VERSION,
};
use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::Value;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct JsonLibraryStore {
    data_dir: PathBuf,
}

impl JsonLibraryStore {
    pub fn new(data_dir: PathBuf) -> Self {
        Self { data_dir }
    }

    fn settings_path(&self) -> PathBuf {
        self.data_dir.join("settings.json")
    }

    fn mod_list_index_path(&self) -> PathBuf {
        self.data_dir.join("mod-lists").join("index.json")
    }

    fn mod_list_path(&self, id: &str) -> Result<PathBuf, LibraryError> {
        if id.is_empty() || id.contains("..") || id.contains('/') || id.contains('\\') {
            return Err(LibraryError::InvalidId(id.to_string()));
        }
        Ok(self.data_dir.join("mod-lists").join(format!("{id}.json")))
    }

    async fn ensure_dirs(&self) -> Result<(), LibraryError> {
        tokio::fs::create_dir_all(self.data_dir.join("mod-lists"))
            .await
            .map_err(|e| LibraryError::Io(e.to_string()))
    }

    async fn read_json<T: DeserializeOwned>(
        &self,
        path: &Path,
        kind: DocumentKind,
    ) -> Result<T, LibraryError> {
        let bytes = tokio::fs::read(path)
            .await
            .map_err(|e| LibraryError::Io(e.to_string()))?;
        let mut value: Value = serde_json::from_slice(&bytes)?;
        let outcome = migrate_document(kind, &mut value)?;
        if outcome.changed() {
            tracing::info!(
                path = ?path,
                from = outcome.from_version,
                to = outcome.to_version,
                "migrated library document"
            );
        }
        serde_json::from_value(value).map_err(LibraryError::from)
    }

    async fn write_json<T: Serialize>(&self, path: &Path, value: &T) -> Result<(), LibraryError> {
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| LibraryError::Io(e.to_string()))?;
        }
        let bytes = serde_json::to_vec_pretty(value)?;
        tokio::fs::write(path, bytes)
            .await
            .map_err(|e| LibraryError::Io(e.to_string()))
    }
}

#[async_trait]
impl LibraryStore for JsonLibraryStore {
    async fn load_settings(&self) -> Result<LibrarySettings, LibraryError> {
        let path = self.settings_path();
        tracing::debug!(path = ?path, "loading library settings");
        if !path.exists() {
            let settings = LibrarySettings {
                format_version: RIMR_FORMAT_VERSION,
                aliases: Vec::new(),
                tag_defs: Vec::new(),
                mod_tags: Vec::new(),
            };
            self.ensure_dirs().await?;
            self.write_json(&path, &settings).await?;
            return Ok(settings);
        }
        self.read_json(&path, DocumentKind::LibrarySettings).await
    }

    async fn save_settings(&self, settings: &LibrarySettings) -> Result<(), LibraryError> {
        tracing::debug!(path = ?self.settings_path(), aliases = settings.aliases.len(), "saving library settings");
        self.ensure_dirs().await?;
        let settings = LibrarySettings {
            format_version: RIMR_FORMAT_VERSION,
            aliases: settings.aliases.clone(),
            tag_defs: settings.tag_defs.clone(),
            mod_tags: settings.mod_tags.clone(),
        };
        self.write_json(&self.settings_path(), &settings).await
    }

    async fn load_mod_list_index(&self) -> Result<ModListIndex, LibraryError> {
        let path = self.mod_list_index_path();
        tracing::debug!(path = ?path, "loading mod list index");
        if !path.exists() {
            let index = ModListIndex {
                format_version: RIMR_FORMAT_VERSION,
                current_mod_list_id: None,
                mod_lists: Vec::new(),
            };
            self.ensure_dirs().await?;
            self.write_json(&path, &index).await?;
            return Ok(index);
        }
        self.read_json(&path, DocumentKind::ModListIndex).await
    }

    async fn save_mod_list_index(&self, index: &ModListIndex) -> Result<(), LibraryError> {
        tracing::debug!(path = ?self.mod_list_index_path(), mod_lists = index.mod_lists.len(), "saving mod list index");
        self.ensure_dirs().await?;
        let index = ModListIndex {
            format_version: RIMR_FORMAT_VERSION,
            current_mod_list_id: index.current_mod_list_id.clone(),
            mod_lists: index.mod_lists.clone(),
        };
        self.write_json(&self.mod_list_index_path(), &index).await
    }

    async fn read_mod_list(&self, id: &str) -> Result<ModList, LibraryError> {
        let path = self.mod_list_path(id)?;
        tracing::debug!(mod_list_id = %id, path = ?path, "reading mod list");
        self.read_json(&path, DocumentKind::ModList).await
    }

    async fn write_mod_list(&self, mod_list: &ModList) -> Result<(), LibraryError> {
        let path = self.mod_list_path(&mod_list.id)?;
        tracing::debug!(mod_list_id = %mod_list.id, path = ?path, "writing mod list");
        let mod_list = ModList {
            format_version: RIMR_FORMAT_VERSION,
            id: mod_list.id.clone(),
            name: mod_list.name.clone(),
            note: mod_list.note.clone(),
            entries: mod_list.entries.clone(),
            active_mods: mod_list.active_mods.clone(),
        };
        self.write_json(&path, &mod_list).await
    }

    async fn delete_mod_list_file(&self, id: &str) -> Result<(), LibraryError> {
        let path = self.mod_list_path(id)?;
        tracing::debug!(mod_list_id = %id, path = ?path, "deleting mod list file");
        if path.exists() {
            tokio::fs::remove_file(&path)
                .await
                .inspect_err(
                    |e| tracing::error!(path = ?path, error = %e, "failed to delete mod list file"),
                )
                .map_err(|e| LibraryError::Io(e.to_string()))?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rimr_core::{Alias, ModIdentity, ModListEntry};

    fn settings() -> LibrarySettings {
        LibrarySettings {
            format_version: 2,
            aliases: vec![Alias {
                identity: ModIdentity {
                    package_id: "local.mod".to_string(),
                    source_kind: None,
                    source_key: None,
                    steam_app_id: None,
                },
                display_alias: "Local".to_string(),
            }],
            tag_defs: Vec::new(),
            mod_tags: Vec::new(),
        }
    }

    fn mod_list() -> ModList {
        ModList {
            format_version: 2,
            id: "default".to_string(),
            name: "Default".to_string(),
            note: None,
            entries: vec![ModListEntry::Mod {
                id: "mod-local".to_string(),
                active: true,
                identity: ModIdentity {
                    package_id: "local.mod".to_string(),
                    source_kind: None,
                    source_key: None,
                    steam_app_id: None,
                },
            }],
            active_mods: vec!["local.mod".to_string()],
        }
    }

    #[tokio::test]
    async fn store_uses_v2_mod_list_layout() {
        let dir = tempfile::tempdir().unwrap();
        let store = JsonLibraryStore::new(dir.path().join("RimR"));

        store.save_settings(&settings()).await.unwrap();
        store
            .save_mod_list_index(&ModListIndex {
                format_version: 2,
                current_mod_list_id: Some("default".to_string()),
                mod_lists: vec![rimr_core::ModListSummary {
                    id: "default".to_string(),
                    name: "Default".to_string(),
                }],
            })
            .await
            .unwrap();
        store.write_mod_list(&mod_list()).await.unwrap();

        assert!(dir.path().join("RimR/settings.json").exists());
        assert!(dir.path().join("RimR/mod-lists/index.json").exists());
        assert!(dir.path().join("RimR/mod-lists/default.json").exists());
        assert!(!dir.path().join("RimR/profiles").exists());
    }

    #[tokio::test]
    async fn store_rejects_documents_without_a_migration_path() {
        let dir = tempfile::tempdir().unwrap();
        let store = JsonLibraryStore::new(dir.path().join("RimR"));
        std::fs::create_dir_all(dir.path().join("RimR")).unwrap();
        std::fs::write(
            dir.path().join("RimR/settings.json"),
            r#"{"formatVersion":1,"aliases":[]}"#,
        )
        .unwrap();

        let error = store.load_settings().await.unwrap_err();
        assert!(matches!(error, LibraryError::Migration(_)), "{error:?}");
    }
}
