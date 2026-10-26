use crate::app_config::AppConfig;
use crate::dto::SaveAppConfigRequest;
use crate::error::CommandResult;
use crate::paths::DetectedPaths;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub fn get_app_config(state: State<'_, AppState>) -> CommandResult<AppConfig> {
    tracing::info!(command = "get_app_config", "command invoked");
    state
        .get_config()
        .inspect_err(|e| tracing::error!(command = "get_app_config", error = ?e, "command failed"))
}

#[tauri::command]
pub fn save_app_config(
    state: State<'_, AppState>,
    request: SaveAppConfigRequest,
) -> CommandResult<AppConfig> {
    tracing::info!(command = "save_app_config", "command invoked");
    state
        .replace_config(request.config)
        .inspect_err(|e| tracing::error!(command = "save_app_config", error = ?e, "command failed"))
}

#[tauri::command]
pub fn autodetect_paths(state: State<'_, AppState>) -> CommandResult<DetectedPaths> {
    tracing::info!(command = "autodetect_paths", "command invoked");
    state.apply_detected_paths().inspect_err(
        |e| tracing::error!(command = "autodetect_paths", error = ?e, "command failed"),
    )
}

#[tauri::command]
pub fn clear_session_cache(state: State<'_, AppState>) -> CommandResult<()> {
    tracing::info!(command = "clear_session_cache", "command invoked");
    state.clear_session_cache().inspect_err(
        |e| tracing::error!(command = "clear_session_cache", error = ?e, "command failed"),
    )
}
