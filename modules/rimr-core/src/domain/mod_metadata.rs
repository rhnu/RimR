//! Compiled mod metadata ready for dependency graph building.

use crate::domain::{Dependency, GameVersion, PackageId};
use crate::ports::{ModSourceKey, SourceKind};
use std::sync::Arc;

/// Load-order and dependency rules compiled from `About.xml`.
///
/// `*ByVersion` and `forceLoad*` values are already merged into these fields
/// by the metadata compilation layer. The original base vs versioned
/// distinction is not preserved at this level.
#[derive(Debug, Clone, Default)]
pub struct Rules {
    /// Mods that must load before this one (this loads AFTER them).
    pub load_after: Vec<PackageId>,
    /// Mods that must load after this one (this loads BEFORE them).
    pub load_before: Vec<PackageId>,
    /// Hard runtime dependencies (always collected, regardless of install).
    pub mod_dependencies: Vec<Dependency>,
    /// Mods incompatible with this one.
    pub incompatible_with: Vec<PackageId>,
    /// Force-load-after; always applied regardless of ByVersion.
    pub force_load_after: Vec<PackageId>,
    /// Force-load-before; always applied regardless of ByVersion.
    pub force_load_before: Vec<PackageId>,
}

/// Compiled metadata for a single mod, ready for dependency graph building.
#[derive(Debug, Clone)]
pub struct ModMetadata {
    pub source_key: ModSourceKey,
    pub source_kind: SourceKind,
    pub package_id: PackageId,
    pub name: Option<Arc<str>>,
    /// Normalized from both `<author>` and `<authors>/<li>`.
    pub authors: Vec<Arc<str>>,
    pub supported_versions: Vec<GameVersion>,
    pub description: Option<Arc<str>>,
    pub mod_version: Option<Arc<str>>,
    pub url: Option<Arc<str>>,
    pub mod_icon_path: Option<Arc<str>>,
    pub steam_app_id: Option<u32>,
    pub has_assemblies: bool,
    pub rules: Rules,
    /// False if the mod has no valid About.xml or missing packageId sentinel.
    pub valid: bool,
    /// True if About.xml existed but was malformed.
    pub data_malformed: bool,
}

impl ModMetadata {
    /// Creates an invalid metadata record for a mod with no parseable About.xml.
    pub fn invalid(source_key: ModSourceKey, source_kind: SourceKind) -> Self {
        Self {
            source_key,
            source_kind,
            package_id: PackageId::missing(),
            name: None,
            authors: Vec::new(),
            supported_versions: Vec::new(),
            description: None,
            mod_version: None,
            url: None,
            mod_icon_path: None,
            steam_app_id: None,
            has_assemblies: false,
            rules: Rules::default(),
            valid: false,
            data_malformed: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ports::{ModSourceKey, SourceKind};

    #[test]
    fn invalid_metadata_uses_sentinel() {
        let m = ModMetadata::invalid(ModSourceKey::new("k"), SourceKind::Local);
        assert!(!m.valid);
        assert!(m.package_id.is_sentinel());
        assert!(m.authors.is_empty());
        assert!(m.supported_versions.is_empty());
        assert!(m.rules.mod_dependencies.is_empty());
    }
}
