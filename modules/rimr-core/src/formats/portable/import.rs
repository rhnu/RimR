//! Backup import: parse a BackupFile with lenient handling of unknown fields.

use crate::error::CoreError;
use crate::formats::portable::schema::BackupFile;

/// Imports a `.rimr.json` backup file from bytes.
///
/// Unknown fields are silently ignored (serde default behavior with
/// `#[serde(default)]` on `BackupMeta`). Returns
/// `CoreError::BackupInvalid` if the JSON is malformed or required fields
/// are missing.
pub fn import_backup(bytes: &[u8]) -> Result<BackupFile, CoreError> {
    tracing::info!("importing backup file");
    let file: BackupFile = serde_json::from_slice(bytes)
        .map_err(|e| CoreError::BackupInvalid(format!("backup parse error: {}", e)))?;
    tracing::info!(active_mods = file.active_mods.len(), "backup file imported");
    Ok(file)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::CoreError;

    const VALID_BACKUP_JSON: &str = r#"{
  "format_version": 1,
  "backup_at": "2026-06-18T12:00:00Z",
  "game_version": "1.5.4104 rev435",
  "active_mods": ["ludeon.rimworld", "brrainz.harmony", "bs.fishery"],
  "known_expansions": ["ludeon.rimworld.royalty"],
  "rimr_meta": {
    "note": "My mod list",
    "tags": [],
    "groups": []
  }
}"#;

    #[test]
    fn parses_valid_full_json() {
        let file = import_backup(VALID_BACKUP_JSON.as_bytes()).unwrap();
        assert_eq!(file.format_version, 1);
        assert_eq!(file.backup_at, "2026-06-18T12:00:00Z");
        assert_eq!(file.game_version, "1.5.4104 rev435");
        assert_eq!(
            file.active_mods,
            vec!["ludeon.rimworld", "brrainz.harmony", "bs.fishery"]
        );
        assert_eq!(file.known_expansions, vec!["ludeon.rimworld.royalty"]);
        assert_eq!(file.rimr_meta.note.as_deref(), Some("My mod list"));
        assert!(file.rimr_meta.tags.is_empty());
        assert!(file.rimr_meta.groups.is_empty());
    }

    #[test]
    fn ignores_unknown_top_level_field() {
        let json = r#"{
            "format_version": 1,
            "backup_at": "2026-06-18T12:00:00Z",
            "game_version": "1.5",
            "active_mods": [],
            "known_expansions": [],
            "extra": 123
        }"#;
        let file = import_backup(json.as_bytes()).unwrap();
        assert_eq!(file.format_version, 1);
    }

    #[test]
    fn ignores_unknown_rimr_meta_subfield() {
        let json = r#"{
            "format_version": 1,
            "backup_at": "2026-06-18T12:00:00Z",
            "game_version": "1.5",
            "active_mods": [],
            "known_expansions": [],
            "rimr_meta": { "note": "n", "future": "x" }
        }"#;
        let file = import_backup(json.as_bytes()).unwrap();
        assert_eq!(file.rimr_meta.note.as_deref(), Some("n"));
    }

    #[test]
    fn missing_rimr_meta_defaults() {
        let json = r#"{
            "format_version": 1,
            "backup_at": "2026-06-18T12:00:00Z",
            "game_version": "1.5",
            "active_mods": [],
            "known_expansions": []
        }"#;
        let file = import_backup(json.as_bytes()).unwrap();
        assert_eq!(file.rimr_meta.note, None);
        assert!(file.rimr_meta.tags.is_empty());
        assert!(file.rimr_meta.groups.is_empty());
    }

    #[test]
    fn malformed_json_returns_backup_invalid() {
        let result = import_backup(b"not json");
        assert!(matches!(result, Err(CoreError::BackupInvalid(_))));
    }

    #[test]
    fn missing_format_version_errors() {
        let json = r#"{
            "backup_at": "2026-06-18T12:00:00Z",
            "game_version": "1.5",
            "active_mods": [],
            "known_expansions": []
        }"#;
        let result = import_backup(json.as_bytes());
        assert!(matches!(result, Err(CoreError::BackupInvalid(_))));
    }

    #[test]
    fn missing_active_mods_errors() {
        let json = r#"{
            "format_version": 1,
            "backup_at": "2026-06-18T12:00:00Z",
            "game_version": "1.5",
            "known_expansions": []
        }"#;
        let result = import_backup(json.as_bytes());
        assert!(matches!(result, Err(CoreError::BackupInvalid(_))));
    }

    #[test]
    fn missing_backup_at_errors() {
        let json = r#"{
            "format_version": 1,
            "game_version": "1.5",
            "active_mods": [],
            "known_expansions": []
        }"#;
        let result = import_backup(json.as_bytes());
        assert!(matches!(result, Err(CoreError::BackupInvalid(_))));
    }

    #[test]
    fn empty_active_mods_parses() {
        let json = r#"{
            "format_version": 1,
            "backup_at": "2026-06-18T12:00:00Z",
            "game_version": "1.5",
            "active_mods": [],
            "known_expansions": []
        }"#;
        let file = import_backup(json.as_bytes()).unwrap();
        assert!(file.active_mods.is_empty());
    }

    #[test]
    fn groups_complex_structure_parses() {
        let json = r#"{
            "format_version": 1,
            "backup_at": "2026-06-18T12:00:00Z",
            "game_version": "1.5",
            "active_mods": ["a"],
            "known_expansions": [],
            "rimr_meta": {
                "note": null,
                "tags": ["t1", "t2"],
                "groups": [
                    {"id": 1, "mods": ["a", "b"]},
                    {"id": 2, "mods": ["c"]},
                    [1, 2, 3],
                    "literal-string",
                    42,
                    null,
                    true
                ]
            }
        }"#;
        let file = import_backup(json.as_bytes()).unwrap();
        assert_eq!(file.rimr_meta.tags, vec!["t1", "t2"]);
        assert_eq!(file.rimr_meta.groups.len(), 7);
        assert_eq!(
            file.rimr_meta.groups[0],
            serde_json::json!({"id": 1, "mods": ["a", "b"]})
        );
        assert_eq!(file.rimr_meta.groups[2], serde_json::json!([1, 2, 3]));
        assert_eq!(
            file.rimr_meta.groups[3],
            serde_json::json!("literal-string")
        );
        assert_eq!(file.rimr_meta.groups[4], serde_json::json!(42));
        assert_eq!(file.rimr_meta.groups[5], serde_json::Value::Null);
        assert_eq!(file.rimr_meta.groups[6], serde_json::Value::Bool(true));
    }
}
