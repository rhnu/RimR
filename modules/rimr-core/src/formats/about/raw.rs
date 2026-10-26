//! Raw schema types for About.xml parsing.

use serde::{Deserialize, Serialize};

/// Raw dependency entry from `modDependencies/li`.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RawDependency {
    pub package_id: Option<String>,
    pub display_name: Option<String>,
    pub steam_workshop_url: Option<String>,
    pub download_url: Option<String>,
    pub alternative_package_ids: Vec<String>,
}

/// A versioned list of package ids (e.g. `loadAfterByVersion` entry).
///
/// `version_key` is `"1.5"` (without `v` prefix); compile adds `v`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionedStringList {
    pub version_key: String,
    pub values: Vec<String>,
}

/// A versioned list of dependencies (`modDependenciesByVersion` entry).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionedDependencyList {
    pub version_key: String,
    pub dependencies: Vec<RawDependency>,
}

/// A versioned scalar (`descriptionsByVersion` entry).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionedString {
    pub version_key: String,
    pub value: String,
}

/// Intermediate representation of raw About.xml content.
///
/// All ByVersion entries preserve their original `version_key` strings
/// (without `v` prefix). The compile layer prepends `v` when matching.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RawAboutXml {
    pub package_id: Option<String>,
    pub name: Option<String>,
    pub author: Option<String>,
    pub authors: Vec<String>,
    pub supported_versions: Vec<String>,
    pub description: Option<String>,
    pub descriptions_by_version: Vec<VersionedString>,
    pub mod_version: Option<String>,
    pub url: Option<String>,
    pub mod_icon_path: Option<String>,
    pub steam_app_id: Option<String>,
    pub load_after: Vec<String>,
    pub load_before: Vec<String>,
    pub force_load_after: Vec<String>,
    pub force_load_before: Vec<String>,
    pub incompatible_with: Vec<String>,
    pub mod_dependencies: Vec<RawDependency>,
    pub load_after_by_version: Vec<VersionedStringList>,
    pub load_before_by_version: Vec<VersionedStringList>,
    pub incompatible_with_by_version: Vec<VersionedStringList>,
    pub mod_dependencies_by_version: Vec<VersionedDependencyList>,
}
