use super::*;

#[test]
fn parse_full_version() {
    let v = GameVersion::parse("1.5.4104 rev435");
    assert_eq!(v.major(), 1);
    assert_eq!(v.minor(), 5);
    assert_eq!(v.build(), Some(4104));
    assert_eq!(v.rev(), Some(435));
    assert_eq!(v.by_version_key(), "v1.5");
}

#[test]
fn parse_major_minor_only() {
    let v = GameVersion::parse("1.5");
    assert_eq!(v.major(), 1);
    assert_eq!(v.minor(), 5);
    assert_eq!(v.build(), None);
    assert_eq!(v.rev(), None);
}

#[test]
fn parse_major_minor_build() {
    let v = GameVersion::parse("1.4.3945");
    assert_eq!(v.build(), Some(3945));
    assert_eq!(v.rev(), None);
}

#[test]
fn unknown_version() {
    let v = GameVersion::unknown();
    assert!(v.is_unknown());
    assert_eq!(v.raw(), "Unknown");
}

#[test]
fn display_outputs_raw() {
    let v = GameVersion::parse("1.5.4104 rev435");
    assert_eq!(v.to_string(), "1.5.4104 rev435");
}
