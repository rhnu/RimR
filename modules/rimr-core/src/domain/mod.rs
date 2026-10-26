//! Domain value types for rimr-core.

mod active_order;
mod catalog;
mod dependency;
mod game_version;
mod library;
mod mod_metadata;
mod package_id;

pub use active_order::ActiveModList;
pub use catalog::{CatalogInsertResult, DuplicatePackageId, ModCatalog};
pub use dependency::Dependency;
pub use game_version::GameVersion;
pub use library::{
    Alias, GroupChild, Library, LibrarySettings, ModIdentity, ModList, ModListEntry, ModListIndex,
    ModListSummary, ModTagBinding, RIMR_FORMAT_VERSION, TagDef, flatten_active_mods, identity_key,
    merge_library_settings, merge_library_settings_aliases, mod_identity_from_catalog,
    mod_list_from_active_mods, mod_list_from_official_content, normalize_mod_list, slugify,
    stable_entry_token, unique_mod_list_id,
};
pub use mod_metadata::{ModMetadata, Rules};
pub use package_id::PackageId;
