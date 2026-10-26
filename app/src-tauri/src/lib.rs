pub mod app_config;
mod commands;
pub mod dto;
mod error;
mod fs_utils;
mod library_store;
pub mod logging;
mod mod_file_info;
pub mod paths;
pub mod player_log;
pub mod source;
pub mod state;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
        .manage(state::AppState::from_default_config_path())
        .invoke_handler(commands::handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
