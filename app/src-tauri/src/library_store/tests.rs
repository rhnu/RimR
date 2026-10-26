use rimr_core::{Alias, ModIdentity, ModListEntry};

use super::*;

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
