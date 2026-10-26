//! Backup export: build and serialize a BackupFile.

use crate::domain::{ActiveModList, PackageId};
use crate::error::CoreError;
use crate::formats::portable::schema::{BackupFile, BackupMeta, CURRENT_FORMAT_VERSION};
use time::OffsetDateTime;
use time::format_description::well_known::Rfc3339;

/// Builds a BackupFile from the current active list and game version.
///
/// `game_version` is the snapshot string (e.g. "1.5.4104 rev435").
/// `known_expansions` is the DLC list from ModsConfig.
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
        active_mods: list.iter().map(|p| p.to_string()).collect(),
        known_expansions: known_expansions.iter().map(|p| p.to_string()).collect(),
        rimr_meta: meta,
    }
}

/// Serializes a BackupFile to a pretty-printed JSON string.
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
mod tests {
    use super::*;
    use crate::domain::{ActiveModList, PackageId};
    use crate::formats::portable::import::import_backup;

    fn ids(raw: &[&str]) -> Vec<PackageId> {
        raw.iter().copied().map(PackageId::new).collect()
    }

    #[test]
    fn build_backup_basic() {
        let list = ActiveModList::from_slice(&ids(&["a", "b", "c"]));
        let known = ids(&["x", "y"]);
        let meta = BackupMeta {
            note: Some("test".to_string()),
            tags: Vec::new(),
            groups: Vec::new(),
        };
        let file = build_backup(&list, "1.5", &known, meta);
        assert_eq!(file.format_version, CURRENT_FORMAT_VERSION);
        assert_eq!(file.game_version, "1.5");
        assert_eq!(file.active_mods, vec!["a", "b", "c"]);
        assert_eq!(file.known_expansions, vec!["x", "y"]);
        assert_eq!(file.rimr_meta.note.as_deref(), Some("test"));
        assert!(!file.backup_at.is_empty());
    }

    #[test]
    fn build_backup_preserves_order() {
        let list = ActiveModList::from_slice(&ids(&["c", "a", "b"]));
        let file = build_backup(&list, "1.5", &[], BackupMeta::default());
        assert_eq!(file.active_mods, vec!["c", "a", "b"]);
    }

    #[test]
    fn serialize_backup_contains_all_fields() {
        let list = ActiveModList::from_slice(&ids(&["a", "b"]));
        let meta = BackupMeta {
            note: Some("note".to_string()),
            tags: vec!["t1".to_string()],
            groups: Vec::new(),
        };
        let file = build_backup(&list, "1.5.4104 rev435", &ids(&["d"]), meta);
        let json = serialize_backup(&file).unwrap();
        assert!(json.contains("\"format_version\""));
        assert!(json.contains("\"backup_at\""));
        assert!(json.contains("\"game_version\""));
        assert!(json.contains("\"active_mods\""));
        assert!(json.contains("\"known_expansions\""));
        assert!(json.contains("\"rimr_meta\""));
        assert!(json.contains("\"1.5.4104 rev435\""));
        assert!(json.contains("\"a\""));
        assert!(json.contains("\"b\""));
        assert!(json.contains("\"d\""));
        assert!(json.contains("\"note\""));
    }

    #[test]
    fn serialize_backup_roundtrips_through_parse() {
        let list = ActiveModList::from_slice(&ids(&["ludeon.rimworld", "brrainz.harmony"]));
        let meta = BackupMeta {
            note: Some("roundtrip".to_string()),
            tags: vec!["alpha".to_string()],
            groups: vec![serde_json::json!({"k": 1})],
        };
        let file = build_backup(&list, "1.5", &ids(&["ludeon.rimworld.royalty"]), meta);
        let json = serialize_backup(&file).unwrap();
        let parsed = import_backup(json.as_bytes()).unwrap();
        assert_eq!(parsed.format_version, file.format_version);
        assert_eq!(parsed.backup_at, file.backup_at);
        assert_eq!(parsed.game_version, file.game_version);
        assert_eq!(parsed.active_mods, file.active_mods);
        assert_eq!(parsed.known_expansions, file.known_expansions);
        assert_eq!(parsed.rimr_meta.note, file.rimr_meta.note);
        assert_eq!(parsed.rimr_meta.tags, file.rimr_meta.tags);
        assert_eq!(parsed.rimr_meta.groups, file.rimr_meta.groups);
    }

    #[test]
    fn build_backup_empty_list() {
        let list = ActiveModList::empty();
        let file = build_backup(&list, "1.5", &[], BackupMeta::default());
        assert!(file.active_mods.is_empty());
        assert!(file.known_expansions.is_empty());
    }

    #[test]
    fn build_backup_default_meta() {
        let list = ActiveModList::from_slice(&ids(&["a"]));
        let file = build_backup(&list, "1.5", &[], BackupMeta::default());
        assert_eq!(file.rimr_meta.note, None);
        assert!(file.rimr_meta.tags.is_empty());
        assert!(file.rimr_meta.groups.is_empty());
    }

    #[test]
    fn iso8601_epoch_zero() {
        assert_eq!(format_unix_time_iso8601(0), "1970-01-01T00:00:00Z");
    }

    #[test]
    fn iso8601_known_timestamp() {
        assert_eq!(format_unix_time_iso8601(1718700000), "2024-06-18T08:40:00Z");
    }
}
