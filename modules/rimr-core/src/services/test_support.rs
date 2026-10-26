//! In-memory `ModSource` implementation for use-case tests.
//!
//! Provides a builder API to assemble a synthetic mod source with
//! `About.xml` bytes and an optional `ModsConfig.xml` without touching the
//! filesystem. Only compiled under `#[cfg(test)]`.

use crate::error::SourceError;
use crate::ports::{ModFeatures, ModSource, ModSourceEntry, ModSourceKey, SourceFile, SourceKind};
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;

/// An in-memory `ModSource` backed by `HashMap`s.
pub(crate) struct MemoryModSource {
    entries: Vec<ModSourceEntry>,
    about_xmls: HashMap<ModSourceKey, Vec<u8>>,
    mods_config: Option<Vec<u8>>,
}

impl MemoryModSource {
    pub(crate) fn builder() -> MemoryModSourceBuilder {
        MemoryModSourceBuilder::default()
    }
}

#[async_trait]
impl ModSource for MemoryModSource {
    async fn discover_mods(&self) -> Result<Vec<ModSourceEntry>, SourceError> {
        Ok(self.entries.clone())
    }

    async fn read_about_xml(&self, key: &ModSourceKey) -> Result<Option<SourceFile>, SourceError> {
        Ok(self.about_xmls.get(key).cloned().map(|bytes| {
            SourceFile::new(
                Some(key.clone()),
                format!("{}/About/About.xml", key.as_str()),
                bytes,
            )
        }))
    }

    async fn read_mods_config(&self) -> Result<Option<SourceFile>, SourceError> {
        Ok(self
            .mods_config
            .clone()
            .map(|bytes| SourceFile::new(None, "ModsConfig.xml", bytes)))
    }

    async fn write_mods_config(&self, _bytes: Vec<u8>) -> Result<(), SourceError> {
        Ok(())
    }

    async fn read_mod_features(&self, _key: &ModSourceKey) -> Result<ModFeatures, SourceError> {
        Ok(ModFeatures::default())
    }
}

/// Builder for [`MemoryModSource`].
#[derive(Default)]
pub(crate) struct MemoryModSourceBuilder {
    entries: Vec<ModSourceEntry>,
    about_xmls: HashMap<ModSourceKey, Vec<u8>>,
    mods_config: Option<Vec<u8>>,
}

impl MemoryModSourceBuilder {
    /// Adds a mod entry with `About.xml` content.
    pub(crate) fn mod_entry(mut self, key: &str, kind: SourceKind, about_xml: &str) -> Self {
        let key = ModSourceKey::new(key);
        self.entries.push(ModSourceEntry {
            key: key.clone(),
            kind,
            display_name_hint: Some(Arc::from(key.as_str())),
        });
        self.about_xmls.insert(key, about_xml.as_bytes().to_vec());
        self
    }

    /// Adds a mod entry with no `About.xml` (read returns `Ok(None)`).
    pub(crate) fn mod_entry_no_about(mut self, key: &str, kind: SourceKind) -> Self {
        let key = ModSourceKey::new(key);
        self.entries.push(ModSourceEntry {
            key: key.clone(),
            kind,
            display_name_hint: Some(Arc::from(key.as_str())),
        });
        self
    }

    /// Adds a mod entry whose `About.xml` bytes are the given raw slice.
    pub(crate) fn mod_entry_bytes(mut self, key: &str, kind: SourceKind, bytes: &[u8]) -> Self {
        let key = ModSourceKey::new(key);
        self.entries.push(ModSourceEntry {
            key: key.clone(),
            kind,
            display_name_hint: Some(Arc::from(key.as_str())),
        });
        self.about_xmls.insert(key, bytes.to_vec());
        self
    }

    /// Sets the `ModsConfig.xml` content returned by `read_mods_config`.
    pub(crate) fn mods_config(mut self, xml: &str) -> Self {
        self.mods_config = Some(xml.as_bytes().to_vec());
        self
    }

    /// Finalizes the builder into a `MemoryModSource`.
    pub(crate) fn build(self) -> MemoryModSource {
        MemoryModSource {
            entries: self.entries,
            about_xmls: self.about_xmls,
            mods_config: self.mods_config,
        }
    }
}
