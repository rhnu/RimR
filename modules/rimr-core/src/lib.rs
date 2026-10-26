//! Pure domain values, load-order rules, and `RimWorld` file formats for `RimR`.

mod diagnostics;
mod domain;
mod error;
mod formats;
mod ports;
mod rules;

pub use diagnostics::{
    Diagnostic, DiagnosticCode, DiagnosticIdentity, DiagnosticLocation, DiagnosticSuppression,
    Severity,
};
pub use domain::{
    ActiveModList, Alias, CatalogInsertResult, Dependency, DuplicatePackageId, EntryId,
    GameVersion, GroupChild, IdentityError, Library, LibrarySettings, ModCatalog, ModIdentity,
    ModList, ModListEntry, ModListId, ModListIndex, ModListSummary, ModMetadata, ModTagBinding,
    PackageId, Rules, TagDef, TagId, flatten_active_mods, identity_key, merge_library_settings,
    merge_library_settings_aliases, mod_identity_from_catalog, mod_list_from_active_mods,
    mod_list_from_official_content, regenerate_entry_ids,
};
pub use error::CoreError;
pub use formats::{
    CompileOpts, ModsConfig, compile_metadata, parse_about_xml, parse_mods_config,
    parse_save_mod_ids, serialize_mods_config,
};
pub use ports::{ModFeatures, ModSourceEntry, ModSourceKey, SourceFile, SourceKind};
pub use rules::{
    Edge, EdgeKind, EdgeSource, LoadOrderGraph, ValidateOpts, ValidationReport,
    build_load_order_graph, validate_order,
};
