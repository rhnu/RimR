//! Library service functions: load/create/save/delete/import mod lists.
//!
//! These are the primary entry points the host calls for library operations.
//! IO goes through [`crate::ports::LibraryStore`]; domain logic uses the pure
//! functions from [`crate::domain::library`].

use crate::{
    domain::{
        ModCatalog, ModList, ModListIndex, ModListSummary, RIMR_FORMAT_VERSION,
        mod_list_from_active_mods, mod_list_from_official_content, normalize_mod_list,
        unique_mod_list_id,
    },
    error::LibraryError,
    ports::LibraryStore,
};

/// Loads the full library snapshot.
///
/// If the mod list index is empty, creates a default mod list from the
/// provided `active_mods` (requires `active_mods` to be `Some`).
/// # Errors
///
/// Returns a store error if reading or initialization fails, or `ActiveModsRequired` if an empty library has no initial active list.
pub async fn load_library(
    store: &dyn LibraryStore,
    active_mods: Option<&[String]>,
    catalog: Option<&ModCatalog>,
) -> Result<crate::domain::Library, LibraryError> {
    tracing::info!("loading library");
    let settings = store.load_settings().await?;
    let mut index = store.load_mod_list_index().await?;

    if index.mod_lists.is_empty() {
        tracing::info!("library index empty, creating default mod list");
        let active_mods = active_mods.ok_or(LibraryError::ActiveModsRequired)?;
        let mod_list = mod_list_from_active_mods("default", "Default", active_mods, catalog);
        store.write_mod_list(&mod_list).await?;
        index = ModListIndex {
            format_version: RIMR_FORMAT_VERSION,
            current_mod_list_id: Some(mod_list.id.clone()),
            mod_lists: vec![ModListSummary {
                id: mod_list.id.clone(),
                name: mod_list.name.clone(),
            }],
        };
        store.save_mod_list_index(&index).await?;
    }

    let current_id = index
        .current_mod_list_id
        .clone()
        .or_else(|| index.mod_lists.first().map(|s| s.id.clone()))
        .ok_or_else(|| LibraryError::NotFound("no mod lists exist".to_string()))?;
    tracing::debug!(current_id = %current_id, "loading current mod list");
    let current_mod_list = store.read_mod_list(&current_id).await?;

    tracing::info!(
        mod_lists = index.mod_lists.len(),
        current_id = %current_id,
        "library loaded"
    );
    Ok(crate::domain::Library {
        settings,
        mod_lists_index: index,
        current_mod_list,
    })
}

/// Creates a new mod list.
///
/// If `base_mod_list` is provided (the "Save As" path), its entries, note, and
/// active mods are copied into the new list, preserving groups and separators.
/// Otherwise the "New" path produces a minimal official-content list: Core
/// followed by each installed DLC (see
/// [`crate::domain::mod_list_from_official_content`]).
/// # Errors
///
/// Returns a store error if loading the index or saving the new list and index fails.
pub async fn create_mod_list(
    store: &dyn LibraryStore,
    name: String,
    base_mod_list: Option<ModList>,
    catalog: Option<&ModCatalog>,
) -> Result<ModList, LibraryError> {
    tracing::info!(%name, "creating mod list");
    let mut index = store.load_mod_list_index().await?;
    let id = unique_mod_list_id(&name, &index);
    let mod_list = if let Some(base) = base_mod_list {
        normalize_mod_list(ModList {
            id: id.clone(),
            name: name.clone(),
            ..base
        })
    } else {
        mod_list_from_official_content(id.clone(), name, catalog)
    };
    store.write_mod_list(&mod_list).await?;
    index.current_mod_list_id = Some(id.clone());
    index.mod_lists.push(ModListSummary {
        id: id.clone(),
        name: mod_list.name.clone(),
    });
    store.save_mod_list_index(&index).await?;
    tracing::info!(id = %mod_list.id, name = %mod_list.name, "mod list created");
    Ok(mod_list)
}

/// Saves an existing mod list, updating the index if the name changed.
/// # Errors
///
/// Returns a store error if loading the index or saving the list and index fails.
pub async fn save_mod_list(
    store: &dyn LibraryStore,
    mod_list: ModList,
) -> Result<ModList, LibraryError> {
    tracing::info!(id = %mod_list.id, "saving mod list");
    let mod_list = normalize_mod_list(mod_list);
    store.write_mod_list(&mod_list).await?;

    let mut index = store.load_mod_list_index().await?;
    if let Some(summary) = index.mod_lists.iter_mut().find(|s| s.id == mod_list.id) {
        summary.name.clone_from(&mod_list.name);
    } else {
        index.mod_lists.push(ModListSummary {
            id: mod_list.id.clone(),
            name: mod_list.name.clone(),
        });
    }
    if index.current_mod_list_id.is_none() {
        index.current_mod_list_id = Some(mod_list.id.clone());
    }
    store.save_mod_list_index(&index).await?;
    tracing::info!(id = %mod_list.id, "mod list saved");

    Ok(mod_list)
}

/// Deletes a mod list and updates the index.
/// # Errors
///
/// Returns a store error if loading the index, deleting the file, or saving the index fails.
pub async fn delete_mod_list(
    store: &dyn LibraryStore,
    id: &str,
) -> Result<ModListIndex, LibraryError> {
    tracing::info!(%id, "deleting mod list");
    let mut index = store.load_mod_list_index().await?;
    index.mod_lists.retain(|s| s.id != id);
    if index.current_mod_list_id.as_deref() == Some(id) {
        index.current_mod_list_id = index.mod_lists.first().map(|s| s.id.clone());
    }
    store.delete_mod_list_file(id).await?;
    store.save_mod_list_index(&index).await?;
    tracing::info!(%id, "mod list deleted");
    Ok(index)
}

/// Sets the current mod list id and returns the mod list.
/// # Errors
///
/// Returns `NotFound` if the id is absent from the index, or a store error if reading or saving fails.
pub async fn set_current_mod_list(
    store: &dyn LibraryStore,
    id: &str,
) -> Result<ModList, LibraryError> {
    tracing::info!(%id, "setting current mod list");
    let mut index = store.load_mod_list_index().await?;
    if !index.mod_lists.iter().any(|s| s.id == id) {
        return Err(LibraryError::NotFound(format!("mod list not found: {id}")));
    }
    let mod_list = store.read_mod_list(id).await?;
    index.current_mod_list_id = Some(id.to_string());
    store.save_mod_list_index(&index).await?;
    tracing::info!(%id, "current mod list set");
    Ok(mod_list)
}

/// Imports a mod list, assigning a unique id to avoid collisions.
/// # Errors
///
/// Returns a store error if loading the index or saving the imported list and index fails.
pub async fn import_mod_list(
    store: &dyn LibraryStore,
    mod_list: ModList,
) -> Result<ModList, LibraryError> {
    tracing::info!(name = %mod_list.name, "importing mod list");
    let mut index = store.load_mod_list_index().await?;
    let id = unique_mod_list_id(&mod_list.name, &index);
    let mod_list = normalize_mod_list(ModList {
        id: id.clone(),
        ..mod_list
    });
    store.write_mod_list(&mod_list).await?;
    index.current_mod_list_id = Some(id.clone());
    index.mod_lists.push(ModListSummary {
        id: id.clone(),
        name: mod_list.name.clone(),
    });
    store.save_mod_list_index(&index).await?;
    tracing::info!(id = %mod_list.id, "mod list imported");
    Ok(mod_list)
}

#[cfg(test)]
mod tests;
