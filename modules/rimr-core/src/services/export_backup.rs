//! Backup export use case.
//!
//! Combines [`crate::formats::portable::build_backup`] and
//! [`crate::formats::portable::serialize_backup`] into a single call that
//! produces both the structured [`BackupFile`] and the serialized JSON string.

use crate::{
    domain::ActiveModList,
    error::CoreError,
    formats::{BackupFile, BackupMeta, ModsConfig, build_backup, serialize_backup},
};

/// Result of exporting a backup.
#[derive(Debug, Clone)]
pub struct ExportBackupResult {
    /// The structured backup file.
    pub file: BackupFile,
    /// Pretty-printed `.rimr.json` content.
    pub json: String,
}

/// Exports the current active list and config as a `.rimr.json` backup.
///
/// `config.version` becomes the `game_version` snapshot;
/// `config.known_expansions` becomes the `known_expansions` list. The
/// `rimr_meta` note/tags/groups are carried through from `meta`.
/// # Errors
///
/// Returns a JSON error if the backup cannot be serialized.
pub fn export_backup(
    list: &ActiveModList,
    config: &ModsConfig,
    meta: BackupMeta,
) -> Result<ExportBackupResult, CoreError> {
    tracing::info!(active_mods = list.len(), "exporting game config backup");
    let file = build_backup(list, &config.version, &config.known_expansions, meta);
    let json = serialize_backup(&file)?;
    tracing::info!("game config backup serialized");
    Ok(ExportBackupResult { file, json })
}

#[cfg(test)]
mod tests;
