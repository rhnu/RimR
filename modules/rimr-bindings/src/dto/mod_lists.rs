use super::mods::ModsConfigDto;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use ts_rs::TS;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ModIdentityDto {
    pub package_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_kind: Option<super::mods::SourceKindDto>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_key: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub steam_app_id: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct DisplayAliasDto {
    pub identity: ModIdentityDto,
    pub display_alias: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct TagDefDto {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub color: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ModTagBindingDto {
    pub identity: ModIdentityDto,
    pub tag_ids: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct LibrarySettingsDto {
    pub format_version: u32,
    pub aliases: Vec<DisplayAliasDto>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tag_defs: Vec<TagDefDto>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub mod_tags: Vec<ModTagBindingDto>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub enum RimrFileKind {
    GameConfigBackup,
    ModList,
    LibrarySettings,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ModListGroupChildDto {
    pub id: String,
    #[serde(default = "default_active")]
    pub active: bool,
    pub identity: ModIdentityDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub enum ModListEntryDto {
    Mod {
        id: String,
        #[serde(default = "default_active")]
        active: bool,
        identity: ModIdentityDto,
    },
    Group {
        id: String,
        name: String,
        collapsed: bool,
        entries: Vec<ModListGroupChildDto>,
    },
    Separator {
        id: String,
        title: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        note: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        color: Option<String>,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ModListDto {
    pub format_version: u32,
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    pub entries: Vec<ModListEntryDto>,
    pub active_mods: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ModListSummaryDto {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ModListIndexDto {
    pub format_version: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_mod_list_id: Option<String>,
    pub mod_lists: Vec<ModListSummaryDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct LibraryDto {
    pub data_dir: String,
    pub settings: LibrarySettingsDto,
    pub mod_lists_index: ModListIndexDto,
    pub current_mod_list: ModListDto,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct SaveLibrarySettingsRequest {
    pub settings: LibrarySettingsDto,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct CreateModListRequest {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub base_mod_list: Option<ModListDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct SaveModListRequest {
    pub mod_list: ModListDto,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct DeleteModListRequest {
    pub mod_list_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct SetCurrentModListRequest {
    pub mod_list_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ApplyModListRequest {
    pub mod_list: ModListDto,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ApplyModListDto {
    pub mod_list_id: String,
    pub active_mods: Vec<String>,
    pub skipped_missing_packages: Vec<String>,
    pub config: ModsConfigDto,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ModListFileDto {
    pub kind: RimrFileKind,
    pub format_version: u32,
    pub exported_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub game_version: Option<String>,
    pub mod_list: ModListDto,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct LibrarySettingsFileDto {
    pub kind: RimrFileKind,
    pub format_version: u32,
    pub exported_at: String,
    pub settings: LibrarySettingsDto,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ExportModListFileRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mod_list_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(type = "string | null")]
    pub output_path: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ExportModListFileDto {
    pub file: ModListFileDto,
    pub json: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(type = "string | null")]
    pub output_path: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ImportModListFileRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(type = "string | null")]
    pub input_path: Option<PathBuf>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub json: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ExportLibrarySettingsFileRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(type = "string | null")]
    pub output_path: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ExportLibrarySettingsFileDto {
    pub file: LibrarySettingsFileDto,
    pub json: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(type = "string | null")]
    pub output_path: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ImportLibrarySettingsFileRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(type = "string | null")]
    pub input_path: Option<PathBuf>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub json: Option<String>,
}

fn default_active() -> bool {
    true
}
