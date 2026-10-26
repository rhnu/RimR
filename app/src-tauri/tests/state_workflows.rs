use rimr_tauri_lib::app_config::{AppConfig, PathsConfig, Theme, UiConfig};
use rimr_tauri_lib::dto::{
    ApplyModListRequest, CleanModsRequest, CommandErrorCode, CreateModListRequest,
    ExportGameConfigBackupRequest, ExportModListFileRequest, ImportLibrarySettingsFileRequest,
    ImportModListFileRequest, LibrarySettingsDto, LoadModFolderSizeRequest, LoadModPreviewRequest,
    ModCleanupKindDto, ModCleanupPreviewRequest, ModIdentityDto, ModListEntryDto,
    ModListGroupChildDto, ModListSummaryDto, OpenSteamWorkshopPageRequest, RimrFileKind,
    SaveLibrarySettingsRequest, SaveModListRequest, SteamWorkshopOpenTarget,
    ValidateActiveOrderRequest,
};
use rimr_tauri_lib::state::AppState;
use std::path::Path;

fn write_file(path: &Path, text: &str) {
    std::fs::create_dir_all(path.parent().expect("file has parent")).unwrap();
    std::fs::write(path, text).unwrap();
}

fn write_bytes(path: &Path, bytes: &[u8]) {
    std::fs::create_dir_all(path.parent().expect("file has parent")).unwrap();
    std::fs::write(path, bytes).unwrap();
}

fn large_preview_png() -> Vec<u8> {
    let image = image::RgbImage::from_fn(1536, 768, |x, y| {
        image::Rgb([
            (x % 251) as u8,
            (y % 241) as u8,
            ((x * 3 + y * 5) % 239) as u8,
        ])
    });
    let mut bytes = std::io::Cursor::new(Vec::new());
    image
        .write_to(&mut bytes, image::ImageFormat::Png)
        .expect("test preview should encode");
    bytes.into_inner()
}

fn data_url_image_dimensions(data_url: &str) -> (u32, u32) {
    let (_, encoded) = data_url
        .split_once(',')
        .expect("preview data URL should contain encoded image");
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .expect("preview data URL should decode");
    let image = image::load_from_memory(&bytes).expect("preview data URL should be an image");
    (image.width(), image.height())
}

fn sample_state() -> (tempfile::TempDir, AppState) {
    let dir = tempfile::tempdir().unwrap();
    let game = dir.path().join("RimWorld");
    let config_dir = dir.path().join("Config");
    let local_mod = game.join("Mods/LocalMod");
    let dep_mod = game.join("Mods/DependencyMod");

    write_file(
        &local_mod.join("About/About.xml"),
        r#"<ModMetaData>
  <packageId>local.mod</packageId>
  <name>Local Mod</name>
  <loadAfter><li>dependency.mod</li></loadAfter>
</ModMetaData>"#,
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
        r#"<ModMetaData><packageId>dependency.mod</packageId><name>Dependency Mod</name></ModMetaData>"#,
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

    let state = AppState::new(dir.path().join("rimr-config.json")).unwrap();
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
        .unwrap();

    (dir, state)
}

#[tokio::test]
async fn load_mod_preview_requires_loaded_catalog() {
    let (_dir, state) = sample_state();

    let error = state
        .load_mod_preview(LoadModPreviewRequest {
            source_key: "missing".to_string(),
        })
        .await
        .unwrap_err();

    assert_eq!(error.code, CommandErrorCode::StateMissing);
    assert!(error.message.contains("catalog"));
}

#[tokio::test]
async fn load_mod_preview_rejects_source_key_outside_catalog() {
    let (_dir, state) = sample_state();
    state.rebuild_mod_catalog().await.unwrap();

    let error = state
        .load_mod_preview(LoadModPreviewRequest {
            source_key: "not-in-catalog".to_string(),
        })
        .await
        .unwrap_err();

    assert_eq!(error.code, CommandErrorCode::PathInvalid);
    assert!(error.message.contains("sourceKey"));
}

#[tokio::test]
async fn rebuild_mod_catalog_returns_lightweight_filesystem_metadata() {
    let (_dir, state) = sample_state();
    let scan = state.rebuild_mod_catalog().await.unwrap();
    let local = scan
        .catalog
        .mods
        .iter()
        .find(|metadata| metadata.package_id == "local.mod")
        .expect("local mod should scan");

    assert!(local.path.ends_with("LocalMod"));
    assert_eq!(local.path, local.source_key);
    assert!(local.modified_at_ms > 0);
}

#[tokio::test]
async fn rebuild_catalog_reports_duplicate_variants_and_resolves_secondary_source_key() {
    let (dir, state) = sample_state();
    let duplicate_mod = dir.path().join("RimWorld/Mods/DuplicateLocalMod");
    write_file(
        &duplicate_mod.join("About/About.xml"),
        r#"<ModMetaData><packageId>local.mod</packageId><name>Duplicate Local Mod</name></ModMetaData>"#,
    );

    let snapshot = state.rebuild_mod_catalog().await.unwrap();
    assert_eq!(snapshot.catalog.duplicate_variants.len(), 1);
    assert_eq!(
        snapshot.catalog.duplicate_variants[0].package_id,
        "local.mod"
    );

    let secondary_source_key = snapshot.catalog.duplicate_variants[0]
        .source_keys
        .iter()
        .find(|source_key| source_key.ends_with("DuplicateLocalMod"))
        .expect("duplicate variant source key should be reported")
        .clone();

    let resolved = state
        .resolve_mod_folder_path(&secondary_source_key)
        .unwrap();
    assert_eq!(resolved, duplicate_mod);
}

#[tokio::test]
async fn texture_only_cleanup_preview_filters_texture_residue_mods() {
    let (dir, state) = sample_state();
    let local_texture = dir.path().join("RimWorld/Mods/TextureResidue");
    let local_other = dir.path().join("RimWorld/Mods/InvalidOther");
    let local_empty = dir.path().join("RimWorld/Mods/EmptyInvalid");
    let expansion_texture = dir.path().join("RimWorld/Data/InvalidExpansion");
    let workshop_root = dir.path().join("steamapps/workshop/content/294100");
    let workshop_texture = workshop_root.join("2009463077");

    write_bytes(&local_texture.join("Textures/a.dds"), b"dds");
    write_bytes(&local_texture.join("Textures/Sub/b.zstd"), b"zstd");
    write_bytes(&local_other.join("Textures/a.png"), b"png");
    std::fs::create_dir_all(&local_empty).unwrap();
    write_bytes(&expansion_texture.join("Textures/a.dds"), b"dds");
    write_bytes(&workshop_texture.join("Textures/a.DDS"), b"dds");

    let mut config = state.get_config().unwrap();
    config.paths.workshop_mods_dir = Some(workshop_root);
    state.replace_config(config).unwrap();

    let preview = state
        .preview_mod_cleanup(ModCleanupPreviewRequest {
            kind: ModCleanupKindDto::TextureOnlyInvalid,
        })
        .await
        .unwrap();
    let paths = preview
        .candidates
        .iter()
        .map(|candidate| candidate.path.as_str())
        .collect::<Vec<_>>();

    assert!(paths.iter().any(|path| path.ends_with("TextureResidue")));
    assert!(paths.iter().any(|path| path.ends_with("2009463077")));
    assert!(!paths.iter().any(|path| path.ends_with("InvalidOther")));
    assert!(!paths.iter().any(|path| path.ends_with("EmptyInvalid")));
    assert!(!paths.iter().any(|path| path.ends_with("InvalidExpansion")));
    assert_eq!(
        preview
            .candidates
            .iter()
            .find(|candidate| candidate.path.ends_with("TextureResidue"))
            .map(|candidate| candidate.file_count),
        Some(2)
    );
}

#[tokio::test]
async fn invalid_cleanup_preview_includes_all_invalid_local_and_workshop_mods() {
    let (dir, state) = sample_state();
    let local_no_about = dir.path().join("RimWorld/Mods/NoAbout");
    let local_malformed = dir.path().join("RimWorld/Mods/Malformed");
    let local_missing_package = dir.path().join("RimWorld/Mods/MissingPackage");
    let expansion_invalid = dir.path().join("RimWorld/Data/InvalidExpansion");
    let workshop_root = dir.path().join("steamapps/workshop/content/294100");
    let workshop_no_about = workshop_root.join("2009463077");

    write_bytes(&local_no_about.join("Textures/a.dds"), b"dds");
    write_file(
        &local_malformed.join("About/About.xml"),
        "<ModMetaData><packageId>bad</packageId",
    );
    write_file(
        &local_missing_package.join("About/About.xml"),
        "<ModMetaData><name>No package</name></ModMetaData>",
    );
    write_bytes(&expansion_invalid.join("Textures/a.dds"), b"dds");
    write_bytes(&workshop_no_about.join("Textures/a.dds"), b"dds");

    let mut config = state.get_config().unwrap();
    config.paths.workshop_mods_dir = Some(workshop_root);
    state.replace_config(config).unwrap();

    let preview = state
        .preview_mod_cleanup(ModCleanupPreviewRequest {
            kind: ModCleanupKindDto::Invalid,
        })
        .await
        .unwrap();
    let paths = preview
        .candidates
        .iter()
        .map(|candidate| candidate.path.as_str())
        .collect::<Vec<_>>();

    assert!(paths.iter().any(|path| path.ends_with("NoAbout")));
    assert!(paths.iter().any(|path| path.ends_with("Malformed")));
    assert!(paths.iter().any(|path| path.ends_with("MissingPackage")));
    assert!(paths.iter().any(|path| path.ends_with("2009463077")));
    assert!(!paths.iter().any(|path| path.ends_with("InvalidExpansion")));
    assert!(!paths.iter().any(|path| path.ends_with("LocalMod")));
}

#[tokio::test]
async fn clean_mods_revalidates_requested_texture_candidates() {
    let (dir, state) = sample_state();
    let local_texture = dir.path().join("RimWorld/Mods/TextureResidue");
    write_bytes(&local_texture.join("Textures/a.dds"), b"dds");

    let preview = state
        .preview_mod_cleanup(ModCleanupPreviewRequest {
            kind: ModCleanupKindDto::TextureOnlyInvalid,
        })
        .await
        .unwrap();
    let source_key = preview
        .candidates
        .iter()
        .find(|candidate| candidate.path.ends_with("TextureResidue"))
        .expect("texture residue should be a candidate")
        .source_key
        .clone();

    write_file(
        &local_texture.join("About/About.xml"),
        "<ModMetaData><packageId>now.valid</packageId></ModMetaData>",
    );

    let result = state
        .clean_mods(CleanModsRequest {
            kind: ModCleanupKindDto::TextureOnlyInvalid,
            source_keys: vec![source_key],
        })
        .await
        .unwrap();

    assert!(result.cleaned.is_empty());
    assert_eq!(result.skipped.len(), 1);
    assert!(local_texture.exists());
}

#[tokio::test]
async fn clean_mods_clears_session_cache_after_successful_cleanup() {
    let (dir, state) = sample_state();
    let local_texture = dir.path().join("RimWorld/Mods/TextureResidue");
    write_bytes(&local_texture.join("Textures/a.dds"), b"dds");

    let preview = state
        .preview_mod_cleanup(ModCleanupPreviewRequest {
            kind: ModCleanupKindDto::TextureOnlyInvalid,
        })
        .await
        .unwrap();
    let source_key = preview
        .candidates
        .iter()
        .find(|candidate| candidate.path.ends_with("TextureResidue"))
        .expect("texture residue should be a candidate")
        .source_key
        .clone();

    state
        .validate_active_order(ValidateActiveOrderRequest {
            active_mods: vec!["local.mod".to_string()],
        })
        .unwrap();

    let result = state
        .clean_mods(CleanModsRequest {
            kind: ModCleanupKindDto::TextureOnlyInvalid,
            source_keys: vec![source_key],
        })
        .await
        .unwrap();

    assert_eq!(result.cleaned.len(), 1);
    assert!(result.skipped.is_empty());
    assert!(!local_texture.exists());

    let validation = state.validate_active_order(ValidateActiveOrderRequest {
        active_mods: vec!["local.mod".to_string()],
    });
    assert!(matches!(validation, Err(ref e) if e.code == CommandErrorCode::StateMissing));
}

#[tokio::test]
async fn load_mod_preview_returns_lazy_preview_without_folder_size() {
    let (_dir, state) = sample_state();
    let scan = state.rebuild_mod_catalog().await.unwrap();
    let local = scan
        .catalog
        .mods
        .iter()
        .find(|metadata| metadata.package_id == "local.mod")
        .expect("local mod should scan");

    let preview = state
        .load_mod_preview(LoadModPreviewRequest {
            source_key: local.source_key.clone(),
        })
        .await
        .unwrap();

    assert_eq!(preview.source_key, local.source_key);
    assert!(
        preview
            .preview_data_url
            .as_deref()
            .is_some_and(|url| url.starts_with("data:image/png;base64,"))
    );
}

#[tokio::test]
async fn load_mod_preview_tolerates_missing_preview() {
    let (_dir, state) = sample_state();
    let scan = state.rebuild_mod_catalog().await.unwrap();
    let dependency = scan
        .catalog
        .mods
        .iter()
        .find(|metadata| metadata.package_id == "dependency.mod")
        .expect("dependency mod should scan");

    let preview = state
        .load_mod_preview(LoadModPreviewRequest {
            source_key: dependency.source_key.clone(),
        })
        .await
        .unwrap();

    assert_eq!(preview.preview_data_url, None);
}

#[tokio::test]
async fn load_mod_preview_ignores_case_of_preview_file_name() {
    let (dir, state) = sample_state();
    std::fs::remove_file(dir.path().join("RimWorld/Mods/LocalMod/About/Preview.png")).unwrap();
    write_bytes(
        &dir.path().join("RimWorld/Mods/LocalMod/About/preview.png"),
        &[
            137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1,
            8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 156, 99, 248, 15, 4,
            0, 9, 251, 3, 253, 167, 45, 186, 44, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
        ],
    );
    let scan = state.rebuild_mod_catalog().await.unwrap();
    let local = scan
        .catalog
        .mods
        .iter()
        .find(|metadata| metadata.package_id == "local.mod")
        .expect("local mod should scan");

    let preview = state
        .load_mod_preview(LoadModPreviewRequest {
            source_key: local.source_key.clone(),
        })
        .await
        .unwrap();

    assert!(
        preview
            .preview_data_url
            .as_deref()
            .is_some_and(|url| url.starts_with("data:image/png;base64,"))
    );
}

#[tokio::test]
async fn load_mod_preview_ignores_case_of_about_directory_name() {
    let (dir, state) = sample_state();
    let about_dir = dir.path().join("RimWorld/Mods/LocalMod/About");
    let lower_about_dir = dir.path().join("RimWorld/Mods/LocalMod/about");
    std::fs::rename(&about_dir, &lower_about_dir).unwrap();
    let scan = state.rebuild_mod_catalog().await.unwrap();
    let local = scan
        .catalog
        .mods
        .iter()
        .find(|metadata| metadata.package_id == "local.mod")
        .expect("local mod should scan");

    let preview = state
        .load_mod_preview(LoadModPreviewRequest {
            source_key: local.source_key.clone(),
        })
        .await
        .unwrap();

    assert!(
        preview
            .preview_data_url
            .as_deref()
            .is_some_and(|url| url.starts_with("data:image/png;base64,"))
    );
}

#[tokio::test]
async fn load_mod_preview_ignores_case_of_preview_extension() {
    let (dir, state) = sample_state();
    std::fs::remove_file(dir.path().join("RimWorld/Mods/LocalMod/About/Preview.png")).unwrap();
    write_bytes(
        &dir.path().join("RimWorld/Mods/LocalMod/About/Preview.PNG"),
        &[
            137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1,
            8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 156, 99, 248, 15, 4,
            0, 9, 251, 3, 253, 167, 45, 186, 44, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
        ],
    );
    let scan = state.rebuild_mod_catalog().await.unwrap();
    let local = scan
        .catalog
        .mods
        .iter()
        .find(|metadata| metadata.package_id == "local.mod")
        .expect("local mod should scan");

    let preview = state
        .load_mod_preview(LoadModPreviewRequest {
            source_key: local.source_key.clone(),
        })
        .await
        .unwrap();

    assert!(
        preview
            .preview_data_url
            .as_deref()
            .is_some_and(|url| url.starts_with("data:image/png;base64,"))
    );
}

#[tokio::test]
async fn load_mod_preview_downscales_large_previews_for_inspector_display() {
    let (dir, state) = sample_state();
    write_bytes(
        &dir.path().join("RimWorld/Mods/LocalMod/About/Preview.png"),
        &large_preview_png(),
    );
    let scan = state.rebuild_mod_catalog().await.unwrap();
    let local = scan
        .catalog
        .mods
        .iter()
        .find(|metadata| metadata.package_id == "local.mod")
        .expect("local mod should scan");

    let preview = state
        .load_mod_preview(LoadModPreviewRequest {
            source_key: local.source_key.clone(),
        })
        .await
        .unwrap();

    let preview_data_url = preview
        .preview_data_url
        .as_deref()
        .expect("large preview should still render");
    let (width, height) = data_url_image_dimensions(preview_data_url);
    assert!(
        width <= 512,
        "preview width should be display-sized: {width}"
    );
    assert!(
        height <= 512,
        "preview height should be display-sized: {height}"
    );
}

#[tokio::test]
async fn load_mod_folder_size_reuses_cached_size_when_fingerprint_is_unchanged() {
    let (dir, state) = sample_state();
    let scan = state.rebuild_mod_catalog().await.unwrap();
    let local = scan
        .catalog
        .mods
        .iter()
        .find(|metadata| metadata.package_id == "local.mod")
        .expect("local mod should scan");

    let first = state
        .load_mod_folder_size(LoadModFolderSizeRequest {
            source_key: local.source_key.clone(),
        })
        .await
        .unwrap();

    write_bytes(
        &dir.path()
            .join("RimWorld/Mods/LocalMod/About/CacheOnly.bin"),
        &[1; 4096],
    );

    let second = state
        .load_mod_folder_size(LoadModFolderSizeRequest {
            source_key: local.source_key.clone(),
        })
        .await
        .unwrap();

    assert_eq!(second.folder_size_bytes, first.folder_size_bytes);
}

#[tokio::test]
async fn load_mod_preview_refreshes_cached_preview_when_preview_fingerprint_changes() {
    let (dir, state) = sample_state();
    let scan = state.rebuild_mod_catalog().await.unwrap();
    let local = scan
        .catalog
        .mods
        .iter()
        .find(|metadata| metadata.package_id == "local.mod")
        .expect("local mod should scan");

    let first = state
        .load_mod_preview(LoadModPreviewRequest {
            source_key: local.source_key.clone(),
        })
        .await
        .unwrap();

    write_bytes(
        &dir.path().join("RimWorld/Mods/LocalMod/About/Preview.png"),
        b"not a real png, but enough to verify base64 cache invalidation",
    );

    let second = state
        .load_mod_preview(LoadModPreviewRequest {
            source_key: local.source_key.clone(),
        })
        .await
        .unwrap();

    assert_ne!(second.preview_data_url, first.preview_data_url);
    assert!(
        second
            .preview_data_url
            .as_deref()
            .is_some_and(|url| url.starts_with("data:image/png;base64,"))
    );
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
            mod_list: rimr_tauri_lib::dto::ModListDto {
                format_version: 2,
                id: mod_list.id.clone(),
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
            },
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
    let (_dir, state) = sample_state();
    state.rebuild_mod_catalog().await.unwrap();
    state.load_active_list().await.unwrap();

    // Sanity: catalog is cached, so validation works pre-replace.
    state
        .validate_active_order(ValidateActiveOrderRequest {
            active_mods: vec!["local.mod".to_string()],
        })
        .unwrap();

    let mut config = state.get_config().unwrap();
    config.paths.workshop_mods_dir = Some(_dir.path().join("workshop"));
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

#[tokio::test]
async fn resolve_mod_folder_path_requires_loaded_catalog() {
    let (_dir, state) = sample_state();

    let error = state.resolve_mod_folder_path("local.mod").unwrap_err();

    assert_eq!(error.code, CommandErrorCode::StateMissing);
    assert!(error.message.contains("catalog"));
}

#[tokio::test]
async fn resolve_mod_folder_path_rejects_source_key_outside_catalog() {
    let (_dir, state) = sample_state();
    state.rebuild_mod_catalog().await.unwrap();

    let error = state.resolve_mod_folder_path("not-in-catalog").unwrap_err();

    assert_eq!(error.code, CommandErrorCode::PathInvalid);
    assert!(error.message.contains("sourceKey"));
}

#[tokio::test]
async fn open_mod_folder_resolves_to_existing_mod_directory() {
    let (dir, state) = sample_state();
    let scan = state.rebuild_mod_catalog().await.unwrap();
    let local = scan
        .catalog
        .mods
        .iter()
        .find(|metadata| metadata.package_id == "local.mod")
        .expect("local mod should scan");

    let resolved = state.resolve_mod_folder_path(&local.source_key).unwrap();

    assert_eq!(resolved, dir.path().join("RimWorld/Mods/LocalMod"));
    assert!(resolved.is_dir());
}

#[tokio::test]
async fn resolve_steam_workshop_url_requires_loaded_catalog() {
    let (_dir, state) = sample_state();

    let error = state
        .resolve_steam_workshop_url(OpenSteamWorkshopPageRequest {
            source_key: "local.mod".to_string(),
            target: SteamWorkshopOpenTarget::Web,
        })
        .unwrap_err();

    assert_eq!(error.code, CommandErrorCode::StateMissing);
    assert!(error.message.contains("catalog"));
}

#[tokio::test]
async fn resolve_steam_workshop_url_rejects_non_workshop_mods() {
    let (_dir, state) = sample_state();
    let scan = state.rebuild_mod_catalog().await.unwrap();
    let local = scan
        .catalog
        .mods
        .iter()
        .find(|metadata| metadata.package_id == "local.mod")
        .expect("local mod should scan");

    let error = state
        .resolve_steam_workshop_url(OpenSteamWorkshopPageRequest {
            source_key: local.source_key.clone(),
            target: SteamWorkshopOpenTarget::Web,
        })
        .unwrap_err();

    assert_eq!(error.code, CommandErrorCode::PathInvalid);
    assert!(error.message.contains("Workshop"));
}

#[tokio::test]
async fn resolve_steam_workshop_url_generates_target_url() {
    let dir = tempfile::tempdir().unwrap();
    let game = dir.path().join("RimWorld");
    let config_dir = dir.path().join("Config");
    let workshop_mod = dir
        .path()
        .join("steamapps/workshop/content/294100/2009463077");
    write_file(
        &workshop_mod.join("About/About.xml"),
        r#"<ModMetaData><packageId>workshop.mod</packageId><name>Workshop Mod</name></ModMetaData>"#,
    );
    write_file(
        &config_dir.join("ModsConfig.xml"),
        r#"<ModsConfigData><version>1.5</version><activeMods /></ModsConfigData>"#,
    );
    let state = AppState::new(dir.path().join("rimr-config.json")).unwrap();
    state
        .replace_config(AppConfig {
            format_version: 4,
            paths: PathsConfig {
                game_dir: Some(game.clone()),
                game_data_dir: Some(dir.path().to_path_buf()),
                local_mods_dir: Some(game.join("Mods")),
                workshop_mods_dir: Some(dir.path().join("steamapps/workshop/content/294100")),
                rimr_data_dir: Some(dir.path().join("RimR")),
            },
            ui: UiConfig::default(),
        })
        .unwrap();

    let scan = state.rebuild_mod_catalog().await.unwrap();
    let workshop = scan
        .catalog
        .mods
        .iter()
        .find(|metadata| metadata.package_id == "workshop.mod")
        .expect("workshop mod should scan");

    assert_eq!(
        state
            .resolve_steam_workshop_url(OpenSteamWorkshopPageRequest {
                source_key: workshop.source_key.clone(),
                target: SteamWorkshopOpenTarget::SteamClient,
            })
            .unwrap(),
        "steam://url/CommunityFilePage/2009463077"
    );
    assert_eq!(
        state
            .resolve_steam_workshop_url(OpenSteamWorkshopPageRequest {
                source_key: workshop.source_key.clone(),
                target: SteamWorkshopOpenTarget::Web,
            })
            .unwrap(),
        "https://steamcommunity.com/sharedfiles/filedetails/?id=2009463077"
    );
}
