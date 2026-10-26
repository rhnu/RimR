//! Shared XML reader/writer helpers.

use std::borrow::Cow;

use quick_xml::encoding::decode;
use quick_xml::events::Event;
use quick_xml::reader::Reader;

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
                    .map_err(|e| XmlReadError::Decoding(e.to_string()));
            }
            Ok(Event::Text(text)) if text.trim().is_empty() => {}
            Ok(Event::Comment(_) | Event::PI(_)) => {}
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
pub fn read_text(reader: &mut Reader<&[u8]>) -> Result<Option<String>, XmlReadError> {
    let mut text = String::new();
    let mut depth = 0;
    loop {
        match reader.read_event() {
            Ok(Event::Text(t)) => {
                if depth == 0 {
                    text.push_str(t.as_ref());
                }
            }
            Ok(Event::CData(t)) => {
                if depth == 0 {
                    text.push_str(t.as_ref());
                }
            }
            Ok(Event::GeneralRef(e)) => {
                if depth == 0 {
                    push_general_ref(&mut text, e.as_ref())?;
                }
            }
            Ok(Event::Start(_)) => depth += 1,
            Ok(Event::End(_)) => {
                if depth == 0 {
                    break;
                }
                depth -= 1;
            }
            Ok(Event::Eof) => break,
            Ok(_) => {}
            Err(quick_xml::Error::Encoding(e)) => {
                return Err(XmlReadError::Decoding(e.to_string()));
            }
            Err(e) => return Err(XmlReadError::Xml(e.to_string())),
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
    Xml(String),
    Decoding(String),
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
                "unknown XML entity: &{};",
                other
            )));
        }
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
mod tests {
    use super::*;

    fn skip_to_first_start(reader: &mut Reader<&[u8]>) {
        loop {
            if let Ok(Event::Start(_)) = reader.read_event() {
                break;
            }
        }
    }

    #[test]
    fn read_text_decodes_entities() {
        let mut reader = Reader::from_str("<x>A &amp; B</x>");
        skip_to_first_start(&mut reader);
        let text = read_text(&mut reader).unwrap();
        assert_eq!(text.as_deref(), Some("A & B"));
    }

    #[test]
    fn read_text_decodes_cdata() {
        let xml = "<x><![CDATA[raw <xml> & text]]></x>";
        let mut reader = Reader::from_str(xml);
        skip_to_first_start(&mut reader);
        let text = read_text(&mut reader).unwrap();
        assert_eq!(text.as_deref(), Some("raw <xml> & text"));
    }

    #[test]
    fn declared_encoding_applies_to_text_and_cdata() {
        let xml = b"<?xml version=\"1.0\" encoding=\"windows-1252\"?><x>Caf\xE9 <![CDATA[cr\xE8me]]> &amp; tea</x>";
        let bytes = decode_xml_bytes(xml).unwrap();
        let mut reader = Reader::from_reader(bytes.as_ref());
        skip_to_first_start(&mut reader);
        assert_eq!(
            read_text(&mut reader).unwrap().as_deref(),
            Some("Café crème & tea")
        );
    }

    #[test]
    fn malformed_declared_encoding_is_rejected() {
        let xml = b"<?xml version=\"1.0\" encoding=\"shift_jis\"?><x>\x82</x>";
        assert!(matches!(
            decode_xml_bytes(xml),
            Err(XmlReadError::Decoding(_))
        ));
    }

    #[test]
    fn invalid_utf8_text_reports_decoding_error() {
        let mut reader = Reader::from_reader(b"<x>\xFF</x>".as_slice());
        skip_to_first_start(&mut reader);
        assert!(matches!(
            read_text(&mut reader),
            Err(XmlReadError::Decoding(_))
        ));
    }

    #[test]
    fn read_text_empty_returns_none() {
        let mut reader = Reader::from_str("<x>   </x>");
        skip_to_first_start(&mut reader);
        let text = read_text(&mut reader).unwrap();
        assert_eq!(text, None);
    }

    #[test]
    fn read_text_unknown_entity_errors() {
        let mut reader = Reader::from_str("<x>A &foo; B</x>");
        skip_to_first_start(&mut reader);
        let result = read_text(&mut reader);
        assert!(matches!(result, Err(XmlReadError::UnknownEntity(_))));
    }

    #[test]
    fn xml_push_escaped_escapes_all_special_chars() {
        let mut out = String::new();
        xml_push_escaped(&mut out, "a&b<c>d\"e'f");
        assert_eq!(out, "a&amp;b&lt;c&gt;d&quot;e&apos;f");
    }

    #[test]
    fn xml_push_escaped_passes_through_normal_chars() {
        let mut out = String::new();
        xml_push_escaped(&mut out, "hello world 123");
        assert_eq!(out, "hello world 123");
    }
}
