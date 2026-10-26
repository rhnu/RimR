use super::*;

#[test]
fn new_is_case_insensitive() {
    assert_eq!(PackageId::new("TestPackage"), PackageId::new("testpackage"));
}

#[test]
fn new_trims_input() {
    assert_eq!(PackageId::new("  TrimMe  "), PackageId::new("trimme"));
}

#[test]
fn empty_becomes_sentinel() {
    assert_eq!(PackageId::new(""), PackageId::missing());
}

#[test]
fn whitespace_becomes_sentinel() {
    assert_eq!(PackageId::new("   "), PackageId::missing());
}

#[test]
fn is_sentinel_correct() {
    assert!(PackageId::missing().is_sentinel());
    assert!(!PackageId::new("normal.id").is_sentinel());
}

#[test]
fn serde_roundtrip_lowercases() {
    let original = PackageId::new("Foo.Bar");
    let json = serde_json::to_string(&original).unwrap();
    let deserialized: PackageId = serde_json::from_str(&json).unwrap();
    assert_eq!(original, deserialized);
    assert_eq!(deserialized.as_str(), "foo.bar");
}

#[test]
fn ord_sorts_alphabetically() {
    let mut v = vec![
        PackageId::new("c"),
        PackageId::new("a"),
        PackageId::new("b"),
    ];
    v.sort();
    assert_eq!(
        v,
        vec![
            PackageId::new("a"),
            PackageId::new("b"),
            PackageId::new("c"),
        ]
    );
}
