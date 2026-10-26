//! Application use cases and runtime session state.

use crate::diagnostics::Diagnostic;
use crate::domain::{ActiveModList, ModCatalog, ModList, PackageId};
use crate::error::{CoreError, RimrFileParseError};
use crate::formats::ModsConfig;
use crate::ports::{Clock, ModSource};
use crate::rules::ValidationReport;
use crate::services;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

pub const RIMR_FILE_FORMAT_VERSION: u32 = 2;

/// Core-owned runtime state for a RimR workspace session.
#[derive(Debug, Default, Clone)]
pub struct WorkspaceSession {
    catalog: Option<ModCatalog>,
    active_mods: Option<ActiveModList>,
    mods_config: Option<ModsConfig>,
    source_metadata: HashMap<String, SourceMetadata>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SourceMetadata {
    pub source_key: String,
    pub mod_icon_path: Option<String>,
}

#[derive(Debug, Clone)]
pub struct GameConfigLoadResult {
    pub active_mods: Vec<String>,
    pub config: ModsConfig,
    pub missing: Vec<String>,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone)]
pub struct GameConfigWriteResult {
    pub active_mods: Vec<String>,
    pub config: ModsConfig,
}

impl WorkspaceSession {
    pub fn catalog(&self) -> Option<&ModCatalog> {
        self.catalog.as_ref()
    }

    pub fn active_mods(&self) -> Option<&ActiveModList> {
        self.active_mods.as_ref()
    }

    pub fn mods_config(&self) -> Option<&ModsConfig> {
        self.mods_config.as_ref()
    }

    pub fn source_metadata(&self, source_key: &str) -> Option<&SourceMetadata> {
        self.source_metadata.get(source_key)
    }

    pub fn clear(&mut self) {
        self.catalog = None;
        self.active_mods = None;
        self.mods_config = None;
        self.source_metadata.clear();
    }

    pub async fn scan_mods(
        &mut self,
        source: &dyn ModSource,
        opts: &crate::services::ScanOpts,
    ) -> Result<crate::services::ScanReport, CoreError> {
        let report = services::scan_mod_metadata(source, opts).await?;
        self.source_metadata = report
            .catalog
            .iter()
            .map(|(_, metadata)| {
                let source_key = metadata.source_key.as_str().to_string();
                (
                    source_key.clone(),
                    SourceMetadata {
                        source_key,
                        mod_icon_path: metadata.mod_icon_path.as_deref().map(str::to_string),
                    },
                )
            })
            .collect();
        self.catalog = Some(report.catalog.clone());
        Ok(report)
    }

    pub async fn load_game_config(
        &mut self,
        source: &dyn ModSource,
    ) -> Result<GameConfigLoadResult, CoreError> {
        let result = services::load_active_list(source, self.catalog.as_ref()).await?;
        let active_mods = result
            .list
            .iter()
            .map(ToString::to_string)
            .collect::<Vec<_>>();
        let missing = result.missing.iter().map(ToString::to_string).collect();
        self.active_mods = Some(result.list.clone());
        self.mods_config = Some(result.config.clone());
        Ok(GameConfigLoadResult {
            active_mods,
            config: result.config,
            missing,
            diagnostics: result.diagnostics,
        })
    }

    pub fn validate_active_order(
        &self,
        active_mods: Vec<String>,
    ) -> Result<crate::services::ValidateOrderResult, CoreError> {
        let catalog = self
            .catalog
            .as_ref()
            .ok_or(CoreError::SessionMissing("catalog is not loaded"))?;
        let ids = active_mods
            .iter()
            .map(|package_id| PackageId::new(package_id))
            .collect::<Vec<_>>();
        let list = ActiveModList::from_slice(&ids);
        Ok(services::validate_order(
            catalog,
            &list,
            &crate::rules::ValidateOpts::default(),
        ))
    }

    pub async fn write_game_config(
        &mut self,
        source: &dyn ModSource,
        active_mods: Vec<String>,
    ) -> Result<GameConfigWriteResult, CoreError> {
        let original_config = self
            .mods_config
            .as_ref()
            .ok_or(CoreError::SessionMissing("ModsConfig.xml is not loaded"))?;
        let ids = active_mods
            .iter()
            .map(|package_id| PackageId::new(package_id))
            .collect::<Vec<_>>();
        let list = ActiveModList::from_slice(&ids);
        let bytes = services::build_mods_config_bytes(&list, original_config)?;
        source.write_mods_config(bytes).await?;

        let mut updated_config = original_config.clone();
        updated_config.active_mods = list.to_vec();
        self.active_mods = Some(list);
        self.mods_config = Some(updated_config.clone());
        Ok(GameConfigWriteResult {
            active_mods,
            config: updated_config,
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RimrFileKind {
    GameConfigBackup,
    ModList,
    LibrarySettings,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameConfigBackupFile {
    pub kind: RimrFileKind,
    pub format_version: u32,
    pub backup_at: String,
    pub game_version: String,
    pub active_mods: Vec<String>,
    pub known_expansions: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub groups: Vec<Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModListFile {
    pub kind: RimrFileKind,
    pub format_version: u32,
    pub exported_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub game_version: Option<String>,
    pub mod_list: ModList,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibrarySettingsFile {
    pub kind: RimrFileKind,
    pub format_version: u32,
    pub exported_at: String,
    pub settings: crate::domain::LibrarySettings,
}

#[derive(Debug, Clone)]
pub struct ExportedRimrFile<T> {
    pub file: T,
    pub json: String,
}

pub struct RimrFileSerializer<'a> {
    clock: &'a dyn Clock,
}

impl<'a> RimrFileSerializer<'a> {
    pub fn new(clock: &'a dyn Clock) -> Self {
        Self { clock }
    }

    pub fn export_game_config_backup(
        &self,
        list: &ActiveModList,
        config: &ModsConfig,
        note: Option<String>,
    ) -> Result<ExportedRimrFile<GameConfigBackupFile>, CoreError> {
        let file = GameConfigBackupFile {
            kind: RimrFileKind::GameConfigBackup,
            format_version: RIMR_FILE_FORMAT_VERSION,
            backup_at: self.clock.now_rfc3339(),
            game_version: config.version.to_string(),
            active_mods: list.iter().map(ToString::to_string).collect(),
            known_expansions: config
                .known_expansions
                .iter()
                .map(ToString::to_string)
                .collect(),
            note,
            tags: Vec::new(),
            groups: Vec::new(),
        };
        serialize(file)
    }

    pub fn import_game_config_backup(
        &self,
        bytes: &[u8],
    ) -> Result<GameConfigBackupFile, CoreError> {
        parse_versioned_file(bytes, RimrFileKind::GameConfigBackup, "gameConfigBackup")
    }

    pub fn export_mod_list(
        &self,
        mod_list: &ModList,
        game_version: Option<String>,
    ) -> Result<ExportedRimrFile<ModListFile>, CoreError> {
        let file = ModListFile {
            kind: RimrFileKind::ModList,
            format_version: RIMR_FILE_FORMAT_VERSION,
            exported_at: self.clock.now_rfc3339(),
            game_version,
            mod_list: mod_list.clone(),
        };
        serialize(file)
    }

    pub fn import_mod_list(&self, bytes: &[u8]) -> Result<ModListFile, CoreError> {
        parse_versioned_file(bytes, RimrFileKind::ModList, "modList")
    }

    pub fn export_library_settings(
        &self,
        settings: &crate::domain::LibrarySettings,
    ) -> Result<ExportedRimrFile<LibrarySettingsFile>, CoreError> {
        let file = LibrarySettingsFile {
            kind: RimrFileKind::LibrarySettings,
            format_version: RIMR_FILE_FORMAT_VERSION,
            exported_at: self.clock.now_rfc3339(),
            settings: settings.clone(),
        };
        serialize(file)
    }

    pub fn import_library_settings(&self, bytes: &[u8]) -> Result<LibrarySettingsFile, CoreError> {
        parse_versioned_file(bytes, RimrFileKind::LibrarySettings, "librarySettings")
    }
}

fn serialize<T>(file: T) -> Result<ExportedRimrFile<T>, CoreError>
where
    T: Serialize + Clone,
{
    let json = serde_json::to_string_pretty(&file)?;
    Ok(ExportedRimrFile { file, json })
}

fn parse_versioned_file<T>(
    bytes: &[u8],
    expected_kind: RimrFileKind,
    kind_name: &'static str,
) -> Result<T, CoreError>
where
    T: for<'de> Deserialize<'de>,
{
    let value: Value = serde_json::from_slice(bytes).map_err(RimrFileParseError::Json)?;
    let found_kind = value
        .get("kind")
        .and_then(Value::as_str)
        .ok_or(RimrFileParseError::MissingField("kind"))?;
    if found_kind != kind_value(expected_kind) {
        return Err(RimrFileParseError::InvalidKind(found_kind.to_string()).into());
    }
    let found_version = value
        .get("formatVersion")
        .or_else(|| value.get("format_version"))
        .and_then(Value::as_u64)
        .ok_or(RimrFileParseError::MissingField("formatVersion"))? as u32;
    if found_version != RIMR_FILE_FORMAT_VERSION {
        return Err(RimrFileParseError::UnsupportedFormatVersion {
            kind: kind_name,
            expected: RIMR_FILE_FORMAT_VERSION,
            found: found_version,
        }
        .into());
    }
    serde_json::from_value(value)
        .map_err(RimrFileParseError::Json)
        .map_err(CoreError::from)
}

fn kind_value(kind: RimrFileKind) -> &'static str {
    match kind {
        RimrFileKind::GameConfigBackup => "gameConfigBackup",
        RimrFileKind::ModList => "modList",
        RimrFileKind::LibrarySettings => "librarySettings",
    }
}

#[allow(dead_code)]
fn _assert_validation_report_send_sync(_: &ValidationReport) {}
