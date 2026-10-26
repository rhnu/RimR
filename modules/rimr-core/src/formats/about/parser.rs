//! quick-xml streaming parser for About.xml → [`RawAboutXml`].

use quick_xml::events::{BytesStart, Event};
use quick_xml::reader::Reader;

use super::error::ParseError;
use super::raw::{
    RawAboutXml, RawDependency, VersionedDependencyList, VersionedString, VersionedStringList,
};
use crate::formats::xml::{
    XmlReadError, push_general_ref as shared_push_general_ref, read_text as shared_read_text,
};

/// Compares an XML element name against an expected ASCII name, ignoring
/// ASCII case. RimWorld's own loader tolerates mixed-case tag names (e.g.
/// `<modMetaData>` vs `<ModMetaData>`), so rimr accepts them too rather than
/// silently dropping mods with non-canonical casing.
fn name_matches(name: &[u8], expected: &[u8]) -> bool {
    name.eq_ignore_ascii_case(expected)
}

/// Reads text content of the current element (after Start) until its End.
/// Returns `None` if the trimmed text is empty.
fn read_text(reader: &mut Reader<&[u8]>) -> Result<Option<String>, ParseError> {
    shared_read_text(reader).map_err(|e| match e {
        XmlReadError::Xml(m) => ParseError::Xml(m),
        XmlReadError::Decoding(m) => ParseError::Encoding(m),
        XmlReadError::UnknownEntity(m) => ParseError::Xml(m),
    })
}

/// Parses About.xml bytes into a [`RawAboutXml`].
pub fn parse_about_xml(bytes: &[u8]) -> Result<RawAboutXml, ParseError> {
    tracing::debug!(bytes = bytes.len(), "parsing About.xml");
    let mut reader = Reader::from_reader(bytes);

    let mut result = RawAboutXml::default();

    loop {
        match reader.read_event() {
            Ok(Event::Start(e)) => {
                if name_matches(e.name().as_ref(), b"ModMetaData") {
                    parse_mod_metadata(&mut reader, &mut result)?;
                } else {
                    reader
                        .read_to_end(e.name())
                        .map_err(|e| ParseError::Xml(e.to_string()))?;
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => {
                tracing::warn!(error = %e, "About.xml parse error");
                return Err(ParseError::XmlAt {
                    message: e.to_string(),
                    byte_offset: reader.error_position(),
                });
            }
            _ => {}
        }
    }
    Ok(result)
}

/// Reads child elements of `<ModMetaData>` until the matching End.
fn parse_mod_metadata(
    reader: &mut Reader<&[u8]>,
    result: &mut RawAboutXml,
) -> Result<(), ParseError> {
    loop {
        match reader.read_event() {
            Ok(Event::Start(e)) => match e.name().as_ref() {
                n if name_matches(n, b"packageId") => result.package_id = read_text(reader)?,
                n if name_matches(n, b"name") => result.name = read_text(reader)?,
                n if name_matches(n, b"author") => result.author = read_text(reader)?,
                n if name_matches(n, b"authors") => result.authors = read_string_list(reader)?,
                n if name_matches(n, b"supportedVersions") => {
                    result.supported_versions = read_string_list(reader)?
                }
                n if name_matches(n, b"description") => result.description = read_text(reader)?,
                n if name_matches(n, b"descriptionsByVersion") => {
                    result.descriptions_by_version = read_versioned_string(reader)?;
                }
                n if name_matches(n, b"modVersion") => result.mod_version = read_text(reader)?,
                n if name_matches(n, b"url") => result.url = read_text(reader)?,
                n if name_matches(n, b"modIconPath") => result.mod_icon_path = read_text(reader)?,
                n if name_matches(n, b"steamAppId") => result.steam_app_id = read_text(reader)?,
                n if name_matches(n, b"loadAfter") => result.load_after = read_string_list(reader)?,
                n if name_matches(n, b"loadBefore") => {
                    result.load_before = read_string_list(reader)?
                }
                n if name_matches(n, b"forceLoadAfter") => {
                    result.force_load_after = read_string_list(reader)?
                }
                n if name_matches(n, b"forceLoadBefore") => {
                    result.force_load_before = read_string_list(reader)?
                }
                n if name_matches(n, b"incompatibleWith") => {
                    result.incompatible_with = read_string_list(reader)?
                }
                n if name_matches(n, b"modDependencies") => {
                    result.mod_dependencies = read_dependency_list(reader)?
                }
                n if name_matches(n, b"loadAfterByVersion") => {
                    result.load_after_by_version = read_versioned_string_list(reader)?;
                }
                n if name_matches(n, b"loadBeforeByVersion") => {
                    result.load_before_by_version = read_versioned_string_list(reader)?;
                }
                n if name_matches(n, b"incompatibleWithByVersion") => {
                    result.incompatible_with_by_version = read_versioned_string_list(reader)?;
                }
                n if name_matches(n, b"modDependenciesByVersion") => {
                    result.mod_dependencies_by_version = read_versioned_dependency_list(reader)?;
                }
                _ => {
                    reader
                        .read_to_end(e.name())
                        .map_err(|e| ParseError::Xml(e.to_string()))?;
                }
            },
            Ok(Event::End(_)) => break,
            Ok(Event::Eof) => break,
            Ok(_) => {}
            Err(e) => return Err(ParseError::Xml(e.to_string())),
        }
    }
    Ok(())
}

/// Reads a `<li>text</li>` list until the outer End.
fn read_string_list(reader: &mut Reader<&[u8]>) -> Result<Vec<String>, ParseError> {
    let mut result = Vec::new();
    loop {
        match reader.read_event() {
            Ok(Event::Start(e)) if name_matches(e.name().as_ref(), b"li") => {
                let text = read_text(reader)?;
                if let Some(t) = text {
                    result.push(t);
                }
            }
            Ok(Event::End(_)) => break,
            Ok(Event::Eof) => break,
            Ok(_) => {}
            Err(e) => return Err(ParseError::Xml(e.to_string())),
        }
    }
    Ok(result)
}

/// Reads a single `<li>` dependency's child elements until End.
fn read_dependency(reader: &mut Reader<&[u8]>) -> Result<RawDependency, ParseError> {
    let mut dep = RawDependency::default();
    loop {
        match reader.read_event() {
            Ok(Event::Start(e)) => match e.name().as_ref() {
                n if name_matches(n, b"packageId") => dep.package_id = read_text(reader)?,
                n if name_matches(n, b"displayName") => dep.display_name = read_text(reader)?,
                n if name_matches(n, b"steamWorkshopUrl") => {
                    dep.steam_workshop_url = read_text(reader)?
                }
                n if name_matches(n, b"downloadUrl") => dep.download_url = read_text(reader)?,
                n if name_matches(n, b"alternativePackageIds") => {
                    dep.alternative_package_ids = read_string_list(reader)?;
                }
                _ => {
                    reader
                        .read_to_end(e.name())
                        .map_err(|e| ParseError::Xml(e.to_string()))?;
                }
            },
            Ok(Event::End(_)) => break,
            Ok(Event::Eof) => break,
            Ok(_) => {}
            Err(e) => return Err(ParseError::Xml(e.to_string())),
        }
    }
    Ok(dep)
}

/// Reads multiple `<li>` dependency entries inside `<modDependencies>`.
fn read_dependency_list(reader: &mut Reader<&[u8]>) -> Result<Vec<RawDependency>, ParseError> {
    let mut result = Vec::new();
    loop {
        match reader.read_event() {
            Ok(Event::Start(e)) if name_matches(e.name().as_ref(), b"li") => {
                let dep = read_dependency(reader)?;
                result.push(dep);
            }
            Ok(Event::End(_)) => break,
            Ok(Event::Eof) => break,
            Ok(_) => {}
            Err(e) => return Err(ParseError::Xml(e.to_string())),
        }
    }
    Ok(result)
}

/// Reads a `*ByVersion` string-list element (e.g. `<loadAfterByVersion>`).
///
/// Each outer `<li>` contains inner `<li>` elements where the first is the
/// version key (plain text) and the rest are values (plain text).
fn read_versioned_string_list(
    reader: &mut Reader<&[u8]>,
) -> Result<Vec<VersionedStringList>, ParseError> {
    let mut entries = Vec::new();
    loop {
        match reader.read_event() {
            Ok(Event::Start(e)) if name_matches(e.name().as_ref(), b"li") => {
                let mut version_key: Option<String> = None;
                let mut values: Vec<String> = Vec::new();
                loop {
                    match reader.read_event() {
                        Ok(Event::Start(inner)) if name_matches(inner.name().as_ref(), b"li") => {
                            let text = read_text(reader)?;
                            if version_key.is_none() {
                                version_key = text;
                            } else if let Some(t) = text {
                                values.push(t);
                            }
                        }
                        Ok(Event::End(_)) => break,
                        Ok(Event::Eof) => break,
                        Ok(_) => {}
                        Err(e) => return Err(ParseError::Xml(e.to_string())),
                    }
                }
                if let Some(vk) = version_key {
                    entries.push(VersionedStringList {
                        version_key: vk,
                        values,
                    });
                }
            }
            Ok(Event::End(_)) => break,
            Ok(Event::Eof) => break,
            Ok(_) => {}
            Err(e) => return Err(ParseError::Xml(e.to_string())),
        }
    }
    Ok(entries)
}

/// Reads `<descriptionsByVersion>`.
///
/// Each outer `<li>` contains two inner `<li>` elements: the first is the
/// version key, the second is the description text. An empty second `<li>`
/// is recorded as an empty string to enable suppression.
fn read_versioned_string(reader: &mut Reader<&[u8]>) -> Result<Vec<VersionedString>, ParseError> {
    let mut entries = Vec::new();
    loop {
        match reader.read_event() {
            Ok(Event::Start(e)) if name_matches(e.name().as_ref(), b"li") => {
                let mut version_key: Option<String> = None;
                let mut value = String::new();
                let mut value_seen = false;
                loop {
                    match reader.read_event() {
                        Ok(Event::Start(inner)) if name_matches(inner.name().as_ref(), b"li") => {
                            let text = read_text(reader)?;
                            if version_key.is_none() {
                                version_key = text;
                            } else if !value_seen {
                                value_seen = true;
                                value = text.unwrap_or_default();
                            }
                        }
                        Ok(Event::End(_)) => break,
                        Ok(Event::Eof) => break,
                        Ok(_) => {}
                        Err(e) => return Err(ParseError::Xml(e.to_string())),
                    }
                }
                if let Some(vk) = version_key
                    && value_seen
                {
                    entries.push(VersionedString {
                        version_key: vk,
                        value,
                    });
                }
            }
            Ok(Event::End(_)) => break,
            Ok(Event::Eof) => break,
            Ok(_) => {}
            Err(e) => return Err(ParseError::Xml(e.to_string())),
        }
    }
    Ok(entries)
}

/// Reads `<modDependenciesByVersion>`.
///
/// Each outer `<li>` contains inner `<li>` elements where the first is the
/// version key (plain text) and the rest are dependencies (with child
/// elements like `packageId`). The parser peeks at the event after each
/// inner `<li>` Start to distinguish text (version key) from child elements
/// (dependency).
fn read_versioned_dependency_list(
    reader: &mut Reader<&[u8]>,
) -> Result<Vec<VersionedDependencyList>, ParseError> {
    let mut entries = Vec::new();
    loop {
        match reader.read_event() {
            Ok(Event::Start(e)) if name_matches(e.name().as_ref(), b"li") => {
                let mut version_key: Option<String> = None;
                let mut deps: Vec<RawDependency> = Vec::new();
                loop {
                    match reader.read_event() {
                        Ok(Event::Start(inner)) if name_matches(inner.name().as_ref(), b"li") => {
                            match read_versioned_dependency_item(reader)? {
                                VersionedDependencyItem::VersionKey(v) if version_key.is_none() => {
                                    version_key = Some(v);
                                }
                                VersionedDependencyItem::Dependency(dep) => deps.push(dep),
                                VersionedDependencyItem::VersionKey(_)
                                | VersionedDependencyItem::Empty => {}
                            }
                        }
                        Ok(Event::End(_)) => break,
                        Ok(Event::Eof) => break,
                        Ok(_) => {}
                        Err(e) => return Err(ParseError::Xml(e.to_string())),
                    }
                }
                if let Some(vk) = version_key {
                    entries.push(VersionedDependencyList {
                        version_key: vk,
                        dependencies: deps,
                    });
                }
            }
            Ok(Event::End(_)) => break,
            Ok(Event::Eof) => break,
            Ok(_) => {}
            Err(e) => return Err(ParseError::Xml(e.to_string())),
        }
    }
    Ok(entries)
}

enum VersionedDependencyItem {
    VersionKey(String),
    Dependency(RawDependency),
    Empty,
}

fn read_versioned_dependency_item(
    reader: &mut Reader<&[u8]>,
) -> Result<VersionedDependencyItem, ParseError> {
    let mut dep = RawDependency::default();
    let mut text = String::new();
    let mut saw_dependency_child = false;

    loop {
        match reader.read_event() {
            Ok(Event::Start(child_start)) => {
                saw_dependency_child = true;
                handle_dep_child(&mut dep, reader, &child_start)?;
            }
            Ok(Event::Text(t)) if !saw_dependency_child => {
                let s = t
                    .decode()
                    .map_err(|e| ParseError::Encoding(e.to_string()))?;
                text.push_str(&s);
            }
            Ok(Event::CData(t)) if !saw_dependency_child => {
                let s = t
                    .decode()
                    .map_err(|e| ParseError::Encoding(e.to_string()))?;
                text.push_str(&s);
            }
            Ok(Event::GeneralRef(e)) if !saw_dependency_child => {
                shared_push_general_ref(&mut text, e.as_ref()).map_err(|e| match e {
                    XmlReadError::UnknownEntity(m) => ParseError::Xml(m),
                    _ => ParseError::Xml(format!("{:?}", e)),
                })?;
            }
            Ok(Event::End(_)) => break,
            Ok(Event::Eof) => break,
            Ok(_) => {}
            Err(e) => return Err(ParseError::Xml(e.to_string())),
        }
    }

    if saw_dependency_child {
        Ok(VersionedDependencyItem::Dependency(dep))
    } else {
        let trimmed = text.trim().to_string();
        if trimmed.is_empty() {
            Ok(VersionedDependencyItem::Empty)
        } else {
            Ok(VersionedDependencyItem::VersionKey(trimmed))
        }
    }
}

/// Processes a single dependency child element whose Start event has been read.
fn handle_dep_child(
    dep: &mut RawDependency,
    reader: &mut Reader<&[u8]>,
    child_start: &BytesStart,
) -> Result<(), ParseError> {
    match child_start.name().as_ref() {
        n if name_matches(n, b"packageId") => dep.package_id = read_text(reader)?,
        n if name_matches(n, b"displayName") => dep.display_name = read_text(reader)?,
        n if name_matches(n, b"steamWorkshopUrl") => dep.steam_workshop_url = read_text(reader)?,
        n if name_matches(n, b"downloadUrl") => dep.download_url = read_text(reader)?,
        n if name_matches(n, b"alternativePackageIds") => {
            dep.alternative_package_ids = read_string_list(reader)?;
        }
        _ => {
            reader
                .read_to_end(child_start.name())
                .map_err(|e| ParseError::Xml(e.to_string()))?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn minimal_core_style() {
        let xml = r#"<ModMetaData>
  <packageId>Ludeon.RimWorld</packageId>
  <author>Ludeon Studios</author>
  <forceLoadBefore><li>Ludeon.RimWorld.Ideology</li></forceLoadBefore>
</ModMetaData>"#;
        let raw = parse_about_xml(xml.as_bytes()).unwrap();
        assert_eq!(raw.package_id.as_deref(), Some("Ludeon.RimWorld"));
        assert_eq!(raw.author.as_deref(), Some("Ludeon Studios"));
        assert_eq!(raw.force_load_before, vec!["Ludeon.RimWorld.Ideology"]);
    }

    #[test]
    fn full_fishery_style() {
        let xml = r#"<ModMetaData>
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
</ModMetaData>"#;
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
        let xml = r#"<ModMetaData>
  <packageId>test.multi</packageId>
  <authors><li>Author1</li><li>Author2</li></authors>
</ModMetaData>"#;
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
        let xml = r#"<ModMetaData>
  <packageId>test.text</packageId>
  <name>A &amp; B</name>
  <description><![CDATA[Uses <xml> & raw text]]></description>
</ModMetaData>"#;
        let raw = parse_about_xml(xml.as_bytes()).unwrap();
        assert_eq!(raw.name.as_deref(), Some("A & B"));
        assert_eq!(raw.description.as_deref(), Some("Uses <xml> & raw text"));
    }

    #[test]
    fn load_after_by_version() {
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
        let raw = parse_about_xml(xml.as_bytes()).unwrap();
        assert_eq!(raw.load_after, vec!["base.mod"]);
        assert_eq!(raw.load_after_by_version.len(), 1);
        let entry = &raw.load_after_by_version[0];
        assert_eq!(entry.version_key, "1.5");
        assert_eq!(entry.values, vec!["versioned.mod"]);
    }

    #[test]
    fn mod_dependencies_by_version() {
        let xml = r#"<ModMetaData>
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
</ModMetaData>"#;
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
        let xml = r#"<ModMetaData>
  <packageId>test.desc</packageId>
  <descriptionsByVersion>
    <li><li>1.5</li><li>Version 1.5 description</li></li>
  </descriptionsByVersion>
</ModMetaData>"#;
        let raw = parse_about_xml(xml.as_bytes()).unwrap();
        assert_eq!(raw.descriptions_by_version.len(), 1);
        let entry = &raw.descriptions_by_version[0];
        assert_eq!(entry.version_key, "1.5");
        assert_eq!(entry.value, "Version 1.5 description");
    }

    #[test]
    fn missing_package_id() {
        let xml = r#"<ModMetaData><name>No PID</name></ModMetaData>"#;
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
        let xml = r#"<ModMetaData>
  <packageId>test.alt</packageId>
  <modDependencies>
    <li>
      <packageId>main.dep</packageId>
      <alternativePackageIds><li>alt.dep1</li><li>alt.dep2</li></alternativePackageIds>
    </li>
  </modDependencies>
</ModMetaData>"#;
        let raw = parse_about_xml(xml.as_bytes()).unwrap();
        assert_eq!(raw.mod_dependencies.len(), 1);
        let dep = &raw.mod_dependencies[0];
        assert_eq!(dep.package_id.as_deref(), Some("main.dep"));
        assert_eq!(dep.alternative_package_ids, vec!["alt.dep1", "alt.dep2"]);
    }

    #[test]
    fn lowercase_root_element_is_accepted() {
        let xml = r#"<modMetaData>
  <packageId>shavius.vpsye.zh</packageId>
  <name>Vanilla Psycast Expanded 汉化包</name>
  <author>Shavius</author>
  <supportedVersions><li>1.5</li></supportedVersions>
</modMetaData>"#;
        let raw = parse_about_xml(xml.as_bytes()).unwrap();
        assert_eq!(raw.package_id.as_deref(), Some("shavius.vpsye.zh"));
        assert_eq!(raw.name.as_deref(), Some("Vanilla Psycast Expanded 汉化包"));
        assert_eq!(raw.author.as_deref(), Some("Shavius"));
        assert_eq!(raw.supported_versions, vec!["1.5"]);
    }

    #[test]
    fn mixed_case_child_tags_are_accepted() {
        let xml = r#"<ModMetaData>
  <PackageId>test.mixed</PackageId>
  <NAME>Test Mixed</NAME>
  <SUPPORTEDVERSIONS><LI>1.5</LI></SUPPORTEDVERSIONS>
  <LOADAFTER><LI>base.mod</LI></LOADAFTER>
</ModMetaData>"#;
        let raw = parse_about_xml(xml.as_bytes()).unwrap();
        assert_eq!(raw.package_id.as_deref(), Some("test.mixed"));
        assert_eq!(raw.name.as_deref(), Some("Test Mixed"));
        assert_eq!(raw.supported_versions, vec!["1.5"]);
        assert_eq!(raw.load_after, vec!["base.mod"]);
    }
}
