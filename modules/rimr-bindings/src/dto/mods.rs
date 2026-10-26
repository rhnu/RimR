use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct CatalogSnapshotDto {
    pub catalog: ModCatalogDto,
    pub diagnostics: Vec<DiagnosticDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ModCatalogDto {
    pub mods: Vec<ModMetadataDto>,
    pub duplicate_package_ids: Vec<String>,
    pub duplicate_variants: Vec<DuplicatePackageIdDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct DuplicatePackageIdDto {
    pub package_id: String,
    pub source_keys: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ModMetadataDto {
    pub source_key: String,
    pub source_kind: SourceKindDto,
    pub package_id: String,
    pub path: String,
    #[ts(type = "number")]
    pub modified_at_ms: u64,
    pub name: Option<String>,
    pub authors: Vec<String>,
    pub supported_versions: Vec<String>,
    pub description: Option<String>,
    pub mod_version: Option<String>,
    pub url: Option<String>,
    pub mod_icon_path: Option<String>,
    pub steam_app_id: Option<u32>,
    pub has_assemblies: bool,
    pub rules: RulesDto,
    pub valid: bool,
    pub data_malformed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct LoadModPreviewRequest {
    pub source_key: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ModPreviewDto {
    pub source_key: String,
    pub preview_data_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct LoadModFolderSizeRequest {
    pub source_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct OpenModFolderRequest {
    pub source_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct OpenSteamWorkshopPageRequest {
    pub source_key: String,
    pub target: SteamWorkshopOpenTarget,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub enum SteamWorkshopOpenTarget {
    SteamClient,
    Web,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ModFolderSizeDto {
    pub source_key: String,
    #[ts(type = "number")]
    pub folder_size_bytes: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub enum ModCleanupKindDto {
    TextureOnlyInvalid,
    Invalid,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub enum ModCleanupReasonDto {
    TextureOnlyInvalid,
    InvalidMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ModCleanupCandidateDto {
    pub source_key: String,
    pub source_kind: SourceKindDto,
    pub path: String,
    pub package_id: String,
    pub name: Option<String>,
    pub reason: ModCleanupReasonDto,
    #[ts(type = "number")]
    pub file_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ModCleanupPreviewRequest {
    pub kind: ModCleanupKindDto,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ModCleanupPreviewDto {
    pub kind: ModCleanupKindDto,
    pub candidates: Vec<ModCleanupCandidateDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct CleanModsRequest {
    pub kind: ModCleanupKindDto,
    pub source_keys: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ModCleanupSkippedDto {
    pub source_key: String,
    pub path: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ModCleanupResultDto {
    pub kind: ModCleanupKindDto,
    pub cleaned: Vec<ModCleanupCandidateDto>,
    pub skipped: Vec<ModCleanupSkippedDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct RulesDto {
    pub load_after: Vec<String>,
    pub load_before: Vec<String>,
    pub mod_dependencies: Vec<DependencyDto>,
    pub incompatible_with: Vec<String>,
    pub force_load_after: Vec<String>,
    pub force_load_before: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct DependencyDto {
    pub package_id: String,
    pub display_name: Option<String>,
    pub steam_workshop_url: Option<String>,
    pub download_url: Option<String>,
    pub alternative_package_ids: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub enum SourceKindDto {
    Expansion,
    Local,
    Workshop,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub enum SeverityDto {
    Error,
    Warning,
    Info,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub enum DiagnosticCodeDto {
    XmlMalformed,
    PackageIdMissing,
    PackageIdDuplicate,
    SourceReadFailed,
    DependencyMissing,
    ConfigModMissing,
    ActiveModMissing,
    DependencyInactive,
    OrderViolationLoadAfter,
    OrderViolationLoadBefore,
    IncompatibleActive,
    CircularDependency,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct DiagnosticLocationDto {
    pub source_key: Option<String>,
    pub path: String,
    pub xml_path: Option<String>,
    pub line: Option<u32>,
    pub col: Option<u32>,
    #[ts(type = "number | null")]
    pub byte_offset: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct DiagnosticDto {
    pub severity: SeverityDto,
    pub code: DiagnosticCodeDto,
    pub message: String,
    pub location: Option<DiagnosticLocationDto>,
    pub related_locations: Vec<DiagnosticLocationDto>,
    #[ts(type = "Record<string, string>")]
    pub params: BTreeMap<String, String>,
    pub related_packages: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ActiveListLoadDto {
    pub active_mods: Vec<String>,
    pub config: ModsConfigDto,
    pub missing: Vec<String>,
    pub diagnostics: Vec<DiagnosticDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ModsConfigDto {
    pub version: String,
    pub active_mods: Vec<String>,
    pub known_expansions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ValidateActiveOrderRequest {
    pub active_mods: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ValidateOrderDto {
    pub report: ValidationReportDto,
    pub graph: DependencyGraphDto,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ValidationReportDto {
    pub errors: Vec<DiagnosticDto>,
    pub warnings: Vec<DiagnosticDto>,
    pub infos: Vec<DiagnosticDto>,
    pub is_clean: bool,
    pub has_errors: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct DependencyGraphDto {
    pub edges: Vec<EdgeDto>,
    pub incompatibilities: Vec<IncompatibilityDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct EdgeDto {
    pub from: String,
    pub to: String,
    pub kind: EdgeKindDto,
    pub source: EdgeSourceDto,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub enum EdgeKindDto {
    LoadAfter,
    LoadBefore,
    ForceLoadAfter,
    ForceLoadBefore,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub enum EdgeSourceDto {
    About,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct IncompatibilityDto {
    pub package_id: String,
    pub incompatible_with: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct ActiveListWriteDto {
    pub active_mods: Vec<String>,
    pub config: ModsConfigDto,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub enum ConfiguredDirectoryKind {
    GameDir,
    GameDataDir,
    LocalModsDir,
    WorkshopModsDir,
    RimrDataDir,
    RimrModListsDir,
    RimrLogsDir,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct OpenConfiguredDirectoryRequest {
    pub kind: ConfiguredDirectoryKind,
}
