mod commands;
mod error;
mod logging;

/// Starts the desktop application and its configured plugins.
///
/// # Panics
/// Panics if Tauri cannot initialize or run the application event loop.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri::Manager;
    let mut builder = tauri::Builder::default();
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|_app, _args, _cwd| {}));
        builder = builder.plugin(tauri_plugin_window_state::Builder::new().build());
    }
    builder
        .plugin(logging::plugin())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            logging::initialize_tracing()?;
            let state = rimr_app::AppState::from_default_config_path();
            if let rimr_app::state::BootstrapStatus::RecoveryRequired { error } = state.bootstrap_status() {
                tracing::error!(error = %error.report(), path = ?error.path, "startup requires recovery");
            }
            app.manage(state);
            Ok(())
        })
        .invoke_handler(commands::handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
