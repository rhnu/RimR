//! Streaming parser for `ModsConfig.xml` → [`ModsConfig`].

use quick_xml::events::Event;
use quick_xml::reader::Reader;

use crate::domain::PackageId;
use crate::error::CoreError;
use crate::formats::game_config::ModsConfig;
use crate::formats::xml::{XmlReadError, read_text as shared_read_text};
use std::sync::Arc;

/// Reads text content of the current element (after Start) until its End.
/// Returns `None` if the trimmed text is empty.
fn read_text(reader: &mut Reader<&[u8]>) -> Result<Option<String>, CoreError> {
    shared_read_text(reader).map_err(|e| match e {
        XmlReadError::Xml(m) | XmlReadError::Decoding(m) | XmlReadError::UnknownEntity(m) => {
            CoreError::ModsConfigInvalid(format!("XML error: {}", m))
        }
    })
}

/// Parses ModsConfig.xml bytes into a ModsConfig.
///
/// Returns `CoreError::ModsConfigInvalid` if:
/// - The XML is not valid
/// - The root element is not `ModsConfigData`
/// - Any of `version`, `activeMods`, `knownExpansions` is missing
/// - `version` is empty
pub fn parse_mods_config(bytes: &[u8]) -> Result<ModsConfig, CoreError> {
    tracing::debug!(bytes = bytes.len(), "parsing ModsConfig.xml");
    let mut reader = Reader::from_reader(bytes);

    let mut version: Option<String> = None;
    let mut active_mods: Option<Vec<PackageId>> = None;
    let mut known_expansions: Option<Vec<PackageId>> = None;
    let mut buf = Vec::new();

    let mut found_root = false;
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) if e.name().as_ref() == b"ModsConfigData" => {
                found_root = true;
                break;
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(CoreError::ModsConfigInvalid(format!("XML error: {}", e))),
            _ => {}
        }
        buf.clear();
    }

    if !found_root {
        return Err(CoreError::ModsConfigInvalid(
            "root element ModsConfigData not found".to_string(),
        ));
    }

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                let name = e.name();
                match name.as_ref() {
                    b"version" => {
                        version = read_text(&mut reader)?;
                    }
                    b"activeMods" => {
                        active_mods = Some(read_package_id_list(&mut reader)?);
                    }
                    b"knownExpansions" => {
                        known_expansions = Some(read_package_id_list(&mut reader)?);
                    }
                    _ => {
                        reader.read_to_end(name).map_err(|e| {
                            CoreError::ModsConfigInvalid(format!("XML error: {}", e))
                        })?;
                    }
                }
            }
            Ok(Event::End(_)) => break,
            Ok(Event::Eof) => break,
            Err(e) => return Err(CoreError::ModsConfigInvalid(format!("XML error: {}", e))),
            _ => {}
        }
        buf.clear();
    }

    let version = version.filter(|v| !v.is_empty()).ok_or_else(|| {
        CoreError::ModsConfigInvalid("version field is missing or empty".to_string())
    })?;
    let active_mods = active_mods
        .ok_or_else(|| CoreError::ModsConfigInvalid("activeMods field is missing".to_string()))?;
    let known_expansions = known_expansions.ok_or_else(|| {
        CoreError::ModsConfigInvalid("knownExpansions field is missing".to_string())
    })?;

    tracing::debug!(
        version = %version,
        active_mods = active_mods.len(),
        known_expansions = known_expansions.len(),
        "ModsConfig.xml parsed"
    );
    Ok(ModsConfig {
        version: Arc::from(version.as_str()),
        active_mods,
        known_expansions,
    })
}

/// Reads a `<li>packageId</li>` list until the outer End.
fn read_package_id_list(reader: &mut Reader<&[u8]>) -> Result<Vec<PackageId>, CoreError> {
    let mut result = Vec::new();
    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) if e.name().as_ref() == b"li" => {
                let text = read_text(reader)?;
                if let Some(t) = text {
                    result.push(PackageId::new(&t));
                }
            }
            Ok(Event::End(_)) => break,
            Ok(Event::Eof) => break,
            Ok(_) => {}
            Err(e) => return Err(CoreError::ModsConfigInvalid(format!("XML error: {}", e))),
        }
        buf.clear();
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    const VALID_XML: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<ModsConfigData>
    <version>1.5.4104 rev435</version>
    <activeMods>
        <li>zetrith.prepatcher</li>
        <li>brrainz.harmony</li>
        <li>bs.fishery</li>
        <li>ludeon.rimworld</li>
    </activeMods>
    <knownExpansions>
        <li>ludeon.rimworld.royalty</li>
        <li>ludeon.rimworld.ideology</li>
    </knownExpansions>
</ModsConfigData>"#;

    const FULL_XML: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<ModsConfigData>
    <version>1.5.4104 rev435</version>
    <activeMods>
        <li>zetrith.prepatcher</li>
        <li>brrainz.harmony</li>
        <li>bs.fishery</li>
        <li>ludeon.rimworld</li>
        <li>ludeon.rimworld.royalty</li>
        <li>ludeon.rimworld.ideology</li>
        <li>ludeon.rimworld.biotech</li>
    </activeMods>
    <knownExpansions>
        <li>ludeon.rimworld.royalty</li>
        <li>ludeon.rimworld.ideology</li>
        <li>ludeon.rimworld.biotech</li>
        <li>ludeon.rimworld.anomaly</li>
    </knownExpansions>
</ModsConfigData>"#;

    #[test]
    fn parses_full_valid_xml() {
        let cfg = parse_mods_config(FULL_XML.as_bytes()).expect("full xml should parse");
        assert_eq!(&*cfg.version, "1.5.4104 rev435");
        assert_eq!(cfg.active_mods.len(), 7);
        assert_eq!(cfg.known_expansions.len(), 4);
        assert_eq!(cfg.active_mods[0], PackageId::new("zetrith.prepatcher"));
        assert_eq!(cfg.active_mods[1], PackageId::new("brrainz.harmony"));
        assert_eq!(cfg.active_mods[2], PackageId::new("bs.fishery"));
        assert_eq!(cfg.active_mods[3], PackageId::new("ludeon.rimworld"));
        assert_eq!(
            cfg.active_mods[4],
            PackageId::new("ludeon.rimworld.royalty")
        );
        assert_eq!(
            cfg.active_mods[5],
            PackageId::new("ludeon.rimworld.ideology")
        );
        assert_eq!(
            cfg.active_mods[6],
            PackageId::new("ludeon.rimworld.biotech")
        );
        assert_eq!(
            cfg.known_expansions[0],
            PackageId::new("ludeon.rimworld.royalty")
        );
        assert_eq!(
            cfg.known_expansions[3],
            PackageId::new("ludeon.rimworld.anomaly")
        );
    }

    #[test]
    fn package_id_is_lowercased() {
        let xml = r#"<ModsConfigData>
    <version>1.5.4104 rev435</version>
    <activeMods>
        <li>Ludeon.RimWorld</li>
        <li>Brrainz.Harmony</li>
    </activeMods>
    <knownExpansions>
        <li>ludeon.rimworld.royalty</li>
    </knownExpansions>
</ModsConfigData>"#;
        let cfg = parse_mods_config(xml.as_bytes()).expect("xml should parse");
        assert_eq!(cfg.active_mods[0], PackageId::new("ludeon.rimworld"));
        assert_eq!(cfg.active_mods[1], PackageId::new("brrainz.harmony"));
        assert_eq!(cfg.active_mods[0].as_str(), "ludeon.rimworld");
    }

    #[test]
    fn windows_1252_xml_decodes_declared_encoding() {
        let xml = b"<?xml version=\"1.0\" encoding=\"windows-1252\"?>
<ModsConfigData>
    <version>1.5 Caf\xE9</version>
    <activeMods>
        <li>Ludeon.RimWorld</li>
    </activeMods>
    <knownExpansions></knownExpansions>
</ModsConfigData>";
        let cfg = parse_mods_config(xml).expect("windows-1252 xml should parse");
        assert_eq!(&*cfg.version, "1.5 Caf\u{e9}");
        assert_eq!(cfg.active_mods, vec![PackageId::new("ludeon.rimworld")]);
    }

    #[test]
    fn missing_version_is_error() {
        let xml = r#"<ModsConfigData>
    <activeMods>
        <li>brrainz.harmony</li>
    </activeMods>
    <knownExpansions>
        <li>ludeon.rimworld.royalty</li>
    </knownExpansions>
</ModsConfigData>"#;
        let err = parse_mods_config(xml.as_bytes()).expect_err("missing version should error");
        assert!(
            matches!(err, CoreError::ModsConfigInvalid(ref m) if m.contains("version")),
            "expected version error, got {:?}",
            err
        );
    }

    #[test]
    fn missing_active_mods_is_error() {
        let xml = r#"<ModsConfigData>
    <version>1.5.4104 rev435</version>
    <knownExpansions>
        <li>ludeon.rimworld.royalty</li>
    </knownExpansions>
</ModsConfigData>"#;
        let err = parse_mods_config(xml.as_bytes()).expect_err("missing activeMods should error");
        assert!(
            matches!(err, CoreError::ModsConfigInvalid(ref m) if m.contains("activeMods")),
            "expected activeMods error, got {:?}",
            err
        );
    }

    #[test]
    fn missing_known_expansions_is_error() {
        let xml = r#"<ModsConfigData>
    <version>1.5.4104 rev435</version>
    <activeMods>
        <li>brrainz.harmony</li>
    </activeMods>
</ModsConfigData>"#;
        let err =
            parse_mods_config(xml.as_bytes()).expect_err("missing knownExpansions should error");
        assert!(
            matches!(err, CoreError::ModsConfigInvalid(ref m) if m.contains("knownExpansions")),
            "expected knownExpansions error, got {:?}",
            err
        );
    }

    #[test]
    fn empty_root_is_error() {
        let xml = "<ModsConfigData></ModsConfigData>";
        let err = parse_mods_config(xml.as_bytes()).expect_err("empty root should error");
        assert!(
            matches!(err, CoreError::ModsConfigInvalid(ref m) if m.contains("version")),
            "expected version error, got {:?}",
            err
        );
    }

    #[test]
    fn non_xml_is_error() {
        let xml = b"this is not xml at all";
        let err = parse_mods_config(xml).expect_err("non-xml should error");
        assert!(matches!(err, CoreError::ModsConfigInvalid(_)));
    }

    #[test]
    fn declaration_only_without_root_is_error() {
        let xml = b"<?xml version=\"1.0\" encoding=\"utf-8\"?>";
        let err = parse_mods_config(xml).expect_err("declaration-only should error");
        assert!(
            matches!(err, CoreError::ModsConfigInvalid(ref m) if m.contains("ModsConfigData")),
            "expected root error, got {:?}",
            err
        );
    }

    #[test]
    fn parses_with_xml_declaration() {
        let cfg = parse_mods_config(VALID_XML.as_bytes()).expect("valid xml should parse");
        assert_eq!(&*cfg.version, "1.5.4104 rev435");
        assert_eq!(cfg.active_mods.len(), 4);
        assert_eq!(cfg.known_expansions.len(), 2);
        assert_eq!(cfg.active_mods[0], PackageId::new("zetrith.prepatcher"));
    }

    #[test]
    fn empty_active_mods_list_is_ok() {
        let xml = r#"<ModsConfigData>
    <version>1.5.4104 rev435</version>
    <activeMods></activeMods>
    <knownExpansions>
        <li>ludeon.rimworld.royalty</li>
    </knownExpansions>
</ModsConfigData>"#;
        let cfg = parse_mods_config(xml.as_bytes()).expect("empty activeMods should parse");
        assert!(cfg.active_mods.is_empty());
        assert_eq!(cfg.known_expansions.len(), 1);
    }
}
