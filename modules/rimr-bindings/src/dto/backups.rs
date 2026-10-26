use super::mod_lists::RimrFileKind;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct GameConfigBackupMetaDto {
    pub note: Option<String>,
    pub tags: Vec<String>,
    pub groups: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct GameConfigBackupDto {
    pub kind: RimrFileKind,
    pub format_version: u32,
    pub backup_at: String,
    pub game_version: String,
    pub active_mods: Vec<String>,
    pub known_expansions: Vec<String>,
    pub rimr_meta: GameConfigBackupMetaDto,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ExportGameConfigBackupRequest {
    pub note: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(type = "string | null")]
    pub output_path: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ExportGameConfigBackupDto {
    pub file: GameConfigBackupDto,
    pub json: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(type = "string | null")]
    pub output_path: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ImportGameConfigBackupRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(type = "string | null")]
    pub input_path: Option<PathBuf>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub json: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ImportGameConfigBackupDto {
    pub file: GameConfigBackupDto,
}
