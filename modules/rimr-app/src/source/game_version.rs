//! Shared version detection for scanning and application information.

use std::path::Path;

use rimr_core::GameVersion;

/// Reads the installed version first, then the last version recorded by the game.
pub(crate) async fn detect_game_version(
    game_dir: Option<&Path>,
    data_dir: Option<&Path>,
) -> GameVersion {
    if let Some(game_dir) = game_dir {
        let path = game_dir.join("Version.txt");
        match tokio::fs::read_to_string(&path).await {
            Ok(raw) => {
                let version = GameVersion::parse(raw.lines().next().unwrap_or_default());
                if version.major() > 0 {
                    return version;
                }
            },
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {},
            Err(error) => {
                tracing::warn!(path = ?path, error = %error, "Version.txt unavailable; inspecting game configuration");
            },
        }
    }
    if let Some(data_dir) = data_dir {
        let path = data_dir.join("Config/ModsConfig.xml");
        match tokio::fs::read(&path).await {
            Ok(bytes) => match rimr_core::parse_mods_config(&bytes) {
                Ok(config) => {
                    let version = GameVersion::parse(&config.version);
                    if version.major() > 0 {
                        return version;
                    }
                },
                Err(error) => {
                    tracing::warn!(path = ?path, error = ?error, "game configuration cannot supply the target version");
                },
            },
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {},
            Err(error) => {
                tracing::warn!(path = ?path, error = %error, "game configuration cannot supply the target version");
            },
        }
    }
    GameVersion::unknown()
}

#[cfg(test)]
mod tests;
