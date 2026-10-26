use std::{collections::HashMap, sync::Mutex};

use async_trait::async_trait;

use super::*;
use crate::domain::{
    GroupChild, LibrarySettings, ModList, ModListEntry, ModListIndex, ModListSummary,
};

/// In-memory `LibraryStore` for testing.
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
    assert_eq!(index.mod_lists, [] as [crate::ModListSummary; 0]);
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
