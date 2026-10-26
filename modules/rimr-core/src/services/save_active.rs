//! Saves the active mod list by building `ModsConfig.xml` bytes.
//!
//! This use case only produces the bytes; the host is responsible for
//! writing them to disk via [`crate::ports::ModSource::write_mods_config`].

use std::sync::Arc;

use crate::{
    domain::ActiveModList,
    error::CoreError,
    formats::{ModsConfig, serialize_mods_config},
};

/// Builds `ModsConfig.xml` bytes from the active list and original config.
///
/// Preserves `version` and `known_expansions` from `original`, replacing
/// `active_mods` with the current list. Returns UTF-8 XML bytes ready to be
/// written by the host.
/// # Errors
///
/// Propagates a serialization error from the config serializer.
pub fn build_mods_config_bytes(
    list: &ActiveModList,
    original: &ModsConfig,
) -> Result<Vec<u8>, CoreError> {
    tracing::info!(active_mods = list.len(), "building ModsConfig.xml bytes");
    let updated = ModsConfig {
        version: Arc::clone(&original.version),
        active_mods: list.to_vec(),
        known_expansions: original.known_expansions.clone(),
    };
    let xml = serialize_mods_config(&updated)?;
    Ok(xml.into_bytes())
}

#[cfg(test)]
mod tests;
