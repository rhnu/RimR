use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use ts_rs::TS;

pub const CURRENT_CONFIG_FORMAT_VERSION: u32 = 4;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub enum Theme {
    Light,
    Dark,
    System,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub enum Locale {
    En,
    #[serde(rename = "zh-CN")]
    #[ts(rename = "zh-CN")]
    ZhCn,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct PathsConfig {
    #[serde(default)]
    #[ts(type = "string | null")]
    pub game_dir: Option<PathBuf>,
    #[serde(default)]
    #[ts(type = "string | null")]
    pub game_data_dir: Option<PathBuf>,
    #[serde(default)]
    #[ts(type = "string | null")]
    pub local_mods_dir: Option<PathBuf>,
    #[serde(default)]
    #[ts(type = "string | null")]
    pub workshop_mods_dir: Option<PathBuf>,
    #[serde(default = "default_data_dir")]
    #[ts(type = "string | null")]
    pub rimr_data_dir: Option<PathBuf>,
}

impl Default for PathsConfig {
    fn default() -> Self {
        Self {
            game_dir: None,
            game_data_dir: None,
            local_mods_dir: None,
            workshop_mods_dir: None,
            rimr_data_dir: default_data_dir(),
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct UiConfig {
    #[serde(default)]
    pub theme: Option<Theme>,
    #[serde(default)]
    pub locale: Option<Locale>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct AppConfig {
    #[serde(default = "default_format_version")]
    pub format_version: u32,
    #[serde(default)]
    pub paths: PathsConfig,
    #[serde(default)]
    pub ui: UiConfig,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            format_version: CURRENT_CONFIG_FORMAT_VERSION,
            paths: PathsConfig::default(),
            ui: UiConfig::default(),
        }
    }
}

impl AppConfig {
    /// Returns true if the path-related fields differ between `self` and `other`.
    /// Used to decide whether replacing the config should invalidate session
    /// caches (catalog/active-list) that depend on the configured paths.
    pub fn paths_changed(&self, other: &AppConfig) -> bool {
        self.paths != other.paths
    }
}

pub fn default_data_dir() -> Option<PathBuf> {
    directories::UserDirs::new()
        .and_then(|dirs| dirs.document_dir().map(|path| path.join("RimR")))
        .or_else(|| directories::UserDirs::new().map(|dirs| dirs.home_dir().join("RimR")))
}

fn default_format_version() -> u32 {
    CURRENT_CONFIG_FORMAT_VERSION
}
