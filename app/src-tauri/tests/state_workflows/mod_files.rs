use base64::Engine;
use rimr_tauri_lib::{
    app_config::{AppConfig, PathsConfig, UiConfig},
    dto::{
        CommandErrorCode, LoadModFolderSizeRequest, LoadModPreviewRequest,
        OpenSteamWorkshopPageRequest, SteamWorkshopOpenTarget,
    },
    state::AppState,
};

use super::{sample_state, write_bytes, write_file};

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
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .expect("preview data URL should decode");
    let image = image::load_from_memory(&bytes).expect("preview data URL should be an image");
    (image.width(), image.height())
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
        r"<ModMetaData><packageId>local.mod</packageId><name>Duplicate Local Mod</name></ModMetaData>",
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
        r"<ModMetaData><packageId>workshop.mod</packageId><name>Workshop Mod</name></ModMetaData>",
    );
    write_file(
        &config_dir.join("ModsConfig.xml"),
        r"<ModsConfigData><version>1.5</version><activeMods /></ModsConfigData>",
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
