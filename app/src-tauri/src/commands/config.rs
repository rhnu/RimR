use rimr_app::{AppState, state::BootstrapStatus};
use rimr_bindings::{
    app_config::{AppConfig, BootstrapStatusDto},
    dto::SaveAppConfigRequest,
    paths::DetectedPaths,
};
use tauri::State;

use crate::error::{CommandResult, from_app};

#[tauri::command]
#[tracing::instrument(skip_all)]
#[expect(
    clippy::needless_pass_by_value,
    reason = "Tauri extracts command arguments by value"
)]
pub fn get_bootstrap_status(state: State<'_, AppState>) -> BootstrapStatusDto {
    match state.bootstrap_status() {
        BootstrapStatus::Ready {
            config,
            imported_preferences,
            migrated,
        } => BootstrapStatusDto::Ready {
            config: config.into(),
            imported_preferences,
            migrated,
        },
        BootstrapStatus::RecoveryRequired { error } => BootstrapStatusDto::RecoveryRequired {
            error: crate::error::dto(&error),
        },
    }
}

#[tauri::command]
#[tracing::instrument(skip_all)]
#[expect(
    clippy::needless_pass_by_value,
    reason = "Tauri extracts command arguments by value"
)]
pub fn get_app_config(state: State<'_, AppState>) -> CommandResult<AppConfig> {
    state.get_config().map(Into::into).map_err(from_app)
}

#[tauri::command]
#[tracing::instrument(skip_all)]
#[expect(
    clippy::needless_pass_by_value,
    reason = "Tauri extracts command arguments by value"
)]
pub fn save_app_config(
    state: State<'_, AppState>,
    request: SaveAppConfigRequest,
) -> CommandResult<AppConfig> {
    state
        .replace_config(request.config.into())
        .map(Into::into)
        .map_err(from_app)
}

#[tauri::command]
#[tracing::instrument(skip_all)]
#[expect(
    clippy::needless_pass_by_value,
    reason = "Tauri extracts command arguments by value"
)]
pub fn autodetect_paths(state: State<'_, AppState>) -> CommandResult<DetectedPaths> {
    state.apply_detected_paths().map_err(from_app)
}

#[tauri::command]
#[tracing::instrument(skip_all)]
#[expect(
    clippy::needless_pass_by_value,
    reason = "Tauri extracts command arguments by value"
)]
pub fn clear_session_cache(state: State<'_, AppState>) -> CommandResult<()> {
    state.clear_session_cache().map_err(from_app)
}
