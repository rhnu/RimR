use tauri::State;

use crate::{
    app_config::AppConfig, dto::SaveAppConfigRequest, error::CommandResult, paths::DetectedPaths,
    state::AppState,
};

#[tauri::command]
#[expect(
    clippy::needless_pass_by_value,
    reason = "Tauri extracts command arguments by value"
)]
pub fn get_app_config(state: State<'_, AppState>) -> CommandResult<AppConfig> {
    tracing::info!(command = "get_app_config", "command invoked");
    state
        .get_config()
        .inspect_err(|e| tracing::error!(command = "get_app_config", error = ?e, "command failed"))
}

#[tauri::command]
#[expect(
    clippy::needless_pass_by_value,
    reason = "Tauri extracts command arguments by value"
)]
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
#[expect(
    clippy::needless_pass_by_value,
    reason = "Tauri extracts command arguments by value"
)]
pub fn autodetect_paths(state: State<'_, AppState>) -> CommandResult<DetectedPaths> {
    tracing::info!(command = "autodetect_paths", "command invoked");
    state.apply_detected_paths().inspect_err(
        |e| tracing::error!(command = "autodetect_paths", error = ?e, "command failed"),
    )
}

#[tauri::command]
#[expect(
    clippy::needless_pass_by_value,
    reason = "Tauri extracts command arguments by value"
)]
pub fn clear_session_cache(state: State<'_, AppState>) -> CommandResult<()> {
    tracing::info!(command = "clear_session_cache", "command invoked");
    state.clear_session_cache().inspect_err(
        |e| tracing::error!(command = "clear_session_cache", error = ?e, "command failed"),
    )
}
