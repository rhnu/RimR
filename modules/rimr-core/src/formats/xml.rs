//! Shared XML reader/writer helpers.

use quick_xml::events::Event;
use quick_xml::reader::Reader;

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
                    let s = t
                        .decode()
                        .map_err(|e| XmlReadError::Decoding(e.to_string()))?;
                    text.push_str(&s);
                }
            }
            Ok(Event::CData(t)) => {
                if depth == 0 {
                    let s = t
                        .decode()
                        .map_err(|e| XmlReadError::Decoding(e.to_string()))?;
                    text.push_str(&s);
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
pub(crate) fn push_general_ref(text: &mut String, entity: &[u8]) -> Result<(), XmlReadError> {
    match entity {
        b"amp" => text.push('&'),
        b"lt" => text.push('<'),
        b"gt" => text.push('>'),
        b"quot" => text.push('"'),
        b"apos" => text.push('\''),
        other => {
            return Err(XmlReadError::UnknownEntity(format!(
                "unknown XML entity: &{};",
                String::from_utf8_lossy(other)
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
