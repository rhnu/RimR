use rimr_app::{
    dto::{LoadPlayerLogRequest, PlayerLogDto, SteamWorkshopLogDto},
    state::AppState,
};
use tauri::State;

use crate::error::CommandResult;

#[tauri::command]
#[tracing::instrument(skip_all)]
pub async fn load_steam_workshop_log(
    state: State<'_, AppState>,
) -> CommandResult<SteamWorkshopLogDto> {
    tracing::info!(command = "load_steam_workshop_log", "command invoked");
    state
        .load_steam_workshop_log()
        .await
        .map_err(crate::error::from_app)
}

#[tauri::command]
#[tracing::instrument(skip_all)]
pub async fn load_player_log(
    state: State<'_, AppState>,
    request: LoadPlayerLogRequest,
) -> CommandResult<PlayerLogDto> {
    tracing::info!(command = "load_player_log", source = ?request.source, "command invoked");
    state
        .load_player_log(request)
        .await
        .map_err(crate::error::from_app)
}
