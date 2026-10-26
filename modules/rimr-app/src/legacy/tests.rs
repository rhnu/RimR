use super::*;

#[test]
fn old_config_directory_becomes_game_data() {
    let source = json!({"formatVersion": 3, "paths": {"configDir": "game-data/Config"}, "ui": {"theme":"dark"}});
    let (config, preferences) = decode_config(&source).unwrap();
    assert_eq!(config.paths.game_data_dir.unwrap(), Path::new("game-data"));
    assert!(preferences.theme.is_some());
}

#[test]
fn flat_legacy_configuration_keeps_custom_library_and_game_paths() {
    let (config, _) = decode_config(&json!({"formatVersion":2,"gameDir":"custom-game","configDir":"custom-data/Config","rimrDataDir":"custom-library"})).unwrap();
    assert_eq!(config.paths.game_dir.unwrap(), Path::new("custom-game"));
    assert_eq!(
        config.paths.game_data_dir.unwrap(),
        Path::new("custom-data")
    );
    assert_eq!(
        config.paths.rimr_data_dir.unwrap(),
        Path::new("custom-library")
    );
}

#[test]
fn legacy_settings_remap_tag_references_as_one_candidate() {
    let settings = settings(json!({"formatVersion":1,"aliases":[],"tagDefs":[{"id":"old-tag","name":"Tools"}],"modTags":[{"identity":{"packageId":"test.mod"},"tagIds":["old-tag"]}]})).unwrap();
    assert_eq!(settings.tag_defs[0].id, settings.mod_tags[0].tag_ids[0]);
    assert_eq!(settings.tag_defs[0].id.as_uuid().get_version_num(), 4);
}

#[test]
fn missing_legacy_tag_reference_is_an_error() {
    assert!(settings(json!({"formatVersion":2,"aliases":[],"modTags":[{"identity":{"packageId":"test.mod"},"tagIds":["missing"]}]})).is_err());
}

#[test]
fn legacy_flat_list_has_entries_with_independent_identity() {
    let list = mod_list(json!({"formatVersion":1,"id":"name-derived","name":"Old","activeMods":["test.mod","test.mod"]})).unwrap();
    assert_eq!(list.entries.len(), 2);
    let ids = list
        .entries
        .iter()
        .map(|entry| match entry {
            rimr_core::ModListEntry::Mod { id, .. } => *id,
            _ => unreachable!(),
        })
        .collect::<Vec<_>>();
    assert_ne!(ids[0], ids[1]);
    assert_eq!(
        rimr_core::flatten_active_mods(&list.entries),
        vec!["test.mod", "test.mod"]
    );
}

#[test]
fn index_order_precedes_stable_orphan_order() {
    let a = rimr_core::mod_list_from_official_content(ModListId::new(), "A", None);
    let b = rimr_core::mod_list_from_official_content(ModListId::new(), "B", None);
    let orphan = rimr_core::mod_list_from_official_content(ModListId::new(), "Orphan", None);
    let ids = HashMap::from([("a".into(), a.id), ("b".into(), b.id)]);
    let mut snapshot = LibrarySnapshot {
        mod_lists: vec![a, b.clone(), orphan],
        ..LibrarySnapshot::default()
    };
    apply_index(
        &mut snapshot,
        &json!({"modLists":[{"id":"b"},{"id":"a"}],"currentModListId":"b"}),
        &ids,
    )
    .unwrap();
    assert_eq!(
        snapshot
            .mod_lists
            .iter()
            .map(|list| list.name.as_str())
            .collect::<Vec<_>>(),
        ["B", "A", "Orphan"]
    );
    assert_eq!(snapshot.current_mod_list_id, Some(b.id));
}
