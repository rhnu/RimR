//! Service orchestration functions for rimr-core.
//!
//! These are the primary entry points the host (rimr-tauri) calls. IO goes
//! through [`crate::ports::ModSource`] and [`crate::ports::LibraryStore`];
//! CPU work is synchronous.

mod export_backup;
mod library;
mod load_active;
mod save_active;
mod scan;
mod validate_order;

pub use export_backup::{ExportBackupResult, export_backup};
pub use library::{
    create_mod_list, delete_mod_list, import_mod_list, load_library, save_mod_list,
    set_current_mod_list,
};
pub use load_active::{ActiveLoadResult, load_active_list};
pub use save_active::build_mods_config_bytes;
pub use scan::{ScanOpts, ScanReport, scan_mod_metadata};
pub use validate_order::{ValidateOrderResult, validate_order};

#[cfg(test)]
pub(crate) mod test_support;
