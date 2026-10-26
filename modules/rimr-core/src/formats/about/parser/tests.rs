use super::*;

#[test]
fn minimal_core_style() {
    let xml = r"<ModMetaData>
  <packageId>Ludeon.RimWorld</packageId>
  <author>Ludeon Studios</author>
  <forceLoadBefore><li>Ludeon.RimWorld.Ideology</li></forceLoadBefore>
</ModMetaData>";
    let raw = parse_about_xml(xml.as_bytes()).unwrap();
    assert_eq!(raw.package_id.as_deref(), Some("Ludeon.RimWorld"));
    assert_eq!(raw.author.as_deref(), Some("Ludeon Studios"));
    assert_eq!(raw.force_load_before, vec!["Ludeon.RimWorld.Ideology"]);
}

#[test]
fn full_fishery_style() {
    let xml = r"<ModMetaData>
  <name>Fishery</name>
  <packageId>bs.fishery</packageId>
  <supportedVersions><li>1.4</li><li>1.5</li></supportedVersions>
  <author>bradson</author>
  <modIconPath>FisheryLib/ModIcon</modIconPath>
  <url>https://github.com/bbradson/fishery</url>
  <loadBefore><li>Ludeon.RimWorld</li></loadBefore>
  <loadAfter><li>brrainz.harmony</li></loadAfter>
  <modDependencies>
    <li>
      <packageId>brrainz.harmony</packageId>
      <displayName>Harmony</displayName>
      <steamWorkshopUrl>steam://url/CommunityFilePage/2009463077</steamWorkshopUrl>
      <downloadUrl>https://github.com/pardeike/HarmonyRimWorld/releases/latest</downloadUrl>
    </li>
  </modDependencies>
  <description>Additions for Harmony</description>
</ModMetaData>";
    let raw = parse_about_xml(xml.as_bytes()).unwrap();
    assert_eq!(raw.name.as_deref(), Some("Fishery"));
    assert_eq!(raw.package_id.as_deref(), Some("bs.fishery"));
    assert_eq!(raw.supported_versions, vec!["1.4", "1.5"]);
    assert_eq!(raw.author.as_deref(), Some("bradson"));
    assert_eq!(raw.mod_icon_path.as_deref(), Some("FisheryLib/ModIcon"));
    assert_eq!(
        raw.url.as_deref(),
        Some("https://github.com/bbradson/fishery")
    );
    assert_eq!(raw.load_before, vec!["Ludeon.RimWorld"]);
    assert_eq!(raw.load_after, vec!["brrainz.harmony"]);
    assert_eq!(raw.description.as_deref(), Some("Additions for Harmony"));
    assert_eq!(raw.mod_dependencies.len(), 1);
    let dep = &raw.mod_dependencies[0];
    assert_eq!(dep.package_id.as_deref(), Some("brrainz.harmony"));
    assert_eq!(dep.display_name.as_deref(), Some("Harmony"));
    assert_eq!(
        dep.steam_workshop_url.as_deref(),
        Some("steam://url/CommunityFilePage/2009463077")
    );
    assert_eq!(
        dep.download_url.as_deref(),
        Some("https://github.com/pardeike/HarmonyRimWorld/releases/latest")
    );
}

#[test]
fn authors_plural_form() {
    let xml = r"<ModMetaData>
  <packageId>test.multi</packageId>
  <authors><li>Author1</li><li>Author2</li></authors>
</ModMetaData>";
    let raw = parse_about_xml(xml.as_bytes()).unwrap();
    assert!(raw.author.is_none());
    assert_eq!(raw.authors, vec!["Author1", "Author2"]);
}

#[test]
fn windows_1252_xml_decodes_declared_encoding() {
    let xml = b"<?xml version=\"1.0\" encoding=\"windows-1252\"?>
<ModMetaData>
  <packageId>test.encoding</packageId>
  <name>Caf\xE9</name>
</ModMetaData>";
    let raw = parse_about_xml(xml).unwrap();
    assert_eq!(raw.package_id.as_deref(), Some("test.encoding"));
    assert_eq!(raw.name.as_deref(), Some("Caf\u{e9}"));
}

#[test]
fn text_fields_decode_entities_and_cdata() {
    let xml = r"<ModMetaData>
  <packageId>test.text</packageId>
  <name>A &amp; B</name>
  <description><![CDATA[Uses <xml> & raw text]]></description>
</ModMetaData>";
    let raw = parse_about_xml(xml.as_bytes()).unwrap();
    assert_eq!(raw.name.as_deref(), Some("A & B"));
    assert_eq!(raw.description.as_deref(), Some("Uses <xml> & raw text"));
}

#[test]
fn load_after_by_version() {
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
    let raw = parse_about_xml(xml.as_bytes()).unwrap();
    assert_eq!(raw.load_after, vec!["base.mod"]);
    assert_eq!(raw.load_after_by_version.len(), 1);
    let entry = &raw.load_after_by_version[0];
    assert_eq!(entry.version_key, "1.5");
    assert_eq!(entry.values, vec!["versioned.mod"]);
}

#[test]
fn mod_dependencies_by_version() {
    let xml = r"<ModMetaData>
  <packageId>test.bvdep</packageId>
  <modDependenciesByVersion>
    <li>
      <li>1.5</li>
      <li>
        <packageId>dep.mod</packageId>
        <displayName>Dep Mod</displayName>
      </li>
    </li>
  </modDependenciesByVersion>
</ModMetaData>";
    let raw = parse_about_xml(xml.as_bytes()).unwrap();
    assert_eq!(raw.mod_dependencies_by_version.len(), 1);
    let entry = &raw.mod_dependencies_by_version[0];
    assert_eq!(entry.version_key, "1.5");
    assert_eq!(entry.dependencies.len(), 1);
    let dep = &entry.dependencies[0];
    assert_eq!(dep.package_id.as_deref(), Some("dep.mod"));
    assert_eq!(dep.display_name.as_deref(), Some("Dep Mod"));
}

#[test]
fn descriptions_by_version() {
    let xml = r"<ModMetaData>
  <packageId>test.desc</packageId>
  <descriptionsByVersion>
    <li><li>1.5</li><li>Version 1.5 description</li></li>
  </descriptionsByVersion>
</ModMetaData>";
    let raw = parse_about_xml(xml.as_bytes()).unwrap();
    assert_eq!(raw.descriptions_by_version.len(), 1);
    let entry = &raw.descriptions_by_version[0];
    assert_eq!(entry.version_key, "1.5");
    assert_eq!(entry.value, "Version 1.5 description");
}

#[test]
fn missing_package_id() {
    let xml = r"<ModMetaData><name>No PID</name></ModMetaData>";
    let raw = parse_about_xml(xml.as_bytes()).unwrap();
    assert!(raw.package_id.is_none());
    assert_eq!(raw.name.as_deref(), Some("No PID"));
}

#[test]
fn empty_xml_returns_empty() {
    let raw = parse_about_xml(b"").unwrap();
    assert!(raw.package_id.is_none());
    assert!(raw.name.is_none());
}

#[test]
fn non_xml_returns_empty() {
    let raw = parse_about_xml(b"not xml at all").unwrap();
    assert!(raw.package_id.is_none());
}

#[test]
fn xml_declaration_header_skipped() {
    let xml = r#"<?xml version="1.0" encoding="utf-8"?>
<ModMetaData><packageId>test.head</packageId></ModMetaData>"#;
    let raw = parse_about_xml(xml.as_bytes()).unwrap();
    assert_eq!(raw.package_id.as_deref(), Some("test.head"));
}

#[test]
fn mod_dependencies_with_alternative_package_ids() {
    let xml = r"<ModMetaData>
  <packageId>test.alt</packageId>
  <modDependencies>
    <li>
      <packageId>main.dep</packageId>
      <alternativePackageIds><li>alt.dep1</li><li>alt.dep2</li></alternativePackageIds>
    </li>
  </modDependencies>
</ModMetaData>";
    let raw = parse_about_xml(xml.as_bytes()).unwrap();
    assert_eq!(raw.mod_dependencies.len(), 1);
    let dep = &raw.mod_dependencies[0];
    assert_eq!(dep.package_id.as_deref(), Some("main.dep"));
    assert_eq!(dep.alternative_package_ids, vec!["alt.dep1", "alt.dep2"]);
}

#[test]
fn lowercase_root_element_is_accepted() {
    let xml = r"<modMetaData>
  <packageId>shavius.vpsye.zh</packageId>
  <name>Vanilla Psycast Expanded 汉化包</name>
  <author>Shavius</author>
  <supportedVersions><li>1.5</li></supportedVersions>
</modMetaData>";
    let raw = parse_about_xml(xml.as_bytes()).unwrap();
    assert_eq!(raw.package_id.as_deref(), Some("shavius.vpsye.zh"));
    assert_eq!(raw.name.as_deref(), Some("Vanilla Psycast Expanded 汉化包"));
    assert_eq!(raw.author.as_deref(), Some("Shavius"));
    assert_eq!(raw.supported_versions, vec!["1.5"]);
}

#[test]
fn mixed_case_child_tags_are_accepted() {
    let xml = r"<ModMetaData>
  <PackageId>test.mixed</PackageId>
  <NAME>Test Mixed</NAME>
  <SUPPORTEDVERSIONS><LI>1.5</LI></SUPPORTEDVERSIONS>
  <LOADAFTER><LI>base.mod</LI></LOADAFTER>
</ModMetaData>";
    let raw = parse_about_xml(xml.as_bytes()).unwrap();
    assert_eq!(raw.package_id.as_deref(), Some("test.mixed"));
    assert_eq!(raw.name.as_deref(), Some("Test Mixed"));
    assert_eq!(raw.supported_versions, vec!["1.5"]);
    assert_eq!(raw.load_after, vec!["base.mod"]);
}

#[test]
fn malformed_metadata_retains_parser_source() {
    use std::error::Error;

    let error = parse_about_xml(b"<ModMetaData><name>a</wrong>").unwrap_err();
    assert!(
        error
            .source()
            .unwrap()
            .downcast_ref::<quick_xml::Error>()
            .is_some()
    );
}
