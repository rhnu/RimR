//! Application use cases for scanning, validation and library/game configuration operations.
//!
//! Game I/O goes through [`crate::ports::ModSource`]. Library mutations operate
//! on candidate snapshots that the application coordinator commits.

mod library;
mod load_active;
mod save_active;
mod scan;
mod validate_order;

pub use library::{
    create_mod_list, delete_mod_list, import_mod_list, load_library, save_mod_list,
    set_current_mod_list,
};
pub use load_active::{ActiveLoadResult, load_active_list};
pub use save_active::{build_mods_config_bytes, write_active_list};
pub use scan::{ScanOpts, ScanReport, scan_mod_metadata};
pub use validate_order::{ValidateOrderResult, validate_order};

#[cfg(test)]
pub(crate) mod test_support;
