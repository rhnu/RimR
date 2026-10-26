pub use rimr_bindings::dto::*;

mod backups_conv;
mod mod_lists_conv;
mod mods_conv;

pub use backups_conv::*;
pub use mod_lists_conv::*;
pub use mods_conv::*;

use rimr_core::{ActiveModList, PackageId};

pub fn packages(ids: &[PackageId]) -> Vec<String> {
    ids.iter().map(|id| id.as_str().to_string()).collect()
}

pub fn active_list_from_strings(ids: Vec<String>) -> ActiveModList {
    let ids: Vec<PackageId> = ids.iter().map(|id| PackageId::new(id)).collect();
    ActiveModList::from_slice(&ids)
}
