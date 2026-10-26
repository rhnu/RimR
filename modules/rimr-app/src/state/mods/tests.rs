use tempfile::tempdir;

use super::*;

#[tokio::test]
async fn game_version_is_available_before_scanning_with_only_install_path_configured() {
    let root = tempdir().unwrap();
    let mut config = crate::app_config::AppConfig::default();
    let state = AppState::with_config(None, config.clone(), None, None, false);
    assert_eq!(state.get_game_version().await.unwrap(), None);

    config.paths.game_dir = Some(root.path().to_path_buf());
    let state = AppState::with_config(None, config, None, None, false);
    assert_eq!(state.get_game_version().await.unwrap(), None);
    std::fs::write(root.path().join("Version.txt"), "1.6.4633").unwrap();
    assert_eq!(
        state.get_game_version().await.unwrap().as_deref(),
        Some("1.6.4633")
    );
    assert!(state.read_state().unwrap().workspace.catalog().is_none());
    std::fs::write(root.path().join("Version.txt"), "1.5.4104").unwrap();
    assert_eq!(
        state.get_game_version().await.unwrap().as_deref(),
        Some("1.5.4104")
    );
}

fn source(root: &Path) -> FsModSource {
    FsModSource::new(SourceRoots {
        game_dir: root.to_path_buf(),
        data_dir: root.to_path_buf(),
        local_mods_dir: Some(root.to_path_buf()),
        workshop_mods_dir: None,
    })
}

fn roots(root: &Path) -> CanonicalSourceRoots {
    CanonicalSourceRoots {
        roots: vec![std::fs::canonicalize(root).unwrap()],
    }
}

fn invalid_mod(root: &Path, name: &str) -> ModMetadata {
    let path = root.join(name);
    std::fs::create_dir_all(&path).unwrap();
    ModMetadata::invalid(
        ModSourceKey::new(path.to_string_lossy().into_owned()),
        SourceKind::Local,
    )
}

#[tokio::test]
async fn repaired_about_xml_is_no_longer_eligible() {
    let dir = tempdir().unwrap();
    let metadata = invalid_mod(dir.path(), "repaired");
    let path = Path::new(metadata.source_key.as_str());
    std::fs::create_dir(path.join("aBoUt")).unwrap();
    std::fs::write(
        path.join("aBoUt/ABOUT.XML"),
        "<ModMetaData><packageId>test.repaired</packageId></ModMetaData>",
    )
    .unwrap();

    for kind in [
        ModCleanupKindDto::Invalid,
        ModCleanupKindDto::TextureOnlyInvalid,
    ] {
        assert!(
            revalidate_cleanup_candidate(&metadata, kind, &roots(dir.path()), &source(dir.path()))
                .await
                .unwrap()
                .is_none()
        );
    }
    assert!(path.exists());
}

#[tokio::test]
async fn only_requested_sources_are_inspected_and_duplicates_are_skipped() {
    let dir = tempdir().unwrap();
    let selected = invalid_mod(dir.path(), "selected");
    let selected_path = PathBuf::from(selected.source_key.as_str());
    std::fs::write(selected_path.join("texture.dds"), b"texture").unwrap();
    let unreadable = invalid_mod(dir.path(), "unselected");
    std::fs::write(
        Path::new(unreadable.source_key.as_str()).join("About"),
        b"not a directory",
    )
    .unwrap();
    let key = selected.source_key.as_str().to_string();
    let mut catalog = ModCatalog::new();
    catalog.insert(selected);
    catalog.insert(unreadable);

    let mut requests = select_cleanup_sources(
        &catalog,
        vec![key.clone(), key.clone(), "unknown source".to_string()],
    )
    .into_iter();
    let candidate = revalidate_cleanup_candidate(
        &requests.next().unwrap().unwrap(),
        ModCleanupKindDto::TextureOnlyInvalid,
        &roots(dir.path()),
        &source(dir.path()),
    )
    .await
    .unwrap()
    .unwrap();
    assert_eq!(candidate.source_key, key);
    assert_eq!(candidate.file_count, 1);
    assert_eq!(requests.next().unwrap().unwrap_err().source_key, key);
    assert_eq!(
        requests.next().unwrap().unwrap_err().source_key,
        "unknown source"
    );
    assert!(requests.next().is_none());
    assert!(selected_path.exists());
}

#[tokio::test]
async fn metadata_read_failure_is_not_cleanup_eligibility() {
    let dir = tempdir().unwrap();
    let metadata = invalid_mod(dir.path(), "unreadable");
    let path = Path::new(metadata.source_key.as_str());
    std::fs::write(path.join("About"), b"not a directory").unwrap();

    let error = revalidate_cleanup_candidate(
        &metadata,
        ModCleanupKindDto::Invalid,
        &roots(dir.path()),
        &source(dir.path()),
    )
    .await
    .unwrap_err();
    assert_eq!(error.code, AppErrorCode::SourceIo);
    assert!(std::error::Error::source(&error).is_some());
    assert!(path.exists());
}

#[tokio::test]
async fn missing_malformed_and_missing_package_id_remain_invalid() {
    let dir = tempdir().unwrap();
    for (name, about) in [
        ("missing", None),
        ("malformed", Some("<ModMetaData><name>x</wrong>")),
        (
            "no-package-id",
            Some("<ModMetaData><name>x</name></ModMetaData>"),
        ),
    ] {
        let metadata = invalid_mod(dir.path(), name);
        let path = Path::new(metadata.source_key.as_str());
        if let Some(about) = about {
            std::fs::create_dir(path.join("About")).unwrap();
            std::fs::write(path.join("About/About.xml"), about).unwrap();
        }
        assert!(
            revalidate_cleanup_candidate(
                &metadata,
                ModCleanupKindDto::Invalid,
                &roots(dir.path()),
                &source(dir.path()),
            )
            .await
            .unwrap()
            .is_some()
        );
        assert!(path.exists());
    }
}

#[tokio::test]
async fn changed_contents_and_protected_sources_are_not_cleaned() {
    let dir = tempdir().unwrap();
    let metadata = invalid_mod(dir.path(), "changed");
    let path = Path::new(metadata.source_key.as_str());
    std::fs::write(path.join("texture.dds"), b"texture").unwrap();
    std::fs::write(path.join("new-content.xml"), b"content").unwrap();
    assert!(
        revalidate_cleanup_candidate(
            &metadata,
            ModCleanupKindDto::TextureOnlyInvalid,
            &roots(dir.path()),
            &source(dir.path()),
        )
        .await
        .unwrap()
        .is_none()
    );

    let mut official = metadata.clone();
    official.source_kind = SourceKind::Expansion;
    assert!(
        revalidate_cleanup_candidate(
            &official,
            ModCleanupKindDto::Invalid,
            &roots(dir.path()),
            &source(dir.path()),
        )
        .await
        .unwrap()
        .is_none()
    );

    let outside = tempdir().unwrap();
    let error = revalidate_cleanup_candidate(
        &metadata,
        ModCleanupKindDto::Invalid,
        &roots(outside.path()),
        &source(dir.path()),
    )
    .await
    .unwrap_err();
    assert_eq!(error.code, AppErrorCode::PathInvalid);
    assert!(path.exists());
}
