use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct SteamWorkshopLogDto {
    pub entries: Vec<SteamWorkshopLogEntryDto>,
    pub acf_path: String,
    pub total_installed: u32,
    pub found: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct SteamWorkshopLogEntryDto {
    pub published_file_id: String,
    pub mod_name: Option<String>,
    pub package_id: Option<String>,
    #[ts(type = "number")]
    pub time_updated_ms: u64,
    #[ts(type = "number")]
    pub time_touched_ms: u64,
    pub has_manifest: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub enum LogSourceDto {
    PlayerLog,
    PlayerPrevLog,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub enum LogLevelDto {
    Info,
    Warning,
    Error,
    Exception,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct LogEntryDto {
    #[ts(type = "number")]
    pub line_number: u32,
    pub level: LogLevelDto,
    pub text: String,
    pub is_stack_trace: bool,
    pub ref_id: Option<String>,
    pub duplicate_ref: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct LoadPlayerLogRequest {
    pub source: LogSourceDto,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct PlayerLogDto {
    pub entries: Vec<LogEntryDto>,
    #[ts(type = "number")]
    pub total_lines: u32,
    #[ts(type = "number")]
    pub error_count: u32,
    #[ts(type = "number")]
    pub warning_count: u32,
    #[ts(type = "number")]
    pub exception_count: u32,
    pub source: LogSourceDto,
    pub file_path: String,
    #[ts(type = "number")]
    pub file_size_bytes: u64,
    #[ts(type = "number")]
    pub modified_at_ms: u64,
}
