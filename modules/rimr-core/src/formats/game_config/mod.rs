//! Game ModsConfig.xml read/write.

mod read;
mod write;

use crate::domain::PackageId;
use std::sync::Arc;

/// The game's `ModsConfig.xml` content.
///
/// `active_mods` preserves insertion order (the load order).
/// `known_expansions` is the DLC list the game tracks.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ModsConfig {
    /// Game version string, preserved as-is (e.g. "1.5.4104 rev435").
    pub version: Arc<str>,
    /// Active mods in load order. Order is authoritative.
    pub active_mods: Vec<PackageId>,
    /// Known expansions (DLC package ids).
    pub known_expansions: Vec<PackageId>,
}

pub use read::parse_mods_config;
pub use write::serialize_mods_config;
