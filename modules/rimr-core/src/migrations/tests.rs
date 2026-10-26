use super::{DocumentKind, MigrationError, migrate_document};
use serde_json::json;

#[test]
fn app_config_v3_gains_game_data_dir() {
    let mut value = json!({
        "formatVersion": 3,
        "paths": { "configDir": "C:/Users/x/AppData/LocalLow/Ludeon/RimWorld/Config" },
    });
    let outcome = migrate_document(DocumentKind::AppConfig, &mut value).unwrap();
    assert!(outcome.changed());
    assert_eq!(outcome.from_version, 3);
    assert_eq!(outcome.to_version, 4);
    assert_eq!(
        value["paths"]["gameDataDir"],
        json!("C:/Users/x/AppData/LocalLow/Ludeon/RimWorld")
    );
    assert_eq!(value["formatVersion"], json!(4));
}

#[test]
fn app_config_v1_walks_the_whole_chain() {
    let mut value = json!({
        "formatVersion": 1,
        "paths": { "configDir": "/home/x/RimWorld/Config" },
    });
    let outcome = migrate_document(DocumentKind::AppConfig, &mut value).unwrap();
    assert_eq!(outcome.from_version, 1);
    assert_eq!(outcome.to_version, 4);
    assert_eq!(value["paths"]["gameDataDir"], json!("/home/x/RimWorld"));
}

#[test]
fn app_config_keeps_existing_game_data_dir() {
    let mut value = json!({
        "formatVersion": 3,
        "paths": { "configDir": "/a/Config", "gameDataDir": "/kept" },
    });
    migrate_document(DocumentKind::AppConfig, &mut value).unwrap();
    assert_eq!(value["paths"]["gameDataDir"], json!("/kept"));
}

#[test]
fn current_version_is_untouched() {
    let mut value = json!({ "formatVersion": 4, "paths": {} });
    let before = value.clone();
    let outcome = migrate_document(DocumentKind::AppConfig, &mut value).unwrap();
    assert!(!outcome.changed());
    assert_eq!(value, before);
}

#[test]
fn snake_case_version_key_is_normalized() {
    let mut value = json!({ "format_version": 3, "paths": { "configDir": "/a/Config" } });
    migrate_document(DocumentKind::AppConfig, &mut value).unwrap();
    assert_eq!(value["formatVersion"], json!(4));
    assert!(value.get("format_version").is_none());
}

#[test]
fn newer_version_is_rejected() {
    let mut value = json!({ "formatVersion": 99, "paths": {} });
    assert!(matches!(
        migrate_document(DocumentKind::AppConfig, &mut value),
        Err(MigrationError::TooNew { found: 99, .. })
    ));
}

#[test]
fn missing_version_is_rejected() {
    let mut value = json!({ "paths": {} });
    assert!(matches!(
        migrate_document(DocumentKind::AppConfig, &mut value),
        Err(MigrationError::MissingVersion { .. })
    ));
}

#[test]
fn non_object_is_rejected() {
    let mut value = json!([1, 2, 3]);
    assert!(matches!(
        migrate_document(DocumentKind::AppConfig, &mut value),
        Err(MigrationError::NotAnObject { .. })
    ));
}

#[test]
fn library_documents_at_target_pass_through() {
    for kind in [
        DocumentKind::LibrarySettings,
        DocumentKind::ModListIndex,
        DocumentKind::ModList,
    ] {
        let mut value = json!({ "formatVersion": kind.target_version() });
        let outcome = migrate_document(kind, &mut value).unwrap();
        assert!(!outcome.changed());
    }
}

#[test]
fn library_documents_without_a_path_report_no_path() {
    let mut value = json!({ "formatVersion": 0 });
    assert!(matches!(
        migrate_document(DocumentKind::ModList, &mut value),
        Err(MigrationError::NoPath { found: 0, .. })
    ));
}
