//! Compiles [`RawAboutXml`] into [`ModMetadata`] with `ByVersion` precedence applied.

use std::sync::Arc;

use crate::{
    domain::{Dependency, GameVersion, ModMetadata, PackageId, Rules},
    formats::about::{
        by_version::{ByVersionEntry, ByVersionResult, resolve_by_version},
        raw::{
            RawAboutXml, RawDependency, VersionedDependencyList, VersionedString,
            VersionedStringList,
        },
    },
    ports::{ModSourceKey, SourceKind},
};

/// Options for compiling raw metadata into domain metadata.
#[derive(Debug, Clone)]
pub struct CompileOpts {
    pub game_version: GameVersion,
    /// When true, `*ByVersion` fields take precedence over base fields.
    /// Default: `true`.
    pub prefer_versioned: bool,
}

impl Default for CompileOpts {
    fn default() -> Self {
        Self {
            game_version: GameVersion::unknown(),
            prefer_versioned: true,
        }
    }
}

/// Compiles a [`RawAboutXml`] into a [`ModMetadata`].
///
/// `valid` is `false` when `packageId` is missing or empty (sentinel);
/// otherwise `true` (the XML was successfully parsed). `data_malformed` is
/// always `false` here (set by the usecase layer when XML parsing itself
/// fails). The host scan layer is responsible for emitting a
/// `PackageIdMissing` diagnostic when the compiled `package_id` is a sentinel.
pub fn compile_metadata(
    raw: RawAboutXml,
    source_key: ModSourceKey,
    source_kind: SourceKind,
    opts: &CompileOpts,
) -> ModMetadata {
    let target_key = opts.game_version.by_version_key();

    let load_after = resolve_string_list_by_version(
        &raw.load_after,
        &raw.load_after_by_version,
        &target_key,
        opts.prefer_versioned,
    );
    let load_before = resolve_string_list_by_version(
        &raw.load_before,
        &raw.load_before_by_version,
        &target_key,
        opts.prefer_versioned,
    );
    let incompatible_with = resolve_string_list_by_version(
        &raw.incompatible_with,
        &raw.incompatible_with_by_version,
        &target_key,
        opts.prefer_versioned,
    );
    let mod_dependencies = resolve_dependency_list_by_version(
        &raw.mod_dependencies,
        &raw.mod_dependencies_by_version,
        &target_key,
        opts.prefer_versioned,
    );
    let description = resolve_description_by_version(
        raw.description.as_deref(),
        &raw.descriptions_by_version,
        &target_key,
        opts.prefer_versioned,
    );

    let package_id = raw
        .package_id
        .map_or_else(PackageId::missing, |s| PackageId::new(&s));
    let valid = !package_id.is_sentinel();

    let authors = normalize_authors(raw.author.as_deref(), &raw.authors);

    let supported_versions: Vec<GameVersion> = raw
        .supported_versions
        .iter()
        .map(|s| GameVersion::parse(s))
        .collect();

    let force_load_after: Vec<PackageId> = raw
        .force_load_after
        .iter()
        .map(|s| PackageId::new(s))
        .collect();
    let force_load_before: Vec<PackageId> = raw
        .force_load_before
        .iter()
        .map(|s| PackageId::new(s))
        .collect();

    ModMetadata {
        source_key,
        source_kind,
        package_id,
        name: raw.name.map(Arc::from),
        authors,
        supported_versions,
        description: description.map(Arc::from),
        mod_version: raw.mod_version.map(Arc::from),
        url: raw.url.map(Arc::from),
        mod_icon_path: raw.mod_icon_path.map(Arc::from),
        steam_app_id: raw.steam_app_id.and_then(|s| s.parse::<u32>().ok()),
        has_assemblies: false,
        rules: Rules {
            load_after: to_package_ids(&load_after),
            load_before: to_package_ids(&load_before),
            mod_dependencies: to_dependencies(&mod_dependencies),
            incompatible_with: to_package_ids(&incompatible_with),
            force_load_after,
            force_load_before,
        },
        valid,
        data_malformed: false,
    }
}

fn resolve_string_list_by_version(
    base: &[String],
    versioned: &[VersionedStringList],
    target_key: &str,
    prefer_versioned: bool,
) -> Vec<String> {
    let entries: Vec<ByVersionEntry<Vec<String>>> = versioned
        .iter()
        .map(|v| ByVersionEntry {
            version_key: format!("v{}", v.version_key),
            value: v.values.clone(),
        })
        .collect();
    match resolve_by_version(base.to_vec(), &entries, target_key, prefer_versioned) {
        ByVersionResult::Base(v) | ByVersionResult::Replaced(v) => v,
        ByVersionResult::Suppressed => Vec::new(),
    }
}

fn resolve_dependency_list_by_version(
    base: &[RawDependency],
    versioned: &[VersionedDependencyList],
    target_key: &str,
    prefer_versioned: bool,
) -> Vec<RawDependency> {
    let entries: Vec<ByVersionEntry<Vec<RawDependency>>> = versioned
        .iter()
        .map(|v| ByVersionEntry {
            version_key: format!("v{}", v.version_key),
            value: v.dependencies.clone(),
        })
        .collect();
    match resolve_by_version(base.to_vec(), &entries, target_key, prefer_versioned) {
        ByVersionResult::Base(v) | ByVersionResult::Replaced(v) => v,
        ByVersionResult::Suppressed => Vec::new(),
    }
}

fn resolve_description_by_version(
    base: Option<&str>,
    versioned: &[VersionedString],
    target_key: &str,
    prefer_versioned: bool,
) -> Option<String> {
    let base_str = base.unwrap_or_default().to_string();
    let entries: Vec<ByVersionEntry<String>> = versioned
        .iter()
        .map(|v| ByVersionEntry {
            version_key: format!("v{}", v.version_key),
            value: v.value.clone(),
        })
        .collect();
    match resolve_by_version(base_str, &entries, target_key, prefer_versioned) {
        ByVersionResult::Base(v) | ByVersionResult::Replaced(v) => {
            if v.is_empty() {
                None
            } else {
                Some(v)
            }
        },
        ByVersionResult::Suppressed => None,
    }
}

fn normalize_authors(author: Option<&str>, authors: &[String]) -> Vec<Arc<str>> {
    let mut result: Vec<Arc<str>> = Vec::new();
    if let Some(a) = author {
        let trimmed = a.trim();
        if !trimmed.is_empty() {
            result.push(Arc::from(trimmed));
        }
    }
    for a in authors {
        let trimmed = a.trim();
        if !trimmed.is_empty() {
            result.push(Arc::from(trimmed));
        }
    }
    result
}

fn to_package_ids(strings: &[String]) -> Vec<PackageId> {
    strings.iter().map(|s| PackageId::new(s)).collect()
}

fn to_dependencies(raw_deps: &[RawDependency]) -> Vec<Dependency> {
    raw_deps
        .iter()
        .map(|rd| {
            let package_id = rd
                .package_id
                .as_ref()
                .map_or_else(PackageId::missing, |s| PackageId::new(s));
            Dependency {
                package_id,
                display_name: rd.display_name.as_ref().map(|s| Arc::from(s.as_str())),
                steam_workshop_url: rd
                    .steam_workshop_url
                    .as_ref()
                    .map(|s| Arc::from(s.as_str())),
                download_url: rd.download_url.as_ref().map(|s| Arc::from(s.as_str())),
                alternative_package_ids: rd
                    .alternative_package_ids
                    .iter()
                    .map(|s| PackageId::new(s))
                    .collect(),
            }
        })
        .collect()
}

#[cfg(test)]
mod tests;
