//! Case-insensitive RimWorld mod package identifier.

use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Sentinel value for mods with missing/invalid packageId.
pub const MISSING_PACKAGE_ID: &str = "missing.packageid";

/// Case-insensitive RimWorld mod package identifier.
///
/// Internally stored as lowercase. Comparison via `PartialEq`/`Hash` is
/// case-insensitive because the invariant guarantees lowercase storage.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct PackageId(Arc<str>);

impl PackageId {
    /// Creates a PackageId, lowercasing and trimming the input.
    /// Empty or whitespace-only input becomes the sentinel `missing.packageid`.
    pub fn new(raw: &str) -> Self {
        let lower = raw.trim().to_ascii_lowercase();
        if lower.is_empty() {
            return Self(Arc::from(MISSING_PACKAGE_ID));
        }
        Self(Arc::from(lower.as_str()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    pub fn is_sentinel(&self) -> bool {
        self.0.as_ref() == MISSING_PACKAGE_ID
    }

    pub fn missing() -> Self {
        Self(Arc::from(MISSING_PACKAGE_ID))
    }
}

impl std::fmt::Display for PackageId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl Serialize for PackageId {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.0)
    }
}

impl<'de> Deserialize<'de> for PackageId {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        let s = String::deserialize(d)?;
        Ok(PackageId::new(&s))
    }
}

impl PartialOrd for PackageId {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for PackageId {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.0.as_ref().cmp(other.0.as_ref())
    }
}

#[cfg(test)]
mod tests {
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
}
