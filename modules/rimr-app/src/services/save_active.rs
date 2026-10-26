//! Explicit game configuration writing and pure `ModsConfig.xml` construction.
//!
//! Applies an explicit order while preserving the current game's other fields.

use std::sync::Arc;

use crate::{
    domain::ActiveModList,
    error::{AppResult, CoreError},
    formats::{ModsConfig, serialize_mods_config},
    ports::ModSource,
};

/// Reads the current configuration before replacing its order.
///
/// # Errors
/// Propagates read, parse, serialization and write failures without using stale session data.
pub async fn write_active_list(
    source: &dyn ModSource,
    list: &ActiveModList,
) -> AppResult<ModsConfig> {
    let (mut config, _) = super::load_active::load_mods_config(source).await?;
    let bytes = build_mods_config_bytes(list, &config)?;
    source.write_mods_config(bytes).await?;
    config.active_mods = list.to_vec();
    Ok(config)
}

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
