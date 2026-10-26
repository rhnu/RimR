use crate::dto::{LoadPlayerLogRequest, PlayerLogDto, SteamWorkshopLogDto};
use crate::error::CommandResult;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn load_steam_workshop_log(
    state: State<'_, AppState>,
) -> CommandResult<SteamWorkshopLogDto> {
    tracing::info!(command = "load_steam_workshop_log", "command invoked");
    state.load_steam_workshop_log().await.inspect_err(
        |e| tracing::error!(command = "load_steam_workshop_log", error = ?e, "command failed"),
    )
}

#[tauri::command]
pub async fn load_player_log(
    state: State<'_, AppState>,
    request: LoadPlayerLogRequest,
) -> CommandResult<PlayerLogDto> {
    tracing::info!(command = "load_player_log", source = ?request.source, "command invoked");
    state
        .load_player_log(request)
        .await
        .inspect_err(|e| tracing::error!(command = "load_player_log", error = ?e, "command failed"))
}
