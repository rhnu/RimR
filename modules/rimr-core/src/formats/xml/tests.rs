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
