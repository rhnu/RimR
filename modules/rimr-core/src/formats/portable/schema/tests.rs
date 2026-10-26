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
    assert_eq!(parsed.rimr_meta.tags, [] as [std::string::String; 0]);
    assert_eq!(parsed.rimr_meta.groups, [] as [serde_json::Value; 0]);
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
