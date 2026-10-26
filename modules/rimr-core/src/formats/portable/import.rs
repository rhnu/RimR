//! Backup import: parse a `BackupFile` with lenient handling of unknown fields.

use crate::{error::CoreError, formats::portable::schema::BackupFile};

/// Imports a `.rimr.json` backup file from bytes.
///
/// Unknown fields are silently ignored (serde default behavior with
/// `#[serde(default)]` on `BackupMeta`). Returns
/// `CoreError::BackupInvalid` if the JSON is malformed or required fields
/// are missing.
/// # Errors
///
/// Returns an invalid-backup error if JSON is malformed or required fields are missing.
pub fn import_backup(bytes: &[u8]) -> Result<BackupFile, CoreError> {
    tracing::info!("importing backup file");
    let file: BackupFile = serde_json::from_slice(bytes)
        .map_err(|e| CoreError::BackupInvalid(format!("backup parse error: {e}")))?;
    tracing::info!(active_mods = file.active_mods.len(), "backup file imported");
    Ok(file)
}

#[cfg(test)]
mod tests;
