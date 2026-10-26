pub use rimr_bindings::error::*;

use rimr_core::{CoreError, LibraryError, SourceError};

pub fn core_error(error: CoreError) -> CommandError {
    match error {
        CoreError::ModsConfigInvalid(message) => {
            CommandError::new(CommandErrorCode::ModsConfigInvalid, message)
        }
        CoreError::SaveGameInvalid(message) => {
            CommandError::new(CommandErrorCode::SaveGameInvalid, message)
        }
        CoreError::BackupInvalid(message) => {
            CommandError::new(CommandErrorCode::BackupInvalid, message)
        }
        CoreError::Source(source) => source_error(source),
        CoreError::Json(error) => CommandError::new(CommandErrorCode::Json, error.to_string()),
        CoreError::SessionMissing(message) => {
            CommandError::new(CommandErrorCode::StateMissing, message)
        }
        CoreError::RimrFile(error) => CommandError::new(CommandErrorCode::Json, error.to_string()),
    }
}

pub fn source_error(error: SourceError) -> CommandError {
    match error {
        SourceError::Io {
            source_key,
            message,
        } => CommandError {
            code: CommandErrorCode::SourceIo,
            message,
            path: None,
            source_key: Some(source_key.as_str().to_string()),
        },
        SourceError::NotFound(source_key) => CommandError {
            code: CommandErrorCode::PathInvalid,
            message: format!("source not found: {}", source_key),
            path: None,
            source_key: Some(source_key.as_str().to_string()),
        },
    }
}

pub fn library_error(error: LibraryError) -> CommandError {
    match error {
        LibraryError::Io(msg) => CommandError::new(CommandErrorCode::ConfigReadFailed, msg),
        LibraryError::Json(e) => CommandError::new(CommandErrorCode::Json, e.to_string()),
        LibraryError::NotFound(msg) => CommandError::new(CommandErrorCode::StateMissing, msg),
        LibraryError::InvalidId(msg) => CommandError::new(CommandErrorCode::PathInvalid, msg),
        LibraryError::ActiveModsRequired => CommandError::new(
            CommandErrorCode::StateMissing,
            "active mod list is not loaded",
        ),
        LibraryError::UnsupportedFormatVersion {
            file,
            expected,
            found,
        } => CommandError::new(
            CommandErrorCode::Json,
            format!("unsupported {file} format version: expected {expected}, found {found}"),
        ),
        LibraryError::Migration(e) => CommandError::new(CommandErrorCode::Json, e.to_string()),
    }
}
