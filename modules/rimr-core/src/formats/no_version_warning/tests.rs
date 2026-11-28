use super::*;

fn parse(xml: &[u8]) -> Result<NoVersionWarning, NoVersionWarningParseError> {
    NoVersionWarning::parse(&SourceFile::new(None, "ModIdsToFix.xml", xml.to_vec()))
}

#[test]
fn matches_normalized_package_ids_and_ignores_empty_entries() {
    let list = parse(
        b"\xef\xbb\xbf<?xml version=\"1.0\" encoding=\"utf-8\"?>\n\
        <ModIdsToFix><!-- Example --><li> Example.Older </li><li /></ModIdsToFix>",
    )
    .unwrap();
    assert!(
        list.location_for(&PackageId::new("example.older"))
            .is_some()
    );
    assert!(list.location_for(&PackageId::missing()).is_none());
    assert!(
        list.location_for(&PackageId::new("example.other"))
            .is_none()
    );
}

#[test]
fn accepts_an_empty_version_list() {
    let list = parse(b"<ModIdsToFix />").unwrap();
    assert!(
        list.location_for(&PackageId::new("example.older"))
            .is_none()
    );
}

#[test]
fn rejects_wrong_root_and_incomplete_or_extra_content() {
    for xml in [
        "<Other><li>a.mod</li></Other>",
        "<ModIdsToFix><li>a.mod</li>",
        "<ModIdsToFix><li>a.mod",
        "<ModIdsToFix/><Other/>",
    ] {
        assert!(parse(xml.as_bytes()).is_err(), "{xml}");
    }
}
