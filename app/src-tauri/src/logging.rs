use std::env;
use tauri_plugin_log::{Target, TargetKind};

fn env_level(default: log::LevelFilter) -> log::LevelFilter {
    env::var("RIMR_LOG")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(default)
}

pub fn plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri_plugin_log::Builder::new()
        .level(env_level(if cfg!(debug_assertions) {
            log::LevelFilter::Debug
        } else {
            log::LevelFilter::Info
        }))
        .targets([
            Target::new(TargetKind::Stdout),
            Target::new(TargetKind::Webview),
            Target::new(TargetKind::LogDir {
                file_name: Some("rimr".into()),
            }),
        ])
        .build()
}
