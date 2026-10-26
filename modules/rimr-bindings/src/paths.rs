use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub enum Platform {
    Windows,
    Macos,
    Linux,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct DetectedPaths {
    #[ts(type = "string")]
    pub game_dir: PathBuf,
    #[ts(type = "string")]
    pub game_data_dir: PathBuf,
    #[ts(type = "string")]
    pub local_mods_dir: PathBuf,
    #[ts(type = "string")]
    pub workshop_mods_dir: PathBuf,
    pub warnings: Vec<PathDetectionWarning>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub enum PathDetectionWarning {
    SnapSteamDetected,
}
