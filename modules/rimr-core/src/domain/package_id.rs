//! Case-insensitive `RimWorld` mod package identifier.

use std::sync::Arc;

use serde::{Deserialize, Serialize};

/// Sentinel value for mods with missing/invalid packageId.
pub const MISSING_PACKAGE_ID: &str = "missing.packageid";

/// Case-insensitive `RimWorld` mod package identifier.
///
/// Internally stored as lowercase. Comparison via `PartialEq`/`Hash` is
/// case-insensitive because the invariant guarantees lowercase storage.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct PackageId(Arc<str>);

impl PackageId {
    /// Creates a `PackageId`, lowercasing and trimming the input.
    /// Empty or whitespace-only input becomes the sentinel `missing.packageid`.
    pub fn new(raw: &str) -> Self {
        let lower = raw.trim().to_ascii_lowercase();
        if lower.is_empty() {
            return Self(Arc::from(MISSING_PACKAGE_ID));
        }
        Self(Arc::from(lower.as_str()))
    }

    pub fn as_str(&self) -> &str { &self.0 }

    pub fn is_sentinel(&self) -> bool { self.0.as_ref() == MISSING_PACKAGE_ID }

    pub fn missing() -> Self { Self(Arc::from(MISSING_PACKAGE_ID)) }
}

impl std::fmt::Display for PackageId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result { f.write_str(&self.0) }
}

impl Serialize for PackageId {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.0)
    }
}

impl<'de> Deserialize<'de> for PackageId {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        let s = String::deserialize(d)?;
        Ok(Self::new(&s))
    }
}

impl PartialOrd for PackageId {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> { Some(self.cmp(other)) }
}

impl Ord for PackageId {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering { self.0.as_ref().cmp(other.0.as_ref()) }
}

#[cfg(test)]
mod tests;
