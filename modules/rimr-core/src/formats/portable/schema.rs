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
    /// RimR extra metadata.
    #[serde(default)]
    pub rimr_meta: BackupMeta,
}

/// RimR extra metadata carried in a backup file.
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
mod tests {
    use super::*;

    fn sample_file() -> BackupFile {
        BackupFile {
            format_version: CURRENT_FORMAT_VERSION,
            backup_at: "2026-06-18T12:00:00Z".to_string(),
            game_version: "1.5.4104 rev435".to_string(),
            active_mods: vec!["ludeon.rimworld".to_string(), "brrainz.harmony".to_string()],
            known_expansions: vec!["ludeon.rimworld.royalty".to_string()],
            rimr_meta: BackupMeta {
                note: Some("My list".to_string()),
                tags: vec!["alpha".to_string()],
                groups: vec![serde_json::json!({"id": 1})],
            },
        }
    }

    #[test]
    fn serde_roundtrip_preserves_fields() {
        let original = sample_file();
        let json = serde_json::to_string(&original).unwrap();
        let parsed: BackupFile = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.format_version, original.format_version);
        assert_eq!(parsed.backup_at, original.backup_at);
        assert_eq!(parsed.game_version, original.game_version);
        assert_eq!(parsed.active_mods, original.active_mods);
        assert_eq!(parsed.known_expansions, original.known_expansions);
        assert_eq!(parsed.rimr_meta.note, original.rimr_meta.note);
        assert_eq!(parsed.rimr_meta.tags, original.rimr_meta.tags);
        assert_eq!(parsed.rimr_meta.groups, original.rimr_meta.groups);
    }

    #[test]
    fn unknown_top_level_field_ignored() {
        let json = r#"{
            "format_version": 1,
            "backup_at": "2026-06-18T12:00:00Z",
            "game_version": "1.5",
            "active_mods": [],
            "known_expansions": [],
            "unknownField": 42
        }"#;
        let parsed: BackupFile = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.format_version, 1);
        assert_eq!(parsed.game_version, "1.5");
    }

    #[test]
    fn missing_rimr_meta_uses_default() {
        let json = r#"{
            "format_version": 1,
            "backup_at": "2026-06-18T12:00:00Z",
            "game_version": "1.5",
            "active_mods": [],
            "known_expansions": []
        }"#;
        let parsed: BackupFile = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.rimr_meta.note, None);
        assert!(parsed.rimr_meta.tags.is_empty());
        assert!(parsed.rimr_meta.groups.is_empty());
    }

    #[test]
    fn missing_note_defaults_to_none() {
        let json = r#"{
            "format_version": 1,
            "backup_at": "2026-06-18T12:00:00Z",
            "game_version": "1.5",
            "active_mods": [],
            "known_expansions": [],
            "rimr_meta": { "tags": [], "groups": [] }
        }"#;
        let parsed: BackupFile = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.rimr_meta.note, None);
    }

    #[test]
    fn groups_accepts_arbitrary_json_values() {
        let json = r#"{
            "format_version": 1,
            "backup_at": "2026-06-18T12:00:00Z",
            "game_version": "1.5",
            "active_mods": [],
            "known_expansions": [],
            "rimr_meta": {
                "tags": [],
                "groups": [{"id":1,"name":"x"},[1,2],"literal"]
            }
        }"#;
        let parsed: BackupFile = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.rimr_meta.groups.len(), 3);
        assert_eq!(
            parsed.rimr_meta.groups[0],
            serde_json::json!({"id":1,"name":"x"})
        );
        assert_eq!(parsed.rimr_meta.groups[1], serde_json::json!([1, 2]));
        assert_eq!(parsed.rimr_meta.groups[2], serde_json::json!("literal"));
    }
}
