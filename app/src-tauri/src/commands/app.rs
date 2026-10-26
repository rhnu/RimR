use rimr_app::AppState;
use tauri::State;
use tauri_plugin_opener::OpenerExt;

use crate::error::{CommandResult, from_app};

#[tauri::command]
#[tracing::instrument(skip_all)]
pub async fn get_game_version(state: State<'_, AppState>) -> CommandResult<Option<String>> {
    state.get_game_version().await.map_err(from_app)
}

#[tauri::command]
#[tracing::instrument(skip_all)]
#[expect(
    clippy::needless_pass_by_value,
    reason = "Tauri extracts command arguments by value"
)]
pub fn open_project_page(app: tauri::AppHandle) -> CommandResult<()> {
    app.opener()
        .open_url("https://github.com/rhnu/rimr", None::<&str>)
        .map_err(|error| {
            from_app(
                rimr_app::error::AppError::new(
                    rimr_app::error::AppErrorCode::Internal,
                    "opening the project page failed",
                )
                .with_source(error),
            )
        })
}
