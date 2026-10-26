pub mod backups;
pub mod config;
pub mod logs;
pub mod mod_lists;
pub mod mods;
pub mod saves;

pub use backups::*;
pub use config::*;
pub use logs::*;
pub use mod_lists::*;
pub use mods::*;
pub use saves::*;

pub fn handler() -> impl Fn(tauri::ipc::Invoke<tauri::Wry>) -> bool {
    tauri::generate_handler![
        get_app_config,
        save_app_config,
        autodetect_paths,
        clear_session_cache,
        rebuild_mod_catalog,
        load_mod_preview,
        load_mod_folder_size,
        preview_mod_cleanup,
        clean_mods,
        load_active_list,
        validate_active_order,
        load_library,
        save_library_settings,
        create_mod_list,
        save_mod_list,
        delete_mod_list,
        set_current_mod_list,
        apply_mod_list_to_game,
        export_game_config_backup,
        import_game_config_backup,
        export_mod_list_file,
        import_mod_list_file,
        export_library_settings_file,
        import_library_settings_file,
        read_save_mod_ids,
        open_mod_folder,
        open_steam_workshop_page,
        launch_game,
        open_configured_directory,
        load_steam_workshop_log,
        load_player_log
    ]
}
