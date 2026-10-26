//! Error types for rimr-core.

use crate::ports::ModSourceKey;
use thiserror::Error;

/// Fatal domain error returned by use-case functions.
///
/// Non-fatal issues (circular dependencies, missing dependencies, order
/// violations) are reported via [`crate::diagnostics::Diagnostic`] instead.
#[derive(Debug, Error)]
pub enum CoreError {
    #[error("mods config is invalid: {0}")]
    ModsConfigInvalid(String),

    #[error("save game file is invalid: {0}")]
    SaveGameInvalid(String),

    #[error("backup file is invalid: {0}")]
    BackupInvalid(String),

    #[error("source error: {0}")]
    Source(#[from] SourceError),

    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("session state is missing: {0}")]
    SessionMissing(&'static str),

    #[error("RimR file is invalid: {0}")]
    RimrFile(#[from] RimrFileParseError),
}

/// Error returned when a RimR-owned JSON file cannot be parsed.
#[derive(Debug, Error)]
pub enum RimrFileParseError {
    #[error("unsupported {kind} format version: expected {expected}, found {found}")]
    UnsupportedFormatVersion {
        kind: &'static str,
        expected: u32,
        found: u32,
    },

    #[error("missing required field: {0}")]
    MissingField(&'static str),

    #[error("invalid RimR file kind: {0}")]
    InvalidKind(String),

    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
}

/// IO-level error produced by a [`crate::ports::ModSource`] implementation.
#[derive(Debug, Error)]
pub enum SourceError {
    #[error("I/O failure for {source_key:?}: {message}")]
    Io {
        source_key: ModSourceKey,
        message: String,
    },

    #[error("source not found: {0}")]
    NotFound(ModSourceKey),
}

/// Error from library store operations (loading/saving settings, mod lists,
/// or the mod list index).
#[derive(Debug, Error)]
pub enum LibraryError {
    #[error("library I/O failure: {0}")]
    Io(String),

    #[error("library JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("mod list not found: {0}")]
    NotFound(String),

    #[error("invalid mod list id: {0}")]
    InvalidId(String),

    #[error("active mod list is required to initialize the library but was not provided")]
    ActiveModsRequired,

    #[error("unsupported {file} format version: expected {expected}, found {found}")]
    UnsupportedFormatVersion {
        file: &'static str,
        expected: u32,
        found: u32,
    },

    #[error("library format migration failed: {0}")]
    Migration(#[from] crate::migrations::MigrationError),
}
