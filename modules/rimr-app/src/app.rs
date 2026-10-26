//! Application use cases and runtime session state.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{
    domain::{ActiveModList, GameVersion, ModCatalog, ModList, PackageId},
    error::{AppError, AppErrorCode, AppResult, RimrFileParseError},
    formats::ModsConfig,
    ports::Clock,
    services,
};

pub const RIMR_FILE_FORMAT_VERSION: u32 = 3;

/// Application-owned runtime state for a `RimR` workspace session.
#[derive(Debug, Default)]
pub struct WorkspaceSession {
    catalog: Option<(ModCatalog, GameVersion)>,
    active_mods: Option<ActiveModList>,
    mods_config: Option<ModsConfig>,
}

impl WorkspaceSession {
    pub fn catalog(&self) -> Option<&ModCatalog> {
        self.catalog.as_ref().map(|(catalog, _)| catalog)
    }

    pub fn active_mods(&self) -> Option<&ActiveModList> { self.active_mods.as_ref() }

    pub fn mods_config(&self) -> Option<&ModsConfig> { self.mods_config.as_ref() }

    /// Publishes a completed scan without replacing loaded game state.
    pub fn replace_catalog(&mut self, catalog: ModCatalog, game_version: GameVersion) {
        self.catalog = Some((catalog, game_version));
    }

    /// Publishes game state without replacing the latest catalog.
    pub fn replace_game_config(&mut self, config: ModsConfig) {
        self.active_mods = Some(ActiveModList::from_slice(&config.active_mods));
        self.mods_config = Some(config);
    }

    pub fn clear(&mut self) {
        self.catalog = None;
        self.active_mods = None;
        self.mods_config = None;
    }

    /// # Errors
    ///
    /// Returns a missing-session error if the catalog has not been loaded.
    pub fn validate_active_order(
        &self,
        active_mods: Vec<String>,
    ) -> AppResult<crate::services::ValidateOrderResult> {
        let (catalog, game_version) = self
            .catalog
            .as_ref()
            .ok_or_else(|| AppError::new(AppErrorCode::StateMissing, "catalog is not loaded"))?;
        let ids = active_mods
            .into_iter()
            .map(|package_id| PackageId::new(&package_id))
            .collect::<Vec<_>>();
        let list = ActiveModList::from_slice(&ids);
        Ok(services::validate_order(
            catalog,
            &list,
            &crate::rules::ValidateOpts {
                game_version: Some(game_version.clone()),
            },
        ))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RimrFileKind {
    GameConfigBackup,
    ModList,
    LibrarySettings,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModListFile {
    pub kind: RimrFileKind,
    pub format_version: u32,
    pub exported_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub game_version: Option<String>,
    pub mod_list: ModList,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
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
    pub fn new(clock: &'a dyn Clock) -> Self { Self { clock } }

    /// # Errors
    ///
    /// Returns a JSON error if the backup cannot be serialized.
    pub fn export_game_config_backup(
        &self,
        list: &ActiveModList,
        config: &ModsConfig,
        note: Option<String>,
    ) -> AppResult<ExportedRimrFile<GameConfigBackupFile>> {
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
        validate_backup(&file)?;
        serialize(file)
    }

    /// # Errors
    ///
    /// Returns a file-parse error if JSON, kind, version, or required fields are invalid.
    pub fn import_game_config_backup(&self, bytes: &[u8]) -> AppResult<GameConfigBackupFile> {
        let (value, version) = parse_envelope(bytes, RimrFileKind::GameConfigBackup)?;
        let file = if version == 1 && value.get("kind").is_none() {
            let legacy: LegacyGameConfigBackup = serde_json::from_value(value)?;
            GameConfigBackupFile {
                kind: RimrFileKind::GameConfigBackup,
                format_version: RIMR_FILE_FORMAT_VERSION,
                backup_at: legacy.backup_at,
                game_version: legacy.game_version,
                active_mods: legacy.active_mods,
                known_expansions: legacy.known_expansions,
                note: legacy.rimr_meta.note,
                tags: legacy.rimr_meta.tags,
                groups: legacy.rimr_meta.groups,
            }
        } else {
            serde_json::from_value(value)?
        };
        validate_backup(&file)?;
        Ok(file)
    }

    /// # Errors
    ///
    /// Returns a JSON error if the mod list cannot be serialized.
    pub fn export_mod_list(
        &self,
        mod_list: &ModList,
        game_version: Option<String>,
    ) -> AppResult<ExportedRimrFile<ModListFile>> {
        let file = ModListFile {
            kind: RimrFileKind::ModList,
            format_version: RIMR_FILE_FORMAT_VERSION,
            exported_at: self.clock.now_rfc3339(),
            game_version,
            mod_list: mod_list.clone(),
        };
        validate_mod_list(&file.mod_list)?;
        serialize(file)
    }

    /// # Errors
    ///
    /// Returns a file-parse error if JSON, kind, version, or required fields are invalid.
    pub fn import_mod_list(&self, bytes: &[u8]) -> AppResult<ModListFile> {
        let (value, version) = parse_envelope(bytes, RimrFileKind::ModList)?;
        let file = if version == RIMR_FILE_FORMAT_VERSION {
            serde_json::from_value(value)?
        } else {
            let envelope: LegacyModListEnvelope = serde_json::from_value(value.clone())?;
            ModListFile {
                kind: RimrFileKind::ModList,
                format_version: RIMR_FILE_FORMAT_VERSION,
                exported_at: envelope.exported_at,
                game_version: envelope.game_version,
                mod_list: crate::legacy::portable_mod_list(&value)?,
            }
        };
        validate_mod_list(&file.mod_list)?;
        Ok(file)
    }

    /// # Errors
    ///
    /// Returns a JSON error if library settings cannot be serialized.
    pub fn export_library_settings(
        &self,
        settings: &crate::domain::LibrarySettings,
    ) -> AppResult<ExportedRimrFile<LibrarySettingsFile>> {
        let file = LibrarySettingsFile {
            kind: RimrFileKind::LibrarySettings,
            format_version: RIMR_FILE_FORMAT_VERSION,
            exported_at: self.clock.now_rfc3339(),
            settings: settings.clone(),
        };
        validate_settings(&file.settings)?;
        serialize(file)
    }

    /// # Errors
    ///
    /// Returns a file-parse error if JSON, kind, version, or required fields are invalid.
    pub fn import_library_settings(&self, bytes: &[u8]) -> AppResult<LibrarySettingsFile> {
        let (value, version) = parse_envelope(bytes, RimrFileKind::LibrarySettings)?;
        let file = if version == RIMR_FILE_FORMAT_VERSION {
            serde_json::from_value(value)?
        } else {
            let envelope: LegacySettingsEnvelope = serde_json::from_value(value.clone())?;
            LibrarySettingsFile {
                kind: RimrFileKind::LibrarySettings,
                format_version: RIMR_FILE_FORMAT_VERSION,
                exported_at: envelope.exported_at,
                settings: crate::legacy::portable_settings(&value)?,
            }
        };
        validate_settings(&file.settings)?;
        Ok(file)
    }
}

#[derive(Deserialize)]
struct LegacyGameConfigBackup {
    backup_at: String,
    game_version: String,
    active_mods: Vec<String>,
    known_expansions: Vec<String>,
    #[serde(default)]
    rimr_meta: LegacyBackupMeta,
}

#[derive(Default, Deserialize)]
#[serde(default)]
struct LegacyBackupMeta {
    note: Option<String>,
    tags: Vec<String>,
    groups: Vec<Value>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LegacyModListEnvelope {
    exported_at: String,
    game_version: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LegacySettingsEnvelope {
    exported_at: String,
}

fn validate_mod_list(list: &ModList) -> AppResult<()> {
    crate::current::LibrarySnapshot {
        mod_lists: vec![list.clone()],
        current_mod_list_id: Some(list.id),
        ..crate::current::LibrarySnapshot::default()
    }
    .validate()
}

fn validate_settings(settings: &crate::domain::LibrarySettings) -> AppResult<()> {
    crate::current::LibrarySnapshot {
        settings: settings.clone(),
        ..crate::current::LibrarySnapshot::default()
    }
    .validate()
}

fn validate_backup(backup: &GameConfigBackupFile) -> AppResult<()> {
    if backup.game_version.trim().is_empty()
        || backup
            .active_mods
            .iter()
            .chain(&backup.known_expansions)
            .any(|id| id.trim().is_empty())
    {
        return Err(AppError::new(
            AppErrorCode::BackupInvalid,
            "backup contains an empty game version or package ID",
        ));
    }
    Ok(())
}

fn serialize<T: Serialize>(file: T) -> AppResult<ExportedRimrFile<T>> {
    let json = serde_json::to_string_pretty(&file)?;
    Ok(ExportedRimrFile { file, json })
}

/// Selects a decoder before interpreting payloads; current files never use legacy conversion.
fn parse_envelope(bytes: &[u8], expected_kind: RimrFileKind) -> AppResult<(Value, u32)> {
    let value: Value = serde_json::from_slice(bytes)?;
    let version = value
        .get("formatVersion")
        .or_else(|| value.get("format_version"))
        .ok_or_else(|| file_error(RimrFileParseError::MissingField("formatVersion")))?;
    let version: u32 = serde_json::from_value(version.clone())?;
    if !(1..=RIMR_FILE_FORMAT_VERSION).contains(&version) {
        return Err(file_error(RimrFileParseError::UnsupportedFormatVersion {
            kind: kind_value(expected_kind),
            expected: RIMR_FILE_FORMAT_VERSION,
            found: version,
        }));
    }
    let legacy_backup = version == 1
        && expected_kind == RimrFileKind::GameConfigBackup
        && value.get("kind").is_none();
    if !legacy_backup {
        let kind = value
            .get("kind")
            .and_then(Value::as_str)
            .ok_or_else(|| file_error(RimrFileParseError::MissingField("kind")))?;
        if kind != kind_value(expected_kind) {
            return Err(file_error(RimrFileParseError::InvalidKind(
                kind.to_string(),
            )));
        }
    }
    Ok((value, version))
}

fn file_error(source: RimrFileParseError) -> AppError {
    AppError::new(AppErrorCode::BackupInvalid, "portable document is invalid").with_source(source)
}

fn kind_value(kind: RimrFileKind) -> &'static str {
    match kind {
        RimrFileKind::GameConfigBackup => "gameConfigBackup",
        RimrFileKind::ModList => "modList",
        RimrFileKind::LibrarySettings => "librarySettings",
    }
}

#[cfg(test)]
mod tests;
