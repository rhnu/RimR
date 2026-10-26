//! Library service functions: load/create/save/delete/import mod lists.
//!
//! These are the primary entry points the host calls for library operations.
//! IO goes through [`crate::ports::LibraryStore`]; domain logic uses the pure
//! functions from [`crate::domain::library`].

use crate::domain::{
    ModCatalog, ModList, ModListIndex, ModListSummary, RIMR_FORMAT_VERSION,
    mod_list_from_active_mods, mod_list_from_official_content, normalize_mod_list,
    unique_mod_list_id,
};
use crate::error::LibraryError;
use crate::ports::LibraryStore;

/// Loads the full library snapshot.
///
/// If the mod list index is empty, creates a default mod list from the
/// provided `active_mods` (requires `active_mods` to be `Some`).
pub async fn load_library(
    store: &dyn LibraryStore,
    active_mods: Option<&[String]>,
    catalog: Option<&ModCatalog>,
) -> Result<crate::domain::Library, LibraryError> {
    tracing::info!("loading library");
    let settings = store.load_settings().await?;
    let mut index = store.load_mod_list_index().await?;

    if index.mod_lists.is_empty() {
        tracing::info!("library index empty, creating default mod list");
        let active_mods = active_mods.ok_or(LibraryError::ActiveModsRequired)?;
        let mod_list = mod_list_from_active_mods("default", "Default", active_mods, catalog);
        store.write_mod_list(&mod_list).await?;
        index = ModListIndex {
            format_version: RIMR_FORMAT_VERSION,
            current_mod_list_id: Some(mod_list.id.clone()),
            mod_lists: vec![ModListSummary {
                id: mod_list.id.clone(),
                name: mod_list.name.clone(),
            }],
        };
        store.save_mod_list_index(&index).await?;
    }

    let current_id = index
        .current_mod_list_id
        .clone()
        .or_else(|| index.mod_lists.first().map(|s| s.id.clone()))
        .ok_or_else(|| LibraryError::NotFound("no mod lists exist".to_string()))?;
    tracing::debug!(current_id = %current_id, "loading current mod list");
    let current_mod_list = store.read_mod_list(&current_id).await?;

    tracing::info!(
        mod_lists = index.mod_lists.len(),
        current_id = %current_id,
        "library loaded"
    );
    Ok(crate::domain::Library {
        settings,
        mod_lists_index: index,
        current_mod_list,
    })
}

/// Creates a new mod list.
///
/// If `base_mod_list` is provided (the "Save As" path), its entries, note, and
/// active mods are copied into the new list, preserving groups and separators.
/// Otherwise the "New" path produces a minimal official-content list: Core
/// followed by each installed DLC (see
/// [`crate::domain::mod_list_from_official_content`]).
pub async fn create_mod_list(
    store: &dyn LibraryStore,
    name: String,
    base_mod_list: Option<ModList>,
    catalog: Option<&ModCatalog>,
) -> Result<ModList, LibraryError> {
    tracing::info!(%name, "creating mod list");
    let mut index = store.load_mod_list_index().await?;
    let id = unique_mod_list_id(&name, &index);
    let mod_list = if let Some(base) = base_mod_list {
        normalize_mod_list(ModList {
            id: id.clone(),
            name: name.clone(),
            ..base
        })
    } else {
        mod_list_from_official_content(id.clone(), name, catalog)
    };
    store.write_mod_list(&mod_list).await?;
    index.current_mod_list_id = Some(id.clone());
    index.mod_lists.push(ModListSummary {
        id: id.clone(),
        name: mod_list.name.clone(),
    });
    store.save_mod_list_index(&index).await?;
    tracing::info!(id = %mod_list.id, name = %mod_list.name, "mod list created");
    Ok(mod_list)
}

/// Saves an existing mod list, updating the index if the name changed.
pub async fn save_mod_list(
    store: &dyn LibraryStore,
    mod_list: ModList,
) -> Result<ModList, LibraryError> {
    tracing::info!(id = %mod_list.id, "saving mod list");
    let mod_list = normalize_mod_list(mod_list);
    store.write_mod_list(&mod_list).await?;

    let mut index = store.load_mod_list_index().await?;
    if let Some(summary) = index.mod_lists.iter_mut().find(|s| s.id == mod_list.id) {
        summary.name = mod_list.name.clone();
    } else {
        index.mod_lists.push(ModListSummary {
            id: mod_list.id.clone(),
            name: mod_list.name.clone(),
        });
    }
    if index.current_mod_list_id.is_none() {
        index.current_mod_list_id = Some(mod_list.id.clone());
    }
    store.save_mod_list_index(&index).await?;
    tracing::info!(id = %mod_list.id, "mod list saved");

    Ok(mod_list)
}

/// Deletes a mod list and updates the index.
pub async fn delete_mod_list(
    store: &dyn LibraryStore,
    id: &str,
) -> Result<ModListIndex, LibraryError> {
    tracing::info!(%id, "deleting mod list");
    let mut index = store.load_mod_list_index().await?;
    index.mod_lists.retain(|s| s.id != id);
    if index.current_mod_list_id.as_deref() == Some(id) {
        index.current_mod_list_id = index.mod_lists.first().map(|s| s.id.clone());
    }
    store.delete_mod_list_file(id).await?;
    store.save_mod_list_index(&index).await?;
    tracing::info!(%id, "mod list deleted");
    Ok(index)
}

/// Sets the current mod list id and returns the mod list.
pub async fn set_current_mod_list(
    store: &dyn LibraryStore,
    id: &str,
) -> Result<ModList, LibraryError> {
    tracing::info!(%id, "setting current mod list");
    let mut index = store.load_mod_list_index().await?;
    if !index.mod_lists.iter().any(|s| s.id == id) {
        return Err(LibraryError::NotFound(format!("mod list not found: {id}")));
    }
    let mod_list = store.read_mod_list(id).await?;
    index.current_mod_list_id = Some(id.to_string());
    store.save_mod_list_index(&index).await?;
    tracing::info!(%id, "current mod list set");
    Ok(mod_list)
}

/// Imports a mod list, assigning a unique id to avoid collisions.
pub async fn import_mod_list(
    store: &dyn LibraryStore,
    mod_list: ModList,
) -> Result<ModList, LibraryError> {
    tracing::info!(name = %mod_list.name, "importing mod list");
    let mut index = store.load_mod_list_index().await?;
    let id = unique_mod_list_id(&mod_list.name, &index);
    let mod_list = normalize_mod_list(ModList {
        id: id.clone(),
        ..mod_list
    });
    store.write_mod_list(&mod_list).await?;
    index.current_mod_list_id = Some(id.clone());
    index.mod_lists.push(ModListSummary {
        id: id.clone(),
        name: mod_list.name.clone(),
    });
    store.save_mod_list_index(&index).await?;
    tracing::info!(id = %mod_list.id, "mod list imported");
    Ok(mod_list)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{
        GroupChild, LibrarySettings, ModList, ModListEntry, ModListIndex, ModListSummary,
    };
    use async_trait::async_trait;
    use std::collections::HashMap;
    use std::sync::Mutex;

    /// In-memory LibraryStore for testing.
    struct InMemoryStore {
        settings: Mutex<LibrarySettings>,
        index: Mutex<ModListIndex>,
        mod_lists: Mutex<HashMap<String, ModList>>,
    }

    impl InMemoryStore {
        fn new() -> Self {
            Self {
                settings: Mutex::new(LibrarySettings {
                    format_version: RIMR_FORMAT_VERSION,
                    aliases: vec![],
                    tag_defs: vec![],
                    mod_tags: vec![],
                }),
                index: Mutex::new(ModListIndex {
                    format_version: RIMR_FORMAT_VERSION,
                    current_mod_list_id: None,
                    mod_lists: vec![],
                }),
                mod_lists: Mutex::new(HashMap::new()),
            }
        }
    }

    #[async_trait]
    impl LibraryStore for InMemoryStore {
        async fn load_settings(&self) -> Result<LibrarySettings, LibraryError> {
            Ok(self.settings.lock().unwrap().clone())
        }
        async fn save_settings(&self, settings: &LibrarySettings) -> Result<(), LibraryError> {
            *self.settings.lock().unwrap() = settings.clone();
            Ok(())
        }
        async fn load_mod_list_index(&self) -> Result<ModListIndex, LibraryError> {
            Ok(self.index.lock().unwrap().clone())
        }
        async fn save_mod_list_index(&self, index: &ModListIndex) -> Result<(), LibraryError> {
            *self.index.lock().unwrap() = index.clone();
            Ok(())
        }
        async fn read_mod_list(&self, id: &str) -> Result<ModList, LibraryError> {
            self.mod_lists
                .lock()
                .unwrap()
                .get(id)
                .cloned()
                .ok_or_else(|| LibraryError::NotFound(id.to_string()))
        }
        async fn write_mod_list(&self, mod_list: &ModList) -> Result<(), LibraryError> {
            self.mod_lists
                .lock()
                .unwrap()
                .insert(mod_list.id.clone(), mod_list.clone());
            Ok(())
        }
        async fn delete_mod_list_file(&self, id: &str) -> Result<(), LibraryError> {
            self.mod_lists.lock().unwrap().remove(id);
            Ok(())
        }
    }

    fn sample_mod_list(id: &str, name: &str) -> ModList {
        ModList {
            format_version: RIMR_FORMAT_VERSION,
            id: id.to_string(),
            name: name.to_string(),
            note: None,
            entries: vec![ModListEntry::Mod {
                id: "mod-a".to_string(),
                active: true,
                identity: crate::domain::ModIdentity {
                    package_id: "a".to_string(),
                    source_kind: None,
                    source_key: None,
                    steam_app_id: None,
                },
            }],
            active_mods: vec!["a".to_string()],
        }
    }

    fn sample_structured_mod_list(id: &str, name: &str) -> ModList {
        ModList {
            format_version: RIMR_FORMAT_VERSION,
            id: id.to_string(),
            name: name.to_string(),
            note: Some("source note".to_string()),
            entries: vec![
                ModListEntry::Mod {
                    id: "mod-a".to_string(),
                    active: true,
                    identity: crate::domain::ModIdentity {
                        package_id: "a".to_string(),
                        source_kind: None,
                        source_key: None,
                        steam_app_id: None,
                    },
                },
                ModListEntry::Group {
                    id: "group-1".to_string(),
                    name: "My Group".to_string(),
                    collapsed: false,
                    entries: vec![GroupChild {
                        id: "child-b".to_string(),
                        active: true,
                        identity: crate::domain::ModIdentity {
                            package_id: "b".to_string(),
                            source_kind: None,
                            source_key: None,
                            steam_app_id: None,
                        },
                    }],
                },
                ModListEntry::Separator {
                    id: "sep-1".to_string(),
                    title: "Section".to_string(),
                    note: None,
                    color: Some("#ff0000".to_string()),
                },
            ],
            active_mods: vec!["a".to_string(), "b".to_string()],
        }
    }

    #[tokio::test]
    async fn load_library_creates_default_when_empty() {
        let store = InMemoryStore::new();
        let library = load_library(&store, Some(&["a".to_string()]), None)
            .await
            .unwrap();
        assert_eq!(library.current_mod_list.id, "default");
        assert_eq!(library.current_mod_list.name, "Default");
        assert_eq!(library.mod_lists_index.mod_lists.len(), 1);
    }

    #[tokio::test]
    async fn load_library_requires_active_mods_when_empty() {
        let store = InMemoryStore::new();
        let result = load_library(&store, None, None).await;
        assert!(matches!(result, Err(LibraryError::ActiveModsRequired)));
    }

    #[tokio::test]
    async fn load_library_loads_existing() {
        let store = InMemoryStore::new();
        // Seed with an existing mod list
        {
            let mut index = store.index.lock().unwrap();
            index.mod_lists.push(ModListSummary {
                id: "existing".to_string(),
                name: "Existing".to_string(),
            });
            index.current_mod_list_id = Some("existing".to_string());
        }
        store.mod_lists.lock().unwrap().insert(
            "existing".to_string(),
            sample_mod_list("existing", "Existing"),
        );
        let library = load_library(&store, None, None).await.unwrap();
        assert_eq!(library.current_mod_list.id, "existing");
    }

    #[tokio::test]
    async fn create_mod_list_assigns_unique_id() {
        let store = InMemoryStore::new();
        let ml = create_mod_list(&store, "My List".to_string(), None, None)
            .await
            .unwrap();
        assert_eq!(ml.id, "my-list");
        let index = store.load_mod_list_index().await.unwrap();
        assert_eq!(index.mod_lists.len(), 1);
        assert_eq!(index.current_mod_list_id, Some("my-list".to_string()));
    }

    #[tokio::test]
    async fn create_mod_list_with_base_mod_list_copies_entries_and_note() {
        let store = InMemoryStore::new();
        let base = sample_structured_mod_list("source", "Source");
        let ml = create_mod_list(&store, "Copy".to_string(), Some(base.clone()), None)
            .await
            .unwrap();
        assert_eq!(ml.id, "copy");
        assert_eq!(ml.name, "Copy");
        assert_eq!(ml.note, base.note);
        assert_eq!(ml.entries.len(), base.entries.len());
        assert!(matches!(ml.entries[1], ModListEntry::Group { .. }));
        assert!(matches!(ml.entries[2], ModListEntry::Separator { .. }));
        assert_eq!(ml.active_mods, vec!["a".to_string(), "b".to_string()]);
        let index = store.load_mod_list_index().await.unwrap();
        assert_eq!(index.current_mod_list_id, Some("copy".to_string()));
    }

    #[tokio::test]
    async fn create_mod_list_with_base_mod_list_generates_unique_id() {
        let store = InMemoryStore::new();
        create_mod_list(&store, "Base".to_string(), None, None)
            .await
            .unwrap();
        let base = sample_mod_list("base", "Base");
        let ml = create_mod_list(&store, "Base".to_string(), Some(base), None)
            .await
            .unwrap();
        assert_eq!(ml.id, "base-2");
        let index = store.load_mod_list_index().await.unwrap();
        assert_eq!(index.mod_lists.len(), 2);
    }

    #[tokio::test]
    async fn save_mod_list_updates_name_in_index() {
        let store = InMemoryStore::new();
        let ml = create_mod_list(&store, "Original".to_string(), None, None)
            .await
            .unwrap();
        let updated = ModList {
            name: "Renamed".to_string(),
            ..ml
        };
        let saved = save_mod_list(&store, updated).await.unwrap();
        assert_eq!(saved.name, "Renamed");
        let index = store.load_mod_list_index().await.unwrap();
        assert_eq!(index.mod_lists[0].name, "Renamed");
    }

    #[tokio::test]
    async fn delete_mod_list_removes_from_index_and_store() {
        let store = InMemoryStore::new();
        create_mod_list(&store, "To Delete".to_string(), None, None)
            .await
            .unwrap();
        let index = delete_mod_list(&store, "to-delete").await.unwrap();
        assert!(index.mod_lists.is_empty());
        assert!(store.mod_lists.lock().unwrap().get("to-delete").is_none());
    }

    #[tokio::test]
    async fn set_current_mod_list_changes_current() {
        let store = InMemoryStore::new();
        create_mod_list(&store, "First".to_string(), None, None)
            .await
            .unwrap();
        create_mod_list(&store, "Second".to_string(), None, None)
            .await
            .unwrap();
        let ml = set_current_mod_list(&store, "first").await.unwrap();
        assert_eq!(ml.id, "first");
        let index = store.load_mod_list_index().await.unwrap();
        assert_eq!(index.current_mod_list_id, Some("first".to_string()));
    }

    #[tokio::test]
    async fn set_current_mod_list_errors_on_missing() {
        let store = InMemoryStore::new();
        let result = set_current_mod_list(&store, "nope").await;
        assert!(matches!(result, Err(LibraryError::NotFound(_))));
    }

    #[tokio::test]
    async fn import_mod_list_assigns_unique_id() {
        let store = InMemoryStore::new();
        let ml = sample_mod_list("imported", "Imported");
        let result = import_mod_list(&store, ml).await.unwrap();
        assert_eq!(result.id, "imported");
        let index = store.load_mod_list_index().await.unwrap();
        assert_eq!(index.mod_lists.len(), 1);
    }
}
