//! The sole conversion from application failures into IPC errors.

pub use rimr_bindings::error::CommandErrorCode;
use serde::Serialize;
pub type CommandResult<T> = Result<T, CommandError>;

#[derive(Debug, Serialize)]
#[serde(transparent)]
pub struct CommandError(rimr_bindings::error::CommandError);

impl CommandError {
    pub fn new(code: CommandErrorCode, message: impl Into<String>) -> Self {
        Self(rimr_bindings::error::CommandError::new(code, message))
    }

    pub fn with_path(mut self, path: std::path::PathBuf) -> Self {
        self.0.path = Some(path);
        self
    }
}

#[expect(
    clippy::needless_pass_by_value,
    reason = "map_err consumes the application failure at the IPC boundary"
)]
pub fn from_app(error: rimr_app::error::AppError) -> CommandError {
    let dto = dto(&error);
    match dto.code {
        CommandErrorCode::Conflict
        | CommandErrorCode::PathNotConfigured
        | CommandErrorCode::PathInvalid
        | CommandErrorCode::PathAutodetectFailed
        | CommandErrorCode::StateMissing
        | CommandErrorCode::ModsConfigInvalid
        | CommandErrorCode::SaveGameInvalid
        | CommandErrorCode::BackupInvalid
        | CommandErrorCode::Json => {
            tracing::warn!(code = ?dto.code, path = ?dto.path, error = %dto.message, "command rejected");
        },
        _ => {
            tracing::error!(code = ?dto.code, path = ?dto.path, error = %dto.message, "command failed");
        },
    }
    CommandError(dto)
}

impl From<rimr_app::error::AppError> for CommandError {
    fn from(error: rimr_app::error::AppError) -> Self { from_app(error) }
}

pub fn dto(error: &rimr_app::error::AppError) -> rimr_bindings::error::CommandError {
    use rimr_app::error::AppErrorCode as A;
    let code = match error.code {
        A::ConfigReadFailed => CommandErrorCode::ConfigReadFailed,
        A::ConfigWriteFailed => CommandErrorCode::ConfigWriteFailed,
        A::PathAutodetectFailed => CommandErrorCode::PathAutodetectFailed,
        A::PathNotConfigured => CommandErrorCode::PathNotConfigured,
        A::PathInvalid => CommandErrorCode::PathInvalid,
        A::SourceIo => CommandErrorCode::SourceIo,
        A::ModsConfigInvalid => CommandErrorCode::ModsConfigInvalid,
        A::SaveGameInvalid => CommandErrorCode::SaveGameInvalid,
        A::BackupInvalid => CommandErrorCode::BackupInvalid,
        A::Json => CommandErrorCode::Json,
        A::StateMissing => CommandErrorCode::StateMissing,
        A::Internal => CommandErrorCode::Internal,
        A::Conflict => CommandErrorCode::Conflict,
        A::RecoveryRequired => CommandErrorCode::RecoveryRequired,
    };
    rimr_bindings::error::CommandError {
        code,
        message: error.report(),
        path: error.path.clone(),
        source_key: error.source_key.clone(),
    }
}
