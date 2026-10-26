use std::{env, io::Write};

use tauri_plugin_log::{Target, TargetKind};
use tracing_subscriber::{EnvFilter, filter::LevelFilter, fmt::MakeWriter};

fn configured_filter() -> Result<EnvFilter, Box<dyn std::error::Error>> {
    match env::var("RIMR_LOG") {
        Ok(value) => Ok(EnvFilter::try_new(value)?),
        Err(env::VarError::NotPresent) => Ok(EnvFilter::new(if cfg!(debug_assertions) {
            "debug"
        } else {
            "info"
        })),
        Err(error) => Err(error.into()),
    }
}

fn desktop_level() -> log::LevelFilter {
    // Invalid configuration is reported by initialize_tracing during setup.
    match configured_filter()
        .ok()
        .and_then(|filter| filter.max_level_hint())
    {
        Some(LevelFilter::OFF) => log::LevelFilter::Off,
        Some(LevelFilter::ERROR) => log::LevelFilter::Error,
        Some(LevelFilter::WARN) => log::LevelFilter::Warn,
        Some(LevelFilter::INFO) => log::LevelFilter::Info,
        Some(LevelFilter::DEBUG) => log::LevelFilter::Debug,
        _ => log::LevelFilter::Trace,
    }
}

pub fn plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri_plugin_log::Builder::new()
        .level(desktop_level())
        .targets([
            Target::new(TargetKind::Stdout),
            Target::new(TargetKind::Webview),
            Target::new(TargetKind::LogDir {
                file_name: Some("rimr".into()),
            }),
        ])
        .build()
}

struct DesktopLogOutput;

impl<'writer> MakeWriter<'writer> for DesktopLogOutput {
    type Writer = DesktopLogWriter;

    fn make_writer(&'writer self) -> Self::Writer {
        DesktopLogWriter {
            bytes: Vec::new(),
            level: log::Level::Info,
            target: "rimr".into(),
        }
    }

    fn make_writer_for(&'writer self, metadata: &tracing::Metadata<'_>) -> Self::Writer {
        let level = match *metadata.level() {
            tracing::Level::ERROR => log::Level::Error,
            tracing::Level::WARN => log::Level::Warn,
            tracing::Level::INFO => log::Level::Info,
            tracing::Level::DEBUG => log::Level::Debug,
            tracing::Level::TRACE => log::Level::Trace,
        };
        DesktopLogWriter {
            bytes: Vec::new(),
            level,
            target: metadata.target().into(),
        }
    }
}

// Retain event severity and target when forwarding formatted spans to desktop outputs.
struct DesktopLogWriter {
    bytes: Vec<u8>,
    level: log::Level,
    target: String,
}

impl Write for DesktopLogWriter {
    fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
        self.bytes.extend_from_slice(bytes);
        Ok(bytes.len())
    }

    fn flush(&mut self) -> std::io::Result<()> { Ok(()) }
}

impl Drop for DesktopLogWriter {
    fn drop(&mut self) {
        if !self.bytes.is_empty() {
            log::log!(target: &self.target, self.level, "{}", String::from_utf8_lossy(&self.bytes).trim_end());
        }
    }
}

/// Installs the subscriber after the desktop log outputs are ready.
///
/// # Errors
/// Returns an error for an invalid filter or an already installed subscriber.
pub fn initialize_tracing() -> Result<(), Box<dyn std::error::Error>> {
    let subscriber = tracing_subscriber::fmt()
        .with_env_filter(configured_filter()?)
        .with_ansi(false)
        .with_writer(DesktopLogOutput)
        .finish();
    tracing::subscriber::set_global_default(subscriber)?;
    Ok(())
}
