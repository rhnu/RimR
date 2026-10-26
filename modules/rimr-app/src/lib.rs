//! Application use cases, session coordination and local adapters.

mod app;
pub mod app_config;
pub mod bootstrap;
pub mod current;
pub mod dto;
pub mod error;
mod fs_utils;
pub mod legacy;
mod mod_file_info;
pub mod paths;
pub mod player_log;
pub mod ports;
pub mod saves;
mod services;
pub mod source;
pub mod state;

pub use app::*;
pub use error::{AppError, AppErrorCode, AppResult};
pub use ports::{AppClock, Clock, ModSource};
pub use services::*;
pub use state::AppState;

mod domain {
    pub use rimr_core::*;
}
mod diagnostics {
    pub use rimr_core::{Diagnostic, DiagnosticCode, DiagnosticLocation, Severity};
}
mod formats {
    pub use rimr_core::{
        CompileOpts, ModsConfig, compile_metadata, parse_about_xml, parse_mods_config,
        serialize_mods_config,
    };
}
mod rules {
    pub use rimr_core::{
        LoadOrderGraph, ValidateOpts, ValidationReport, build_load_order_graph, validate_order,
    };
}
