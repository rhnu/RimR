//! Parsed RimWorld game version.

use std::sync::Arc;

/// A parsed RimWorld game version like "1.5.4104 rev435".
///
/// Stored as the raw string for round-trip fidelity, with structured
/// major/minor/build/rev components for ByVersion key matching.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GameVersion {
    raw: Arc<str>,
    major: u32,
    minor: u32,
    build: Option<u32>,
    rev: Option<u32>,
}

impl GameVersion {
    /// Parses a version string like "1.5", "1.5.4104", or "1.5.4104 rev435".
    pub fn parse(raw: &str) -> Self {
        let trimmed = raw.trim();
        let (version_part, rev) = match trimmed.split_once("rev") {
            Some((v, r)) => (v.trim(), r.trim().parse::<u32>().ok()),
            None => (trimmed, None),
        };
        let parts: Vec<&str> = version_part.split('.').collect();
        let major = parts
            .first()
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or(0);
        let minor = parts
            .get(1)
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or(0);
        let build = parts.get(2).and_then(|s| s.parse::<u32>().ok());
        Self {
            raw: Arc::from(trimmed),
            major,
            minor,
            build,
            rev,
        }
    }

    /// Creates an "Unknown" version (when Version.txt can't be read).
    pub fn unknown() -> Self {
        Self {
            raw: Arc::from("Unknown"),
            major: 0,
            minor: 0,
            build: None,
            rev: None,
        }
    }

    pub fn raw(&self) -> &str {
        &self.raw
    }
    pub fn major(&self) -> u32 {
        self.major
    }
    pub fn minor(&self) -> u32 {
        self.minor
    }
    pub fn build(&self) -> Option<u32> {
        self.build
    }
    pub fn rev(&self) -> Option<u32> {
        self.rev
    }

    /// Returns the ByVersion lookup key, e.g. "v1.5" for "1.5.4104 rev435".
    pub fn by_version_key(&self) -> String {
        format!("v{}.{}", self.major, self.minor)
    }

    pub fn is_unknown(&self) -> bool {
        self.raw.as_ref() == "Unknown"
    }
}

impl std::fmt::Display for GameVersion {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.raw)
    }
}

#[cfg(test)]
mod tests {
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
}
