use crate::dto::{
    ExportGameConfigBackupDto, ExportGameConfigBackupRequest, ImportGameConfigBackupDto,
    ImportGameConfigBackupRequest,
};
use crate::error::CommandResult;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn export_game_config_backup(
    state: State<'_, AppState>,
    request: ExportGameConfigBackupRequest,
) -> CommandResult<ExportGameConfigBackupDto> {
    tracing::info!(
        command = "export_game_config_backup",
        has_output_path = request.output_path.is_some(),
        "command invoked"
    );
    state.export_game_config_backup(request).await.inspect_err(
        |e| tracing::error!(command = "export_game_config_backup", error = ?e, "command failed"),
    )
}

#[tauri::command]
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
    state.import_game_config_backup(request).await.inspect_err(
        |e| tracing::error!(command = "import_game_config_backup", error = ?e, "command failed"),
    )
}
