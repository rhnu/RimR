use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

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

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
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
    #[serde(default)]
    #[ts(type = "string | null")]
    pub rimr_data_dir: Option<PathBuf>,
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

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct AppConfig {
    #[serde(default)]
    pub paths: PathsConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(tag = "status", rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub enum BootstrapStatusDto {
    Ready {
        config: AppConfig,
        #[serde(rename = "importedPreferences")]
        #[ts(rename = "importedPreferences")]
        imported_preferences: Option<UiConfig>,
        migrated: bool,
    },
    RecoveryRequired {
        error: crate::error::CommandError,
    },
}
