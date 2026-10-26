use super::*;

#[test]
fn version_exceeding_u32_cannot_wrap_to_the_supported_version() {
    let version = u64::from(u32::MAX) + 1 + u64::from(RIMR_FILE_FORMAT_VERSION);
    let bytes = serde_json::to_vec(&serde_json::json!({
        "kind": "gameConfigBackup",
        "formatVersion": version,
        "backupAt": "2026-10-26T00:00:00Z",
        "gameVersion": "1.6",
        "activeMods": [],
        "knownExpansions": [],
    }))
    .unwrap();

    let result = parse_versioned_file::<GameConfigBackupFile>(
        &bytes,
        RimrFileKind::GameConfigBackup,
        "gameConfigBackup",
    );

    assert!(matches!(
        result,
        Err(CoreError::RimrFile(RimrFileParseError::Json(_)))
    ));
}
