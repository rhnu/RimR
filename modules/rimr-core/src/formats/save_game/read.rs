use std::borrow::Cow;
use std::io::Read;

use flate2::read::GzDecoder;
use quick_xml::events::Event;
use quick_xml::reader::Reader;

use crate::domain::PackageId;
use crate::error::CoreError;
use crate::formats::xml::{XmlReadError, read_text as shared_read_text};

fn read_text(reader: &mut Reader<&[u8]>) -> Result<Option<String>, CoreError> {
    shared_read_text(reader).map_err(|e| match e {
        XmlReadError::Xml(m) | XmlReadError::Decoding(m) | XmlReadError::UnknownEntity(m) => {
            CoreError::SaveGameInvalid(format!("XML error: {}", m))
        }
    })
}

pub fn parse_save_mod_ids(bytes: &[u8]) -> Result<Vec<PackageId>, CoreError> {
    tracing::debug!(bytes = bytes.len(), "parsing save game modIds");
    let bytes = decompress_save_bytes(bytes)?;
    let mut reader = Reader::from_reader(bytes.as_ref());
    let mut buf = Vec::new();

    let mut found_root = false;
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) if e.name().as_ref() == b"savegame" => {
                found_root = true;
                break;
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(CoreError::SaveGameInvalid(format!("XML error: {}", e))),
            _ => {}
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
        let mut decoder = GzDecoder::new(bytes);
        let mut decoded = Vec::new();
        decoder
            .read_to_end(&mut decoded)
            .map_err(|e| CoreError::SaveGameInvalid(format!("gzip decompression failed: {}", e)))?;
        return Ok(Cow::Owned(decoded));
    }

    if bytes.starts_with(&[0x28, 0xB5, 0x2F, 0xFD]) {
        tracing::debug!(bytes = bytes.len(), "decompressing zstd save game");
        let decoded = zstd::stream::decode_all(bytes)
            .map_err(|e| CoreError::SaveGameInvalid(format!("zstd decompression failed: {}", e)))?;
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
                if name.as_ref() == b"meta" {
                    return read_mod_ids_in_meta(reader);
                }
                reader
                    .read_to_end(name)
                    .map_err(|e| CoreError::SaveGameInvalid(format!("XML error: {}", e)))?;
            }
            Ok(Event::End(_)) => break,
            Ok(Event::Eof) => break,
            Err(e) => return Err(CoreError::SaveGameInvalid(format!("XML error: {}", e))),
            _ => {}
        }
        buf.clear();
    }
    tracing::info!("save game <meta> not found; older save without modIds");
    Ok(Vec::new())
}

fn read_mod_ids_in_meta(reader: &mut Reader<&[u8]>) -> Result<Vec<PackageId>, CoreError> {
    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                let name = e.name();
                if name.as_ref() == b"modIds" {
                    return read_package_id_list(reader);
                }
                reader
                    .read_to_end(name)
                    .map_err(|e| CoreError::SaveGameInvalid(format!("XML error: {}", e)))?;
            }
            Ok(Event::End(_)) => break,
            Ok(Event::Eof) => break,
            Err(e) => return Err(CoreError::SaveGameInvalid(format!("XML error: {}", e))),
            _ => {}
        }
        buf.clear();
    }
    tracing::info!("save game <modIds> not found; older save without modIds");
    Ok(Vec::new())
}

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
            Err(e) => return Err(CoreError::SaveGameInvalid(format!("XML error: {}", e))),
        }
        buf.clear();
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    const VALID_SAVE: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<savegame>
  <meta>
    <gameVersion>1.5.4104 rev435</gameVersion>
    <modIds>
      <li>brrainz.harmony</li>
      <li>ludeon.rimworld</li>
    </modIds>
    <modNames>
      <li>Harmony</li>
      <li>RimWorld</li>
    </modNames>
  </meta>
  <game></game>
</savegame>"#;

    #[test]
    fn parses_valid_save() {
        let mods = parse_save_mod_ids(VALID_SAVE.as_bytes()).expect("valid save should parse");
        assert_eq!(mods.len(), 2);
        assert_eq!(mods[0], PackageId::new("brrainz.harmony"));
        assert_eq!(mods[1], PackageId::new("ludeon.rimworld"));
    }

    #[test]
    fn parses_gzip_compressed_save() {
        use flate2::Compression;
        use flate2::write::GzEncoder;
        use std::io::Write;

        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(VALID_SAVE.as_bytes()).unwrap();
        let compressed = encoder.finish().unwrap();

        let mods = parse_save_mod_ids(&compressed).expect("compressed save should parse");
        assert_eq!(
            mods,
            vec![
                PackageId::new("brrainz.harmony"),
                PackageId::new("ludeon.rimworld")
            ]
        );
    }

    #[test]
    fn parses_zstd_compressed_save() {
        let compressed = zstd::stream::encode_all(VALID_SAVE.as_bytes(), 1).unwrap();

        let mods = parse_save_mod_ids(&compressed).expect("compressed save should parse");
        assert_eq!(
            mods,
            vec![
                PackageId::new("brrainz.harmony"),
                PackageId::new("ludeon.rimworld")
            ]
        );
    }

    #[test]
    fn package_id_is_lowercased() {
        let xml = r#"<?xml version="1.0" encoding="utf-8"?>
<savegame>
  <meta>
    <modIds>
      <li>Ludeon.RimWorld</li>
    </modIds>
  </meta>
</savegame>"#;
        let mods = parse_save_mod_ids(xml.as_bytes()).expect("valid save should parse");
        assert_eq!(mods, vec![PackageId::new("ludeon.rimworld")]);
    }

    #[test]
    fn missing_root_is_error() {
        let xml = r#"<?xml version="1.0" encoding="utf-8"?>
<foo>
  <meta>
    <modIds>
      <li>brrainz.harmony</li>
    </modIds>
  </meta>
</foo>"#;
        let err = parse_save_mod_ids(xml.as_bytes()).expect_err("missing root should error");
        assert!(
            matches!(err, CoreError::SaveGameInvalid(ref m) if m.contains("savegame")),
            "expected savegame root error, got {:?}",
            err
        );
    }

    #[test]
    fn non_xml_is_error() {
        let err = parse_save_mod_ids(b"not xml").expect_err("non-xml should error");
        assert!(matches!(err, CoreError::SaveGameInvalid(_)));
    }

    #[test]
    fn missing_meta_returns_empty() {
        let xml = r#"<?xml version="1.0" encoding="utf-8"?>
<savegame>
  <game></game>
</savegame>"#;
        let mods = parse_save_mod_ids(xml.as_bytes()).expect("missing meta should parse");
        assert!(mods.is_empty());
    }

    #[test]
    fn missing_mod_ids_returns_empty() {
        let xml = r#"<?xml version="1.0" encoding="utf-8"?>
<savegame>
  <meta>
    <gameVersion>1.5.4104 rev435</gameVersion>
  </meta>
</savegame>"#;
        let mods = parse_save_mod_ids(xml.as_bytes()).expect("missing modIds should parse");
        assert!(mods.is_empty());
    }

    #[test]
    fn empty_mod_ids_list_is_ok() {
        let xml = r#"<?xml version="1.0" encoding="utf-8"?>
<savegame>
  <meta>
    <modIds></modIds>
  </meta>
</savegame>"#;
        let mods = parse_save_mod_ids(xml.as_bytes()).expect("empty modIds should parse");
        assert!(mods.is_empty());
    }

    #[test]
    fn skips_unknown_siblings_in_meta() {
        let xml = r#"<?xml version="1.0" encoding="utf-8"?>
<savegame>
  <meta>
    <gameVersion>1.5.4104 rev435</gameVersion>
    <modIds>
      <li>brrainz.harmony</li>
      <li>ludeon.rimworld</li>
    </modIds>
    <modNames>
      <li>Harmony</li>
      <li>RimWorld</li>
    </modNames>
  </meta>
</savegame>"#;
        let mods = parse_save_mod_ids(xml.as_bytes()).expect("valid save should parse");
        assert_eq!(mods.len(), 2);
        assert_eq!(mods[0], PackageId::new("brrainz.harmony"));
        assert_eq!(mods[1], PackageId::new("ludeon.rimworld"));
    }
}
