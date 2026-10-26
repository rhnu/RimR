use crate::app_config::default_data_dir;
use crate::dto::CleanModsRequest;
use crate::dto::{
    ActiveListLoadDto, CatalogSnapshotDto, ConfiguredDirectoryKind, LoadModFolderSizeRequest,
    LoadModPreviewRequest, ModCleanupPreviewDto, ModCleanupPreviewRequest, ModCleanupResultDto,
    ModFolderSizeDto, ModPreviewDto, OpenConfiguredDirectoryRequest, OpenModFolderRequest,
    OpenSteamWorkshopPageRequest, ValidateActiveOrderRequest, ValidateOrderDto,
};
use crate::error::CommandResult;
use crate::state::AppState;
use tauri::{Manager, State};
use tauri_plugin_opener::OpenerExt;

#[tauri::command]
pub async fn rebuild_mod_catalog(state: State<'_, AppState>) -> CommandResult<CatalogSnapshotDto> {
    tracing::info!(command = "rebuild_mod_catalog", "command invoked");
    state.rebuild_mod_catalog().await.inspect_err(
        |e| tracing::error!(command = "rebuild_mod_catalog", error = ?e, "command failed"),
    )
}

#[tauri::command]
pub async fn load_mod_preview(
    state: State<'_, AppState>,
    request: LoadModPreviewRequest,
) -> CommandResult<ModPreviewDto> {
    tracing::info!(command = "load_mod_preview", source_key = %request.source_key, "command invoked");
    state.load_mod_preview(request).await.inspect_err(
        |e| tracing::error!(command = "load_mod_preview", error = ?e, "command failed"),
    )
}

#[tauri::command]
pub async fn load_mod_folder_size(
    state: State<'_, AppState>,
    request: LoadModFolderSizeRequest,
) -> CommandResult<ModFolderSizeDto> {
    tracing::info!(command = "load_mod_folder_size", source_key = %request.source_key, "command invoked");
    state.load_mod_folder_size(request).await.inspect_err(
        |e| tracing::error!(command = "load_mod_folder_size", error = ?e, "command failed"),
    )
}

#[tauri::command]
pub async fn preview_mod_cleanup(
    state: State<'_, AppState>,
    request: ModCleanupPreviewRequest,
) -> CommandResult<ModCleanupPreviewDto> {
    tracing::info!(command = "preview_mod_cleanup", kind = ?request.kind, "command invoked");
    state.preview_mod_cleanup(request).await.inspect_err(
        |e| tracing::error!(command = "preview_mod_cleanup", error = ?e, "command failed"),
    )
}

#[tauri::command]
pub async fn clean_mods(
    state: State<'_, AppState>,
    request: CleanModsRequest,
) -> CommandResult<ModCleanupResultDto> {
    tracing::info!(
        command = "clean_mods",
        kind = ?request.kind,
        source_keys = request.source_keys.len(),
        "command invoked"
    );
    state
        .clean_mods(request)
        .await
        .inspect_err(|e| tracing::error!(command = "clean_mods", error = ?e, "command failed"))
}

#[tauri::command]
pub async fn load_active_list(state: State<'_, AppState>) -> CommandResult<ActiveListLoadDto> {
    tracing::info!(command = "load_active_list", "command invoked");
    state.load_active_list().await.inspect_err(
        |e| tracing::error!(command = "load_active_list", error = ?e, "command failed"),
    )
}

#[tauri::command]
pub fn validate_active_order(
    state: State<'_, AppState>,
    request: ValidateActiveOrderRequest,
) -> CommandResult<ValidateOrderDto> {
    tracing::info!(
        command = "validate_active_order",
        active_mods = request.active_mods.len(),
        "command invoked"
    );
    state.validate_active_order(request).inspect_err(
        |e| tracing::error!(command = "validate_active_order", error = ?e, "command failed"),
    )
}

#[tauri::command]
pub fn open_mod_folder(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    request: OpenModFolderRequest,
) -> CommandResult<()> {
    tracing::info!(command = "open_mod_folder", source_key = %request.source_key, "command invoked");
    let mod_path = state.resolve_mod_folder_path(&request.source_key)?;
    if !mod_path.is_dir() {
        return Err(crate::error::CommandError::new(
            crate::error::CommandErrorCode::PathInvalid,
            "mod folder does not exist",
        )
        .with_path(mod_path));
    }
    app.opener()
        .open_path(mod_path.to_string_lossy().into_owned(), None::<&str>)
        .map_err(|error| {
            crate::error::CommandError::new(
                crate::error::CommandErrorCode::Internal,
                error.to_string(),
            )
            .with_path(mod_path.clone())
        })?;
    tracing::info!(path = ?mod_path, "mod folder opened");
    Ok(())
}

#[tauri::command]
pub fn open_steam_workshop_page(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    request: OpenSteamWorkshopPageRequest,
) -> CommandResult<()> {
    tracing::info!(
        command = "open_steam_workshop_page",
        source_key = %request.source_key,
        target = ?request.target,
        "command invoked"
    );
    let url = state.resolve_steam_workshop_url(request)?;
    app.opener().open_url(&url, None::<&str>).map_err(|error| {
        crate::error::CommandError::new(crate::error::CommandErrorCode::Internal, error.to_string())
    })?;
    tracing::info!(url = %url, "Steam Workshop page opened");
    Ok(())
}

#[tauri::command]
pub fn launch_game(app: tauri::AppHandle) -> CommandResult<()> {
    tracing::info!(command = "launch_game", "command invoked");
    const STEAM_RUN_URL: &str = "steam://rungameid/294100";
    app.opener()
        .open_url(STEAM_RUN_URL, None::<&str>)
        .map_err(|error| {
            crate::error::CommandError::new(
                crate::error::CommandErrorCode::Internal,
                error.to_string(),
            )
        })?;
    tracing::info!(url = %STEAM_RUN_URL, "game launch URL opened");
    Ok(())
}

#[tauri::command]
pub fn open_configured_directory(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    request: OpenConfiguredDirectoryRequest,
) -> CommandResult<()> {
    tracing::info!(
        command = "open_configured_directory",
        kind = ?request.kind,
        "command invoked"
    );

    let config = state.get_config()?;
    let path = match request.kind {
        ConfiguredDirectoryKind::GameDir => config.paths.game_dir.clone(),
        ConfiguredDirectoryKind::GameDataDir => config.paths.game_data_dir.clone(),
        ConfiguredDirectoryKind::LocalModsDir => config.paths.local_mods_dir.clone(),
        ConfiguredDirectoryKind::WorkshopModsDir => config.paths.workshop_mods_dir.clone(),
        ConfiguredDirectoryKind::RimrDataDir => {
            config.paths.rimr_data_dir.clone().or_else(default_data_dir)
        }
        ConfiguredDirectoryKind::RimrModListsDir => config
            .paths
            .rimr_data_dir
            .clone()
            .or_else(default_data_dir)
            .map(|path| path.join("mod-lists")),
        ConfiguredDirectoryKind::RimrLogsDir => {
            Some(app.path().app_log_dir().map_err(|error| {
                crate::error::CommandError::new(
                    crate::error::CommandErrorCode::Internal,
                    error.to_string(),
                )
            })?)
        }
    }
    .ok_or_else(|| {
        crate::error::CommandError::new(
            crate::error::CommandErrorCode::PathNotConfigured,
            format!("{:?} is not configured", request.kind),
        )
    })?;

    if !path.is_dir() {
        return Err(crate::error::CommandError::new(
            crate::error::CommandErrorCode::PathInvalid,
            "directory does not exist",
        )
        .with_path(path));
    }

    app.opener()
        .open_path(path.to_string_lossy().into_owned(), None::<&str>)
        .map_err(|error| {
            crate::error::CommandError::new(
                crate::error::CommandErrorCode::Internal,
                error.to_string(),
            )
            .with_path(path.clone())
        })?;

    tracing::info!(path = ?path, "configured directory opened");
    Ok(())
}
