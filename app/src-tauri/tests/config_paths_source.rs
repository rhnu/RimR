use rimr_core::{ModSource, PackageId, SourceKind};
use rimr_tauri_lib::app_config::{
    AppConfig, Locale, PathsConfig, Theme, UiConfig, load_config_from_file, save_config_to_file,
};
use rimr_tauri_lib::paths::{PathDetectionInput, Platform, autodetect_paths_from};
use rimr_tauri_lib::source::{FsModSource, SourceRoots};
use std::path::{Path, PathBuf};

fn write_file(path: &Path, text: &str) {
    std::fs::create_dir_all(path.parent().expect("file has parent")).unwrap();
    std::fs::write(path, text).unwrap();
}

fn sample_paths() -> PathsConfig {
    PathsConfig {
        game_dir: Some(PathBuf::from("C:/Steam/steamapps/common/RimWorld")),
        game_data_dir: Some(PathBuf::from(
            "C:/Users/test/AppData/LocalLow/Ludeon Studios/RimWorld by Ludeon Studios",
        )),
        local_mods_dir: Some(PathBuf::from("C:/Steam/steamapps/common/RimWorld/Mods")),
        workshop_mods_dir: Some(PathBuf::from("C:/Steam/steamapps/workshop/content/294100")),
        rimr_data_dir: Some(PathBuf::from("D:/RimR")),
    }
}

#[test]
fn app_config_roundtrips_camel_case_json() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("config.json");
    let config = AppConfig {
        format_version: 4,
        paths: sample_paths(),
        ui: UiConfig {
            theme: Some(Theme::Dark),
            locale: Some(Locale::ZhCn),
        },
    };

    save_config_to_file(&path, &config).unwrap();
    let raw = std::fs::read_to_string(&path).unwrap();
    assert!(raw.contains("formatVersion"));
    assert!(raw.contains("rimrDataDir"));
    assert!(raw.contains("workshopModsDir"));
    assert!(raw.contains("\"paths\""));
    assert!(raw.contains("\"ui\""));
    assert!(raw.contains("\"theme\": \"dark\""));
    assert!(raw.contains("\"locale\": \"zh-CN\""));
    assert!(!raw.contains("lastBackupDir"));

    let loaded = load_config_from_file(&path).unwrap();
    assert_eq!(loaded, config);
}

#[test]
fn missing_app_config_uses_default_version() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("missing.json");

    let loaded = load_config_from_file(&path).unwrap();

    assert_eq!(loaded.format_version, 4);
    assert!(loaded.paths.game_dir.is_none());
    assert!(loaded.paths.game_data_dir.is_none());
    assert!(loaded.paths.rimr_data_dir.is_some());
    assert_eq!(
        loaded
            .paths
            .rimr_data_dir
            .as_ref()
            .and_then(|path| path.file_name()),
        Some(std::ffi::OsStr::new("RimR"))
    );
    assert_eq!(loaded.ui.theme, None);
    assert_eq!(loaded.ui.locale, None);
}

#[test]
fn app_config_default_uses_documents_rimr_data_dir() {
    let config = AppConfig::default();

    assert!(config.paths.rimr_data_dir.is_some());
    let data_dir = config.paths.rimr_data_dir.unwrap();
    assert_eq!(data_dir.file_name(), Some(std::ffi::OsStr::new("RimR")));
    assert!(
        data_dir
            .components()
            .any(|component| component.as_os_str() == std::ffi::OsStr::new("Documents"))
    );
}

#[test]
fn legacy_flat_config_is_reinterpreted_with_default_sections() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("legacy.json");
    std::fs::write(
        &path,
        r#"{"formatVersion":2,"gameDir":"C:/RimWorld","configDir":"C:/Config","rimrDataDir":"D:/RimR"}"#,
    )
    .unwrap();

    let loaded = load_config_from_file(&path).unwrap();

    assert_eq!(loaded.format_version, 4);
    assert!(loaded.paths.game_dir.is_none());
    assert!(loaded.paths.rimr_data_dir.is_some());
    assert_eq!(loaded.ui.theme, None);
    assert_eq!(loaded.ui.locale, None);
}

#[test]
fn linux_autodetect_prefers_proton_config_and_derives_mod_dirs() {
    let dir = tempfile::tempdir().unwrap();
    let home = dir.path().join("home");
    let steam = home.join(".steam/steam");
    let game = steam.join("steamapps/common/RimWorld");
    let workshop = steam.join("steamapps/workshop/content/294100");
    let proton_config = steam.join(
        "steamapps/compatdata/294100/pfx/drive_c/users/steamuser/AppData/LocalLow/Ludeon Studios/RimWorld by Ludeon Studios",
    );
    std::fs::create_dir_all(&game).unwrap();
    std::fs::create_dir_all(&workshop).unwrap();
    std::fs::create_dir_all(&proton_config).unwrap();

    let detected = autodetect_paths_from(PathDetectionInput {
        platform: Platform::Linux,
        home_dir: home.clone(),
        steam_roots: vec![steam.clone()],
        rimworld_app_dir: Some(game.clone()),
    })
    .unwrap();

    assert_eq!(detected.game_dir, game);
    assert_eq!(detected.game_data_dir, proton_config);
    assert_eq!(detected.local_mods_dir, detected.game_dir.join("Mods"));
    assert_eq!(detected.workshop_mods_dir, workshop);
    assert!(detected.warnings.is_empty());
}

#[test]
fn windows_autodetect_falls_back_to_standard_paths() {
    let dir = tempfile::tempdir().unwrap();
    let home = dir.path().join("Users/test");
    let steam = dir.path().join("Program Files (x86)/Steam");

    let detected = autodetect_paths_from(PathDetectionInput {
        platform: Platform::Windows,
        home_dir: home.clone(),
        steam_roots: vec![steam.clone()],
        rimworld_app_dir: None,
    })
    .unwrap();

    assert_eq!(detected.game_dir, steam.join("steamapps/common/RimWorld"));
    assert_eq!(
        detected.game_data_dir,
        home.join("AppData/LocalLow/Ludeon Studios/RimWorld by Ludeon Studios")
    );
    assert_eq!(
        detected.workshop_mods_dir,
        steam.join("steamapps/workshop/content/294100")
    );
}

#[tokio::test]
async fn fs_mod_source_discovers_reads_and_writes_rimworld_files() {
    let dir = tempfile::tempdir().unwrap();
    let game = dir.path().join("RimWorld");
    let data_core = game.join("Data/Core");
    let local_mod = game.join("Mods/LocalMod");
    let workshop_mod = dir.path().join("workshop/12345");
    let config_dir = dir.path().join("Config");

    write_file(
        &data_core.join("About/About.xml"),
        "<ModMetaData><packageId>Ludeon.RimWorld</packageId></ModMetaData>",
    );
    write_file(
        &local_mod.join("About/About.xml"),
        "<ModMetaData><packageId>Local.Mod</packageId></ModMetaData>",
    );
    write_file(
        &workshop_mod.join("About/About.xml"),
        "<ModMetaData><packageId>Workshop.Mod</packageId></ModMetaData>",
    );
    write_file(
        &config_dir.join("ModsConfig.xml"),
        r#"<?xml version="1.0" encoding="utf-8"?><ModsConfigData><version>1.5</version><activeMods><li>ludeon.rimworld</li></activeMods><knownExpansions /></ModsConfigData>"#,
    );

    let source = FsModSource::new(SourceRoots {
        game_dir: game.clone(),
        data_dir: dir.path().to_path_buf(),
        local_mods_dir: Some(game.join("Mods")),
        workshop_mods_dir: Some(dir.path().join("workshop")),
    });

    let entries = source.discover_mods().await.unwrap();
    assert_eq!(entries.len(), 3);
    assert!(
        entries
            .iter()
            .any(|entry| entry.kind == SourceKind::Expansion)
    );
    assert!(entries.iter().any(|entry| entry.kind == SourceKind::Local));
    assert!(
        entries
            .iter()
            .any(|entry| entry.kind == SourceKind::Workshop)
    );

    let local = entries
        .iter()
        .find(|entry| entry.key.as_str().ends_with("LocalMod"))
        .unwrap();
    let about = source.read_about_xml(&local.key).await.unwrap().unwrap();
    assert!(
        about.path.ends_with("LocalMod\\About\\About.xml")
            || about.path.ends_with("LocalMod/About/About.xml")
    );
    assert!(
        String::from_utf8(about.bytes)
            .unwrap()
            .contains("Local.Mod")
    );

    let config = source.read_mods_config().await.unwrap().unwrap();
    assert!(config.path.ends_with("ModsConfig.xml"));
    assert!(
        String::from_utf8(config.bytes)
            .unwrap()
            .contains("ludeon.rimworld")
    );

    source
        .write_mods_config(
            r#"<ModsConfigData><version>1.5</version><activeMods><li>local.mod</li></activeMods><knownExpansions /></ModsConfigData>"#
                .as_bytes()
                .to_vec(),
        )
        .await
        .unwrap();
    let written = std::fs::read_to_string(config_dir.join("ModsConfig.xml")).unwrap();
    assert!(written.contains("local.mod"));
}

#[tokio::test]
async fn fs_mod_source_integrates_with_core_scan() {
    let dir = tempfile::tempdir().unwrap();
    let game = dir.path().join("RimWorld");
    let local_mod = game.join("Mods/LocalMod");
    let config_dir = dir.path().join("Config");
    write_file(
        &local_mod.join("About/About.xml"),
        "<ModMetaData><packageId>Local.Mod</packageId><name>Local Mod</name></ModMetaData>",
    );
    std::fs::create_dir_all(&config_dir).unwrap();

    let source = FsModSource::new(SourceRoots {
        game_dir: game.clone(),
        data_dir: dir.path().to_path_buf(),
        local_mods_dir: Some(game.join("Mods")),
        workshop_mods_dir: None,
    });

    let report = rimr_core::scan_mod_metadata(&source, &rimr_core::ScanOpts::default())
        .await
        .unwrap();

    assert!(report.catalog.contains(&PackageId::new("local.mod")));
    assert!(report.diagnostics.is_empty());
}
