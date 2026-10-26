//! RimR `.rimr.json` backup/restore.
//!
//! Backup files carry the active mod list plus RimR extra metadata
//! (`formatVersion`, `backupAt`, `note`, `gameVersion` snapshot). The
//! `groups[]`/`tags[]` fields are reserved for future use and parsed
//! leniently (unknown fields ignored).

mod export;
mod import;
mod schema;

pub use export::{build_backup, serialize_backup};
pub use import::import_backup;
pub use schema::{BackupFile, BackupMeta};
