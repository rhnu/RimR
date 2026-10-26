//! Errors retain their source until the host renders an IPC response.
use std::{path::PathBuf, sync::Arc};

pub use rimr_core::CoreError;
use thiserror::Error;

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AppErrorCode {
    ConfigReadFailed,
    ConfigWriteFailed,
    PathAutodetectFailed,
    PathNotConfigured,
    PathInvalid,
    SourceIo,
    ModsConfigInvalid,
    SaveGameInvalid,
    BackupInvalid,
    Json,
    StateMissing,
    Internal,
    Conflict,
    RecoveryRequired,
}

#[derive(Debug, Clone)]
pub struct AppError {
    pub code: AppErrorCode,
    pub message: String,
    pub path: Option<PathBuf>,
    pub source_key: Option<String>,
    pub source: Option<Arc<dyn std::error::Error + Send + Sync>>,
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.message)
    }
}

impl std::error::Error for AppError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        // Expose the wrapped error itself, rather than the cloneable Arc container.
        self.source
            .as_deref()
            .map(|source| source as &(dyn std::error::Error + 'static))
    }
}

impl AppError {
    pub fn new(code: AppErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            path: None,
            source_key: None,
            source: None,
        }
    }

    #[must_use]
    pub fn with_path(mut self, path: PathBuf) -> Self {
        self.path = Some(path);
        self
    }

    #[must_use]
    pub fn with_source_key(mut self, key: impl Into<String>) -> Self {
        self.source_key = Some(key.into());
        self
    }

    #[must_use]
    pub fn with_source(mut self, source: impl std::error::Error + Send + Sync + 'static) -> Self {
        self.source = Some(Arc::new(source));
        self
    }

    pub fn report(&self) -> String {
        let mut report = self.message.clone();
        let mut cause = std::error::Error::source(self);
        while let Some(source) = cause {
            report.push_str(": ");
            report.push_str(&source.to_string());
            cause = source.source();
        }
        report
    }

    pub fn io(code: AppErrorCode, path: impl Into<PathBuf>, source: std::io::Error) -> Self {
        Self::new(code, "file operation failed")
            .with_path(path.into())
            .with_source(source)
    }
}

pub fn core_error(error: CoreError) -> AppError {
    let code = match &error {
        CoreError::ModsConfigInvalid(_) | CoreError::ModsConfigParse { .. } => {
            AppErrorCode::ModsConfigInvalid
        },
        CoreError::SaveGameInvalid(_)
        | CoreError::SaveGameParse { .. }
        | CoreError::SaveGameDecode { .. } => AppErrorCode::SaveGameInvalid,
    };
    AppError::new(code, "application operation failed").with_source(error)
}

impl From<serde_json::Error> for AppError {
    fn from(error: serde_json::Error) -> Self {
        Self::new(AppErrorCode::Json, "JSON document is invalid").with_source(error)
    }
}

impl From<CoreError> for AppError {
    fn from(error: CoreError) -> Self { core_error(error) }
}

#[derive(Debug, Error)]
pub enum SourceError {
    #[error("I/O failure for {source_key}")]
    Io {
        source_key: rimr_core::ModSourceKey,
        #[source]
        source: std::io::Error,
    },
    #[error("source not found: {0}")]
    NotFound(rimr_core::ModSourceKey),
}

impl From<SourceError> for AppError {
    fn from(error: SourceError) -> Self {
        let (code, key) = match &error {
            SourceError::Io { source_key, .. } => {
                (AppErrorCode::SourceIo, source_key.as_str().to_string())
            },
            SourceError::NotFound(key) => (AppErrorCode::PathInvalid, key.as_str().to_string()),
        };
        Self::new(code, "mod source operation failed")
            .with_path(PathBuf::from(&key))
            .with_source_key(key)
            .with_source(error)
    }
}

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
    #[error("invalid portable file kind: {0}")]
    InvalidKind(String),
    #[error("portable JSON cannot be parsed")]
    Json(#[from] serde_json::Error),
}

impl From<rimr_core::IdentityError> for AppError {
    fn from(error: rimr_core::IdentityError) -> Self {
        Self::new(AppErrorCode::PathInvalid, "invalid entity ID").with_source(error)
    }
}
