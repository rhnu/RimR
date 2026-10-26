//! Library and mod list domain types.
//!
//! These types model `RimR`'s user-managed mod lists (`Library`, `ModList`,
//! `LibrarySettings`) and the pure domain functions that operate on them
//! (`slugify`, `normalize_mod_list`, `flatten_active_mods`, etc.).
//!
//! Serialization uses `camelCase` field names to match the on-disk JSON
//! file layout (`settings.json`, `mod-lists/<id>.json`,
//! `mod-lists/index.json`).

use serde::{Deserialize, Serialize};

use crate::{domain::ModCatalog, ports::SourceKind};

/// `RimR` library file format version.
pub const RIMR_FORMAT_VERSION: u32 = 2;

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

fn default_active() -> bool { true }

// ---------------------------------------------------------------------------
// Pure domain functions
// ---------------------------------------------------------------------------

/// Converts a human-readable name into a URL-safe slug.
pub fn slugify(name: &str) -> String { slugish(name, "mod-list") }

/// Generates a stable token from a package id (used for entry ids).
pub fn stable_entry_token(value: &str) -> String { slugish(value, "entry") }

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

/// Creates a new mod list pre-populated with official `RimWorld` content only:
/// Core followed by each installed DLC, in `RimWorld`'s DLC package order. DLCs
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
            catalog.is_some_and(|c| c.contains(&crate::domain::PackageId::new(package_id)))
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
mod tests;
