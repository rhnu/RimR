pub use rimr_bindings::paths::*;

use std::path::{Component, Path, PathBuf};
use thiserror::Error;

pub const RIMWORLD_APP_ID: u32 = 294_100;

#[derive(Debug, Clone)]
pub struct PathDetectionInput {
    pub platform: Platform,
    pub home_dir: PathBuf,
    pub steam_roots: Vec<PathBuf>,
    pub rimworld_app_dir: Option<PathBuf>,
}

#[derive(Debug, Error)]
pub enum PathDetectionError {
    #[error("home directory is not available")]
    HomeUnavailable,
}

pub fn autodetect_paths() -> Result<DetectedPaths, PathDetectionError> {
    tracing::info!("autodetecting RimWorld paths");
    let home_dir = directories::UserDirs::new()
        .map(|dirs| dirs.home_dir().to_path_buf())
        .ok_or(PathDetectionError::HomeUnavailable)?;
    let platform = current_platform();
    let (steam_roots, rimworld_app_dir) = locate_steam_rimworld();
    autodetect_paths_from(PathDetectionInput {
        platform,
        home_dir,
        steam_roots,
        rimworld_app_dir,
    })
}

pub fn autodetect_paths_from(
    input: PathDetectionInput,
) -> Result<DetectedPaths, PathDetectionError> {
    let steam_root = input
        .steam_roots
        .first()
        .cloned()
        .unwrap_or_else(|| default_steam_root(input.platform, &input.home_dir));
    let mut game_dir = input
        .rimworld_app_dir
        .unwrap_or_else(|| default_game_dir(input.platform, &steam_root));

    if input.platform == Platform::Macos {
        game_dir = find_mac_app_bundle(&game_dir);
    }

    let workshop_mods_dir = derive_workshop_dir(&game_dir).unwrap_or_else(|| {
        steam_root
            .join("steamapps")
            .join("workshop")
            .join("content")
            .join("294100")
    });
    let local_mods_dir = local_mods_dir_for(input.platform, &game_dir);
    let game_data_dir = game_data_dir_for(input.platform, &input.home_dir, &steam_root);
    let warnings = if input.platform == Platform::Linux
        && steam_root
            .components()
            .any(|component| component.as_os_str() == "snap")
    {
        vec![PathDetectionWarning::SnapSteamDetected]
    } else {
        Vec::new()
    };

    let detected = DetectedPaths {
        game_dir,
        game_data_dir,
        local_mods_dir,
        workshop_mods_dir,
        warnings,
    };
    tracing::info!(
        game_dir = ?detected.game_dir,
        game_data_dir = ?detected.game_data_dir,
        local_mods_dir = ?detected.local_mods_dir,
        workshop_mods_dir = ?detected.workshop_mods_dir,
        warnings = detected.warnings.len(),
        "RimWorld paths detected"
    );
    Ok(detected)
}

fn current_platform() -> Platform {
    if cfg!(target_os = "windows") {
        Platform::Windows
    } else if cfg!(target_os = "macos") {
        Platform::Macos
    } else {
        Platform::Linux
    }
}

fn locate_steam_rimworld() -> (Vec<PathBuf>, Option<PathBuf>) {
    let steam_dirs = steamlocate::locate_all().unwrap_or_default();
    let mut roots = Vec::new();
    let mut app_dir = None;

    for steam_dir in steam_dirs {
        roots.push(steam_dir.path().to_path_buf());
        if app_dir.is_none()
            && let Ok(Some((app, library))) = steam_dir.find_app(RIMWORLD_APP_ID)
        {
            app_dir = Some(library.resolve_app_dir(&app));
        }
    }

    (roots, app_dir)
}

fn default_steam_root(platform: Platform, home: &Path) -> PathBuf {
    match platform {
        Platform::Windows => PathBuf::from("C:/Program Files (x86)/Steam"),
        Platform::Macos => home
            .join("Library")
            .join("Application Support")
            .join("Steam"),
        Platform::Linux => home.join(".steam").join("steam"),
    }
}

fn default_game_dir(platform: Platform, steam_root: &Path) -> PathBuf {
    let base = steam_root.join("steamapps").join("common").join("RimWorld");
    match platform {
        Platform::Macos => base.join("RimWorldMac.app"),
        Platform::Windows | Platform::Linux => base,
    }
}

fn local_mods_dir_for(platform: Platform, game_dir: &Path) -> PathBuf {
    if platform == Platform::Macos && game_dir.extension().is_some_and(|ext| ext == "app") {
        return game_dir.parent().unwrap_or(game_dir).join("Mods");
    }
    game_dir.join("Mods")
}

fn game_data_dir_for(platform: Platform, home: &Path, steam_root: &Path) -> PathBuf {
    match platform {
        Platform::Windows => home
            .join("AppData")
            .join("LocalLow")
            .join("Ludeon Studios")
            .join("RimWorld by Ludeon Studios"),
        Platform::Macos => home
            .join("Library")
            .join("Application Support")
            .join("Rimworld"),
        Platform::Linux => {
            let proton = steam_root
                .join("steamapps")
                .join("compatdata")
                .join("294100")
                .join("pfx")
                .join("drive_c")
                .join("users")
                .join("steamuser")
                .join("AppData")
                .join("LocalLow")
                .join("Ludeon Studios")
                .join("RimWorld by Ludeon Studios");
            if proton.exists() {
                proton
            } else {
                home.join(".config")
                    .join("unity3d")
                    .join("Ludeon Studios")
                    .join("RimWorld by Ludeon Studios")
            }
        }
    }
}

fn find_mac_app_bundle(rimworld_dir: &Path) -> PathBuf {
    if rimworld_dir.extension().is_some_and(|ext| ext == "app") {
        return rimworld_dir.to_path_buf();
    }
    if let Ok(entries) = std::fs::read_dir(rimworld_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().is_some_and(|ext| ext == "app") {
                return path;
            }
        }
    }
    rimworld_dir.join("RimWorldMac.app")
}

fn derive_workshop_dir(game_dir: &Path) -> Option<PathBuf> {
    let mut before_common = PathBuf::new();
    for component in game_dir.components() {
        if component.as_os_str() == "common" {
            return Some(
                before_common
                    .join("workshop")
                    .join("content")
                    .join("294100"),
            );
        }
        match component {
            Component::Prefix(prefix) => before_common.push(prefix.as_os_str()),
            Component::RootDir => before_common.push(component.as_os_str()),
            _ => before_common.push(component.as_os_str()),
        }
    }
    None
}
