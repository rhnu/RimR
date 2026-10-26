//! Core domain boundary for RimR.
//!
//! This crate owns the RimWorld mod list domain logic: About.xml metadata
//! parsing, load-order graph construction, order validation, ModsConfig.xml
//! read/write, and `.rimr.json` portable export/restore. IO is abstracted
//! behind the [`ports::ModSource`] async trait; the host (rimr-tauri)
//! provides the implementation.

mod app;
mod diagnostics;
mod domain;
mod error;
mod formats;
pub mod migrations;
mod ports;
mod rules;
mod services;

// Re-export the stable public API at the crate root.
pub use app::{
    ExportedRimrFile, GameConfigBackupFile, GameConfigLoadResult, GameConfigWriteResult,
    LibrarySettingsFile, ModListFile, RIMR_FILE_FORMAT_VERSION, RimrFileKind, RimrFileSerializer,
    SourceMetadata, WorkspaceSession,
};
pub use diagnostics::{Diagnostic, DiagnosticCode, DiagnosticLocation, Severity};
pub use domain::{
    ActiveModList, Alias, CatalogInsertResult, Dependency, DuplicatePackageId, GameVersion,
    GroupChild, Library, LibrarySettings, ModCatalog, ModIdentity, ModList, ModListEntry,
    ModListIndex, ModListSummary, ModMetadata, ModTagBinding, PackageId, RIMR_FORMAT_VERSION,
    Rules, TagDef, flatten_active_mods, identity_key, merge_library_settings,
    merge_library_settings_aliases, mod_identity_from_catalog, mod_list_from_active_mods,
    mod_list_from_official_content, normalize_mod_list, slugify, stable_entry_token,
    unique_mod_list_id,
};
pub use error::{CoreError, LibraryError, RimrFileParseError, SourceError};
pub use formats::{
    BackupFile, BackupMeta, CompileOpts, ModsConfig, import_backup, parse_mods_config,
    parse_save_mod_ids,
};
pub use ports::{
    AppClock, Clock, LibraryStore, ModFeatures, ModSource, ModSourceEntry, ModSourceKey,
    SourceFile, SourceKind,
};
pub use rules::{Edge, EdgeKind, EdgeSource, LoadOrderGraph, ValidateOpts, ValidationReport};
pub use services::{
    ActiveLoadResult, ExportBackupResult, ScanOpts, ScanReport, ValidateOrderResult,
    build_mods_config_bytes, create_mod_list, delete_mod_list, export_backup, import_mod_list,
    load_active_list, load_library, save_mod_list, scan_mod_metadata, set_current_mod_list,
    validate_order,
};
