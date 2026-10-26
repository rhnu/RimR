use crate::dto::{ReadSaveModIdsDto, ReadSaveModIdsRequest};
use crate::error::{CommandError, CommandErrorCode, CommandResult};
use rimr_core::parse_save_mod_ids;
use std::path::PathBuf;

#[tauri::command]
pub async fn read_save_mod_ids(request: ReadSaveModIdsRequest) -> CommandResult<ReadSaveModIdsDto> {
    tracing::info!(command = "read_save_mod_ids", path = ?request.path, "command invoked");
    read_save_mod_ids_impl(request.path).await.inspect_err(
        |e| tracing::error!(command = "read_save_mod_ids", error = ?e, "command failed"),
    )
}

async fn read_save_mod_ids_impl(path: PathBuf) -> CommandResult<ReadSaveModIdsDto> {
    let bytes = match tokio::fs::read(&path).await {
        Ok(b) => b,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            return Err(CommandError::new(
                CommandErrorCode::PathInvalid,
                format!("save file not found: {}", path.display()),
            )
            .with_path(path));
        }
        Err(e) => {
            return Err(CommandError::new(
                CommandErrorCode::SourceIo,
                format!("failed to read save file: {}", e),
            )
            .with_path(path));
        }
    };
    let mod_ids = parse_save_mod_ids(&bytes).map_err(crate::error::core_error)?;
    Ok(ReadSaveModIdsDto {
        mod_ids: crate::dto::packages(&mod_ids),
    })
}
