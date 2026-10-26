use std::{error::Error, sync::Arc};

use rimr_core::{LibrarySettings, ModListId, flatten_active_mods, mod_list_from_active_mods};
use serde_json::json;

use super::*;

struct FixedClock;

#[test]
fn order_validation_uses_version_published_with_catalog_and_refreshes_on_rescan() {
    let mut session = WorkspaceSession::default();
    let catalog = || {
        let raw = rimr_core::parse_about_xml(
            b"<ModMetaData><packageId>test.versioned</packageId><supportedVersions><li>1.5</li></supportedVersions></ModMetaData>",
        ).unwrap();
        let mut catalog = ModCatalog::new();
        catalog.insert(rimr_core::compile_metadata(
            raw,
            rimr_core::ModSourceKey::new("test.versioned"),
            rimr_core::SourceKind::Local,
            &rimr_core::CompileOpts::default(),
        ));
        catalog
    };
    session.replace_catalog(catalog(), GameVersion::parse("1.6.4633"));
    // The version in loaded game configuration can be stale after an update.
    session.replace_game_config(ModsConfig {
        version: "1.5".into(),
        active_mods: vec![],
        known_expansions: vec![],
    });
    let result = session
        .validate_active_order(vec!["test.versioned".into()])
        .unwrap();
    assert_eq!(result.report.warnings.len(), 1);
    assert_eq!(result.report.warnings[0].params["gameVersion"], "1.6.4633");

    session.replace_catalog(catalog(), GameVersion::parse("1.5"));
    assert!(
        session
            .validate_active_order(vec!["test.versioned".into()])
            .unwrap()
            .report
            .is_clean()
    );
    session.replace_catalog(catalog(), GameVersion::unknown());
    assert!(
        session
            .validate_active_order(vec!["test.versioned".into()])
            .unwrap()
            .report
            .is_clean()
    );
    session.clear();
    assert!(
        session
            .validate_active_order(vec!["test.versioned".into()])
            .is_err()
    );
}

impl Clock for FixedClock {
    fn now_rfc3339(&self) -> String { "2026-01-01T00:00:00Z".into() }
}

#[test]
fn old_mod_lists_use_entries_and_receive_fresh_identity() {
    let serializer = RimrFileSerializer::new(&FixedClock);
    for version in [1, 2] {
        let mut value = json!({
            "kind": "modList", "formatVersion": version, "exportedAt": "old",
            "modList": {
                "formatVersion": version, "id": "named-list", "name": "Imported",
                "activeMods": ["stale"],
                "entries": [{"kind": "mod", "id": "mod-a", "identity": {"packageId": "actual"}}]
            }
        });
        if version == 1 {
            value["modList"].as_object_mut().unwrap().remove("entries");
            value["modList"]["activeMods"] = json!(["actual"]);
        }
        let bytes = serde_json::to_vec(&value).unwrap();
        let file = serializer.import_mod_list(&bytes).unwrap();
        let another = serializer.import_mod_list(&bytes).unwrap();
        assert_eq!(flatten_active_mods(&file.mod_list.entries), ["actual"]);
        assert_ne!(file.mod_list.id, another.mod_list.id);
        assert_ne!(file.mod_list.entries, another.mod_list.entries);
        assert_eq!(file.format_version, RIMR_FILE_FORMAT_VERSION);
    }
}

#[test]
fn old_settings_remap_tag_references_for_both_portable_versions() {
    let serializer = RimrFileSerializer::new(&FixedClock);
    for version in [1, 2] {
        let bytes = serde_json::to_vec(&json!({
            "kind": "librarySettings", "formatVersion": version, "exportedAt": "old",
            "settings": {
                "formatVersion": version, "aliases": [],
                "tagDefs": [{"id": "favorite", "name": "Favorite"}],
                "modTags": [{"identity": {"packageId": "a"}, "tagIds": ["favorite"]}]
            }
        }))
        .unwrap();
        let file = serializer.import_library_settings(&bytes).unwrap();
        assert_eq!(
            file.settings.mod_tags[0].tag_ids,
            [file.settings.tag_defs[0].id]
        );
        assert_eq!(file.settings.tag_defs[0].id.as_uuid().get_version_num(), 4);
    }
}

#[test]
fn historical_game_backups_keep_extra_metadata() {
    let serializer = RimrFileSerializer::new(&FixedClock);
    let v1 = json!({
        "format_version": 1, "backup_at": "old", "game_version": "1.6",
        "active_mods": ["a"], "known_expansions": ["dlc"],
        "rimr_meta": {"note": "note", "tags": ["favorite"], "groups": [{"custom": "data"}]}
    });
    let old = serializer
        .import_game_config_backup(&serde_json::to_vec(&v1).unwrap())
        .unwrap();
    assert_eq!(old.note.as_deref(), Some("note"));
    assert_eq!(old.tags, ["favorite"]);
    assert_eq!(old.groups, [json!({"custom": "data"})]);
    let v2 = json!({
        "kind": "gameConfigBackup", "formatVersion": 2, "backupAt": "old", "gameVersion": "1.6",
        "activeMods": ["a"], "knownExpansions": ["dlc"], "note": "note", "tags": ["favorite"],
        "groups": [{"custom": "data"}]
    });
    let newer = serializer
        .import_game_config_backup(&serde_json::to_vec(&v2).unwrap())
        .unwrap();
    assert_eq!(old.active_mods, newer.active_mods);
    assert_eq!(old.note, newer.note);
    assert_eq!(old.tags, newer.tags);
    assert_eq!(old.groups, newer.groups);
}

#[test]
fn current_portable_roundtrip_has_only_entries_as_order_source() {
    let serializer = RimrFileSerializer::new(&FixedClock);
    let list = mod_list_from_active_mods(ModListId::new(), "List", &["a".into()], None);
    let exported = serializer.export_mod_list(&list, None).unwrap();
    let value: Value = serde_json::from_str(&exported.json).unwrap();
    assert_eq!(value["formatVersion"], 3);
    assert!(value["modList"].get("activeMods").is_none());
    assert!(value["modList"].get("formatVersion").is_none());
    let imported = serializer
        .import_mod_list(exported.json.as_bytes())
        .unwrap();
    assert_eq!(imported.mod_list, list);
    let settings = LibrarySettings::default();
    let exported = serializer.export_library_settings(&settings).unwrap();
    assert_eq!(
        serializer
            .import_library_settings(exported.json.as_bytes())
            .unwrap()
            .settings,
        settings
    );
}

#[test]
fn future_versions_wrong_kind_and_current_legacy_payload_are_rejected() {
    let serializer = RimrFileSerializer::new(&FixedClock);
    let future = serializer
        .import_mod_list(br#"{"kind":"modList","formatVersion":4}"#)
        .unwrap_err();
    assert!(matches!(
        future
            .source()
            .unwrap()
            .downcast_ref::<RimrFileParseError>(),
        Some(RimrFileParseError::UnsupportedFormatVersion { found: 4, .. })
    ));
    assert!(
        serializer
            .import_mod_list(br#"{"kind":"librarySettings","formatVersion":3}"#)
            .is_err()
    );
    let current_with_old_payload = json!({"kind":"modList","formatVersion":3,"exportedAt":"now", "modList":{"formatVersion":2,"id":"old-name","name":"Old","entries":[]}});
    assert!(
        serializer
            .import_mod_list(&serde_json::to_vec(&current_with_old_payload).unwrap())
            .is_err()
    );
}

#[test]
fn malformed_json_retains_source_and_duplicate_entry_ids_are_rejected() {
    let serializer = RimrFileSerializer::new(&FixedClock);
    let malformed = serializer.import_mod_list(b"{").unwrap_err();
    assert!(
        malformed
            .source()
            .unwrap()
            .downcast_ref::<serde_json::Error>()
            .is_some()
    );
    let mut list = mod_list_from_active_mods(ModListId::new(), "List", &["a".into()], None);
    list.entries.push(list.entries[0].clone());
    assert!(serializer.export_mod_list(&list, None).is_err());
    let value = json!({"kind":"modList","formatVersion":3,"exportedAt":"now", "modList":list});
    assert!(
        serializer
            .import_mod_list(&serde_json::to_vec(&value).unwrap())
            .is_err()
    );
}

fn config(package: &str) -> ModsConfig {
    ModsConfig {
        version: Arc::from("1.6"),
        active_mods: vec![PackageId::new(package)],
        known_expansions: Vec::new(),
    }
}

#[test]
fn partial_session_publication_preserves_independent_state() {
    let original_config = config("original");
    let mut published = WorkspaceSession::default();
    published.replace_game_config(original_config.clone());
    published.replace_catalog(ModCatalog::new(), GameVersion::unknown());
    assert_eq!(published.mods_config(), Some(&original_config));
    assert!(published.catalog().is_some());
    let updated_config = config("updated");
    published.replace_game_config(updated_config.clone());
    assert!(published.catalog().is_some());
    assert_eq!(published.mods_config(), Some(&updated_config));
    assert_eq!(
        published.active_mods().unwrap().as_slice(),
        [PackageId::new("updated")]
    );
}

#[test]
fn suppression_settings_reject_corruption_and_duplicates_at_snapshot_and_portable_boundaries() {
    let rule = rimr_core::Diagnostic::new(
        rimr_core::Severity::Warning,
        rimr_core::DiagnosticCode::ActiveModMissing,
        "missing",
    )
    .with_related_packages(vec![PackageId::new("a")])
    .with_suppression_identity(rimr_core::DiagnosticIdentity::new().with_field("packageId", "a"))
    .suppression()
    .unwrap();
    let settings = LibrarySettings {
        diagnostic_suppressions: vec![rule.clone()],
        ..LibrarySettings::default()
    };
    let serializer = RimrFileSerializer::new(&FixedClock);
    let exported = serializer.export_library_settings(&settings).unwrap();
    assert_eq!(
        serializer
            .import_library_settings(exported.json.as_bytes())
            .unwrap()
            .settings,
        settings
    );
    let mut snapshot = crate::current::LibrarySnapshot {
        settings,
        ..crate::current::LibrarySnapshot::default()
    };
    assert!(snapshot.validate().is_ok());
    snapshot.settings.diagnostic_suppressions.push(rule);
    assert!(snapshot.validate().is_err());
    let mut value: Value = serde_json::from_str(&exported.json).unwrap();
    value["settings"]["diagnosticSuppressions"][0]["gameVersion"] = json!("1.8");
    assert!(
        serializer
            .import_library_settings(&serde_json::to_vec(&value).unwrap())
            .is_err()
    );
    snapshot.settings.diagnostic_suppressions.truncate(1);
    snapshot.settings.diagnostic_suppressions[0].key = "v1:".into();
    assert!(snapshot.validate().is_err());
}
