use super::*;
use crate::{
    formats::about::parser::parse_about_xml,
    ports::{ModSourceKey, SourceKind},
};

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
    let xml = r"<ModMetaData>
  <packageId>Ludeon.RimWorld</packageId>
  <author>Ludeon Studios</author>
</ModMetaData>";
    let m = compile(xml, &CompileOpts::default());
    assert_eq!(m.package_id.as_str(), "ludeon.rimworld");
    assert_eq!(m.authors.len(), 1);
    assert_eq!(&*m.authors[0], "Ludeon Studios");
    assert!(m.valid);
    assert!(!m.data_malformed);
}

#[test]
fn by_version_replacement() {
    let xml = r"<ModMetaData>
  <packageId>test.bv</packageId>
  <loadAfter><li>base.mod</li></loadAfter>
  <loadAfterByVersion>
    <li>
      <li>1.5</li>
      <li>versioned.mod</li>
    </li>
  </loadAfterByVersion>
</ModMetaData>";
    let m = compile(xml, &opts_v15(true));
    let la: Vec<&str> = m.rules.load_after.iter().map(PackageId::as_str).collect();
    assert_eq!(la, vec!["versioned.mod"]);
}

#[test]
fn by_version_suppression() {
    let xml = r"<ModMetaData>
  <packageId>test.suppress</packageId>
  <loadAfter><li>base.mod</li></loadAfter>
  <loadAfterByVersion>
    <li>
      <li>1.5</li>
    </li>
  </loadAfterByVersion>
</ModMetaData>";
    let m = compile(xml, &opts_v15(true));
    assert_eq!(m.rules.load_after, [] as [crate::PackageId; 0]);
}

#[test]
fn by_version_fallback() {
    let xml = r"<ModMetaData>
  <packageId>test.fallback</packageId>
  <loadAfter><li>base.mod</li></loadAfter>
  <loadAfterByVersion>
    <li>
      <li>1.4</li>
      <li>old.mod</li>
    </li>
  </loadAfterByVersion>
</ModMetaData>";
    let m = compile(xml, &opts_v15(true));
    let la: Vec<&str> = m.rules.load_after.iter().map(PackageId::as_str).collect();
    assert_eq!(la, vec!["base.mod"]);
}

#[test]
fn prefer_versioned_false_ignores_by_version() {
    let xml = r"<ModMetaData>
  <packageId>test.nopref</packageId>
  <loadAfter><li>base.mod</li></loadAfter>
  <loadAfterByVersion>
    <li>
      <li>1.5</li>
      <li>versioned.mod</li>
    </li>
  </loadAfterByVersion>
</ModMetaData>";
    let m = compile(xml, &opts_v15(false));
    let la: Vec<&str> = m.rules.load_after.iter().map(PackageId::as_str).collect();
    assert_eq!(la, vec!["base.mod"]);
}

#[test]
fn force_load_always_applied() {
    let xml = r"<ModMetaData>
  <packageId>test.force</packageId>
  <forceLoadAfter><li>force.mod</li></forceLoadAfter>
  <loadAfterByVersion>
    <li>
      <li>1.5</li>
      <li>versioned.mod</li>
    </li>
  </loadAfterByVersion>
</ModMetaData>";
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
    let xml = r"<ModMetaData><name>No PID</name></ModMetaData>";
    let m = compile(xml, &CompileOpts::default());
    assert!(m.package_id.is_sentinel());
    assert!(!m.valid);
}

#[test]
fn empty_package_id_marks_invalid() {
    let xml = r"<ModMetaData><packageId>   </packageId></ModMetaData>";
    let m = compile(xml, &CompileOpts::default());
    assert!(m.package_id.is_sentinel());
    assert!(!m.valid);
}

#[test]
fn author_and_authors_coexist() {
    let xml = r"<ModMetaData>
  <packageId>test.both</packageId>
  <author>SingleAuthor</author>
  <authors><li>MultiAuthor1</li><li>MultiAuthor2</li></authors>
</ModMetaData>";
    let m = compile(xml, &CompileOpts::default());
    let names: Vec<&str> = m.authors.iter().map(|a| &**a).collect();
    assert_eq!(names, vec!["SingleAuthor", "MultiAuthor1", "MultiAuthor2"]);
}

#[test]
fn mod_dependencies_compiled() {
    let xml = r"<ModMetaData>
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
</ModMetaData>";
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
    let xml = r"<ModMetaData>
  <packageId>test.desc</packageId>
  <description>Base description</description>
  <descriptionsByVersion>
    <li><li>1.5</li><li>Version 1.5 description</li></li>
  </descriptionsByVersion>
</ModMetaData>";
    let m = compile(xml, &opts_v15(true));
    assert_eq!(m.description.as_deref().unwrap(), "Version 1.5 description");
}
