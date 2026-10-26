//! Library store port: async IO contract for persisting the RimR library.
//!
//! [`LibraryStore`] is the async trait between the domain layer and the host.
//! `rimr-core` defines it; `rimr-tauri` implements it with `tokio::fs`.
//! The core never touches the filesystem directly.

use async_trait::async_trait;

use crate::domain::{LibrarySettings, ModList, ModListIndex};
use crate::error::LibraryError;

/// Async IO contract for loading and saving the RimR library (settings,
/// mod list index, and individual mod list files).
#[async_trait]
pub trait LibraryStore: Sync {
    /// Loads `settings.json`, creating a default if it does not exist.
    async fn load_settings(&self) -> Result<LibrarySettings, LibraryError>;

    /// Saves `settings.json`.
    async fn save_settings(&self, settings: &LibrarySettings) -> Result<(), LibraryError>;

    /// Loads `mod-lists/index.json`, creating a default if it does not exist.
    async fn load_mod_list_index(&self) -> Result<ModListIndex, LibraryError>;

    /// Saves `mod-lists/index.json`.
    async fn save_mod_list_index(&self, index: &ModListIndex) -> Result<(), LibraryError>;

    /// Reads a single mod list file (`mod-lists/<id>.json`).
    async fn read_mod_list(&self, id: &str) -> Result<ModList, LibraryError>;

    /// Writes a single mod list file (`mod-lists/<id>.json`).
    async fn write_mod_list(&self, mod_list: &ModList) -> Result<(), LibraryError>;

    /// Deletes a mod list file (`mod-lists/<id>.json`).
    async fn delete_mod_list_file(&self, id: &str) -> Result<(), LibraryError>;
}
