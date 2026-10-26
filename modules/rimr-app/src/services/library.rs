//! Snapshot mutations; the caller serializes and commits the complete candidate.
use rimr_core::{
    ModCatalog, ModList, ModListId, mod_list_from_active_mods, mod_list_from_official_content,
    regenerate_entry_ids,
};

use crate::{
    current::LibrarySnapshot,
    error::{AppError, AppErrorCode, AppResult},
};

/// # Errors
/// Returns a source, parsing, validation, or state error if the operation cannot complete.
pub fn load_library(
    snapshot: &mut LibrarySnapshot,
    active_mods: Option<&[String]>,
    catalog: Option<&ModCatalog>,
) -> AppResult<rimr_core::Library> {
    if snapshot.mod_lists.is_empty() {
        let list = if let Some(active) = active_mods {
            mod_list_from_active_mods(ModListId::new(), "Default", active, catalog)
        } else {
            mod_list_from_official_content(ModListId::new(), "Default", catalog)
        };
        snapshot.current_mod_list_id = Some(list.id);
        snapshot.mod_lists.push(list);
    }
    snapshot.library()
}

pub fn create_mod_list(
    snapshot: &mut LibrarySnapshot,
    name: String,
    base: Option<ModList>,
    catalog: Option<&ModCatalog>,
) -> ModList {
    let id = ModListId::new();
    let list = if let Some(mut base) = base {
        base.id = id;
        base.name = name;
        base.revision = 0;
        regenerate_entry_ids(&mut base.entries);
        base
    } else {
        mod_list_from_official_content(id, name, catalog)
    };
    snapshot.current_mod_list_id = Some(id);
    snapshot.mod_lists.push(list.clone());
    list
}

/// # Errors
/// Returns a source, parsing, validation, or state error if the operation cannot complete.
pub fn save_mod_list(snapshot: &mut LibrarySnapshot, mut list: ModList) -> AppResult<ModList> {
    let existing = snapshot
        .mod_lists
        .iter_mut()
        .find(|existing| existing.id == list.id)
        .ok_or_else(|| AppError::new(AppErrorCode::StateMissing, "mod list no longer exists"))?;
    if existing.revision != list.revision {
        return Err(AppError::new(
            AppErrorCode::Conflict,
            "mod list has changed; reload it before saving",
        ));
    }
    list.revision = list
        .revision
        .checked_add(1)
        .ok_or_else(|| AppError::new(AppErrorCode::Internal, "mod list revision exhausted"))?;
    *existing = list.clone();
    Ok(list)
}

/// # Errors
/// Returns a source, parsing, validation, or state error if the operation cannot complete.
pub fn delete_mod_list(
    snapshot: &mut LibrarySnapshot,
    id: ModListId,
) -> AppResult<rimr_core::ModListIndex> {
    if !snapshot.mod_lists.iter().any(|list| list.id == id) {
        return Err(AppError::new(
            AppErrorCode::StateMissing,
            "mod list no longer exists",
        ));
    }
    snapshot.mod_lists.retain(|list| list.id != id);
    if snapshot.current_mod_list_id == Some(id) {
        snapshot.current_mod_list_id = snapshot.mod_lists.first().map(|list| list.id);
    }
    Ok(snapshot.index())
}

/// # Errors
/// Returns a source, parsing, validation, or state error if the operation cannot complete.
pub fn set_current_mod_list(snapshot: &mut LibrarySnapshot, id: ModListId) -> AppResult<ModList> {
    let list = snapshot
        .mod_lists
        .iter()
        .find(|list| list.id == id)
        .cloned()
        .ok_or_else(|| AppError::new(AppErrorCode::StateMissing, "mod list no longer exists"))?;
    snapshot.current_mod_list_id = Some(id);
    Ok(list)
}

pub fn import_mod_list(snapshot: &mut LibrarySnapshot, list: ModList) -> ModList {
    let name = list.name.clone();
    create_mod_list(snapshot, name, Some(list), None)
}

#[cfg(test)]
mod tests;
