use rimr_app::{
    dto::{
        ExportGameConfigBackupDto, ExportGameConfigBackupRequest, ImportGameConfigBackupDto,
        ImportGameConfigBackupRequest,
    },
    state::AppState,
};
use tauri::State;

use crate::error::CommandResult;

#[tauri::command]
#[tracing::instrument(skip_all)]
pub async fn export_game_config_backup(
    state: State<'_, AppState>,
    request: ExportGameConfigBackupRequest,
) -> CommandResult<ExportGameConfigBackupDto> {
    tracing::info!(
        command = "export_game_config_backup",
        has_output_path = request.output_path.is_some(),
        "command invoked"
    );
    state
        .export_game_config_backup(request)
        .await
        .map_err(crate::error::from_app)
}

#[tauri::command]
#[tracing::instrument(skip_all)]
pub async fn import_game_config_backup(
    state: State<'_, AppState>,
    request: ImportGameConfigBackupRequest,
) -> CommandResult<ImportGameConfigBackupDto> {
    tracing::info!(
        command = "import_game_config_backup",
        has_input_path = request.input_path.is_some(),
        has_json = request.json.is_some(),
        "command invoked"
    );
    state
        .import_game_config_backup(request)
        .await
        .map_err(crate::error::from_app)
}
