//! Serializer for [`ModsConfig`] → `ModsConfig.xml` text.

use crate::error::CoreError;
use crate::formats::game_config::ModsConfig;
use crate::formats::xml::xml_push_escaped;

/// Serializes a ModsConfig into an XML string.
///
/// Format: 2-space indented XML, UTF-8, with XML declaration.
/// Field order: version, activeMods, knownExpansions.
pub fn serialize_mods_config(config: &ModsConfig) -> Result<String, CoreError> {
    tracing::debug!(
        version = %config.version,
        active_mods = config.active_mods.len(),
        "serializing ModsConfig.xml"
    );
    let mut xml = String::new();
    xml.push_str("<?xml version=\"1.0\" encoding=\"utf-8\"?>\n");
    xml.push_str("<ModsConfigData>\n");

    xml.push_str("  <version>");
    xml_push_escaped(&mut xml, &config.version);
    xml.push_str("</version>\n");

    xml.push_str("  <activeMods>\n");
    for id in &config.active_mods {
        xml.push_str("    <li>");
        xml_push_escaped(&mut xml, id.as_str());
        xml.push_str("</li>\n");
    }
    xml.push_str("  </activeMods>\n");

    xml.push_str("  <knownExpansions>\n");
    for id in &config.known_expansions {
        xml.push_str("    <li>");
        xml_push_escaped(&mut xml, id.as_str());
        xml.push_str("</li>\n");
    }
    xml.push_str("  </knownExpansions>\n");

    xml.push_str("</ModsConfigData>\n");

    Ok(xml)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::PackageId;
    use crate::formats::game_config::parse_mods_config;
    use std::sync::Arc;

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

    #[test]
    fn roundtrip_preserves_fields_and_order() {
        let original = parse_mods_config(VALID_XML.as_bytes()).expect("parse should succeed");
        let serialized = serialize_mods_config(&original).expect("serialize should succeed");
        let reparsed = parse_mods_config(serialized.as_bytes()).expect("reparse should succeed");
        assert_eq!(original, reparsed);
        assert_eq!(original.active_mods, reparsed.active_mods);
        assert_eq!(original.known_expansions, reparsed.known_expansions);
        assert_eq!(original.version, reparsed.version);
    }

    #[test]
    fn output_has_declaration_indent_and_field_order() {
        let cfg = ModsConfig {
            version: Arc::from("1.5.4104 rev435"),
            active_mods: vec![PackageId::new("brrainz.harmony")],
            known_expansions: vec![PackageId::new("ludeon.rimworld.royalty")],
        };
        let xml = serialize_mods_config(&cfg).expect("serialize should succeed");
        assert!(
            xml.starts_with("<?xml version=\"1.0\" encoding=\"utf-8\"?>\n"),
            "expected XML declaration header"
        );
        let version_idx = xml.find("<version>").expect("version element");
        let active_idx = xml.find("<activeMods>").expect("activeMods element");
        let known_idx = xml
            .find("<knownExpansions>")
            .expect("knownExpansions element");
        assert!(version_idx < active_idx, "version must precede activeMods");
        assert!(
            active_idx < known_idx,
            "activeMods must precede knownExpansions"
        );
        assert!(
            xml.contains("  <version>"),
            "expected 2-space indent on version"
        );
        assert!(
            xml.contains("    <li>brrainz.harmony</li>"),
            "expected 4-space indent on li"
        );
    }

    #[test]
    fn escapes_special_characters_in_package_ids() {
        let cfg = ModsConfig {
            version: Arc::from("1.5.4104 rev435"),
            active_mods: vec![PackageId::new("a&b<c>d\"e'f")],
            known_expansions: vec![],
        };
        let xml = serialize_mods_config(&cfg).expect("serialize should succeed");
        assert!(xml.contains("a&amp;b&lt;c&gt;d&quot;e&apos;f"));
        assert!(!xml.contains("a&b<c>d\"e'f"));
        let reparsed = parse_mods_config(xml.as_bytes()).expect("reparse should succeed");
        assert_eq!(reparsed.active_mods[0].as_str(), "a&b<c>d\"e'f");
    }

    #[test]
    fn empty_active_mods_serializes_without_li() {
        let cfg = ModsConfig {
            version: Arc::from("1.5.4104 rev435"),
            active_mods: vec![],
            known_expansions: vec![PackageId::new("ludeon.rimworld.royalty")],
        };
        let xml = serialize_mods_config(&cfg).expect("serialize should succeed");
        let active_block = xml
            .split("<activeMods>\n")
            .nth(1)
            .unwrap()
            .split("</activeMods>")
            .next()
            .unwrap();
        assert!(
            !active_block.contains("<li>"),
            "empty activeMods must not contain <li>"
        );
        assert!(xml.contains("  <activeMods>\n  </activeMods>\n"));
    }

    #[test]
    fn version_with_space_is_preserved() {
        let cfg = ModsConfig {
            version: Arc::from("1.5.4104 rev435"),
            active_mods: vec![PackageId::new("brrainz.harmony")],
            known_expansions: vec![],
        };
        let xml = serialize_mods_config(&cfg).expect("serialize should succeed");
        assert!(xml.contains("<version>1.5.4104 rev435</version>"));
        let reparsed = parse_mods_config(xml.as_bytes()).expect("reparse should succeed");
        assert_eq!(&*reparsed.version, "1.5.4104 rev435");
    }
}
