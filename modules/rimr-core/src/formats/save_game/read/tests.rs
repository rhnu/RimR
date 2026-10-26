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
    use std::io::Write;

    use flate2::{Compression, write::GzEncoder};

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
        "expected savegame root error, got {err:?}"
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
    assert_eq!(mods, [] as [crate::PackageId; 0]);
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
    assert_eq!(mods, [] as [crate::PackageId; 0]);
}

#[test]
fn empty_mod_ids_list_is_ok() {
    for mod_ids in ["<modIds></modIds>", "<modIds/>"] {
        let xml = format!("<savegame><meta>{mod_ids}</meta></savegame>");
        let mods = parse_save_mod_ids(xml.as_bytes()).expect("empty modIds should parse");
        assert_eq!(mods, [] as [PackageId; 0]);
    }
}

#[test]
fn truncated_metadata_never_returns_empty_or_partial_ids() {
    for xml in [
        "<savegame>",
        "<savegame><meta>",
        "<savegame><meta><gameVersion>1.6</gameVersion>",
        "<savegame><meta><modIds><li>mod.a</li>",
        "<savegame><meta><modIds><li>mod.a",
        "<savegame><meta><modIds><li>mod.a</li></modIds>",
    ] {
        let error = parse_save_mod_ids(xml.as_bytes()).unwrap_err();
        assert!(
            matches!(
                error,
                CoreError::SaveGameParse {
                    source: quick_xml::Error::IllFormed(IllFormedError::MissingEndTag(_))
                }
            ),
            "expected a missing end tag for {xml}, got {error:?}"
        );
    }
}

#[test]
fn completed_metadata_leaves_game_body_unread() {
    let ids = parse_save_mod_ids(
        b"<savegame><meta><modIds><li>mod.a</li></modIds></meta><game><unfinished",
    )
    .unwrap();
    assert_eq!(ids, [PackageId::new("mod.a")]);
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

#[test]
fn truncated_compressed_saves_retain_io_errors() {
    use std::error::Error;

    for (bytes, expected) in [
        (&[0x1F, 0x8B, 0x08][..], "gzip"),
        (&[0x28, 0xB5, 0x2F, 0xFD][..], "zstd"),
    ] {
        let error = parse_save_mod_ids(bytes).unwrap_err();
        assert!(
            matches!(&error, CoreError::SaveGameDecode { compression, .. } if *compression == expected)
        );
        assert!(
            error
                .source()
                .unwrap()
                .downcast_ref::<std::io::Error>()
                .is_some()
        );
    }
}

#[test]
fn malformed_save_xml_retains_parser_source() {
    use std::error::Error;

    let error = parse_save_mod_ids(b"<savegame><meta><modIds><li>a</wrong>").unwrap_err();
    assert!(matches!(error, CoreError::SaveGameParse { .. }));
    assert!(
        error
            .source()
            .unwrap()
            .downcast_ref::<quick_xml::Error>()
            .is_some()
    );
}

#[test]
fn declared_save_encoding_failure_retains_encoding_cause() {
    use std::error::Error;

    let error = parse_save_mod_ids(
        b"<?xml version=\"1.0\" encoding=\"shift_jis\"?><savegame>\x82</savegame>",
    )
    .unwrap_err();
    let xml = error
        .source()
        .unwrap()
        .downcast_ref::<quick_xml::Error>()
        .unwrap();
    assert!(matches!(xml, quick_xml::Error::Encoding(_)));
    assert!(
        xml.source()
            .unwrap()
            .downcast_ref::<quick_xml::encoding::EncodingError>()
            .is_some()
    );
}
