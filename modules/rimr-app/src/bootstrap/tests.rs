use serde_json::json;

use super::*;

struct Fixture {
    _root: tempfile::TempDir,
    config: PathBuf,
    data: PathBuf,
    originals: Vec<(PathBuf, Vec<u8>)>,
}

impl Fixture {
    fn new() -> Self {
        let root = tempfile::tempdir().unwrap();
        let config = root.path().join("config.json");
        let data = root.path().join("library");
        std::fs::create_dir_all(data.join("mod-lists")).unwrap();
        let documents = [
            (
                config.clone(),
                json!({"formatVersion":4,"paths":{"rimrDataDir":data},"ui":{"theme":"dark","locale":"zh-CN"}}),
            ),
            (
                data.join("settings.json"),
                json!({"formatVersion":2,"aliases":[{"identity":{"packageId":"test.mod"},"displayAlias":"My mod"}],"tagDefs":[{"id":"old-tag","name":"Tools"}],"modTags":[{"identity":{"packageId":"test.mod"},"tagIds":["old-tag"]}]}),
            ),
            (
                data.join("mod-lists/index.json"),
                json!({"formatVersion":2,"currentModListId":"name-derived","modLists":[{"id":"name-derived","name":"Old list"}]}),
            ),
            (
                data.join("mod-lists/name-derived.json"),
                json!({"formatVersion":1,"id":"name-derived","name":"Old list","activeMods":["test.mod"]}),
            ),
        ];
        let originals = documents
            .into_iter()
            .map(|(path, document)| {
                let bytes = serde_json::to_vec_pretty(&document).unwrap();
                std::fs::write(&path, &bytes).unwrap();
                (path, bytes)
            })
            .collect();
        Self {
            _root: root,
            config,
            data,
            originals,
        }
    }

    fn assert_sources_unchanged(&self) {
        for (path, original) in &self.originals {
            assert_eq!(
                std::fs::read(path).unwrap(),
                *original,
                "{}",
                path.display()
            );
        }
    }
}

#[test]
fn migration_preserves_sources_and_hands_off_preferences_across_restarts() {
    let fixture = Fixture::new();
    let ready = run(&fixture.config).unwrap();
    assert!(ready.migrated);
    assert!(ready.imported_preferences.is_some());
    let snapshot = current::load_library(&fixture.data).unwrap();
    assert_eq!(snapshot.mod_lists.len(), 1);
    assert_eq!(snapshot.mod_lists[0].name, "Old list");
    assert_eq!(snapshot.current_mod_list_id, Some(snapshot.mod_lists[0].id));
    assert_eq!(snapshot.settings.aliases[0].display_alias, "My mod");
    assert_eq!(
        snapshot.settings.tag_defs[0].id,
        snapshot.settings.mod_tags[0].tag_ids[0]
    );
    fixture.assert_sources_unchanged();

    let committed = std::fs::read(current::library_path(&fixture.data)).unwrap();
    std::fs::write(
        fixture.data.join("mod-lists/name-derived.json"),
        b"invalid legacy data",
    )
    .unwrap();
    let restarted = run(&fixture.config).unwrap();
    assert!(!restarted.migrated);
    assert_eq!(restarted.config, ready.config);
    assert_eq!(restarted.imported_preferences, ready.imported_preferences);
    assert_eq!(
        std::fs::read(current::library_path(&fixture.data)).unwrap(),
        committed
    );
}

#[test]
fn invalid_legacy_candidate_leaves_no_current_library_or_config() {
    let fixture = Fixture::new();
    std::fs::write(
        fixture.data.join("mod-lists/broken.json"),
        b"invalid legacy data",
    )
    .unwrap();
    assert!(run(&fixture.config).is_err());
    assert!(!current::library_path(&fixture.data).exists());
    assert!(!current::config_path(&fixture.config).unwrap().exists());
    fixture.assert_sources_unchanged();
}

#[test]
fn corrupt_current_library_is_never_replaced_from_valid_legacy_sources() {
    let fixture = Fixture::new();
    run(&fixture.config).unwrap();
    let path = current::library_path(&fixture.data);
    let corrupt = b"invalid current data";
    std::fs::write(&path, corrupt).unwrap();
    assert!(run(&fixture.config).is_err());
    assert_eq!(std::fs::read(&path).unwrap(), corrupt);
    fixture.assert_sources_unchanged();
}

#[test]
fn restart_after_library_commit_reuses_existing_identity_and_content() {
    let fixture = Fixture::new();
    let mut committed = prepare_library(&fixture.data).unwrap();
    committed.mod_lists[0].name = "Already committed".into();
    current::save_library(&fixture.data, &committed).unwrap();
    let bytes = std::fs::read(current::library_path(&fixture.data)).unwrap();
    assert!(!current::config_path(&fixture.config).unwrap().exists());

    run(&fixture.config).unwrap();
    assert!(current::config_path(&fixture.config).unwrap().exists());
    assert_eq!(
        std::fs::read(current::library_path(&fixture.data)).unwrap(),
        bytes
    );
    fixture.assert_sources_unchanged();
}
