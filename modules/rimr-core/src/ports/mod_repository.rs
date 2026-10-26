//! IO abstraction trait for rimr-core.
//!
//! [`ModSource`] is the async contract between the app/core layer and the
//! host. `rimr-core` defines it; `rimr-tauri` implements it with `tokio::fs`.
//! This keeps the core free of filesystem, path, and permission concerns.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::error::SourceError;

/// Opaque identifier for a single mod discovered by the host.
///
/// Allocated by the host; the core treats it as an opaque handle. Internally
/// an `Arc<str>` so cloning is cheap.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct ModSourceKey(Arc<str>);

impl ModSourceKey {
    /// Creates a new key from any string-like value.
    pub fn new(value: impl Into<Arc<str>>) -> Self {
        Self(value.into())
    }

    /// Returns the underlying string.
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for ModSourceKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

/// Where a mod was discovered.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SourceKind {
    /// RimWorld game Data directory (Core + DLCs).
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

/// Async IO contract between the domain layer and the host.
///
/// All methods are async because they involve host-side I/O. The core calls
/// these methods; it never touches the filesystem directly.
#[async_trait]
pub trait ModSource: Sync {
    /// Discovers all mod entries available from this source.
    async fn discover_mods(&self) -> Result<Vec<ModSourceEntry>, SourceError>;

    /// Reads the `About.xml` bytes for a specific mod.
    ///
    /// Returns `Ok(None)` if the mod has no `About.xml` (the host should still
    /// report the entry via `discover_mods`; the core will create an invalid
    /// metadata record).
    async fn read_about_xml(&self, key: &ModSourceKey) -> Result<Option<SourceFile>, SourceError>;

    /// Reads the game's `ModsConfig.xml` bytes, if present.
    async fn read_mods_config(&self) -> Result<Option<SourceFile>, SourceError>;

    /// Writes the game's `ModsConfig.xml`.
    async fn write_mods_config(&self, bytes: Vec<u8>) -> Result<(), SourceError>;

    /// Best-effort detection of mod features that require filesystem inspection
    /// beyond `About.xml`. The host should return `ModFeatures::default()` on
    /// any error; failures here must not abort a scan.
    async fn read_mod_features(&self, key: &ModSourceKey) -> Result<ModFeatures, SourceError>;
}
