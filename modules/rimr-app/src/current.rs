//! Current-format persistence. This module never reads legacy documents.

use std::{
    collections::HashSet,
    io::Write,
    path::{Path, PathBuf},
};

use rimr_core::{
    Library, LibrarySettings, ModList, ModListEntry, ModListId, ModListIndex, ModListSummary,
    identity_key,
};
use serde::{Deserialize, Serialize};

use crate::{
    app_config::AppConfig,
    error::{AppError, AppErrorCode, AppResult},
};

pub const SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LibrarySnapshot {
    pub schema_version: u32,
    pub settings: LibrarySettings,
    pub mod_lists: Vec<ModList>,
    pub current_mod_list_id: Option<ModListId>,
}

impl Default for LibrarySnapshot {
    fn default() -> Self {
        Self {
            schema_version: SCHEMA_VERSION,
            settings: LibrarySettings::default(),
            mod_lists: Vec::new(),
            current_mod_list_id: None,
        }
    }
}

impl LibrarySnapshot {
    /// # Errors
    /// Returns a source, parsing, validation, or state error if the operation cannot complete.
    pub fn validate(&self) -> AppResult<()> {
        if self.schema_version != SCHEMA_VERSION {
            return Err(invalid("unsupported library schema version"));
        }
        let mut list_ids = HashSet::new();
        let mut entry_ids = HashSet::new();
        for list in &self.mod_lists {
            if !list_ids.insert(list.id) {
                return Err(invalid("duplicate mod list ID"));
            }
            for entry in &list.entries {
                let id = match entry {
                    ModListEntry::Mod { id, .. } | ModListEntry::Separator { id, .. } => id,
                    ModListEntry::Group { id, entries, .. } => {
                        for child in entries {
                            if !entry_ids.insert(child.id) {
                                return Err(invalid("duplicate entry ID"));
                            }
                        }
                        id
                    },
                };
                if !entry_ids.insert(*id) {
                    return Err(invalid("duplicate entry ID"));
                }
            }
        }
        if self
            .current_mod_list_id
            .is_some_and(|id| !list_ids.contains(&id))
            || (self.current_mod_list_id.is_none() && !self.mod_lists.is_empty())
        {
            return Err(invalid("current mod list reference is invalid"));
        }
        let mut suppression_keys = HashSet::new();
        for suppression in &self.settings.diagnostic_suppressions {
            if !suppression.is_valid() || !suppression_keys.insert(&suppression.key) {
                return Err(invalid("invalid or duplicate diagnostic suppression"));
            }
        }
        let mut tags = HashSet::new();
        for tag in &self.settings.tag_defs {
            if !tags.insert(tag.id) {
                return Err(invalid("duplicate tag ID"));
            }
        }
        if self
            .settings
            .mod_tags
            .iter()
            .any(|binding| binding.tag_ids.iter().any(|id| !tags.contains(id)))
        {
            return Err(invalid("tag binding refers to a missing tag"));
        }
        let mut aliases = HashSet::new();
        for alias in &self.settings.aliases {
            let key = identity_key(&alias.identity);
            if alias.identity.package_id.trim().is_empty() || !aliases.insert(key) {
                return Err(invalid("duplicate or empty alias package ID"));
            }
        }
        let mut bindings = HashSet::new();
        for binding in &self.settings.mod_tags {
            let key = identity_key(&binding.identity);
            if binding.identity.package_id.trim().is_empty() || !bindings.insert(key) {
                return Err(invalid("duplicate or empty tag-binding package ID"));
            }
            let mut references = HashSet::new();
            if binding.tag_ids.iter().any(|id| !references.insert(*id)) {
                return Err(invalid("duplicate tag reference"));
            }
        }
        Ok(())
    }

    pub fn index(&self) -> ModListIndex {
        ModListIndex {
            current_mod_list_id: self.current_mod_list_id,
            mod_lists: self
                .mod_lists
                .iter()
                .map(|list| ModListSummary {
                    id: list.id,
                    name: list.name.clone(),
                })
                .collect(),
        }
    }

    /// # Errors
    /// Returns a source, parsing, validation, or state error if the operation cannot complete.
    pub fn library(&self) -> AppResult<Library> {
        let current_mod_list = self
            .current_mod_list_id
            .and_then(|id| self.mod_lists.iter().find(|list| list.id == id))
            .cloned()
            .ok_or_else(|| AppError::new(AppErrorCode::StateMissing, "no mod list exists"))?;
        Ok(Library {
            settings: self.settings.clone(),
            mod_lists_index: self.index(),
            current_mod_list,
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ConfigDocument {
    schema_version: u32,
    config: AppConfig,
}

pub fn library_path(data_dir: &Path) -> PathBuf { data_dir.join("current/library.json") }

/// # Errors
/// Returns a source, parsing, validation, or state error if the operation cannot complete.
pub fn config_path(legacy_path: &Path) -> AppResult<PathBuf> {
    legacy_path
        .parent()
        .map(|parent| parent.join("current/config.json"))
        .ok_or_else(|| invalid("configuration path has no parent directory"))
}

/// # Errors
/// Returns a source, parsing, validation, or state error if the operation cannot complete.
pub fn load_library(data_dir: &Path) -> AppResult<LibrarySnapshot> {
    let path = library_path(data_dir);
    let snapshot: LibrarySnapshot = read_json(&path)?;
    snapshot.validate()?;
    Ok(snapshot)
}

/// # Errors
/// Returns a source, parsing, validation, or state error if the operation cannot complete.
pub fn save_library(data_dir: &Path, snapshot: &LibrarySnapshot) -> AppResult<()> {
    snapshot.validate()?;
    atomic_json(&library_path(data_dir), snapshot)
}

/// # Errors
/// Returns a source, parsing, validation, or state error if the operation cannot complete.
pub fn create_library(data_dir: &Path, snapshot: &LibrarySnapshot) -> AppResult<LibrarySnapshot> {
    snapshot.validate()?;
    create_json(&library_path(data_dir), snapshot)?;
    load_library(data_dir)
}

/// # Errors
/// Returns a source, parsing, validation, or state error if the operation cannot complete.
pub fn load_config(path: &Path) -> AppResult<AppConfig> {
    let document: ConfigDocument = read_json(path)?;
    if document.schema_version != SCHEMA_VERSION {
        return Err(invalid("unsupported configuration schema version"));
    }
    document.config.validate()?;
    Ok(document.config)
}

/// # Errors
/// Returns a source, parsing, validation, or state error if the operation cannot complete.
pub fn save_config(path: &Path, config: &AppConfig) -> AppResult<()> {
    config.validate()?;
    atomic_json(
        path,
        &ConfigDocument {
            schema_version: SCHEMA_VERSION,
            config: config.clone(),
        },
    )
}

/// # Errors
/// Returns a source, parsing, validation, or state error if the operation cannot complete.
pub fn create_config(path: &Path, config: &AppConfig) -> AppResult<AppConfig> {
    config.validate()?;
    create_json(
        path,
        &ConfigDocument {
            schema_version: SCHEMA_VERSION,
            config: config.clone(),
        },
    )?;
    load_config(path)
}

/// # Errors
/// Returns a source, parsing, validation, or state error if the operation cannot complete.
pub fn read_json<T: serde::de::DeserializeOwned>(path: &Path) -> AppResult<T> {
    let bytes = std::fs::read(path)
        .map_err(|source| AppError::io(AppErrorCode::ConfigReadFailed, path, source))?;
    serde_json::from_slice(&bytes).map_err(|source| {
        AppError::new(AppErrorCode::Json, "document is invalid")
            .with_path(path.to_path_buf())
            .with_source(source)
    })
}

/// # Errors
/// Returns a source, parsing, validation, or state error if the operation cannot complete.
pub fn atomic_json(path: &Path, value: &impl Serialize) -> AppResult<()> {
    let bytes = serde_json::to_vec_pretty(value)?;
    atomic_write(path, &bytes)
}

/// # Errors
/// Returns a source, parsing, validation, or state error if the operation cannot complete.
pub fn atomic_write(path: &Path, bytes: &[u8]) -> AppResult<()> {
    write_document(path, bytes, false)
}

/// # Errors
/// Returns a source, parsing, validation, or state error if the operation cannot complete.
pub fn create_json(path: &Path, value: &impl Serialize) -> AppResult<()> {
    write_document(path, &serde_json::to_vec_pretty(value)?, true)
}

fn write_document(path: &Path, bytes: &[u8], create_only: bool) -> AppResult<()> {
    let parent = path
        .parent()
        .ok_or_else(|| invalid("output path has no parent directory"))?;
    std::fs::create_dir_all(parent)
        .map_err(|source| AppError::io(AppErrorCode::ConfigWriteFailed, parent, source))?;
    let mut temporary = tempfile::NamedTempFile::new_in(parent)
        .map_err(|source| AppError::io(AppErrorCode::ConfigWriteFailed, parent, source))?;
    temporary
        .write_all(bytes)
        .and_then(|()| temporary.as_file().sync_all())
        .map_err(|source| AppError::io(AppErrorCode::ConfigWriteFailed, path, source))?;
    if create_only {
        match temporary.persist_noclobber(path) {
            Ok(_) => {},
            Err(error) if error.error.kind() == std::io::ErrorKind::AlreadyExists => {},
            Err(error) => {
                return Err(AppError::io(
                    AppErrorCode::ConfigWriteFailed,
                    path,
                    error.error,
                ));
            },
        }
    } else {
        temporary
            .persist(path)
            .map_err(|error| AppError::io(AppErrorCode::ConfigWriteFailed, path, error.error))?;
    }
    Ok(())
}

pub(crate) fn invalid(message: impl Into<String>) -> AppError {
    AppError::new(AppErrorCode::RecoveryRequired, message)
}
