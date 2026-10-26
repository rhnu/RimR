use super::*;

fn identity(package_id: &str, kind: SourceKind, source_key: &str) -> ModIdentity {
    ModIdentity {
        package_id: package_id.to_string(),
        source_kind: Some(kind),
        source_key: Some(source_key.to_string()),
        steam_app_id: None,
    }
}

#[test]
fn identity_key_survives_workshop_to_local_swap() {
    let workshop = identity("foo.bar", SourceKind::Workshop, "C:/workshop/294100/12345");
    let local = identity("foo.bar", SourceKind::Local, "C:/RimWorld/Mods/FooBar");
    assert_eq!(identity_key(&workshop), identity_key(&local));
}

#[test]
fn identity_key_normalizes_package_id() {
    let a = identity("  Foo.Bar  ", SourceKind::Local, "a");
    let b = identity("foo.bar", SourceKind::Local, "b");
    assert_eq!(identity_key(&a), identity_key(&b));
}

#[test]
fn identity_key_still_separates_distinct_mods() {
    let a = identity("foo.bar", SourceKind::Local, "same");
    let b = identity("other.mod", SourceKind::Local, "same");
    assert_ne!(identity_key(&a), identity_key(&b));
}

#[test]
fn slugify_basic() {
    assert_eq!(slugify("My Cool List"), "my-cool-list");
    assert_eq!(slugify("  "), "mod-list");
    assert_eq!(slugify("---"), "mod-list");
}

#[test]
fn stable_entry_token_basic() {
    assert_eq!(stable_entry_token("Brrainz.Harmony"), "brrainz-harmony");
    assert_eq!(stable_entry_token(""), "entry");
}

#[test]
fn unique_mod_list_id_no_collision() {
    let index = ModListIndex {
        format_version: 1,
        current_mod_list_id: None,
        mod_lists: vec![],
    };
    assert_eq!(unique_mod_list_id("My List", &index), "my-list");
}

#[test]
fn unique_mod_list_id_with_collision() {
    let index = ModListIndex {
        format_version: 1,
        current_mod_list_id: None,
        mod_lists: vec![ModListSummary {
            id: "my-list".to_string(),
            name: "My List".to_string(),
        }],
    };
    assert_eq!(unique_mod_list_id("My List", &index), "my-list-2");
}

#[test]
fn flatten_active_mods_handles_groups_and_separators() {
    let entries = vec![
        ModListEntry::Mod {
            id: "mod-a".to_string(),
            active: true,
            identity: ModIdentity {
                package_id: "a".to_string(),
                source_kind: None,
                source_key: None,
                steam_app_id: None,
            },
        },
        ModListEntry::Separator {
            id: "sep-1".to_string(),
            title: "Section".to_string(),
            note: None,
            color: None,
        },
        ModListEntry::Group {
            id: "grp-1".to_string(),
            name: "Group".to_string(),
            collapsed: false,
            entries: vec![
                GroupChild {
                    id: "child-b".to_string(),
                    active: true,
                    identity: ModIdentity {
                        package_id: "b".to_string(),
                        source_kind: None,
                        source_key: None,
                        steam_app_id: None,
                    },
                },
                GroupChild {
                    id: "child-c".to_string(),
                    active: true,
                    identity: ModIdentity {
                        package_id: "c".to_string(),
                        source_kind: None,
                        source_key: None,
                        steam_app_id: None,
                    },
                },
            ],
        },
    ];
    assert_eq!(flatten_active_mods(&entries), vec!["a", "b", "c"]);
}

#[test]
fn flatten_active_mods_ignores_inactive_entries_and_children() {
    let entries = vec![
        ModListEntry::Mod {
            id: "mod-a".to_string(),
            active: false,
            identity: ModIdentity {
                package_id: "a".to_string(),
                source_kind: None,
                source_key: None,
                steam_app_id: None,
            },
        },
        ModListEntry::Group {
            id: "grp-1".to_string(),
            name: "Group".to_string(),
            collapsed: false,
            entries: vec![
                GroupChild {
                    id: "child-b".to_string(),
                    active: true,
                    identity: ModIdentity {
                        package_id: "b".to_string(),
                        source_kind: None,
                        source_key: None,
                        steam_app_id: None,
                    },
                },
                GroupChild {
                    id: "child-c".to_string(),
                    active: false,
                    identity: ModIdentity {
                        package_id: "c".to_string(),
                        source_kind: None,
                        source_key: None,
                        steam_app_id: None,
                    },
                },
            ],
        },
    ];
    assert_eq!(flatten_active_mods(&entries), vec!["b"]);
}

#[test]
fn old_mod_list_json_defaults_entries_to_active() {
    let json = r#"{
        "formatVersion": 2,
        "id": "legacy",
        "name": "Legacy",
        "entries": [
            {
                "kind": "mod",
                "id": "mod-a",
                "identity": { "packageId": "a" }
            },
            {
                "kind": "group",
                "id": "grp-1",
                "name": "Group",
                "collapsed": false,
                "entries": [
                    { "id": "child-b", "identity": { "packageId": "b" } }
                ]
            }
        ],
        "activeMods": ["stale"]
    }"#;

    let parsed: ModList = serde_json::from_str(json).unwrap();
    let normalized = normalize_mod_list(parsed);

    assert_eq!(normalized.active_mods, vec!["a", "b"]);
}

#[test]
fn normalize_recomputes_active_mods() {
    let mod_list = ModList {
        format_version: 1,
        id: "test".to_string(),
        name: "Test".to_string(),
        note: None,
        entries: vec![ModListEntry::Mod {
            id: "mod-x".to_string(),
            active: true,
            identity: ModIdentity {
                package_id: "x".to_string(),
                source_kind: None,
                source_key: None,
                steam_app_id: None,
            },
        }],
        active_mods: vec!["stale".to_string()],
    };
    let normalized = normalize_mod_list(mod_list);
    assert_eq!(normalized.active_mods, vec!["x"]);
}

#[test]
fn mod_list_from_active_mods_creates_entries() {
    let mod_list = mod_list_from_active_mods("default", "Default", &["a".into(), "b".into()], None);
    assert_eq!(mod_list.id, "default");
    assert_eq!(mod_list.name, "Default");
    assert_eq!(mod_list.active_mods, vec!["a", "b"]);
    assert_eq!(mod_list.entries.len(), 2);
}

#[test]
fn mod_list_from_official_content_with_full_catalog() {
    use crate::{
        domain::ModMetadata,
        ports::{ModSourceKey, SourceKind},
    };

    let mut catalog = ModCatalog::new();
    for id in [
        "ludeon.rimworld",
        "ludeon.rimworld.royalty",
        "ludeon.rimworld.ideology",
        "ludeon.rimworld.biotech",
        "ludeon.rimworld.anomaly",
        "ludeon.rimworld.odyssey",
        "brrainz.harmony",
    ] {
        catalog.insert(ModMetadata {
            source_key: ModSourceKey::new(format!("/data/{id}")),
            source_kind: SourceKind::Expansion,
            package_id: crate::domain::PackageId::new(id),
            ..ModMetadata::invalid(ModSourceKey::new(""), SourceKind::Expansion)
        });
    }
    let mod_list = mod_list_from_official_content("x", "X", Some(&catalog));
    assert_eq!(
        mod_list.active_mods,
        vec![
            "ludeon.rimworld",
            "ludeon.rimworld.royalty",
            "ludeon.rimworld.ideology",
            "ludeon.rimworld.biotech",
            "ludeon.rimworld.anomaly",
            "ludeon.rimworld.odyssey",
        ]
    );
    assert_eq!(mod_list.entries.len(), 6);
}

#[test]
fn mod_list_from_official_content_drops_uninstalled_dlcs() {
    use crate::{
        domain::ModMetadata,
        ports::{ModSourceKey, SourceKind},
    };

    let mut catalog = ModCatalog::new();
    for id in [
        "ludeon.rimworld",
        "ludeon.rimworld.biotech",
        "brrainz.harmony",
    ] {
        catalog.insert(ModMetadata {
            source_key: ModSourceKey::new(format!("/data/{id}")),
            source_kind: SourceKind::Expansion,
            package_id: crate::domain::PackageId::new(id),
            ..ModMetadata::invalid(ModSourceKey::new(""), SourceKind::Expansion)
        });
    }
    let mod_list = mod_list_from_official_content("x", "X", Some(&catalog));
    assert_eq!(
        mod_list.active_mods,
        vec!["ludeon.rimworld", "ludeon.rimworld.biotech"]
    );
    assert_eq!(mod_list.entries.len(), 2);
}

#[test]
fn mod_list_from_official_content_without_catalog_yields_bare_core() {
    let mod_list = mod_list_from_official_content("x", "X", None);
    assert_eq!(mod_list.active_mods, vec!["ludeon.rimworld"]);
    assert_eq!(mod_list.entries.len(), 1);
    match &mod_list.entries[0] {
        ModListEntry::Mod {
            identity, active, ..
        } => {
            assert!(identity.source_kind.is_none());
            assert!(identity.source_key.is_none());
            assert!(identity.steam_app_id.is_none());
            assert!(*active);
            assert_eq!(identity.package_id, "ludeon.rimworld");
        },
        _ => panic!("expected Mod entry"),
    }
}

#[test]
fn merge_library_settings_aliases_replaces_matching_local() {
    let local = LibrarySettings {
        format_version: 1,
        aliases: vec![Alias {
            identity: ModIdentity {
                package_id: "a".to_string(),
                source_kind: None,
                source_key: None,
                steam_app_id: None,
            },
            display_alias: "local-a".to_string(),
        }],
        tag_defs: Vec::new(),
        mod_tags: Vec::new(),
    };
    let imported = LibrarySettings {
        format_version: 1,
        aliases: vec![Alias {
            identity: ModIdentity {
                package_id: "a".to_string(),
                source_kind: None,
                source_key: None,
                steam_app_id: None,
            },
            display_alias: "imported-a".to_string(),
        }],
        tag_defs: Vec::new(),
        mod_tags: Vec::new(),
    };
    let merged = merge_library_settings_aliases(local, imported);
    assert_eq!(merged.aliases.len(), 1);
    assert_eq!(merged.aliases[0].display_alias, "imported-a");
}

#[test]
fn merge_library_settings_aliases_keeps_non_matching_local() {
    let local = LibrarySettings {
        format_version: 1,
        aliases: vec![Alias {
            identity: ModIdentity {
                package_id: "a".to_string(),
                source_kind: None,
                source_key: None,
                steam_app_id: None,
            },
            display_alias: "local-a".to_string(),
        }],
        tag_defs: Vec::new(),
        mod_tags: Vec::new(),
    };
    let imported = LibrarySettings {
        format_version: 1,
        aliases: vec![Alias {
            identity: ModIdentity {
                package_id: "b".to_string(),
                source_kind: None,
                source_key: None,
                steam_app_id: None,
            },
            display_alias: "imported-b".to_string(),
        }],
        tag_defs: Vec::new(),
        mod_tags: Vec::new(),
    };
    let merged = merge_library_settings_aliases(local, imported);
    assert_eq!(merged.aliases.len(), 2);
}

#[test]
fn mod_list_serde_roundtrip_camel_case() {
    let mod_list = ModList {
        format_version: 1,
        id: "test".to_string(),
        name: "Test".to_string(),
        note: Some("note".to_string()),
        entries: vec![ModListEntry::Mod {
            id: "mod-a".to_string(),
            active: true,
            identity: ModIdentity {
                package_id: "a".to_string(),
                source_kind: Some(SourceKind::Local),
                source_key: Some("/path".to_string()),
                steam_app_id: Some(42),
            },
        }],
        active_mods: vec!["a".to_string()],
    };
    let json = serde_json::to_string(&mod_list).unwrap();
    assert!(json.contains("\"formatVersion\""));
    assert!(json.contains("\"activeMods\""));
    assert!(json.contains("\"packageId\""));
    assert!(json.contains("\"sourceKind\":\"local\""));
    assert!(json.contains("\"steamAppId\":42"));
    let parsed: ModList = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed, mod_list);
}

#[test]
fn mod_list_entry_tagged_serde() {
    let entry = ModListEntry::Separator {
        id: "sep-1".to_string(),
        title: "Section".to_string(),
        note: None,
        color: None,
    };
    let json = serde_json::to_string(&entry).unwrap();
    assert!(json.contains("\"kind\":\"separator\""));
    let parsed: ModListEntry = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed, entry);
}

#[test]
fn tag_def_serde_roundtrip() {
    let tag = TagDef {
        id: "fav".to_string(),
        name: "Favorite".to_string(),
        color: Some("#ff0000".to_string()),
    };
    let json = serde_json::to_string(&tag).unwrap();
    assert!(json.contains("\"id\":\"fav\""));
    assert!(json.contains("\"name\":\"Favorite\""));
    assert!(json.contains("\"color\":\"#ff0000\""));
    assert!(!json.contains("\"tagId\""));
    let parsed: TagDef = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed, tag);

    let no_color = TagDef {
        id: "plain".to_string(),
        name: "Plain".to_string(),
        color: None,
    };
    let json = serde_json::to_string(&no_color).unwrap();
    assert!(!json.contains("\"color\""));
    let parsed: TagDef = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed, no_color);
}

#[test]
fn mod_tag_binding_serde_roundtrip() {
    let binding = ModTagBinding {
        identity: ModIdentity {
            package_id: "a".to_string(),
            source_kind: None,
            source_key: None,
            steam_app_id: None,
        },
        tag_ids: vec!["fav".to_string(), "core".to_string()],
    };
    let json = serde_json::to_string(&binding).unwrap();
    assert!(json.contains("\"tagIds\""));
    assert!(json.contains("\"fav\""));
    assert!(json.contains("\"core\""));
    assert!(!json.contains("\"tag_ids\""));
    let parsed: ModTagBinding = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed, binding);
}

#[test]
fn library_settings_defaults_empty_tags_when_missing() {
    let json = r#"{
        "formatVersion": 2,
        "aliases": []
    }"#;
    let parsed: LibrarySettings = serde_json::from_str(json).unwrap();
    assert_eq!(parsed.format_version, 2);
    assert_eq!(parsed.aliases, [] as [crate::Alias; 0]);
    assert_eq!(parsed.tag_defs, [] as [crate::TagDef; 0]);
    assert_eq!(parsed.mod_tags, [] as [crate::ModTagBinding; 0]);
}

#[test]
fn library_settings_skips_empty_tags_on_serialize() {
    let settings = LibrarySettings {
        format_version: 2,
        aliases: Vec::new(),
        tag_defs: Vec::new(),
        mod_tags: Vec::new(),
    };
    let json = serde_json::to_string(&settings).unwrap();
    assert!(!json.contains("\"tagDefs\""));
    assert!(!json.contains("\"modTags\""));
}

#[test]
fn merge_library_settings_merges_tag_defs_by_id() {
    let local = LibrarySettings {
        format_version: 2,
        aliases: Vec::new(),
        tag_defs: vec![TagDef {
            id: "fav".to_string(),
            name: "Local Fav".to_string(),
            color: None,
        }],
        mod_tags: Vec::new(),
    };
    let imported = LibrarySettings {
        format_version: 2,
        aliases: Vec::new(),
        tag_defs: vec![TagDef {
            id: "fav".to_string(),
            name: "Imported Fav".to_string(),
            color: Some("#00ff00".to_string()),
        }],
        mod_tags: Vec::new(),
    };
    let merged = merge_library_settings(local, imported);
    assert_eq!(merged.tag_defs.len(), 1);
    assert_eq!(merged.tag_defs[0].name, "Imported Fav");
    assert_eq!(merged.tag_defs[0].color.as_deref(), Some("#00ff00"));
}

#[test]
fn merge_library_settings_keeps_non_conflicting_tag_defs() {
    let local = LibrarySettings {
        format_version: 2,
        aliases: Vec::new(),
        tag_defs: vec![TagDef {
            id: "fav".to_string(),
            name: "Favorite".to_string(),
            color: None,
        }],
        mod_tags: Vec::new(),
    };
    let imported = LibrarySettings {
        format_version: 2,
        aliases: Vec::new(),
        tag_defs: vec![TagDef {
            id: "core".to_string(),
            name: "Core".to_string(),
            color: None,
        }],
        mod_tags: Vec::new(),
    };
    let merged = merge_library_settings(local, imported);
    let ids: Vec<&str> = merged.tag_defs.iter().map(|t| t.id.as_str()).collect();
    assert_eq!(ids, vec!["fav", "core"]);
}

#[test]
fn merge_library_settings_merges_mod_tags_by_identity() {
    let identity = ModIdentity {
        package_id: "a".to_string(),
        source_kind: None,
        source_key: None,
        steam_app_id: None,
    };
    let local = LibrarySettings {
        format_version: 2,
        aliases: Vec::new(),
        tag_defs: Vec::new(),
        mod_tags: vec![ModTagBinding {
            identity: identity.clone(),
            tag_ids: vec!["local".to_string()],
        }],
    };
    let imported = LibrarySettings {
        format_version: 2,
        aliases: Vec::new(),
        tag_defs: Vec::new(),
        mod_tags: vec![ModTagBinding {
            identity: identity.clone(),
            tag_ids: vec!["imported".to_string()],
        }],
    };
    let merged = merge_library_settings(local, imported);
    assert_eq!(merged.mod_tags.len(), 1);
    assert_eq!(merged.mod_tags[0].identity, identity);
    assert_eq!(merged.mod_tags[0].tag_ids, vec!["imported".to_string()]);
}

#[test]
fn merge_library_settings_keeps_non_conflicting_mod_tags() {
    let local = LibrarySettings {
        format_version: 2,
        aliases: Vec::new(),
        tag_defs: Vec::new(),
        mod_tags: vec![ModTagBinding {
            identity: ModIdentity {
                package_id: "a".to_string(),
                source_kind: None,
                source_key: None,
                steam_app_id: None,
            },
            tag_ids: vec!["fav".to_string()],
        }],
    };
    let imported = LibrarySettings {
        format_version: 2,
        aliases: Vec::new(),
        tag_defs: Vec::new(),
        mod_tags: vec![ModTagBinding {
            identity: ModIdentity {
                package_id: "b".to_string(),
                source_kind: None,
                source_key: None,
                steam_app_id: None,
            },
            tag_ids: vec!["core".to_string()],
        }],
    };
    let merged = merge_library_settings(local, imported);
    assert_eq!(merged.mod_tags.len(), 2);
}

#[test]
fn merge_library_settings_merges_aliases_unchanged_behavior() {
    let local = LibrarySettings {
        format_version: 2,
        aliases: vec![Alias {
            identity: ModIdentity {
                package_id: "a".to_string(),
                source_kind: None,
                source_key: None,
                steam_app_id: None,
            },
            display_alias: "local-a".to_string(),
        }],
        tag_defs: Vec::new(),
        mod_tags: Vec::new(),
    };
    let imported = LibrarySettings {
        format_version: 2,
        aliases: vec![Alias {
            identity: ModIdentity {
                package_id: "a".to_string(),
                source_kind: None,
                source_key: None,
                steam_app_id: None,
            },
            display_alias: "imported-a".to_string(),
        }],
        tag_defs: Vec::new(),
        mod_tags: Vec::new(),
    };
    let merged = merge_library_settings(local, imported);
    assert_eq!(merged.aliases.len(), 1);
    assert_eq!(merged.aliases[0].display_alias, "imported-a");
}
