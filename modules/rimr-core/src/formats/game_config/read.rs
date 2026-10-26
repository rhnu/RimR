//! Streaming parser for `ModsConfig.xml` → [`ModsConfig`].

use std::sync::Arc;

use quick_xml::{events::Event, reader::Reader};

use crate::{
    domain::PackageId,
    error::CoreError,
    formats::{
        game_config::ModsConfig,
        xml::{XmlReadError, decode_xml_bytes, read_text as shared_read_text},
    },
};

/// Reads text content of the current element (after Start) until its End.
/// Returns `None` if the trimmed text is empty.
fn read_text(reader: &mut Reader<&[u8]>) -> Result<Option<String>, CoreError> {
    shared_read_text(reader).map_err(|e| match e {
        XmlReadError::Xml(m) | XmlReadError::Decoding(m) | XmlReadError::UnknownEntity(m) => {
            CoreError::ModsConfigInvalid(format!("XML error: {m}"))
        },
    })
}

/// Parses ModsConfig.xml bytes into a `ModsConfig`.
///
/// Returns `CoreError::ModsConfigInvalid` if:
/// - The XML is not valid
/// - The root element is not `ModsConfigData`
/// - Any of `version`, `activeMods`, `knownExpansions` is missing
/// - `version` is empty
/// # Errors
///
/// Returns an invalid-config error for malformed XML, an unexpected root, or missing or empty required fields.
pub fn parse_mods_config(bytes: &[u8]) -> Result<ModsConfig, CoreError> {
    tracing::debug!(bytes = bytes.len(), "parsing ModsConfig.xml");
    let bytes = decode_xml_bytes(bytes).map_err(|e| match e {
        XmlReadError::Xml(m) | XmlReadError::Decoding(m) | XmlReadError::UnknownEntity(m) => {
            CoreError::ModsConfigInvalid(format!("XML error: {m}"))
        },
    })?;
    let mut reader = Reader::from_reader(bytes.as_ref());

    let mut version: Option<String> = None;
    let mut active_mods: Option<Vec<PackageId>> = None;
    let mut known_expansions: Option<Vec<PackageId>> = None;
    let mut buf = Vec::new();

    let mut found_root = false;
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) if e.name().as_ref() == "ModsConfigData" => {
                found_root = true;
                break;
            },
            Ok(Event::Eof) => break,
            Err(e) => return Err(CoreError::ModsConfigInvalid(format!("XML error: {e}"))),
            _ => {},
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
                    "version" => {
                        version = read_text(&mut reader)?;
                    },
                    "activeMods" => {
                        active_mods = Some(read_package_id_list(&mut reader)?);
                    },
                    "knownExpansions" => {
                        known_expansions = Some(read_package_id_list(&mut reader)?);
                    },
                    _ => {
                        reader
                            .read_to_end(name)
                            .map_err(|e| CoreError::ModsConfigInvalid(format!("XML error: {e}")))?;
                    },
                }
            },
            Ok(Event::End(_) | Event::Eof) => break,
            Err(e) => return Err(CoreError::ModsConfigInvalid(format!("XML error: {e}"))),
            _ => {},
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
            Ok(Event::Start(e)) if e.name().as_ref() == "li" => {
                let text = read_text(reader)?;
                if let Some(t) = text {
                    result.push(PackageId::new(&t));
                }
            },
            Ok(Event::End(_) | Event::Eof) => break,
            Ok(_) => {},
            Err(e) => return Err(CoreError::ModsConfigInvalid(format!("XML error: {e}"))),
        }
        buf.clear();
    }
    Ok(result)
}

#[cfg(test)]
mod tests;
