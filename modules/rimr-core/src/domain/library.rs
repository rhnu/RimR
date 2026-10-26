//! Library and mod list domain types.
//!
//! Entries own list structure and order; persistence belongs to the application.

use serde::{Deserialize, Serialize};

use crate::{
    domain::{EntryId, ModCatalog, ModListId, TagId},
    ports::SourceKind,
};

/// Base-game Core package id.
const CORE_PACKAGE_ID: &str = "ludeon.rimworld";

/// `RimWorld` DLC package ids (excluding base game `ludeon.rimworld`).
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

/// A user-defined display alias for a logical mod.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Alias {
    pub identity: ModIdentity,
    pub display_alias: String,
}

/// A user-defined shared tag.
///
/// Tags are global (shared across all mod lists). A tag may have an
/// optional color used for the left color bar on mod rows; tags without
/// a color do not contribute a segment to the bar.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TagDef {
    pub id: TagId,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
}

/// Binds a mod identity to an ordered list of tag ids.
///
/// The order of `tag_ids` determines the vertical segment order of the
/// left color bar.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModTagBinding {
    pub identity: ModIdentity,
    pub tag_ids: Vec<TagId>,
}

/// Shared user settings and their concurrency revision.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibrarySettings {
    pub revision: u32,
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
    pub id: EntryId,
    #[serde(default = "default_active")]
    pub active: bool,
    pub identity: ModIdentity,
}

/// A single entry in a mod list: a mod, a group, or a separator.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ModListEntry {
    Mod {
        id: EntryId,
        #[serde(default = "default_active")]
        active: bool,
        identity: ModIdentity,
    },
    Group {
        id: EntryId,
        name: String,
        collapsed: bool,
        entries: Vec<GroupChild>,
    },
    Separator {
        id: EntryId,
        title: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        note: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        color: Option<String>,
    },
}

/// A user-managed mod list and its concurrency revision.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModList {
    pub revision: u32,
    pub id: ModListId,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    pub entries: Vec<ModListEntry>,
}

/// Summary of a mod list in the index.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModListSummary {
    pub id: ModListId,
    pub name: String,
}

/// Index of all mod lists in the library.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModListIndex {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_mod_list_id: Option<ModListId>,
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

fn default_active() -> bool { true }

// ---------------------------------------------------------------------------
// Pure domain functions
// ---------------------------------------------------------------------------

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
            },
            ModListEntry::Group { entries, .. } => {
                active.extend(
                    entries
                        .iter()
                        .filter(|child| child.active)
                        .map(|child| child.identity.package_id.clone()),
                );
            },
            ModListEntry::Mod { active: false, .. } | ModListEntry::Separator { .. } => {},
        }
    }
    active
}

/// Assigns fresh identity to every entry and group child when copying or importing.
pub fn regenerate_entry_ids(entries: &mut [ModListEntry]) {
    for entry in entries {
        match entry {
            ModListEntry::Mod { id, .. } | ModListEntry::Separator { id, .. } => {
                *id = EntryId::new();
            },
            ModListEntry::Group { id, entries, .. } => {
                *id = EntryId::new();
                for child in entries {
                    child.id = EntryId::new();
                }
            },
        }
    }
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
    id: ModListId,
    name: impl Into<String>,
    active_mods: &[String],
    catalog: Option<&ModCatalog>,
) -> ModList {
    let entries = active_mods
        .iter()
        .map(|package_id| ModListEntry::Mod {
            id: EntryId::new(),
            active: true,
            identity: mod_identity_from_catalog(package_id, catalog),
        })
        .collect::<Vec<_>>();
    ModList {
        revision: 0,
        id,
        name: name.into(),
        note: None,
        entries,
    }
}

/// Creates a new mod list pre-populated with official `RimWorld` content only:
/// Core followed by each installed DLC, in `RimWorld`'s DLC package order. DLCs
/// not present in `catalog` are dropped so the list reflects DLCs the user
/// actually owns.
///
/// When `catalog` is `None` or Core is not found in it, a single Core entry
/// built from a bare package id is produced (no source enrichment).
pub fn mod_list_from_official_content(
    id: ModListId,
    name: impl Into<String>,
    catalog: Option<&ModCatalog>,
) -> ModList {
    let official_ids = std::iter::once(CORE_PACKAGE_ID)
        .chain(RIMWORLD_DLC_PACKAGE_IDS.iter().copied())
        .collect::<Vec<_>>();
    let entries = official_ids
        .iter()
        .filter(|package_id| {
            catalog.is_some_and(|c| c.contains(&crate::domain::PackageId::new(package_id)))
        })
        .map(|package_id| ModListEntry::Mod {
            id: EntryId::new(),
            active: true,
            identity: mod_identity_from_catalog(package_id, catalog),
        })
        .collect::<Vec<_>>();
    let entries = if entries.is_empty() {
        vec![ModListEntry::Mod {
            id: EntryId::new(),
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
    ModList {
        revision: 0,
        id,
        name: name.into(),
        note: None,
        entries,
    }
}

/// Returns a stable string key for comparing two [`ModIdentity`] values.
///
/// Only the `package_id` participates. The source fields are provenance
/// hints captured when the entry was created: `source_key` is a host path
/// that changes when a mod moves between the Workshop and local folders, when
/// the game is reinstalled, or when a folder is renamed. Keying on them made
/// aliases and tag bindings silently detach from their mod.
pub fn identity_key(identity: &ModIdentity) -> String {
    crate::domain::PackageId::new(&identity.package_id).to_string()
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
        revision: local.revision,
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

    let imported_tag_ids: std::collections::HashSet<TagId> =
        imported.tag_defs.iter().map(|t| t.id).collect();
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
        revision: local.revision,
        aliases,
        tag_defs,
        mod_tags,
    }
}

#[cfg(test)]
mod tests;
