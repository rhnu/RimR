use super::*;

const VALID_XML: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<ModsConfigData>
    <version>1.5.4104 rev435</version>
    <activeMods>
        <li>zetrith.prepatcher</li>
        <li>brrainz.harmony</li>
        <li>bs.fishery</li>
        <li>ludeon.rimworld</li>
    </activeMods>
    <knownExpansions>
        <li>ludeon.rimworld.royalty</li>
        <li>ludeon.rimworld.ideology</li>
    </knownExpansions>
</ModsConfigData>"#;

const FULL_XML: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<ModsConfigData>
    <version>1.5.4104 rev435</version>
    <activeMods>
        <li>zetrith.prepatcher</li>
        <li>brrainz.harmony</li>
        <li>bs.fishery</li>
        <li>ludeon.rimworld</li>
        <li>ludeon.rimworld.royalty</li>
        <li>ludeon.rimworld.ideology</li>
        <li>ludeon.rimworld.biotech</li>
    </activeMods>
    <knownExpansions>
        <li>ludeon.rimworld.royalty</li>
        <li>ludeon.rimworld.ideology</li>
        <li>ludeon.rimworld.biotech</li>
        <li>ludeon.rimworld.anomaly</li>
    </knownExpansions>
</ModsConfigData>"#;

#[test]
fn parses_full_valid_xml() {
    let cfg = parse_mods_config(FULL_XML.as_bytes()).expect("full xml should parse");
    assert_eq!(&*cfg.version, "1.5.4104 rev435");
    assert_eq!(cfg.active_mods.len(), 7);
    assert_eq!(cfg.known_expansions.len(), 4);
    assert_eq!(cfg.active_mods[0], PackageId::new("zetrith.prepatcher"));
    assert_eq!(cfg.active_mods[1], PackageId::new("brrainz.harmony"));
    assert_eq!(cfg.active_mods[2], PackageId::new("bs.fishery"));
    assert_eq!(cfg.active_mods[3], PackageId::new("ludeon.rimworld"));
    assert_eq!(
        cfg.active_mods[4],
        PackageId::new("ludeon.rimworld.royalty")
    );
    assert_eq!(
        cfg.active_mods[5],
        PackageId::new("ludeon.rimworld.ideology")
    );
    assert_eq!(
        cfg.active_mods[6],
        PackageId::new("ludeon.rimworld.biotech")
    );
    assert_eq!(
        cfg.known_expansions[0],
        PackageId::new("ludeon.rimworld.royalty")
    );
    assert_eq!(
        cfg.known_expansions[3],
        PackageId::new("ludeon.rimworld.anomaly")
    );
}

#[test]
fn package_id_is_lowercased() {
    let xml = r"<ModsConfigData>
    <version>1.5.4104 rev435</version>
    <activeMods>
        <li>Ludeon.RimWorld</li>
        <li>Brrainz.Harmony</li>
    </activeMods>
    <knownExpansions>
        <li>ludeon.rimworld.royalty</li>
    </knownExpansions>
</ModsConfigData>";
    let cfg = parse_mods_config(xml.as_bytes()).expect("xml should parse");
    assert_eq!(cfg.active_mods[0], PackageId::new("ludeon.rimworld"));
    assert_eq!(cfg.active_mods[1], PackageId::new("brrainz.harmony"));
    assert_eq!(cfg.active_mods[0].as_str(), "ludeon.rimworld");
}

#[test]
fn windows_1252_xml_decodes_declared_encoding() {
    let xml = b"<?xml version=\"1.0\" encoding=\"windows-1252\"?>
<ModsConfigData>
    <version>1.5 Caf\xE9</version>
    <activeMods>
        <li>Ludeon.RimWorld</li>
    </activeMods>
    <knownExpansions></knownExpansions>
</ModsConfigData>";
    let cfg = parse_mods_config(xml).expect("windows-1252 xml should parse");
    assert_eq!(&*cfg.version, "1.5 Caf\u{e9}");
    assert_eq!(cfg.active_mods, vec![PackageId::new("ludeon.rimworld")]);
}

#[test]
fn missing_version_is_error() {
    let xml = r"<ModsConfigData>
    <activeMods>
        <li>brrainz.harmony</li>
    </activeMods>
    <knownExpansions>
        <li>ludeon.rimworld.royalty</li>
    </knownExpansions>
</ModsConfigData>";
    let err = parse_mods_config(xml.as_bytes()).expect_err("missing version should error");
    assert!(
        matches!(err, CoreError::ModsConfigInvalid(ref m) if m.contains("version")),
        "expected version error, got {err:?}"
    );
}

#[test]
fn missing_active_mods_is_error() {
    let xml = r"<ModsConfigData>
    <version>1.5.4104 rev435</version>
    <knownExpansions>
        <li>ludeon.rimworld.royalty</li>
    </knownExpansions>
</ModsConfigData>";
    let err = parse_mods_config(xml.as_bytes()).expect_err("missing activeMods should error");
    assert!(
        matches!(err, CoreError::ModsConfigInvalid(ref m) if m.contains("activeMods")),
        "expected activeMods error, got {err:?}"
    );
}

#[test]
fn missing_known_expansions_is_error() {
    let xml = r"<ModsConfigData>
    <version>1.5.4104 rev435</version>
    <activeMods>
        <li>brrainz.harmony</li>
    </activeMods>
</ModsConfigData>";
    let err = parse_mods_config(xml.as_bytes()).expect_err("missing knownExpansions should error");
    assert!(
        matches!(err, CoreError::ModsConfigInvalid(ref m) if m.contains("knownExpansions")),
        "expected knownExpansions error, got {err:?}"
    );
}

#[test]
fn empty_root_is_error() {
    let xml = "<ModsConfigData></ModsConfigData>";
    let err = parse_mods_config(xml.as_bytes()).expect_err("empty root should error");
    assert!(
        matches!(err, CoreError::ModsConfigInvalid(ref m) if m.contains("version")),
        "expected version error, got {err:?}"
    );
}

#[test]
fn non_xml_is_error() {
    let xml = b"this is not xml at all";
    let err = parse_mods_config(xml).expect_err("non-xml should error");
    assert!(matches!(err, CoreError::ModsConfigInvalid(_)));
}

#[test]
fn declaration_only_without_root_is_error() {
    let xml = b"<?xml version=\"1.0\" encoding=\"utf-8\"?>";
    let err = parse_mods_config(xml).expect_err("declaration-only should error");
    assert!(
        matches!(err, CoreError::ModsConfigInvalid(ref m) if m.contains("ModsConfigData")),
        "expected root error, got {err:?}"
    );
}

#[test]
fn parses_with_xml_declaration() {
    let cfg = parse_mods_config(VALID_XML.as_bytes()).expect("valid xml should parse");
    assert_eq!(&*cfg.version, "1.5.4104 rev435");
    assert_eq!(cfg.active_mods.len(), 4);
    assert_eq!(cfg.known_expansions.len(), 2);
    assert_eq!(cfg.active_mods[0], PackageId::new("zetrith.prepatcher"));
}

#[test]
fn empty_active_mods_list_is_ok() {
    let xml = r"<ModsConfigData>
    <version>1.5.4104 rev435</version>
    <activeMods></activeMods>
    <knownExpansions>
        <li>ludeon.rimworld.royalty</li>
    </knownExpansions>
</ModsConfigData>";
    let cfg = parse_mods_config(xml.as_bytes()).expect("empty activeMods should parse");
    assert_eq!(cfg.active_mods, [] as [crate::PackageId; 0]);
    assert_eq!(cfg.known_expansions.len(), 1);
}

#[test]
fn xml_parse_failure_retains_quick_xml_source() {
    use std::error::Error;

    let error = parse_mods_config(b"<ModsConfigData><version>1.6</wrong>").unwrap_err();
    assert!(matches!(error, CoreError::ModsConfigParse { .. }));
    assert!(
        error
            .source()
            .unwrap()
            .downcast_ref::<quick_xml::Error>()
            .is_some()
    );
}

#[test]
fn text_encoding_failure_retains_encoding_cause() {
    use std::error::Error;

    let error =
        parse_mods_config(b"<ModsConfigData><version>\xFF</version></ModsConfigData>").unwrap_err();
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
