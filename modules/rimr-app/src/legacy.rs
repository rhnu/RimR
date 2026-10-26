//! Read-only decoders for historical data. No writer belongs in this module.

use std::{collections::HashMap, path::Path};

use rimr_core::{EntryId, LibrarySettings, ModList, ModListId, TagId};
use serde::Deserialize;
use serde_json::{Value, json};

use crate::{
    app_config::{AppConfig, PathsConfig, UiConfig},
    current::{LibrarySnapshot, invalid, read_json},
    error::AppResult,
};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LegacyConfig {
    #[serde(alias = "format_version")]
    format_version: u32,
    #[serde(default)]
    paths: Value,
    #[serde(default)]
    ui: UiConfig,
}

/// # Errors
/// Returns a source, parsing, validation, or state error if the operation cannot complete.
pub fn config(path: &Path) -> AppResult<(AppConfig, UiConfig)> { decode_config(&read_json(path)?) }

fn decode_config(value: &Value) -> AppResult<(AppConfig, UiConfig)> {
    let document: LegacyConfig = serde_json::from_value(value.clone())?;
    if !(1..=4).contains(&document.format_version) {
        return Err(invalid("unsupported legacy configuration version"));
    }
    let mut paths = if document.paths.is_null() && document.format_version < 4 {
        let mut paths = serde_json::Map::new();
        for key in [
            "gameDir",
            "gameDataDir",
            "configDir",
            "localModsDir",
            "workshopModsDir",
            "rimrDataDir",
        ] {
            if let Some(path) = value.get(key) {
                paths.insert(key.to_string(), path.clone());
            }
        }
        Value::Object(paths)
    } else {
        document.paths
    };
    if document.format_version < 4 {
        let old = paths
            .get("configDir")
            .and_then(Value::as_str)
            .and_then(|path| Path::new(path).parent())
            .map(|path| path.to_string_lossy().into_owned());
        if paths.get("gameDataDir").is_none()
            && let Some(old) = old
        {
            paths["gameDataDir"] = json!(old);
        }
    }
    if let Some(paths) = paths.as_object_mut() {
        paths.remove("configDir");
    }
    let paths = if paths.is_null() {
        PathsConfig::default()
    } else {
        serde_json::from_value(paths)?
    };
    Ok((AppConfig { paths }, document.ui))
}

fn check_version(value: &Value) -> AppResult<()> {
    match value
        .get("formatVersion")
        .or_else(|| value.get("format_version"))
        .and_then(Value::as_u64)
    {
        Some(1 | 2) => Ok(()),
        _ => Err(invalid("unsupported legacy library or portable version")),
    }
}

/// # Errors
/// Returns a source, parsing, validation, or state error if the operation cannot complete.
pub fn mod_list(mut value: Value) -> AppResult<ModList> {
    check_version(&value)?;
    let object = value
        .as_object_mut()
        .ok_or_else(|| invalid("legacy mod list must be an object"))?;
    object.remove("formatVersion");
    object.remove("format_version");
    object.insert("revision".into(), json!(0));
    object.insert("id".into(), json!(ModListId::new()));
    if !object.contains_key("entries") {
        let active = object
            .get("activeMods")
            .or_else(|| object.get("active_mods"))
            .and_then(Value::as_array)
            .ok_or_else(|| invalid("legacy mod list has neither entries nor activeMods"))?;
        let entries = active.iter().map(|id| {
            let id = id.as_str().ok_or_else(|| invalid("legacy package ID is not a string"))?;
            Ok(json!({"kind":"mod","id":EntryId::new(),"active":true,"identity":{"packageId":id}}))
        }).collect::<AppResult<Vec<_>>>()?;
        object.insert("entries".into(), json!(entries));
    }
    object.remove("activeMods");
    object.remove("active_mods");
    let entries = object
        .get_mut("entries")
        .and_then(Value::as_array_mut)
        .ok_or_else(|| invalid("legacy entries must be an array"))?;
    for entry in entries {
        let entry = entry
            .as_object_mut()
            .ok_or_else(|| invalid("legacy entry must be an object"))?;
        entry.insert("id".into(), json!(EntryId::new()));
        if entry.get("kind").and_then(Value::as_str) == Some("group") {
            let children = entry
                .get_mut("entries")
                .and_then(Value::as_array_mut)
                .ok_or_else(|| invalid("legacy group children must be an array"))?;
            for child in children {
                child
                    .as_object_mut()
                    .ok_or_else(|| invalid("legacy group child must be an object"))?
                    .insert("id".into(), json!(EntryId::new()));
            }
        }
    }
    serde_json::from_value(value).map_err(Into::into)
}

/// # Errors
/// Returns a source, parsing, validation, or state error if the operation cannot complete.
pub fn settings(mut value: Value) -> AppResult<LibrarySettings> {
    check_version(&value)?;
    let object = value
        .as_object_mut()
        .ok_or_else(|| invalid("legacy settings must be an object"))?;
    object.remove("formatVersion");
    object.remove("format_version");
    object.insert("revision".into(), json!(0));
    object.entry("aliases").or_insert(json!([]));
    let mut tags = HashMap::new();
    if let Some(defs) = object.get_mut("tagDefs") {
        for tag in defs
            .as_array_mut()
            .ok_or_else(|| invalid("legacy tagDefs must be an array"))?
        {
            let old_id = tag
                .get("id")
                .and_then(Value::as_str)
                .ok_or_else(|| invalid("legacy tag has no ID"))?
                .to_string();
            let id = TagId::new();
            if tags.insert(old_id, id).is_some() {
                return Err(invalid("duplicate legacy tag ID"));
            }
            tag["id"] = json!(id);
        }
    }
    if let Some(bindings) = object.get_mut("modTags") {
        for binding in bindings
            .as_array_mut()
            .ok_or_else(|| invalid("legacy modTags must be an array"))?
        {
            let refs = binding
                .get_mut("tagIds")
                .and_then(Value::as_array_mut)
                .ok_or_else(|| invalid("legacy tagIds must be an array"))?;
            for id in refs {
                let old = id
                    .as_str()
                    .ok_or_else(|| invalid("legacy tag reference is not a string"))?;
                *id = json!(
                    tags.get(old)
                        .ok_or_else(|| invalid("legacy tag reference is missing"))?
                );
            }
        }
    }
    serde_json::from_value(value).map_err(Into::into)
}

/// # Errors
/// Returns a source, parsing, validation, or state error if the operation cannot complete.
pub fn library(data_dir: &Path) -> AppResult<LibrarySnapshot> {
    let mut snapshot = LibrarySnapshot::default();
    let settings_path = data_dir.join("settings.json");
    if settings_path.try_exists().map_err(|source| {
        crate::error::AppError::io(
            crate::error::AppErrorCode::ConfigReadFailed,
            &settings_path,
            source,
        )
    })? {
        snapshot.settings = settings(read_json(&settings_path)?)?;
    }
    let lists_dir = data_dir.join("mod-lists");
    if !lists_dir.try_exists().map_err(|source| {
        crate::error::AppError::io(
            crate::error::AppErrorCode::ConfigReadFailed,
            &lists_dir,
            source,
        )
    })? {
        return Ok(snapshot);
    }
    let index_path = lists_dir.join("index.json");
    let index: Option<Value> = if index_path.try_exists().map_err(|source| {
        crate::error::AppError::io(
            crate::error::AppErrorCode::ConfigReadFailed,
            &index_path,
            source,
        )
    })? {
        let value = read_json(&index_path)?;
        check_version(&value)?;
        Some(value)
    } else {
        None
    };
    let mut paths = std::fs::read_dir(&lists_dir)
        .map_err(|source| {
            crate::error::AppError::io(
                crate::error::AppErrorCode::ConfigReadFailed,
                &lists_dir,
                source,
            )
        })?
        .map(|entry| entry.map(|entry| entry.path()))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|source| {
            crate::error::AppError::io(
                crate::error::AppErrorCode::ConfigReadFailed,
                &lists_dir,
                source,
            )
        })?;
    paths.sort();
    let mut ids = HashMap::new();
    for path in paths {
        if path == index_path || path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        let value: Value = read_json(&path)?;
        let old = value
            .get("id")
            .and_then(Value::as_str)
            .ok_or_else(|| invalid("legacy list has no ID"))?
            .to_string();
        let list = mod_list(value)?;
        if ids.insert(old, list.id).is_some() {
            return Err(invalid("duplicate legacy mod list ID"));
        }
        snapshot.mod_lists.push(list);
    }
    if let Some(index) = &index {
        apply_index(&mut snapshot, index, &ids)?;
    }
    if snapshot.current_mod_list_id.is_none() {
        snapshot.current_mod_list_id = snapshot.mod_lists.first().map(|list| list.id);
    }
    snapshot.validate()?;
    Ok(snapshot)
}

fn apply_index(
    snapshot: &mut LibrarySnapshot,
    index: &Value,
    ids: &HashMap<String, ModListId>,
) -> AppResult<()> {
    let summaries = index
        .get("modLists")
        .and_then(Value::as_array)
        .ok_or_else(|| invalid("legacy index has no lists"))?;
    let mut positions = HashMap::new();
    for (position, summary) in summaries.iter().enumerate() {
        let old = summary
            .get("id")
            .and_then(Value::as_str)
            .ok_or_else(|| invalid("legacy list summary has no ID"))?;
        if let Some(id) = ids.get(old)
            && positions.insert(*id, position).is_some()
        {
            return Err(invalid("duplicate legacy list summary"));
        }
        if !ids.contains_key(old) {
            return Err(invalid("legacy index references a missing mod list"));
        }
    }
    snapshot
        .mod_lists
        .sort_by_key(|list| positions.get(&list.id).copied().unwrap_or(usize::MAX));
    if let Some(old) = index.get("currentModListId").and_then(Value::as_str) {
        snapshot.current_mod_list_id = Some(
            *ids.get(old)
                .ok_or_else(|| invalid("legacy current list is missing"))?,
        );
    }
    Ok(())
}

/// # Errors
/// Returns a source, parsing, validation, or state error if the operation cannot complete.
pub fn portable_mod_list(value: &Value) -> AppResult<ModList> {
    check_version(value)?;
    let mut list = value
        .get("modList")
        .cloned()
        .ok_or_else(|| invalid("portable file has no modList"))?;
    if list.get("formatVersion").is_none() {
        list["formatVersion"] = json!(2);
    }
    mod_list(list)
}

/// # Errors
/// Returns a source, parsing, validation, or state error if the operation cannot complete.
pub fn portable_settings(value: &Value) -> AppResult<LibrarySettings> {
    check_version(value)?;
    let mut imported = value
        .get("settings")
        .cloned()
        .ok_or_else(|| invalid("portable file has no settings"))?;
    if imported.get("formatVersion").is_none() {
        imported["formatVersion"] = json!(2);
    }
    settings(imported)
}

#[cfg(test)]
mod tests;
