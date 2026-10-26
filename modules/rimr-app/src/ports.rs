//! Application-side I/O contracts.

use async_trait::async_trait;
pub use rimr_core::{ModFeatures, ModSourceEntry, ModSourceKey, SourceFile, SourceKind};

pub use crate::error::SourceError;

#[async_trait]
pub trait ModSource: Sync {
    async fn discover_mods(&self) -> Result<Vec<ModSourceEntry>, SourceError>;

    async fn read_about_xml(&self, key: &ModSourceKey) -> Result<Option<SourceFile>, SourceError>;

    async fn read_mods_config(&self) -> Result<Option<SourceFile>, SourceError>;

    async fn write_mods_config(&self, bytes: Vec<u8>) -> Result<(), SourceError>;

    async fn read_mod_features(&self, key: &ModSourceKey) -> Result<ModFeatures, SourceError>;
}

pub trait Clock: Sync {
    fn now_rfc3339(&self) -> String;
}

pub struct AppClock;

impl Clock for AppClock {
    fn now_rfc3339(&self) -> String {
        time::OffsetDateTime::now_utc()
            .format(&time::format_description::well_known::Rfc3339)
            .expect("the standard RFC3339 format accepts UTC time")
    }
}
