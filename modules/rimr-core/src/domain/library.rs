//! Library and mod list domain types.
//!
//! These types model RimR's user-managed mod lists (`Library`, `ModList`,
//! `LibrarySettings`) and the pure domain functions that operate on them
//! (`slugify`, `normalize_mod_list`, `flatten_active_mods`, etc.).
//!
//! Serialization uses `camelCase` field names to match the on-disk JSON
//! file layout (`settings.json`, `mod-lists/<id>.json`,
//! `mod-lists/index.json`).

use crate::domain::ModCatalog;
use crate::ports::SourceKind;
use serde::{Deserialize, Serialize};

/// RimR library file format version.
pub const RIMR_FORMAT_VERSION: u32 = 2;

/// Base-game Core package id.
const CORE_PACKAGE_ID: &str = "ludeon.rimworld";

/// RimWorld DLC package ids (excluding base game `ludeon.rimworld`).
const RIMWORLD_DLC_PACKAGE_IDS: &[&str] = &[
    "ludeon.rimworld.royalty",
    "ludeon.rimworld.ideology",
    "ludeon.rimworld.biotech",
    "ludeon.rimworld.anomaly",
    "ludeon.rimworld.odyssey",
];

/// Identity of a single mod within a mod list or library settings alias.
///
/// `source_kind` and `source_key` are opaque to the core — the core never
/// interprets them as filesystem paths. The host adapter populates them from
/// the discovered [`crate::ports::ModSourceEntry`] / [`ModCatalog`].
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModIdentity {
    pub package_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_kind: Option<SourceKind>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_key: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub steam_app_id: Option<u32>,
}

/// A user-defined display alias for a mod identity, stored in `settings.json`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Alias {
    pub identity: ModIdentity,
    pub display_alias: String,
}

/// A user-defined tag definition stored in `settings.json`.
///
/// Tags are global (shared across all mod lists). A tag may have an
/// optional color used for the left color bar on mod rows; tags without
/// a color do not contribute a segment to the bar.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TagDef {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
}

/// Binds a mod identity to an ordered list of tag ids.
///
/// The order of `tag_ids` determines the vertical segment order of the
/// left color bar. Stored in `settings.json` as part of `LibrarySettings`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModTagBinding {
    pub identity: ModIdentity,
    pub tag_ids: Vec<String>,
}

/// Library settings (`settings.json`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibrarySettings {
    pub format_version: u32,
    pub aliases: Vec<Alias>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tag_defs: Vec<TagDef>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub mod_tags: Vec<ModTagBinding>,
}

/// A child entry inside a group within a mod list.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupChild {
    pub id: String,
    #[serde(default = "default_active")]
    pub active: bool,
    pub identity: ModIdentity,
}

/// A single entry in a mod list: a mod, a group, or a separator.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ModListEntry {
    Mod {
        id: String,
        #[serde(default = "default_active")]
        active: bool,
        identity: ModIdentity,
    },
    Group {
        id: String,
        name: String,
        collapsed: bool,
        entries: Vec<GroupChild>,
    },
    Separator {
        id: String,
        title: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        note: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        color: Option<String>,
    },
}

/// A user-managed mod list (`mod-lists/<id>.json`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModList {
    pub format_version: u32,
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    pub entries: Vec<ModListEntry>,
    pub active_mods: Vec<String>,
}

/// Summary of a mod list in the index (`mod-lists/index.json`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModListSummary {
    pub id: String,
    pub name: String,
}

/// Index of all mod lists in the library.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModListIndex {
    pub format_version: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_mod_list_id: Option<String>,
    pub mod_lists: Vec<ModListSummary>,
}

/// The full library snapshot: settings + index + current mod list.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Library {
    pub settings: LibrarySettings,
    pub mod_lists_index: ModListIndex,
    pub current_mod_list: ModList,
}

fn default_active() -> bool {
    true
}

// ---------------------------------------------------------------------------
// Pure domain functions
// ---------------------------------------------------------------------------

/// Converts a human-readable name into a URL-safe slug.
pub fn slugify(name: &str) -> String {
    slugish(name, "mod-list")
}

/// Generates a stable token from a package id (used for entry ids).
pub fn stable_entry_token(value: &str) -> String {
    slugish(value, "entry")
}

fn slugish(value: &str, fallback: &str) -> String {
    let mut slug = String::new();
    for ch in value.chars() {
        if ch.is_ascii_alphanumeric() {
            slug.push(ch.to_ascii_lowercase());
        } else if !slug.ends_with('-') {
            slug.push('-');
        }
    }
    let slug = slug.trim_matches('-').to_string();
    if slug.is_empty() {
        fallback.to_string()
    } else {
        slug
    }
}

/// Generates a unique mod list id from a name, avoiding collisions with
/// existing ids in the index.
pub fn unique_mod_list_id(name: &str, index: &ModListIndex) -> String {
    let base = slugify(name);
    if !index.mod_lists.iter().any(|s| s.id == base) {
        return base;
    }
    let mut n = 2;
    loop {
        let candidate = format!("{base}-{n}");
        if !index.mod_lists.iter().any(|s| s.id == candidate) {
            return candidate;
        }
        n += 1;
    }
}

/// Flattens mod list entries into a flat list of active package ids.
///
/// Group children are expanded inline; separators contribute nothing.
pub fn flatten_active_mods(entries: &[ModListEntry]) -> Vec<String> {
    let mut active = Vec::new();
    for entry in entries {
        match entry {
            ModListEntry::Mod {
                active: true,
                identity,
                ..
            } => {
                active.push(identity.package_id.clone());
            }
            ModListEntry::Group { entries, .. } => {
                active.extend(
                    entries
                        .iter()
                        .filter(|child| child.active)
                        .map(|child| child.identity.package_id.clone()),
                );
            }
            ModListEntry::Mod { active: false, .. } => {}
            ModListEntry::Separator { .. } => {}
        }
    }
    active
}

/// Recomputes `active_mods` from `entries` so they never drift.
pub fn normalize_mod_list(mut mod_list: ModList) -> ModList {
    mod_list.active_mods = flatten_active_mods(&mod_list.entries);
    mod_list
}

/// Builds a [`ModIdentity`] by looking up the catalog for source info.
pub fn mod_identity_from_catalog(package_id: &str, catalog: Option<&ModCatalog>) -> ModIdentity {
    let metadata = catalog.and_then(|c| c.get(&crate::domain::PackageId::new(package_id)));
    ModIdentity {
        package_id: package_id.to_string(),
        source_kind: metadata.map(|m| m.source_kind),
        source_key: metadata.map(|m| m.source_key.as_str().to_string()),
        steam_app_id: metadata.and_then(|m| m.steam_app_id),
    }
}

/// Creates a new mod list from a flat list of active package ids, looking up
/// source info from the catalog when available.
pub fn mod_list_from_active_mods(
    id: impl Into<String>,
    name: impl Into<String>,
    active_mods: &[String],
    catalog: Option<&ModCatalog>,
) -> ModList {
    let entries = active_mods
        .iter()
        .map(|package_id| ModListEntry::Mod {
            id: format!("mod-{}", stable_entry_token(package_id)),
            active: true,
            identity: mod_identity_from_catalog(package_id, catalog),
        })
        .collect::<Vec<_>>();
    normalize_mod_list(ModList {
        format_version: RIMR_FORMAT_VERSION,
        id: id.into(),
        name: name.into(),
        note: None,
        entries,
        active_mods: Vec::new(),
    })
}

/// Creates a new mod list pre-populated with official RimWorld content only:
/// Core followed by each installed DLC, in RimWorld's DLC package order. DLCs
/// not present in `catalog` are dropped so the list reflects DLCs the user
/// actually owns.
///
/// When `catalog` is `None` or Core is not found in it, a single Core entry
/// built from a bare package id is produced (no source enrichment).
pub fn mod_list_from_official_content(
    id: impl Into<String>,
    name: impl Into<String>,
    catalog: Option<&ModCatalog>,
) -> ModList {
    let official_ids = std::iter::once(CORE_PACKAGE_ID)
        .chain(RIMWORLD_DLC_PACKAGE_IDS.iter().copied())
        .collect::<Vec<_>>();
    let entries = official_ids
        .iter()
        .filter(|package_id| {
            catalog
                .map(|c| c.contains(&crate::domain::PackageId::new(package_id)))
                .unwrap_or(false)
        })
        .map(|package_id| ModListEntry::Mod {
            id: format!("mod-{}", stable_entry_token(package_id)),
            active: true,
            identity: mod_identity_from_catalog(package_id, catalog),
        })
        .collect::<Vec<_>>();
    let entries = if entries.is_empty() {
        vec![ModListEntry::Mod {
            id: format!("mod-{}", stable_entry_token(CORE_PACKAGE_ID)),
            active: true,
            identity: ModIdentity {
                package_id: CORE_PACKAGE_ID.to_string(),
                source_kind: None,
                source_key: None,
                steam_app_id: None,
            },
        }]
    } else {
        entries
    };
    normalize_mod_list(ModList {
        format_version: RIMR_FORMAT_VERSION,
        id: id.into(),
        name: name.into(),
        note: None,
        entries,
        active_mods: Vec::new(),
    })
}

/// Returns a stable string key for comparing two [`ModIdentity`] values.
///
/// Only the `package_id` participates. The source fields are provenance
/// hints captured when the entry was created: `source_key` is a host path
/// that changes when a mod moves between the Workshop and local folders, when
/// the game is reinstalled, or when a folder is renamed. Keying on them made
/// aliases and tag bindings silently detach from their mod.
pub fn identity_key(identity: &ModIdentity) -> String {
    identity.package_id.trim().to_ascii_lowercase()
}

/// Merges imported library settings aliases into local ones.
///
/// Local aliases whose identity matches an imported one are replaced by the
/// imported version; all other local aliases are kept.
pub fn merge_library_settings_aliases(
    local: LibrarySettings,
    imported: LibrarySettings,
) -> LibrarySettings {
    let imported_keys: std::collections::HashSet<String> = imported
        .aliases
        .iter()
        .map(|a| identity_key(&a.identity))
        .collect();
    let aliases = local
        .aliases
        .into_iter()
        .filter(|a| !imported_keys.contains(&identity_key(&a.identity)))
        .chain(imported.aliases)
        .collect();
    LibrarySettings {
        format_version: local.format_version,
        aliases,
        tag_defs: local.tag_defs,
        mod_tags: local.mod_tags,
    }
}

/// Merges imported library settings into local ones.
///
/// - `aliases`: imported replaces local with same identity key; others kept.
/// - `tag_defs`: imported replaces local with same id; others kept.
/// - `mod_tags`: imported replaces local with same identity key; others kept.
pub fn merge_library_settings(
    local: LibrarySettings,
    imported: LibrarySettings,
) -> LibrarySettings {
    let imported_alias_keys: std::collections::HashSet<String> = imported
        .aliases
        .iter()
        .map(|a| identity_key(&a.identity))
        .collect();
    let aliases = local
        .aliases
        .into_iter()
        .filter(|a| !imported_alias_keys.contains(&identity_key(&a.identity)))
        .chain(imported.aliases)
        .collect();

    let imported_tag_ids: std::collections::HashSet<String> =
        imported.tag_defs.iter().map(|t| t.id.clone()).collect();
    let tag_defs = local
        .tag_defs
        .into_iter()
        .filter(|t| !imported_tag_ids.contains(&t.id))
        .chain(imported.tag_defs)
        .collect();

    let imported_mod_tag_keys: std::collections::HashSet<String> = imported
        .mod_tags
        .iter()
        .map(|m| identity_key(&m.identity))
        .collect();
    let mod_tags = local
        .mod_tags
        .into_iter()
        .filter(|m| !imported_mod_tag_keys.contains(&identity_key(&m.identity)))
        .chain(imported.mod_tags)
        .collect();

    LibrarySettings {
        format_version: local.format_version,
        aliases,
        tag_defs,
        mod_tags,
    }
}

#[cfg(test)]
mod tests {
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
        let mod_list =
            mod_list_from_active_mods("default", "Default", &["a".into(), "b".into()], None);
        assert_eq!(mod_list.id, "default");
        assert_eq!(mod_list.name, "Default");
        assert_eq!(mod_list.active_mods, vec!["a", "b"]);
        assert_eq!(mod_list.entries.len(), 2);
    }

    #[test]
    fn mod_list_from_official_content_with_full_catalog() {
        use crate::domain::ModMetadata;
        use crate::ports::{ModSourceKey, SourceKind};

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
        use crate::domain::ModMetadata;
        use crate::ports::{ModSourceKey, SourceKind};

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
            }
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
        assert!(parsed.aliases.is_empty());
        assert!(parsed.tag_defs.is_empty());
        assert!(parsed.mod_tags.is_empty());
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
}
