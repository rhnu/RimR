use crate::dto::{
    ApplyModListDto, ApplyModListRequest, CreateModListRequest, DeleteModListRequest,
    ExportLibrarySettingsFileDto, ExportLibrarySettingsFileRequest, ExportModListFileDto,
    ExportModListFileRequest, ImportLibrarySettingsFileRequest, ImportModListFileRequest,
    LibraryDto, LibrarySettingsDto, ModListDto, ModListIndexDto, SaveLibrarySettingsRequest,
    SaveModListRequest, SetCurrentModListRequest,
};
use crate::error::CommandResult;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn load_library(state: State<'_, AppState>) -> CommandResult<LibraryDto> {
    tracing::info!(command = "load_library", "command invoked");
    state
        .load_library()
        .await
        .inspect_err(|e| tracing::error!(command = "load_library", error = ?e, "command failed"))
}

#[tauri::command]
pub async fn save_library_settings(
    state: State<'_, AppState>,
    request: SaveLibrarySettingsRequest,
) -> CommandResult<LibrarySettingsDto> {
    tracing::info!(command = "save_library_settings", "command invoked");
    state.save_library_settings(request).await.inspect_err(
        |e| tracing::error!(command = "save_library_settings", error = ?e, "command failed"),
    )
}

#[tauri::command]
pub async fn create_mod_list(
    state: State<'_, AppState>,
    request: CreateModListRequest,
) -> CommandResult<ModListDto> {
    tracing::info!(command = "create_mod_list", name = %request.name, "command invoked");
    state
        .create_mod_list(request)
        .await
        .inspect_err(|e| tracing::error!(command = "create_mod_list", error = ?e, "command failed"))
}

#[tauri::command]
pub async fn save_mod_list(
    state: State<'_, AppState>,
    request: SaveModListRequest,
) -> CommandResult<ModListDto> {
    tracing::info!(command = "save_mod_list", mod_list_id = %request.mod_list.id, "command invoked");
    state
        .save_mod_list(request)
        .await
        .inspect_err(|e| tracing::error!(command = "save_mod_list", error = ?e, "command failed"))
}

#[tauri::command]
pub async fn delete_mod_list(
    state: State<'_, AppState>,
    request: DeleteModListRequest,
) -> CommandResult<ModListIndexDto> {
    tracing::info!(command = "delete_mod_list", mod_list_id = %request.mod_list_id, "command invoked");
    state
        .delete_mod_list(request)
        .await
        .inspect_err(|e| tracing::error!(command = "delete_mod_list", error = ?e, "command failed"))
}

#[tauri::command]
pub async fn set_current_mod_list(
    state: State<'_, AppState>,
    request: SetCurrentModListRequest,
) -> CommandResult<ModListDto> {
    tracing::info!(command = "set_current_mod_list", mod_list_id = %request.mod_list_id, "command invoked");
    state.set_current_mod_list(request).await.inspect_err(
        |e| tracing::error!(command = "set_current_mod_list", error = ?e, "command failed"),
    )
}

#[tauri::command]
pub async fn apply_mod_list_to_game(
    state: State<'_, AppState>,
    request: ApplyModListRequest,
) -> CommandResult<ApplyModListDto> {
    tracing::info!(command = "apply_mod_list_to_game", mod_list_id = %request.mod_list.id, "command invoked");
    state.apply_mod_list_to_game(request).await.inspect_err(
        |e| tracing::error!(command = "apply_mod_list_to_game", error = ?e, "command failed"),
    )
}

#[tauri::command]
pub async fn export_mod_list_file(
    state: State<'_, AppState>,
    request: ExportModListFileRequest,
) -> CommandResult<ExportModListFileDto> {
    tracing::info!(
        command = "export_mod_list_file",
        mod_list_id = ?request.mod_list_id,
        has_output_path = request.output_path.is_some(),
        "command invoked"
    );
    state.export_mod_list_file(request).await.inspect_err(
        |e| tracing::error!(command = "export_mod_list_file", error = ?e, "command failed"),
    )
}

#[tauri::command]
pub async fn import_mod_list_file(
    state: State<'_, AppState>,
    request: ImportModListFileRequest,
) -> CommandResult<ModListDto> {
    tracing::info!(
        command = "import_mod_list_file",
        has_input_path = request.input_path.is_some(),
        has_json = request.json.is_some(),
        "command invoked"
    );
    state.import_mod_list_file(request).await.inspect_err(
        |e| tracing::error!(command = "import_mod_list_file", error = ?e, "command failed"),
    )
}

#[tauri::command]
pub async fn export_library_settings_file(
    state: State<'_, AppState>,
    request: ExportLibrarySettingsFileRequest,
) -> CommandResult<ExportLibrarySettingsFileDto> {
    tracing::info!(
        command = "export_library_settings_file",
        has_output_path = request.output_path.is_some(),
        "command invoked"
    );
    state
        .export_library_settings_file(request)
        .await
        .inspect_err(|e| tracing::error!(command = "export_library_settings_file", error = ?e, "command failed"))
}

#[tauri::command]
pub async fn import_library_settings_file(
    state: State<'_, AppState>,
    request: ImportLibrarySettingsFileRequest,
) -> CommandResult<LibrarySettingsDto> {
    tracing::info!(
        command = "import_library_settings_file",
        has_input_path = request.input_path.is_some(),
        has_json = request.json.is_some(),
        "command invoked"
    );
    state
        .import_library_settings_file(request)
        .await
        .inspect_err(|e| tracing::error!(command = "import_library_settings_file", error = ?e, "command failed"))
}
