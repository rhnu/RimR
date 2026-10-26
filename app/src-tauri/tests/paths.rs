use rimr_tauri_lib::state::AppState;
use tempfile::tempdir;

#[test]
fn configured_paths_are_loaded_from_config_file() {
    let dir = tempdir().unwrap();
    let game_dir = dir.path().join("game");
    let game_data_dir = dir.path().join("data");
    let local_mods_dir = dir.path().join("mods");
    let workshop_mods_dir = dir.path().join("workshop");
    let rimr_data_dir = dir.path().join("RimR");

    std::fs::create_dir_all(&rimr_data_dir).unwrap();

    let config_path = dir.path().join("config.json");
    std::fs::write(
        &config_path,
        serde_json::to_string(&serde_json::json!({
            "formatVersion": 4,
            "paths": {
                "gameDir": game_dir,
                "gameDataDir": game_data_dir,
                "localModsDir": local_mods_dir,
                "workshopModsDir": workshop_mods_dir,
                "rimrDataDir": rimr_data_dir
            }
        }))
        .unwrap(),
    )
    .unwrap();

    let state = AppState::new(config_path).unwrap();
    let config = state.get_config().unwrap();

    assert_eq!(config.paths.game_dir, Some(game_dir));
    assert_eq!(config.paths.game_data_dir, Some(game_data_dir));
    assert_eq!(config.paths.local_mods_dir, Some(local_mods_dir));
    assert_eq!(config.paths.workshop_mods_dir, Some(workshop_mods_dir));
    assert_eq!(config.paths.rimr_data_dir, Some(rimr_data_dir));
}

#[test]
fn rimr_data_dir_falls_back_to_default_when_not_configured() {
    let dir = tempdir().unwrap();
    let config_path = dir.path().join("config.json");
    std::fs::write(
        &config_path,
        serde_json::to_string(&serde_json::json!({
            "formatVersion": 3,
            "paths": {}
        }))
        .unwrap(),
    )
    .unwrap();

    let state = AppState::new(config_path).unwrap();
    let config = state.get_config().unwrap();

    // When not configured, the default data dir is used.
    assert!(config.paths.rimr_data_dir.is_some());
}
