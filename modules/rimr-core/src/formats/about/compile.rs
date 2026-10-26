//! Compiles [`RawAboutXml`] into [`ModMetadata`] with ByVersion precedence applied.

use std::sync::Arc;

use crate::domain::{Dependency, GameVersion, ModMetadata, PackageId, Rules};
use crate::formats::about::by_version::{ByVersionEntry, ByVersionResult, resolve_by_version};
use crate::formats::about::raw::{
    RawAboutXml, RawDependency, VersionedDependencyList, VersionedString, VersionedStringList,
};
use crate::ports::{ModSourceKey, SourceKind};

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
        &raw.description,
        &raw.descriptions_by_version,
        &target_key,
        opts.prefer_versioned,
    );

    let package_id = raw
        .package_id
        .map(|s| PackageId::new(&s))
        .unwrap_or_else(PackageId::missing);
    let valid = !package_id.is_sentinel();

    let authors = normalize_authors(&raw.author, &raw.authors);

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
    base: &Option<String>,
    versioned: &[VersionedString],
    target_key: &str,
    prefer_versioned: bool,
) -> Option<String> {
    let base_str = base.clone().unwrap_or_default();
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
        }
        ByVersionResult::Suppressed => None,
    }
}

fn normalize_authors(author: &Option<String>, authors: &[String]) -> Vec<Arc<str>> {
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
                .map(|s| PackageId::new(s))
                .unwrap_or_else(PackageId::missing);
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
mod tests {
    use super::*;
    use crate::formats::about::parser::parse_about_xml;
    use crate::ports::{ModSourceKey, SourceKind};

    fn compile(xml: &str, opts: &CompileOpts) -> ModMetadata {
        let raw = parse_about_xml(xml.as_bytes()).unwrap();
        compile_metadata(raw, ModSourceKey::new("test"), SourceKind::Local, opts)
    }

    fn opts_v15(prefer: bool) -> CompileOpts {
        CompileOpts {
            game_version: GameVersion::parse("1.5"),
            prefer_versioned: prefer,
        }
    }

    #[test]
    fn base_field_compilation() {
        let xml = r#"<ModMetaData>
  <packageId>Ludeon.RimWorld</packageId>
  <author>Ludeon Studios</author>
</ModMetaData>"#;
        let m = compile(xml, &CompileOpts::default());
        assert_eq!(m.package_id.as_str(), "ludeon.rimworld");
        assert_eq!(m.authors.len(), 1);
        assert_eq!(&*m.authors[0], "Ludeon Studios");
        assert!(m.valid);
        assert!(!m.data_malformed);
    }

    #[test]
    fn by_version_replacement() {
        let xml = r#"<ModMetaData>
  <packageId>test.bv</packageId>
  <loadAfter><li>base.mod</li></loadAfter>
  <loadAfterByVersion>
    <li>
      <li>1.5</li>
      <li>versioned.mod</li>
    </li>
  </loadAfterByVersion>
</ModMetaData>"#;
        let m = compile(xml, &opts_v15(true));
        let la: Vec<&str> = m.rules.load_after.iter().map(PackageId::as_str).collect();
        assert_eq!(la, vec!["versioned.mod"]);
    }

    #[test]
    fn by_version_suppression() {
        let xml = r#"<ModMetaData>
  <packageId>test.suppress</packageId>
  <loadAfter><li>base.mod</li></loadAfter>
  <loadAfterByVersion>
    <li>
      <li>1.5</li>
    </li>
  </loadAfterByVersion>
</ModMetaData>"#;
        let m = compile(xml, &opts_v15(true));
        assert!(m.rules.load_after.is_empty());
    }

    #[test]
    fn by_version_fallback() {
        let xml = r#"<ModMetaData>
  <packageId>test.fallback</packageId>
  <loadAfter><li>base.mod</li></loadAfter>
  <loadAfterByVersion>
    <li>
      <li>1.4</li>
      <li>old.mod</li>
    </li>
  </loadAfterByVersion>
</ModMetaData>"#;
        let m = compile(xml, &opts_v15(true));
        let la: Vec<&str> = m.rules.load_after.iter().map(PackageId::as_str).collect();
        assert_eq!(la, vec!["base.mod"]);
    }

    #[test]
    fn prefer_versioned_false_ignores_by_version() {
        let xml = r#"<ModMetaData>
  <packageId>test.nopref</packageId>
  <loadAfter><li>base.mod</li></loadAfter>
  <loadAfterByVersion>
    <li>
      <li>1.5</li>
      <li>versioned.mod</li>
    </li>
  </loadAfterByVersion>
</ModMetaData>"#;
        let m = compile(xml, &opts_v15(false));
        let la: Vec<&str> = m.rules.load_after.iter().map(PackageId::as_str).collect();
        assert_eq!(la, vec!["base.mod"]);
    }

    #[test]
    fn force_load_always_applied() {
        let xml = r#"<ModMetaData>
  <packageId>test.force</packageId>
  <forceLoadAfter><li>force.mod</li></forceLoadAfter>
  <loadAfterByVersion>
    <li>
      <li>1.5</li>
      <li>versioned.mod</li>
    </li>
  </loadAfterByVersion>
</ModMetaData>"#;
        let m = compile(xml, &opts_v15(true));
        let fla: Vec<&str> = m
            .rules
            .force_load_after
            .iter()
            .map(PackageId::as_str)
            .collect();
        assert_eq!(fla, vec!["force.mod"]);
        let la: Vec<&str> = m.rules.load_after.iter().map(PackageId::as_str).collect();
        assert_eq!(la, vec!["versioned.mod"]);
    }

    #[test]
    fn missing_package_id_marks_invalid() {
        let xml = r#"<ModMetaData><name>No PID</name></ModMetaData>"#;
        let m = compile(xml, &CompileOpts::default());
        assert!(m.package_id.is_sentinel());
        assert!(!m.valid);
    }

    #[test]
    fn empty_package_id_marks_invalid() {
        let xml = r#"<ModMetaData><packageId>   </packageId></ModMetaData>"#;
        let m = compile(xml, &CompileOpts::default());
        assert!(m.package_id.is_sentinel());
        assert!(!m.valid);
    }

    #[test]
    fn author_and_authors_coexist() {
        let xml = r#"<ModMetaData>
  <packageId>test.both</packageId>
  <author>SingleAuthor</author>
  <authors><li>MultiAuthor1</li><li>MultiAuthor2</li></authors>
</ModMetaData>"#;
        let m = compile(xml, &CompileOpts::default());
        let names: Vec<&str> = m.authors.iter().map(|a| &**a).collect();
        assert_eq!(names, vec!["SingleAuthor", "MultiAuthor1", "MultiAuthor2"]);
    }

    #[test]
    fn mod_dependencies_compiled() {
        let xml = r#"<ModMetaData>
  <packageId>test.dep</packageId>
  <modDependencies>
    <li>
      <packageId>dep.mod</packageId>
      <displayName>Dep Mod</displayName>
      <steamWorkshopUrl>steam://url/123</steamWorkshopUrl>
      <downloadUrl>https://example.com</downloadUrl>
      <alternativePackageIds><li>alt.dep</li></alternativePackageIds>
    </li>
  </modDependencies>
</ModMetaData>"#;
        let m = compile(xml, &CompileOpts::default());
        assert_eq!(m.rules.mod_dependencies.len(), 1);
        let dep = &m.rules.mod_dependencies[0];
        assert_eq!(dep.package_id.as_str(), "dep.mod");
        assert_eq!(dep.display_name.as_deref().unwrap(), "Dep Mod");
        assert_eq!(
            dep.steam_workshop_url.as_deref().unwrap(),
            "steam://url/123"
        );
        assert_eq!(dep.download_url.as_deref().unwrap(), "https://example.com");
        assert_eq!(dep.alternative_package_ids.len(), 1);
        assert_eq!(dep.alternative_package_ids[0].as_str(), "alt.dep");
    }

    #[test]
    fn descriptions_by_version_replacement() {
        let xml = r#"<ModMetaData>
  <packageId>test.desc</packageId>
  <description>Base description</description>
  <descriptionsByVersion>
    <li><li>1.5</li><li>Version 1.5 description</li></li>
  </descriptionsByVersion>
</ModMetaData>"#;
        let m = compile(xml, &opts_v15(true));
        assert_eq!(m.description.as_deref().unwrap(), "Version 1.5 description");
    }
}
