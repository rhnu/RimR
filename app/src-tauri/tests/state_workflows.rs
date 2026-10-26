use std::path::Path;

use rimr_tauri_lib::{
    app_config::{AppConfig, PathsConfig, Theme, UiConfig},
    dto::{
        CommandErrorCode, LoadModFolderSizeRequest, LoadModPreviewRequest,
        ValidateActiveOrderRequest,
    },
    state::AppState,
};

#[path = "state_workflows/cleanup.rs"]
mod cleanup;
#[path = "state_workflows/library.rs"]
mod library;
#[path = "state_workflows/mod_files.rs"]
mod mod_files;

fn write_file(path: &Path, text: &str) {
    std::fs::create_dir_all(path.parent().expect("fixture file has a parent directory"))
        .expect("fixture directory should be created");
    std::fs::write(path, text).expect("fixture text file should be written");
}

fn write_bytes(path: &Path, bytes: &[u8]) {
    std::fs::create_dir_all(path.parent().expect("fixture file has a parent directory"))
        .expect("fixture directory should be created");
    std::fs::write(path, bytes).expect("fixture binary file should be written");
}

fn sample_state() -> (tempfile::TempDir, AppState) {
    let dir = tempfile::tempdir().expect("fixture workspace should be created");
    let game = dir.path().join("RimWorld");
    let config_dir = dir.path().join("Config");
    let local_mod = game.join("Mods/LocalMod");
    let dep_mod = game.join("Mods/DependencyMod");

    write_file(
        &local_mod.join("About/About.xml"),
        r"<ModMetaData>
  <packageId>local.mod</packageId>
  <name>Local Mod</name>
  <loadAfter><li>dependency.mod</li></loadAfter>
</ModMetaData>",
    );
    write_bytes(
        &local_mod.join("About/Preview.png"),
        &[
            137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1,
            8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 156, 99, 248, 15, 4,
            0, 9, 251, 3, 253, 167, 45, 186, 44, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
        ],
    );
    write_file(
        &dep_mod.join("About/About.xml"),
        r"<ModMetaData><packageId>dependency.mod</packageId><name>Dependency Mod</name></ModMetaData>",
    );
    write_file(
        &config_dir.join("ModsConfig.xml"),
        r#"<?xml version="1.0" encoding="utf-8"?>
<ModsConfigData>
  <version>1.5.4104 rev435</version>
  <activeMods>
    <li>local.mod</li>
    <li>dependency.mod</li>
  </activeMods>
  <knownExpansions>
    <li>ludeon.rimworld.royalty</li>
  </knownExpansions>
</ModsConfigData>"#,
    );

    let state = AppState::new(dir.path().join("rimr-config.json"))
        .expect("fixture application state should initialize");
    state
        .replace_config(AppConfig {
            format_version: 4,
            paths: PathsConfig {
                game_dir: Some(game.clone()),
                game_data_dir: Some(dir.path().to_path_buf()),
                local_mods_dir: Some(game.join("Mods")),
                workshop_mods_dir: None,
                rimr_data_dir: Some(dir.path().join("RimR")),
            },
            ui: UiConfig::default(),
        })
        .expect("fixture source paths should be saved");

    (dir, state)
}

#[tokio::test]
async fn scan_requires_configured_paths() {
    let dir = tempfile::tempdir().unwrap();
    let state = AppState::new(dir.path().join("rimr-config.json")).unwrap();

    let error = state.rebuild_mod_catalog().await.unwrap_err();

    assert_eq!(error.code, CommandErrorCode::PathNotConfigured);
    assert!(error.message.contains("gameDir"));
}

#[tokio::test]
async fn replace_config_preserves_session_cache_when_only_ui_changes() {
    let (dir, state) = sample_state();

    state.rebuild_mod_catalog().await.unwrap();
    state.load_active_list().await.unwrap();

    let mut config = state.get_config().unwrap();
    config.ui = UiConfig {
        theme: Some(Theme::Dark),
        locale: Some(rimr_tauri_lib::app_config::Locale::ZhCn),
    };
    let saved = state.replace_config(config.clone()).unwrap();
    assert_eq!(saved.ui.theme, Some(Theme::Dark));

    // Re-scan should still see the cached catalog without touching the disk:
    // the point is that replace_config did NOT wipe the in-memory catalog.
    let workspace = state.load_library().await.unwrap();
    assert_eq!(workspace.current_mod_list.active_mods.len(), 2);
    assert!(dir.path().join("RimR/mod-lists/index.json").exists());
}

#[tokio::test]
async fn replace_config_clears_session_cache_when_paths_change() {
    let (dir, state) = sample_state();
    state.rebuild_mod_catalog().await.unwrap();
    state.load_active_list().await.unwrap();

    // Sanity: catalog is cached, so validation works pre-replace.
    state
        .validate_active_order(ValidateActiveOrderRequest {
            active_mods: vec!["local.mod".to_string()],
        })
        .unwrap();

    let mut config = state.get_config().unwrap();
    config.paths.workshop_mods_dir = Some(dir.path().join("workshop"));
    state.replace_config(config).unwrap();

    // After a paths change, the cached catalog must be gone, so validation
    // fails with StateMissing ("catalog is not loaded").
    let result = state.validate_active_order(ValidateActiveOrderRequest {
        active_mods: vec!["local.mod".to_string()],
    });
    assert!(matches!(result, Err(ref e) if e.code == CommandErrorCode::StateMissing));
}

#[tokio::test]
async fn clear_session_cache_wipes_catalog_and_rebuilds_on_rescan() {
    let (_dir, state) = sample_state();
    state.rebuild_mod_catalog().await.unwrap();
    state.load_active_list().await.unwrap();

    state
        .validate_active_order(ValidateActiveOrderRequest {
            active_mods: vec!["local.mod".to_string()],
        })
        .unwrap();

    state.clear_session_cache().unwrap();
    let result = state.validate_active_order(ValidateActiveOrderRequest {
        active_mods: vec!["local.mod".to_string()],
    });
    assert!(matches!(result, Err(ref e) if e.code == CommandErrorCode::StateMissing));

    state.rebuild_mod_catalog().await.unwrap();
    state
        .validate_active_order(ValidateActiveOrderRequest {
            active_mods: vec!["local.mod".to_string()],
        })
        .unwrap();
}

#[tokio::test]
async fn clear_session_cache_wipes_mod_file_info_indexes_and_caches() {
    let (_dir, state) = sample_state();
    let scan = state.rebuild_mod_catalog().await.unwrap();
    let local = scan
        .catalog
        .mods
        .iter()
        .find(|metadata| metadata.package_id == "local.mod")
        .expect("local mod should scan");

    state
        .load_mod_preview(LoadModPreviewRequest {
            source_key: local.source_key.clone(),
        })
        .await
        .unwrap();
    state
        .load_mod_folder_size(LoadModFolderSizeRequest {
            source_key: local.source_key.clone(),
        })
        .await
        .unwrap();

    state.clear_session_cache().unwrap();

    let preview_error = state
        .load_mod_preview(LoadModPreviewRequest {
            source_key: local.source_key.clone(),
        })
        .await
        .unwrap_err();
    let folder_error = state
        .load_mod_folder_size(LoadModFolderSizeRequest {
            source_key: local.source_key.clone(),
        })
        .await
        .unwrap_err();

    assert_eq!(preview_error.code, CommandErrorCode::StateMissing);
    assert_eq!(folder_error.code, CommandErrorCode::StateMissing);
}
