//! Shared XML reader/writer helpers.

use std::borrow::Cow;

use quick_xml::{encoding::decode, events::Event, reader::Reader};

/// Transcodes declared non-UTF-8 input before constructing string-based XML events.
/// UTF-8 input stays borrowed so parsing and byte-offset diagnostics remain lazy.
pub(crate) fn decode_xml_bytes(bytes: &[u8]) -> Result<Cow<'_, [u8]>, XmlReadError> {
    let mut reader = Reader::from_reader(bytes);
    loop {
        match reader.read_event() {
            Ok(Event::Decl(_)) => {
                let encoding = reader.encoding();
                if encoding.name() == "UTF-8" {
                    return Ok(Cow::Borrowed(bytes));
                }
                return decode(bytes, encoding)
                    .map(|text| match text {
                        Cow::Borrowed(text) => Cow::Borrowed(text.as_bytes()),
                        Cow::Owned(text) => Cow::Owned(text.into_bytes()),
                    })
                    .map_err(XmlReadError::Decoding);
            },
            Ok(Event::Text(text)) if text.trim().is_empty() => {},
            Ok(Event::Comment(_) | Event::PI(_)) => {},
            // Let the actual parser report malformed XML and encoding failures.
            _ => return Ok(Cow::Borrowed(bytes)),
        }
    }
}

/// Reads text content of the current element (after its Start event) until
/// the matching End event. Decodes text, CDATA, and standard XML entity
/// references (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;`). Returns `None`
/// if the trimmed text is empty.
///
/// Unknown entity references are returned as an error string.
/// # Errors
/// Returns a source, parsing, validation, or state error if the operation cannot complete.
pub fn read_text(reader: &mut Reader<&[u8]>) -> Result<Option<String>, XmlReadError> {
    let mut text = String::new();
    let mut depth = 0;
    loop {
        match reader.read_event() {
            Ok(Event::Text(t)) => {
                if depth == 0 {
                    text.push_str(t.as_ref());
                }
            },
            Ok(Event::CData(t)) => {
                if depth == 0 {
                    text.push_str(t.as_ref());
                }
            },
            Ok(Event::GeneralRef(e)) => {
                if depth == 0 {
                    push_general_ref(&mut text, e.as_ref())?;
                }
            },
            Ok(Event::Start(_)) => depth += 1,
            Ok(Event::End(_)) => {
                if depth == 0 {
                    break;
                }
                depth -= 1;
            },
            Ok(Event::Eof) => break,
            Ok(_) => {},
            Err(quick_xml::Error::Encoding(e)) => {
                return Err(XmlReadError::Decoding(e));
            },
            Err(e) => return Err(XmlReadError::Xml(e)),
        }
    }
    let trimmed = text.trim();
    if trimmed.is_empty() {
        Ok(None)
    } else {
        Ok(Some(trimmed.to_string()))
    }
}

/// Error from XML text reading.
#[derive(Debug)]
pub enum XmlReadError {
    Xml(quick_xml::Error),
    Decoding(quick_xml::encoding::EncodingError),
    UnknownEntity(String),
}

/// Resolves a standard XML general entity reference into its character and
/// appends it to `text`. Unknown entities return an error.
pub(crate) fn push_general_ref(text: &mut String, entity: &str) -> Result<(), XmlReadError> {
    match entity {
        "amp" => text.push('&'),
        "lt" => text.push('<'),
        "gt" => text.push('>'),
        "quot" => text.push('"'),
        "apos" => text.push('\''),
        other => {
            return Err(XmlReadError::UnknownEntity(format!(
                "unknown XML entity: &{other};"
            )));
        },
    }
    Ok(())
}

/// Escapes XML special characters in a string and appends to `out`.
pub fn xml_push_escaped(out: &mut String, text: &str) {
    for c in text.chars() {
        match c {
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '&' => out.push_str("&amp;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&apos;"),
            _ => out.push(c),
        }
    }
}

#[cfg(test)]
mod tests;
