use super::*;

fn identity(package_id: &str, kind: SourceKind, source_key: &str) -> ModIdentity {
    ModIdentity {
        package_id: package_id.to_string(),
        source_kind: Some(kind),
        source_key: Some(source_key.to_string()),
        steam_app_id: None,
    }
}

fn bare_identity(package_id: &str) -> ModIdentity {
    ModIdentity {
        package_id: package_id.into(),
        source_kind: None,
        source_key: None,
        steam_app_id: None,
    }
}

#[test]
fn logical_identity_normalizes_package_and_ignores_installation() {
    let workshop = identity(" Foo.Bar ", SourceKind::Workshop, "workshop/12345");
    let local = identity("foo.bar", SourceKind::Local, "Mods/FooBar");
    assert_eq!(identity_key(&workshop), identity_key(&local));
    assert_ne!(
        identity_key(&local),
        identity_key(&bare_identity("other.mod"))
    );
}

#[test]
fn repeated_packages_and_names_receive_independent_ids() {
    let list = mod_list_from_active_mods(ModListId::new(), "Same", &["a".into(), "a".into()], None);
    let other = mod_list_from_active_mods(ModListId::new(), "Same", &["a".into()], None);
    assert_ne!(list.id, other.id);
    let ids: Vec<_> = list
        .entries
        .iter()
        .map(|entry| match entry {
            ModListEntry::Mod { id, .. } => *id,
            _ => unreachable!(),
        })
        .collect();
    assert_ne!(ids[0], ids[1]);
    assert_eq!(list.id.as_uuid().get_version_num(), 4);
    assert_eq!(ids[0].as_uuid().get_version_num(), 4);
    assert_eq!(flatten_active_mods(&list.entries), ["a", "a"]);
}

fn structured_entries() -> Vec<ModListEntry> {
    vec![
        ModListEntry::Mod {
            id: EntryId::new(),
            active: true,
            identity: bare_identity("before"),
        },
        ModListEntry::Separator {
            id: EntryId::new(),
            title: "Section".into(),
            note: None,
            color: None,
        },
        ModListEntry::Group {
            id: EntryId::new(),
            name: "Group".into(),
            collapsed: true,
            entries: vec![
                GroupChild {
                    id: EntryId::new(),
                    active: true,
                    identity: bare_identity("inside"),
                },
                GroupChild {
                    id: EntryId::new(),
                    active: false,
                    identity: bare_identity("disabled-child"),
                },
            ],
        },
        ModListEntry::Mod {
            id: EntryId::new(),
            active: false,
            identity: bare_identity("disabled"),
        },
        ModListEntry::Mod {
            id: EntryId::new(),
            active: true,
            identity: bare_identity("after"),
        },
    ]
}

#[test]
fn flatten_expands_active_children_at_group_position() {
    assert_eq!(
        flatten_active_mods(&structured_entries()),
        ["before", "inside", "after"]
    );
}

#[test]
fn copying_regenerates_all_entry_ids_and_preserves_structure() {
    let original = structured_entries();
    let mut copied = original.clone();
    regenerate_entry_ids(&mut copied);
    for (old, new) in original.iter().zip(&copied) {
        match (old, new) {
            (ModListEntry::Mod { id: old, .. }, ModListEntry::Mod { id: new, .. })
            | (ModListEntry::Separator { id: old, .. }, ModListEntry::Separator { id: new, .. }) =>
            {
                assert_ne!(old, new);
            },
            (
                ModListEntry::Group {
                    id: old_id,
                    entries: old,
                    ..
                },
                ModListEntry::Group {
                    id: new_id,
                    entries: new,
                    ..
                },
            ) => {
                assert_ne!(old_id, new_id);
                for (old, new) in old.iter().zip(new) {
                    assert_ne!(old.id, new.id);
                    assert_eq!(old.identity, new.identity);
                    assert_eq!(old.active, new.active);
                }
            },
            _ => panic!("entry kind changed"),
        }
    }
    assert_eq!(flatten_active_mods(&copied), ["before", "inside", "after"]);
}

#[test]
fn mod_list_serialization_contains_uuid_identity_and_entries() {
    let list = mod_list_from_active_mods(ModListId::new(), "List", &["a".into()], None);
    let value = serde_json::to_value(&list).unwrap();
    assert_eq!(value["id"], list.id.to_string());
    assert!(value.get("formatVersion").is_none());
    assert!(value.get("activeMods").is_none());
    assert_eq!(serde_json::from_value::<ModList>(value).unwrap(), list);
    let malformed =
        serde_json::json!({ "revision": 0, "id": "name", "name": "List", "entries": [] });
    assert!(serde_json::from_value::<ModList>(malformed).is_err());
}

fn catalog(packages: &[&str]) -> ModCatalog {
    let mut catalog = ModCatalog::new();
    for package in packages {
        let mut metadata =
            crate::ModMetadata::invalid(crate::ModSourceKey::new(*package), SourceKind::Expansion);
        metadata.package_id = crate::PackageId::new(package);
        catalog.insert(metadata);
    }
    catalog
}

#[test]
fn official_content_keeps_installed_dlc_in_game_order() {
    let catalog = catalog(&[
        "ludeon.rimworld.biotech",
        "other.mod",
        "ludeon.rimworld",
        "ludeon.rimworld.royalty",
    ]);
    let list = mod_list_from_official_content(ModListId::new(), "Official", Some(&catalog));
    assert_eq!(
        flatten_active_mods(&list.entries),
        [
            "ludeon.rimworld",
            "ludeon.rimworld.royalty",
            "ludeon.rimworld.biotech"
        ]
    );
}

#[test]
fn official_content_without_catalog_starts_with_core() {
    let list = mod_list_from_official_content(ModListId::new(), "Official", None);
    assert_eq!(flatten_active_mods(&list.entries), ["ludeon.rimworld"]);
}

#[test]
fn settings_merge_replaces_logical_mod_overrides_and_retains_local_revision() {
    let local_tag = TagId::new();
    let imported_tag = TagId::new();
    let local = LibrarySettings {
        revision: 5,
        aliases: vec![Alias {
            identity: bare_identity(" A "),
            display_alias: "local".into(),
        }],
        tag_defs: vec![TagDef {
            id: local_tag,
            name: "Local".into(),
            color: None,
        }],
        mod_tags: vec![ModTagBinding {
            identity: bare_identity("a"),
            tag_ids: vec![local_tag],
        }],
    };
    let imported = LibrarySettings {
        revision: 100,
        aliases: vec![Alias {
            identity: bare_identity("a"),
            display_alias: "imported".into(),
        }],
        tag_defs: vec![TagDef {
            id: imported_tag,
            name: "Imported".into(),
            color: None,
        }],
        mod_tags: vec![ModTagBinding {
            identity: bare_identity("a"),
            tag_ids: vec![imported_tag],
        }],
    };
    let aliases_only = merge_library_settings_aliases(local.clone(), imported.clone());
    assert_eq!(aliases_only.aliases[0].display_alias, "imported");
    assert_eq!(aliases_only.mod_tags, local.mod_tags);
    assert_eq!(aliases_only.tag_defs, local.tag_defs);
    let merged = merge_library_settings(local, imported);
    assert_eq!(merged.revision, 5);
    assert_eq!(merged.aliases.len(), 1);
    assert_eq!(merged.aliases[0].display_alias, "imported");
    assert_eq!(
        merged.tag_defs.iter().map(|tag| tag.id).collect::<Vec<_>>(),
        [local_tag, imported_tag]
    );
    assert_eq!(merged.mod_tags[0].tag_ids, [imported_tag]);
}

#[test]
fn reimporting_current_settings_preserves_tag_identity() {
    let tag_id = TagId::new();
    let settings = LibrarySettings {
        tag_defs: vec![TagDef {
            id: tag_id,
            name: "Shared".into(),
            color: None,
        }],
        mod_tags: vec![ModTagBinding {
            identity: bare_identity("test.mod"),
            tag_ids: vec![tag_id],
        }],
        ..LibrarySettings::default()
    };
    let merged = merge_library_settings(settings.clone(), settings.clone());
    let merged = merge_library_settings(merged, settings);
    assert_eq!(merged.tag_defs.len(), 1);
    assert_eq!(merged.tag_defs[0].id, tag_id);
    assert_eq!(merged.mod_tags[0].tag_ids, [tag_id]);
}
