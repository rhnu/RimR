use super::*;
use crate::{
    domain::{ModMetadata, PackageId},
    ports::SourceKind,
};

fn meta(package_id: &str, kind: SourceKind, source_key: &str) -> ModMetadata {
    let mut metadata = ModMetadata::invalid(ModSourceKey::new(source_key), kind);
    metadata.package_id = PackageId::new(package_id);
    metadata
}

#[test]
fn names_the_copy_that_wins_and_the_ones_that_are_ignored() {
    let mut catalog = ModCatalog::new();
    catalog.insert(meta(
        "foo.bar",
        SourceKind::Local,
        "C:/RimWorld/Mods/FooBar",
    ));
    catalog.insert(meta("foo.bar", SourceKind::Workshop, "C:/workshop/12345"));

    let diagnostics = check_duplicates(&catalog);
    assert_eq!(diagnostics.len(), 1);
    let params = &diagnostics[0].params;
    assert_eq!(
        params.get("usedPath").map(String::as_str),
        Some("C:/RimWorld/Mods/FooBar")
    );
    assert_eq!(
        params.get("shadowedPaths").map(String::as_str),
        Some("C:/workshop/12345")
    );
}

#[test]
fn no_duplicates_means_no_diagnostics() {
    let mut catalog = ModCatalog::new();
    catalog.insert(meta("foo.bar", SourceKind::Local, "a"));
    catalog.insert(meta("baz.qux", SourceKind::Workshop, "b"));
    assert!(check_duplicates(&catalog).is_empty());
}
