//! quick-xml streaming parser for About.xml → [`RawAboutXml`].

use quick_xml::{
    events::{BytesStart, Event},
    reader::Reader,
};

use super::{
    error::ParseError,
    raw::{
        RawAboutXml, RawDependency, VersionedDependencyList, VersionedString, VersionedStringList,
    },
};
use crate::formats::xml::{
    XmlReadError, decode_xml_bytes, push_general_ref as shared_push_general_ref,
    read_text as shared_read_text,
};

/// Compares an XML element name against an expected ASCII name, ignoring
/// ASCII case. `RimWorld`'s own loader tolerates mixed-case tag names (e.g.
/// `<modMetaData>` vs `<ModMetaData>`), so rimr accepts them too rather than
/// silently dropping mods with non-canonical casing.
fn name_matches(name: &str, expected: &str) -> bool { name.eq_ignore_ascii_case(expected) }

/// Reads text content of the current element (after Start) until its End.
/// Returns `None` if the trimmed text is empty.
fn read_text(reader: &mut Reader<&[u8]>) -> Result<Option<String>, ParseError> {
    shared_read_text(reader).map_err(|e| match e {
        XmlReadError::Decoding(m) => ParseError::Encoding(m),
        XmlReadError::Xml(source) => ParseError::Xml(source),
        XmlReadError::UnknownEntity(message) => ParseError::UnknownEntity(message),
    })
}

/// Parses About.xml bytes into a [`RawAboutXml`].
/// # Errors
/// Returns a source, parsing, validation, or state error if the operation cannot complete.
pub fn parse_about_xml(bytes: &[u8]) -> Result<RawAboutXml, ParseError> {
    tracing::debug!(bytes = bytes.len(), "parsing About.xml");
    let bytes = decode_xml_bytes(bytes).map_err(|e| match e {
        XmlReadError::Decoding(m) => ParseError::Encoding(m),
        XmlReadError::Xml(source) => ParseError::Xml(source),
        XmlReadError::UnknownEntity(message) => ParseError::UnknownEntity(message),
    })?;
    let mut reader = Reader::from_reader(bytes.as_ref());

    let mut result = RawAboutXml::default();

    loop {
        match reader.read_event() {
            Ok(Event::Start(e)) => {
                if name_matches(e.name().as_ref(), "ModMetaData") {
                    parse_mod_metadata(&mut reader, &mut result)?;
                } else {
                    reader.read_to_end(e.name()).map_err(ParseError::Xml)?;
                }
            },
            Ok(Event::Eof) => break,
            Err(e) => {
                tracing::warn!(error = %e, "About.xml parse error");
                return Err(ParseError::XmlAt {
                    source: e,
                    byte_offset: reader.error_position(),
                });
            },
            _ => {},
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
                n if name_matches(n, "packageId") => result.package_id = read_text(reader)?,
                n if name_matches(n, "name") => result.name = read_text(reader)?,
                n if name_matches(n, "author") => result.author = read_text(reader)?,
                n if name_matches(n, "authors") => result.authors = read_string_list(reader)?,
                n if name_matches(n, "supportedVersions") => {
                    result.supported_versions = read_string_list(reader)?;
                },
                n if name_matches(n, "description") => result.description = read_text(reader)?,
                n if name_matches(n, "descriptionsByVersion") => {
                    result.descriptions_by_version = read_versioned_string(reader)?;
                },
                n if name_matches(n, "modVersion") => result.mod_version = read_text(reader)?,
                n if name_matches(n, "url") => result.url = read_text(reader)?,
                n if name_matches(n, "modIconPath") => result.mod_icon_path = read_text(reader)?,
                n if name_matches(n, "steamAppId") => result.steam_app_id = read_text(reader)?,
                n if name_matches(n, "loadAfter") => result.load_after = read_string_list(reader)?,
                n if name_matches(n, "loadBefore") => {
                    result.load_before = read_string_list(reader)?;
                },
                n if name_matches(n, "forceLoadAfter") => {
                    result.force_load_after = read_string_list(reader)?;
                },
                n if name_matches(n, "forceLoadBefore") => {
                    result.force_load_before = read_string_list(reader)?;
                },
                n if name_matches(n, "incompatibleWith") => {
                    result.incompatible_with = read_string_list(reader)?;
                },
                n if name_matches(n, "modDependencies") => {
                    result.mod_dependencies = read_dependency_list(reader)?;
                },
                n if name_matches(n, "loadAfterByVersion") => {
                    result.load_after_by_version = read_versioned_string_list(reader)?;
                },
                n if name_matches(n, "loadBeforeByVersion") => {
                    result.load_before_by_version = read_versioned_string_list(reader)?;
                },
                n if name_matches(n, "incompatibleWithByVersion") => {
                    result.incompatible_with_by_version = read_versioned_string_list(reader)?;
                },
                n if name_matches(n, "modDependenciesByVersion") => {
                    result.mod_dependencies_by_version = read_versioned_dependency_list(reader)?;
                },
                _ => {
                    reader.read_to_end(e.name()).map_err(ParseError::Xml)?;
                },
            },
            Ok(Event::End(_) | Event::Eof) => break,
            Ok(_) => {},
            Err(e) => return Err(ParseError::Xml(e)),
        }
    }
    Ok(())
}

/// Reads a `<li>text</li>` list until the outer End.
fn read_string_list(reader: &mut Reader<&[u8]>) -> Result<Vec<String>, ParseError> {
    let mut result = Vec::new();
    loop {
        match reader.read_event() {
            Ok(Event::Start(e)) if name_matches(e.name().as_ref(), "li") => {
                let text = read_text(reader)?;
                if let Some(t) = text {
                    result.push(t);
                }
            },
            Ok(Event::End(_) | Event::Eof) => break,
            Ok(_) => {},
            Err(e) => return Err(ParseError::Xml(e)),
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
                n if name_matches(n, "packageId") => dep.package_id = read_text(reader)?,
                n if name_matches(n, "displayName") => dep.display_name = read_text(reader)?,
                n if name_matches(n, "steamWorkshopUrl") => {
                    dep.steam_workshop_url = read_text(reader)?;
                },
                n if name_matches(n, "downloadUrl") => dep.download_url = read_text(reader)?,
                n if name_matches(n, "alternativePackageIds") => {
                    dep.alternative_package_ids = read_string_list(reader)?;
                },
                _ => {
                    reader.read_to_end(e.name()).map_err(ParseError::Xml)?;
                },
            },
            Ok(Event::End(_) | Event::Eof) => break,
            Ok(_) => {},
            Err(e) => return Err(ParseError::Xml(e)),
        }
    }
    Ok(dep)
}

/// Reads multiple `<li>` dependency entries inside `<modDependencies>`.
fn read_dependency_list(reader: &mut Reader<&[u8]>) -> Result<Vec<RawDependency>, ParseError> {
    let mut result = Vec::new();
    loop {
        match reader.read_event() {
            Ok(Event::Start(e)) if name_matches(e.name().as_ref(), "li") => {
                let dep = read_dependency(reader)?;
                result.push(dep);
            },
            Ok(Event::End(_) | Event::Eof) => break,
            Ok(_) => {},
            Err(e) => return Err(ParseError::Xml(e)),
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
            Ok(Event::Start(e)) if name_matches(e.name().as_ref(), "li") => {
                let mut version_key: Option<String> = None;
                let mut values: Vec<String> = Vec::new();
                loop {
                    match reader.read_event() {
                        Ok(Event::Start(inner)) if name_matches(inner.name().as_ref(), "li") => {
                            let text = read_text(reader)?;
                            if version_key.is_none() {
                                version_key = text;
                            } else if let Some(t) = text {
                                values.push(t);
                            }
                        },
                        Ok(Event::End(_) | Event::Eof) => break,
                        Ok(_) => {},
                        Err(e) => return Err(ParseError::Xml(e)),
                    }
                }
                if let Some(vk) = version_key {
                    entries.push(VersionedStringList {
                        version_key: vk,
                        values,
                    });
                }
            },
            Ok(Event::End(_) | Event::Eof) => break,
            Ok(_) => {},
            Err(e) => return Err(ParseError::Xml(e)),
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
            Ok(Event::Start(e)) if name_matches(e.name().as_ref(), "li") => {
                let mut version_key: Option<String> = None;
                let mut value = String::new();
                let mut value_seen = false;
                loop {
                    match reader.read_event() {
                        Ok(Event::Start(inner)) if name_matches(inner.name().as_ref(), "li") => {
                            let text = read_text(reader)?;
                            if version_key.is_none() {
                                version_key = text;
                            } else if !value_seen {
                                value_seen = true;
                                value = text.unwrap_or_default();
                            }
                        },
                        Ok(Event::End(_) | Event::Eof) => break,
                        Ok(_) => {},
                        Err(e) => return Err(ParseError::Xml(e)),
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
            },
            Ok(Event::End(_) | Event::Eof) => break,
            Ok(_) => {},
            Err(e) => return Err(ParseError::Xml(e)),
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
            Ok(Event::Start(e)) if name_matches(e.name().as_ref(), "li") => {
                let mut version_key: Option<String> = None;
                let mut deps: Vec<RawDependency> = Vec::new();
                loop {
                    match reader.read_event() {
                        Ok(Event::Start(inner)) if name_matches(inner.name().as_ref(), "li") => {
                            match read_versioned_dependency_item(reader)? {
                                VersionedDependencyItem::VersionKey(v) if version_key.is_none() => {
                                    version_key = Some(v);
                                },
                                VersionedDependencyItem::Dependency(dep) => deps.push(dep),
                                VersionedDependencyItem::VersionKey(_)
                                | VersionedDependencyItem::Empty => {},
                            }
                        },
                        Ok(Event::End(_) | Event::Eof) => break,
                        Ok(_) => {},
                        Err(e) => return Err(ParseError::Xml(e)),
                    }
                }
                if let Some(vk) = version_key {
                    entries.push(VersionedDependencyList {
                        version_key: vk,
                        dependencies: deps,
                    });
                }
            },
            Ok(Event::End(_) | Event::Eof) => break,
            Ok(_) => {},
            Err(e) => return Err(ParseError::Xml(e)),
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
            },
            Ok(Event::Text(t)) if !saw_dependency_child => {
                text.push_str(t.as_ref());
            },
            Ok(Event::CData(t)) if !saw_dependency_child => {
                text.push_str(t.as_ref());
            },
            Ok(Event::GeneralRef(e)) if !saw_dependency_child => {
                shared_push_general_ref(&mut text, e.as_ref()).map_err(|e| match e {
                    XmlReadError::UnknownEntity(message) => ParseError::UnknownEntity(message),
                    XmlReadError::Xml(source) => ParseError::Xml(source),
                    XmlReadError::Decoding(source) => ParseError::Encoding(source),
                })?;
            },
            Ok(Event::End(_) | Event::Eof) => break,
            Ok(_) => {},
            Err(quick_xml::Error::Encoding(e)) => {
                return Err(ParseError::Encoding(e));
            },
            Err(e) => return Err(ParseError::Xml(e)),
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
        n if name_matches(n, "packageId") => dep.package_id = read_text(reader)?,
        n if name_matches(n, "displayName") => dep.display_name = read_text(reader)?,
        n if name_matches(n, "steamWorkshopUrl") => dep.steam_workshop_url = read_text(reader)?,
        n if name_matches(n, "downloadUrl") => dep.download_url = read_text(reader)?,
        n if name_matches(n, "alternativePackageIds") => {
            dep.alternative_package_ids = read_string_list(reader)?;
        },
        _ => {
            reader
                .read_to_end(child_start.name())
                .map_err(ParseError::Xml)?;
        },
    }
    Ok(())
}

#[cfg(test)]
mod tests;
