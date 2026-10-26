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
    let xml = r#"<?xml version="1.0" encoding="utf-8"?>
<savegame>
  <meta>
    <modIds></modIds>
  </meta>
</savegame>"#;
    let mods = parse_save_mod_ids(xml.as_bytes()).expect("empty modIds should parse");
    assert_eq!(mods, [] as [crate::PackageId; 0]);
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
