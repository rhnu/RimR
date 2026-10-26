//! Source descriptions and opaque identifiers used by metadata and diagnostics.

use std::sync::Arc;

use serde::{Deserialize, Serialize};

/// Opaque identifier for a single mod discovered by the host.
///
/// Allocated by the host; the core treats it as an opaque handle. Internally
/// an `Arc<str>` so cloning is cheap.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct ModSourceKey(Arc<str>);

impl ModSourceKey {
    /// Creates a new key from any string-like value.
    pub fn new(value: impl Into<Arc<str>>) -> Self { Self(value.into()) }

    /// Returns the underlying string.
    pub fn as_str(&self) -> &str { &self.0 }
}

impl std::fmt::Display for ModSourceKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result { f.write_str(&self.0) }
}

/// Where a mod was discovered.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SourceKind {
    /// `RimWorld` game Data directory (Core + DLCs).
    Expansion,
    /// Local mods folder.
    Local,
    /// Steam Workshop mods folder.
    Workshop,
}

/// A single mod entry discovered by the host during scanning.
#[derive(Debug, Clone)]
pub struct ModSourceEntry {
    pub key: ModSourceKey,
    pub kind: SourceKind,
    /// Optional human-readable hint (e.g. directory name) for diagnostics.
    pub display_name_hint: Option<Arc<str>>,
}

/// Best-effort filesystem features detected for a mod (no About.xml parsing).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct ModFeatures {
    /// True if the mod contains at least one `.dll` under an `Assemblies` folder
    /// at the mod root or one directory level deep.
    pub has_assemblies: bool,
}

/// Bytes read from a source file plus the path used for diagnostics.
#[derive(Debug, Clone)]
pub struct SourceFile {
    pub source_key: Option<ModSourceKey>,
    pub path: Arc<str>,
    pub bytes: Vec<u8>,
}

impl SourceFile {
    pub fn new(
        source_key: Option<ModSourceKey>,
        path: impl Into<Arc<str>>,
        bytes: Vec<u8>,
    ) -> Self {
        Self {
            source_key,
            path: path.into(),
            bytes,
        }
    }
}
