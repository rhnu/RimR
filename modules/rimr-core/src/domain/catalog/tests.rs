use super::{CatalogInsertResult, ModCatalog};
use crate::{
    domain::{ModMetadata, PackageId, Rules},
    ports::{ModSourceKey, SourceKind},
};

fn meta(id: &str, key: &str) -> ModMetadata {
    ModMetadata {
        source_key: ModSourceKey::new(key),
        source_kind: SourceKind::Local,
        package_id: PackageId::new(id),
        name: None,
        authors: Vec::new(),
        supported_versions: Vec::new(),
        description: None,
        mod_version: None,
        url: None,
        mod_icon_path: None,
        steam_app_id: None,
        has_assemblies: false,
        rules: Rules::default(),
        valid: false,
        data_malformed: false,
    }
}

#[test]
fn insert_distinct_mods() {
    let mut cat = ModCatalog::new();
    assert_eq!(cat.insert(meta("a", "ka")), CatalogInsertResult::Inserted);
    assert_eq!(cat.insert(meta("b", "kb")), CatalogInsertResult::Inserted);
    assert_eq!(cat.insert(meta("c", "kc")), CatalogInsertResult::Inserted);
    assert_eq!(cat.len(), 3);
    assert!(!cat.has_duplicates());
    assert_eq!(cat.duplicates().count(), 0);
}

#[test]
fn insert_duplicate_keeps_first() {
    let mut cat = ModCatalog::new();
    cat.insert(meta("foo", "first"));
    assert_eq!(
        cat.insert(meta("foo", "second")),
        CatalogInsertResult::Duplicate
    );
    assert_eq!(cat.duplicates().count(), 1);
    let got = cat.get(&PackageId::new("foo")).unwrap();
    assert_eq!(got.source_key.as_str(), "first");
}

#[test]
fn contains_and_get() {
    let mut cat = ModCatalog::new();
    cat.insert(meta("x", "kx"));
    assert!(cat.contains(&PackageId::new("x")));
    assert!(!cat.contains(&PackageId::new("y")));
    assert!(cat.get(&PackageId::new("x")).is_some());
    assert!(cat.get(&PackageId::new("y")).is_none());
}

#[test]
fn iter_and_package_ids() {
    let mut cat = ModCatalog::new();
    cat.insert(meta("a", "ka"));
    cat.insert(meta("b", "kb"));
    let ids: Vec<&str> = cat.package_ids().map(PackageId::as_str).collect();
    assert_eq!(ids, vec!["a", "b"]);
    let pairs: Vec<&str> = cat.iter().map(|(_, m)| m.source_key.as_str()).collect();
    assert_eq!(pairs, vec!["ka", "kb"]);
}

#[test]
fn has_duplicates_true_after_duplicate() {
    let mut cat = ModCatalog::new();
    cat.insert(meta("d", "kd"));
    cat.insert(meta("d", "kd2"));
    assert!(cat.has_duplicates());
    assert_eq!(
        cat.duplicates().cloned().collect::<Vec<_>>(),
        vec![PackageId::new("d")]
    );
}

#[test]
fn sentinel_package_ids_do_not_create_duplicates() {
    let mut cat = ModCatalog::new();
    assert_eq!(cat.insert(meta("", "ka")), CatalogInsertResult::Inserted);
    assert_eq!(cat.insert(meta("", "kb")), CatalogInsertResult::Inserted);
    assert_eq!(cat.insert(meta("   ", "kc")), CatalogInsertResult::Inserted);
    assert_eq!(cat.len(), 3);
    assert!(
        cat.get(&PackageId::missing()).is_none(),
        "sentinel entries are source-key addressable only"
    );
    assert!(!cat.has_duplicates());
    assert_eq!(cat.duplicates().count(), 0);
    assert_eq!(cat.duplicate_variants(), []);
    assert_eq!(
        cat.get_by_source_key(&ModSourceKey::new("ka"))
            .expect("first sentinel source key should resolve")
            .source_key
            .as_str(),
        "ka"
    );
    assert_eq!(
        cat.get_by_source_key(&ModSourceKey::new("kb"))
            .expect("second sentinel source key should resolve")
            .source_key
            .as_str(),
        "kb"
    );
}

#[test]
fn source_key_lookup_includes_primary_and_duplicate_variants() {
    let mut cat = ModCatalog::new();
    cat.insert(meta("foo", "first"));
    cat.insert(meta("bar", "third"));
    cat.insert(meta("foo", "second"));

    assert_eq!(
        cat.get_by_source_key(&ModSourceKey::new("first"))
            .expect("primary source key should resolve")
            .package_id,
        PackageId::new("foo")
    );
    assert_eq!(
        cat.get_by_source_key(&ModSourceKey::new("second"))
            .expect("duplicate source key should resolve")
            .package_id,
        PackageId::new("foo")
    );

    let variants = cat.duplicate_variants();
    assert_eq!(variants.len(), 1);
    assert_eq!(variants[0].package_id, PackageId::new("foo"));
    assert_eq!(
        variants[0].source_keys,
        vec![ModSourceKey::new("first"), ModSourceKey::new("second")]
    );
}

#[test]
fn duplicates_are_stored_once_and_both_variants_stay_addressable() {
    let mut cat = ModCatalog::new();
    cat.insert(meta("foo", "C:/workshop/294100/12345"));
    cat.insert(meta("foo", "C:/RimWorld/Mods/Foo"));

    assert_eq!(cat.len(), 1, "a duplicated mod counts as one mod");
    assert_eq!(
        cat.iter().count(),
        1,
        "iteration yields primaries only, so ordering sees one entry"
    );
    assert_eq!(
        cat.get(&PackageId::new("foo")).unwrap().source_key.as_str(),
        "C:/workshop/294100/12345",
        "the first discovered copy stays primary"
    );
    for key in ["C:/workshop/294100/12345", "C:/RimWorld/Mods/Foo"] {
        assert_eq!(
            cat.get_by_source_key(&ModSourceKey::new(key))
                .expect("both copies remain inspectable")
                .source_key
                .as_str(),
            key
        );
    }
}

#[test]
fn a_third_copy_extends_the_existing_duplicate_record() {
    let mut cat = ModCatalog::new();
    cat.insert(meta("foo", "a"));
    cat.insert(meta("foo", "b"));
    cat.insert(meta("foo", "c"));

    let variants = cat.duplicate_variants();
    assert_eq!(variants.len(), 1);
    assert_eq!(
        variants[0].source_keys,
        vec![
            ModSourceKey::new("a"),
            ModSourceKey::new("b"),
            ModSourceKey::new("c"),
        ]
    );
}
