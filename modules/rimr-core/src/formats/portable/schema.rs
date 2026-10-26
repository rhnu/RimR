//! Backup file data structures.

use serde::{Deserialize, Serialize};

/// Current backup format version.
pub const CURRENT_FORMAT_VERSION: u32 = 1;

/// The top-level `.rimr.json` backup file structure.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupFile {
    /// Backup format schema version (currently 1).
    pub format_version: u32,
    /// ISO 8601 timestamp when the backup was created.
    pub backup_at: String,
    /// Game version snapshot at backup time (e.g. "1.5.4104 rev435").
    pub game_version: String,
    /// Active mod package ids in load order.
    pub active_mods: Vec<String>,
    /// Known expansions (DLC package ids) at backup time.
    pub known_expansions: Vec<String>,
    /// `RimR` extra metadata.
    #[serde(default)]
    pub rimr_meta: BackupMeta,
}

/// `RimR` extra metadata carried in a backup file.
///
/// `tags` and `groups` are reserved for future use. v1 writes empty arrays
/// and parses them leniently (unknown sub-fields ignored).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct BackupMeta {
    /// Free-form user note.
    pub note: Option<String>,
    /// Reserved for future tagging support.
    pub tags: Vec<String>,
    /// Reserved for future grouping support. Stored as opaque JSON values
    /// so future schema additions don't break v1 parsing.
    pub groups: Vec<serde_json::Value>,
}

#[cfg(test)]
mod tests;
