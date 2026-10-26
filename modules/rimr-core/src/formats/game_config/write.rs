//! Serializer for [`ModsConfig`] → `ModsConfig.xml` text.

use crate::{
    error::CoreError,
    formats::{game_config::ModsConfig, xml::xml_push_escaped},
};

/// Serializes a `ModsConfig` into an XML string.
///
/// Format: 2-space indented XML, UTF-8, with XML declaration.
/// Field order: version, activeMods, knownExpansions.
/// # Errors
/// Returns a source, parsing, validation, or state error if the operation cannot complete.
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
mod tests;
