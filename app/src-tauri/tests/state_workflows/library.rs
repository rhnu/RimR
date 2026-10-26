use rimr_tauri_lib::dto::{
    ApplyModListRequest, CreateModListRequest, ExportGameConfigBackupRequest,
    ExportModListFileRequest, ImportLibrarySettingsFileRequest, ImportModListFileRequest,
    LibrarySettingsDto, ModIdentityDto, ModListEntryDto, ModListGroupChildDto, ModListSummaryDto,
    RimrFileKind, SaveLibrarySettingsRequest, SaveModListRequest, ValidateActiveOrderRequest,
};

use super::sample_state;

fn grouped_mod_list(id: String) -> rimr_tauri_lib::dto::ModListDto {
    rimr_tauri_lib::dto::ModListDto {
        format_version: 2,
        id,
        name: "Grouped".to_string(),
        note: Some("kept in RimR only".to_string()),
        entries: vec![
            ModListEntryDto::Separator {
                id: "sep-core".to_string(),
                title: "Core".to_string(),
                note: None,
                color: Some("#888888".to_string()),
            },
            ModListEntryDto::Group {
                id: "grp-required".to_string(),
                name: "Required".to_string(),
                collapsed: false,
                entries: vec![
                    ModListGroupChildDto {
                        id: "mod-dependency".to_string(),
                        active: true,
                        identity: ModIdentityDto {
                            package_id: "dependency.mod".to_string(),
                            source_kind: None,
                            source_key: None,
                            steam_app_id: None,
                        },
                    },
                    ModListGroupChildDto {
                        id: "mod-local".to_string(),
                        active: true,
                        identity: ModIdentityDto {
                            package_id: "local.mod".to_string(),
                            source_kind: None,
                            source_key: None,
                            steam_app_id: None,
                        },
                    },
                ],
            },
        ],
        active_mods: vec!["dependency.mod".to_string(), "local.mod".to_string()],
    }
}

#[tokio::test]
async fn workspace_initializes_default_mod_list_and_applies_mod_list_order() {
    let (dir, state) = sample_state();

    state.rebuild_mod_catalog().await.unwrap();
    state.load_active_list().await.unwrap();

    let workspace = state.load_library().await.unwrap();
    assert_eq!(workspace.settings.format_version, 2);
    assert_eq!(
        workspace.mod_lists_index.mod_lists,
        vec![ModListSummaryDto {
            id: "default".to_string(),
            name: "Default".to_string(),
        }]
    );
    assert_eq!(
        workspace.mod_lists_index.current_mod_list_id,
        Some("default".to_string())
    );
    assert_eq!(workspace.current_mod_list.id, "default");
    assert_eq!(workspace.current_mod_list.entries.len(), 2);
    assert_eq!(
        workspace.current_mod_list.active_mods,
        vec!["local.mod".to_string(), "dependency.mod".to_string()]
    );

    let settings = state
        .save_library_settings(SaveLibrarySettingsRequest {
            settings: LibrarySettingsDto {
                format_version: 2,
                aliases: vec![rimr_tauri_lib::dto::DisplayAliasDto {
                    identity: ModIdentityDto {
                        package_id: "local.mod".to_string(),
                        source_kind: Some(rimr_tauri_lib::dto::SourceKindDto::Local),
                        source_key: Some("local:LocalMod".to_string()),
                        steam_app_id: None,
                    },
                    display_alias: "Local Alias".to_string(),
                }],
                tag_defs: Vec::new(),
                mod_tags: Vec::new(),
            },
        })
        .await
        .unwrap();
    assert_eq!(settings.aliases[0].display_alias, "Local Alias");

    let mod_list = state
        .create_mod_list(CreateModListRequest {
            name: "Grouped".to_string(),
            base_mod_list: None,
        })
        .await
        .unwrap();

    let saved = state
        .save_mod_list(SaveModListRequest {
            mod_list: grouped_mod_list(mod_list.id),
        })
        .await
        .unwrap();
    assert_eq!(
        saved.active_mods,
        vec!["dependency.mod".to_string(), "local.mod".to_string()]
    );

    state
        .apply_mod_list_to_game(ApplyModListRequest { mod_list: saved })
        .await
        .unwrap();

    let written = std::fs::read_to_string(dir.path().join("Config/ModsConfig.xml")).unwrap();
    assert!(written.find("dependency.mod").unwrap() < written.find("local.mod").unwrap());
    assert!(!written.contains("Core"));

    assert!(dir.path().join("RimR/settings.json").exists());
    assert!(dir.path().join("RimR/mod-lists/index.json").exists());
    assert!(
        dir.path()
            .join("RimR/mod-lists")
            .join("grouped.json")
            .exists()
    );
}

#[tokio::test]
async fn state_scans_loads_validates_saves_and_exports() {
    let (dir, state) = sample_state();

    let scan = state.rebuild_mod_catalog().await.unwrap();
    assert_eq!(scan.catalog.mods.len(), 2);
    assert!(scan.diagnostics.is_empty());

    let active = state.load_active_list().await.unwrap();
    assert_eq!(active.active_mods, vec!["local.mod", "dependency.mod"]);
    assert_eq!(active.config.version, "1.5.4104 rev435");

    let validation = state
        .validate_active_order(ValidateActiveOrderRequest {
            active_mods: vec!["local.mod".to_string(), "dependency.mod".to_string()],
        })
        .unwrap();
    assert_eq!(validation.report.warnings.len(), 1);
    assert_eq!(validation.report.errors.len(), 0);

    let workspace = state.load_library().await.unwrap();
    let saved = state
        .save_mod_list(SaveModListRequest {
            mod_list: rimr_tauri_lib::dto::ModListDto {
                entries: vec![
                    ModListEntryDto::Mod {
                        id: "mod-dependency".to_string(),
                        active: true,
                        identity: ModIdentityDto {
                            package_id: "dependency.mod".to_string(),
                            source_kind: None,
                            source_key: None,
                            steam_app_id: None,
                        },
                    },
                    ModListEntryDto::Mod {
                        id: "mod-local".to_string(),
                        active: true,
                        identity: ModIdentityDto {
                            package_id: "local.mod".to_string(),
                            source_kind: None,
                            source_key: None,
                            steam_app_id: None,
                        },
                    },
                ],
                active_mods: vec!["dependency.mod".to_string(), "local.mod".to_string()],
                ..workspace.current_mod_list
            },
        })
        .await
        .unwrap();
    state
        .apply_mod_list_to_game(ApplyModListRequest { mod_list: saved })
        .await
        .unwrap();
    let written = std::fs::read_to_string(dir.path().join("Config/ModsConfig.xml")).unwrap();
    assert!(written.find("dependency.mod").unwrap() < written.find("local.mod").unwrap());

    let backup_path = dir.path().join("backup.rimr.json");
    let backup = state
        .export_game_config_backup(ExportGameConfigBackupRequest {
            note: Some("test backup".to_string()),
            output_path: Some(backup_path.clone()),
        })
        .await
        .unwrap();
    assert_eq!(backup.file.active_mods, vec!["dependency.mod", "local.mod"]);
    assert!(backup.json.contains("test backup"));
    assert!(backup_path.exists());
}

#[tokio::test]
async fn apply_mod_list_uses_current_draft_and_skips_missing_packages() {
    let (dir, state) = sample_state();
    state.rebuild_mod_catalog().await.unwrap();
    state.load_active_list().await.unwrap();
    let workspace = state.load_library().await.unwrap();

    let applied = state
        .apply_mod_list_to_game(ApplyModListRequest {
            mod_list: rimr_tauri_lib::dto::ModListDto {
                entries: vec![
                    ModListEntryDto::Mod {
                        id: "mod-dependency".to_string(),
                        active: true,
                        identity: ModIdentityDto {
                            package_id: "dependency.mod".to_string(),
                            source_kind: None,
                            source_key: None,
                            steam_app_id: None,
                        },
                    },
                    ModListEntryDto::Mod {
                        id: "mod-missing".to_string(),
                        active: true,
                        identity: ModIdentityDto {
                            package_id: "missing.mod".to_string(),
                            source_kind: None,
                            source_key: None,
                            steam_app_id: None,
                        },
                    },
                    ModListEntryDto::Mod {
                        id: "mod-local".to_string(),
                        active: false,
                        identity: ModIdentityDto {
                            package_id: "local.mod".to_string(),
                            source_kind: None,
                            source_key: None,
                            steam_app_id: None,
                        },
                    },
                ],
                active_mods: vec![
                    "dependency.mod".to_string(),
                    "missing.mod".to_string(),
                    "local.mod".to_string(),
                ],
                ..workspace.current_mod_list
            },
        })
        .await
        .unwrap();

    assert_eq!(applied.active_mods, vec!["dependency.mod"]);
    assert_eq!(applied.skipped_missing_packages, vec!["missing.mod"]);
    let written = std::fs::read_to_string(dir.path().join("Config/ModsConfig.xml")).unwrap();
    assert!(written.contains("dependency.mod"));
    assert!(!written.contains("local.mod"));
    assert!(!written.contains("missing.mod"));
}

#[tokio::test]
async fn state_exports_and_imports_mod_list_files_with_group_entries() {
    let (dir, state) = sample_state();
    state.rebuild_mod_catalog().await.unwrap();
    state.load_active_list().await.unwrap();
    let workspace = state.load_library().await.unwrap();

    let mod_list_path = dir.path().join("mod-list.rimr.json");
    let exported = state
        .export_mod_list_file(ExportModListFileRequest {
            mod_list_id: Some(workspace.current_mod_list.id.clone()),
            output_path: Some(mod_list_path.clone()),
        })
        .await
        .unwrap();

    assert_eq!(exported.file.kind, RimrFileKind::ModList);
    assert_eq!(exported.file.mod_list.id, workspace.current_mod_list.id);
    assert!(mod_list_path.exists());

    let imported = state
        .import_mod_list_file(ImportModListFileRequest {
            input_path: Some(mod_list_path),
            json: None,
        })
        .await
        .unwrap();

    assert_ne!(imported.id, workspace.current_mod_list.id);
    assert_eq!(imported.name, workspace.current_mod_list.name);
    assert_eq!(imported.entries, workspace.current_mod_list.entries);
    assert_eq!(imported.active_mods, workspace.current_mod_list.active_mods);
}

#[tokio::test]
async fn state_imports_library_settings_files_by_merging_alias_identities() {
    let (_dir, state) = sample_state();
    state.rebuild_mod_catalog().await.unwrap();
    state.load_active_list().await.unwrap();
    state.load_library().await.unwrap();

    let identity = ModIdentityDto {
        package_id: "local.mod".to_string(),
        source_kind: Some(rimr_tauri_lib::dto::SourceKindDto::Local),
        source_key: Some("local:LocalMod".to_string()),
        steam_app_id: None,
    };
    state
        .save_library_settings(SaveLibrarySettingsRequest {
            settings: LibrarySettingsDto {
                format_version: 2,
                aliases: vec![
                    rimr_tauri_lib::dto::DisplayAliasDto {
                        identity: identity.clone(),
                        display_alias: "Old Alias".to_string(),
                    },
                    rimr_tauri_lib::dto::DisplayAliasDto {
                        identity: ModIdentityDto {
                            package_id: "dependency.mod".to_string(),
                            source_kind: None,
                            source_key: None,
                            steam_app_id: None,
                        },
                        display_alias: "Dependency Alias".to_string(),
                    },
                ],
                tag_defs: Vec::new(),
                mod_tags: Vec::new(),
            },
        })
        .await
        .unwrap();

    let imported_json = serde_json::json!({
        "kind": "librarySettings",
        "formatVersion": 2,
        "exportedAt": "2026-06-18T00:00:00Z",
        "settings": {
            "formatVersion": 2,
            "aliases": [
                {
                    "identity": identity,
                    "displayAlias": "Imported Alias"
                }
            ]
        }
    })
    .to_string();

    let merged = state
        .import_library_settings_file(ImportLibrarySettingsFileRequest {
            input_path: None,
            json: Some(imported_json),
        })
        .await
        .unwrap();

    assert_eq!(merged.aliases.len(), 2);
    assert!(
        merged
            .aliases
            .iter()
            .any(|alias| alias.identity.package_id == "local.mod"
                && alias.display_alias == "Imported Alias")
    );
    assert!(
        merged
            .aliases
            .iter()
            .any(|alias| alias.identity.package_id == "dependency.mod"
                && alias.display_alias == "Dependency Alias")
    );
}

#[tokio::test]
async fn state_imports_library_settings_files_by_merging_tags() {
    let (_dir, state) = sample_state();
    state.rebuild_mod_catalog().await.unwrap();
    state.load_active_list().await.unwrap();
    state.load_library().await.unwrap();

    let identity = ModIdentityDto {
        package_id: "local.mod".to_string(),
        source_kind: Some(rimr_tauri_lib::dto::SourceKindDto::Local),
        source_key: Some("local:LocalMod".to_string()),
        steam_app_id: None,
    };

    state
        .save_library_settings(SaveLibrarySettingsRequest {
            settings: LibrarySettingsDto {
                format_version: 2,
                aliases: vec![rimr_tauri_lib::dto::DisplayAliasDto {
                    identity: identity.clone(),
                    display_alias: "Local Alias".to_string(),
                }],
                tag_defs: vec![
                    rimr_tauri_lib::dto::TagDefDto {
                        id: "fav".to_string(),
                        name: "Local Favorite".to_string(),
                        color: Some("#ff0000".to_string()),
                    },
                    rimr_tauri_lib::dto::TagDefDto {
                        id: "core".to_string(),
                        name: "Core".to_string(),
                        color: None,
                    },
                ],
                mod_tags: vec![rimr_tauri_lib::dto::ModTagBindingDto {
                    identity: identity.clone(),
                    tag_ids: vec!["fav".to_string()],
                }],
            },
        })
        .await
        .unwrap();

    let imported_json = serde_json::json!({
        "kind": "librarySettings",
        "formatVersion": 2,
        "exportedAt": "2026-06-22T00:00:00Z",
        "settings": {
            "formatVersion": 2,
            "aliases": [],
            "tagDefs": [
                {
                    "id": "fav",
                    "name": "Imported Favorite",
                    "color": "#00ff00"
                },
                {
                    "id": "new",
                    "name": "New Tag"
                }
            ],
            "modTags": [
                {
                    "identity": identity,
                    "tagIds": ["imported"]
                }
            ]
        }
    })
    .to_string();

    let merged = state
        .import_library_settings_file(ImportLibrarySettingsFileRequest {
            input_path: None,
            json: Some(imported_json),
        })
        .await
        .unwrap();

    assert_eq!(merged.aliases.len(), 1);
    assert_eq!(merged.aliases[0].display_alias, "Local Alias");

    assert_eq!(merged.tag_defs.len(), 3);
    let fav = merged
        .tag_defs
        .iter()
        .find(|t| t.id == "fav")
        .expect("fav tag def should survive merge");
    assert_eq!(fav.name, "Imported Favorite");
    assert_eq!(fav.color.as_deref(), Some("#00ff00"));
    let core = merged
        .tag_defs
        .iter()
        .find(|t| t.id == "core")
        .expect("core tag def should be kept");
    assert_eq!(core.name, "Core");
    assert_eq!(core.color, None);
    let new = merged
        .tag_defs
        .iter()
        .find(|t| t.id == "new")
        .expect("new tag def should be added");
    assert_eq!(new.name, "New Tag");

    assert_eq!(merged.mod_tags.len(), 1);
    assert_eq!(merged.mod_tags[0].tag_ids, vec!["imported".to_string()]);
}
