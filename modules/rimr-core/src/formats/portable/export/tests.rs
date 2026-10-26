use super::*;
use crate::{
    domain::{ActiveModList, PackageId},
    formats::portable::import::import_backup,
};

fn ids(raw: &[&str]) -> Vec<PackageId> { raw.iter().copied().map(PackageId::new).collect() }

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
    assert_ne!(file.backup_at, "");
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
    assert_eq!(file.active_mods, [] as [std::string::String; 0]);
    assert_eq!(file.known_expansions, [] as [std::string::String; 0]);
}

#[test]
fn build_backup_default_meta() {
    let list = ActiveModList::from_slice(&ids(&["a"]));
    let file = build_backup(&list, "1.5", &[], BackupMeta::default());
    assert_eq!(file.rimr_meta.note, None);
    assert_eq!(file.rimr_meta.tags, [] as [std::string::String; 0]);
    assert_eq!(file.rimr_meta.groups, [] as [serde_json::Value; 0]);
}

#[test]
fn iso8601_epoch_zero() {
    assert_eq!(format_unix_time_iso8601(0), "1970-01-01T00:00:00Z");
}

#[test]
fn iso8601_known_timestamp() {
    assert_eq!(
        format_unix_time_iso8601(1_718_700_000),
        "2024-06-18T08:40:00Z"
    );
}
