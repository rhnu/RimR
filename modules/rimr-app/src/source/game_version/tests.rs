use super::*;

#[tokio::test]
async fn installed_version_takes_precedence_and_data_path_is_optional() {
    let root = tempfile::tempdir().unwrap();
    std::fs::write(
        root.path().join("Version.txt"),
        "1.6.4633 rev123\nextra info",
    )
    .unwrap();
    std::fs::create_dir(root.path().join("Config")).unwrap();
    let path = root.path().join("Config/ModsConfig.xml");
    let config = b"<ModsConfigData><version>1.5.4104</version><activeMods/><knownExpansions/></ModsConfigData>";
    std::fs::write(&path, config).unwrap();

    for data_dir in [None, Some(root.path())] {
        let version = detect_game_version(Some(root.path()), data_dir).await;
        assert_eq!(version.raw(), "1.6.4633 rev123");
    }
    assert_eq!(std::fs::read(&path).unwrap(), config);
}

#[tokio::test]
async fn missing_invalid_and_unreadable_installed_versions_use_game_configuration() {
    let root = tempfile::tempdir().unwrap();
    std::fs::create_dir(root.path().join("Config")).unwrap();
    std::fs::write(root.path().join("Config/ModsConfig.xml"),
        b"<ModsConfigData><version>1.5.4104</version><activeMods/><knownExpansions/></ModsConfigData>"
    ).unwrap();
    for game_dir in [None, Some(root.path())] {
        assert_eq!(
            detect_game_version(game_dir, Some(root.path())).await.raw(),
            "1.5.4104"
        );
    }
    for contents in [b"invalid".as_slice(), b"\xff\xfe".as_slice()] {
        std::fs::write(root.path().join("Version.txt"), contents).unwrap();
        assert_eq!(
            detect_game_version(Some(root.path()), Some(root.path()))
                .await
                .raw(),
            "1.5.4104"
        );
    }
}

#[tokio::test]
async fn unavailable_paths_and_malformed_configuration_remain_unknown() {
    assert!(detect_game_version(None, None).await.is_unknown());
    let root = tempfile::tempdir().unwrap();
    assert!(
        detect_game_version(Some(root.path()), Some(root.path()))
            .await
            .is_unknown()
    );
    std::fs::create_dir(root.path().join("Config")).unwrap();
    for contents in [
        "<ModsConfigData><version>",
        "<ModsConfigData><version>invalid</version><activeMods/><knownExpansions/></ModsConfigData>",
    ] {
        std::fs::write(root.path().join("Config/ModsConfig.xml"), contents).unwrap();
        assert!(
            detect_game_version(Some(root.path()), Some(root.path()))
                .await
                .is_unknown()
        );
    }
}
