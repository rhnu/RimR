//! Backup export: build and serialize a `BackupFile`.

use time::{OffsetDateTime, format_description::well_known::Rfc3339};

use crate::{
    domain::{ActiveModList, PackageId},
    error::CoreError,
    formats::portable::schema::{BackupFile, BackupMeta, CURRENT_FORMAT_VERSION},
};

/// Builds a `BackupFile` from the current active list and game version.
///
/// `game_version` is the snapshot string (e.g. "1.5.4104 rev435").
/// `known_expansions` is the DLC list from `ModsConfig`.
pub fn build_backup(
    list: &ActiveModList,
    game_version: &str,
    known_expansions: &[PackageId],
    meta: BackupMeta,
) -> BackupFile {
    BackupFile {
        format_version: CURRENT_FORMAT_VERSION,
        backup_at: current_iso8601(),
        game_version: game_version.to_string(),
        active_mods: list.iter().map(std::string::ToString::to_string).collect(),
        known_expansions: known_expansions
            .iter()
            .map(std::string::ToString::to_string)
            .collect(),
        rimr_meta: meta,
    }
}

/// Serializes a `BackupFile` to a pretty-printed JSON string.
pub fn serialize_backup(file: &BackupFile) -> Result<String, CoreError> {
    serde_json::to_string_pretty(file).map_err(CoreError::from)
}

/// Returns the current UTC time as an ISO 8601 string.
fn current_iso8601() -> String {
    format_unix_time_iso8601(OffsetDateTime::now_utc().unix_timestamp())
}

/// Formats a Unix timestamp (seconds) as "YYYY-MM-DDTHH:MM:SSZ".
fn format_unix_time_iso8601(secs: i64) -> String {
    match OffsetDateTime::from_unix_timestamp(secs) {
        Ok(dt) => dt
            .format(&Rfc3339)
            .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string()),
        Err(_) => "1970-01-01T00:00:00Z".to_string(),
    }
}

#[cfg(test)]
mod tests;
