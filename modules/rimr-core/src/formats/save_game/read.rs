use std::{borrow::Cow, io::Read};

use flate2::read::GzDecoder;
use quick_xml::{errors::IllFormedError, events::Event, reader::Reader};

use crate::{
    domain::PackageId,
    error::CoreError,
    formats::xml::{XmlReadError, decode_xml_bytes, read_text as shared_read_text},
};

fn read_text(reader: &mut Reader<&[u8]>) -> Result<Option<String>, CoreError> {
    shared_read_text(reader).map_err(|e| match e {
        XmlReadError::Xml(source) => CoreError::SaveGameParse { source },
        XmlReadError::Decoding(source) => CoreError::SaveGameParse {
            source: quick_xml::Error::Encoding(source),
        },
        XmlReadError::UnknownEntity(message) => CoreError::SaveGameInvalid(message),
    })
}

/// # Errors
///
/// Returns an invalid-save error if decompression or XML decoding fails, or the save metadata is missing or malformed.
pub fn parse_save_mod_ids(bytes: &[u8]) -> Result<Vec<PackageId>, CoreError> {
    tracing::debug!(bytes = bytes.len(), "parsing save game modIds");
    let bytes = decompress_save_bytes(bytes)?;
    let bytes = decode_xml_bytes(bytes.as_ref()).map_err(|e| match e {
        XmlReadError::Xml(source) => CoreError::SaveGameParse { source },
        XmlReadError::Decoding(source) => CoreError::SaveGameParse {
            source: quick_xml::Error::Encoding(source),
        },
        XmlReadError::UnknownEntity(message) => CoreError::SaveGameInvalid(message),
    })?;
    let mut reader = Reader::from_reader(bytes.as_ref());
    reader.config_mut().expand_empty_elements = true;
    let mut buf = Vec::new();

    let mut found_root = false;
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) if e.name().as_ref() == "savegame" => {
                found_root = true;
                break;
            },
            Ok(Event::Eof) => break,
            Err(e) => return Err(CoreError::SaveGameParse { source: e }),
            _ => {},
        }
        buf.clear();
    }

    if !found_root {
        return Err(CoreError::SaveGameInvalid(
            "root element savegame not found".to_string(),
        ));
    }

    read_meta_mod_ids(&mut reader)
}

fn decompress_save_bytes(bytes: &[u8]) -> Result<Cow<'_, [u8]>, CoreError> {
    if bytes.starts_with(&[0x1F, 0x8B, 0x08]) {
        tracing::debug!(bytes = bytes.len(), "decompressing gzip save game");
        let mut gzip = GzDecoder::new(bytes);
        let mut decoded = Vec::new();
        gzip.read_to_end(&mut decoded)
            .map_err(|e| CoreError::SaveGameDecode {
                compression: "gzip",
                source: e,
            })?;
        return Ok(Cow::Owned(decoded));
    }

    if bytes.starts_with(&[0x28, 0xB5, 0x2F, 0xFD]) {
        tracing::debug!(bytes = bytes.len(), "decompressing zstd save game");
        let decoded = zstd::stream::decode_all(bytes).map_err(|e| CoreError::SaveGameDecode {
            compression: "zstd",
            source: e,
        })?;
        return Ok(Cow::Owned(decoded));
    }

    Ok(Cow::Borrowed(bytes))
}

fn read_meta_mod_ids(reader: &mut Reader<&[u8]>) -> Result<Vec<PackageId>, CoreError> {
    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                let name = e.name();
                if name.as_ref() == "meta" {
                    return read_mod_ids_in_meta(reader);
                }
                reader
                    .read_to_end(name)
                    .map_err(|e| CoreError::SaveGameParse { source: e })?;
            },
            Ok(Event::End(e)) if e.name().as_ref() == "savegame" => break,
            Ok(Event::Eof) => return Err(missing_end_tag("savegame")),
            Err(e) => return Err(CoreError::SaveGameParse { source: e }),
            _ => {},
        }
        buf.clear();
    }
    tracing::info!("save game <meta> not found; older save without modIds");
    Ok(Vec::new())
}

fn read_mod_ids_in_meta(reader: &mut Reader<&[u8]>) -> Result<Vec<PackageId>, CoreError> {
    let mut buf = Vec::new();
    let mut mod_ids = None;
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                let name = e.name();
                if name.as_ref() == "modIds" {
                    mod_ids = Some(read_package_id_list(reader)?);
                } else {
                    reader
                        .read_to_end(name)
                        .map_err(|e| CoreError::SaveGameParse { source: e })?;
                }
            },
            // Finish the metadata, while leaving the potentially large game body unread.
            Ok(Event::End(e)) if e.name().as_ref() == "meta" => break,
            Ok(Event::Eof) => return Err(missing_end_tag("meta")),
            Err(e) => return Err(CoreError::SaveGameParse { source: e }),
            _ => {},
        }
        buf.clear();
    }
    if let Some(mod_ids) = mod_ids {
        Ok(mod_ids)
    } else {
        tracing::info!("save game <modIds> not found; older save without modIds");
        Ok(Vec::new())
    }
}

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
            Ok(Event::End(e)) if e.name().as_ref() == "modIds" => break,
            Ok(Event::Eof) => return Err(missing_end_tag("modIds")),
            Ok(_) => {},
            Err(e) => return Err(CoreError::SaveGameParse { source: e }),
        }
        buf.clear();
    }
    Ok(result)
}

fn missing_end_tag(element: &str) -> CoreError {
    CoreError::SaveGameParse {
        source: IllFormedError::MissingEndTag(element.to_string()).into(),
    }
}

#[cfg(test)]
mod tests;
