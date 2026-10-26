use std::{
    collections::HashMap,
    path::{Path, PathBuf},
};

use serde::Deserialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AcfError {
    #[error("failed to parse ACF/VDF: {0}")]
    Parse(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkshopUpdateEntry {
    pub published_file_id: String,
    pub time_updated: u64,
    pub time_touched: u64,
    pub has_manifest: bool,
}

#[derive(Deserialize)]
struct AppWorkshopAcf {
    #[serde(rename = "WorkshopItemsInstalled", default)]
    items_installed: HashMap<String, WorkshopItemInstalledRaw>,
    #[serde(rename = "WorkshopItemDetails", default)]
    item_details: HashMap<String, WorkshopItemDetailsRaw>,
}

#[derive(Deserialize, Default)]
struct WorkshopItemInstalledRaw {
    #[serde(rename = "timeupdated", default)]
    time_updated: Option<String>,
    #[serde(default)]
    manifest: Option<String>,
}

#[derive(Deserialize, Default)]
struct WorkshopItemDetailsRaw {
    #[serde(rename = "timeupdated", default)]
    time_updated: Option<String>,
    #[serde(rename = "timetouched", default)]
    time_touched: Option<String>,
}

fn parse_u64(s: Option<&str>) -> u64 { s.and_then(|v| v.parse::<u64>().ok()).unwrap_or(0) }

/// Parses the installed and known Workshop items from a Steam ACF document.
///
/// # Errors
///
/// Returns [`AcfError::Parse`] when the document is not valid ACF/VDF data.
pub fn parse_appworkshop_acf(content: &str) -> Result<Vec<WorkshopUpdateEntry>, AcfError> {
    let acf: AppWorkshopAcf =
        keyvalues_serde::from_str(content).map_err(|e| AcfError::Parse(e.to_string()))?;

    let mut entries: Vec<WorkshopUpdateEntry> = acf
        .items_installed
        .iter()
        .map(|(pfid, installed)| {
            let details = acf.item_details.get(pfid);
            let time_updated = if installed.time_updated.is_some() {
                parse_u64(installed.time_updated.as_deref())
            } else {
                parse_u64(details.and_then(|d| d.time_updated.as_deref()))
            };
            let time_touched = details.map_or(0, |d| parse_u64(d.time_touched.as_deref()));

            WorkshopUpdateEntry {
                published_file_id: pfid.clone(),
                time_updated,
                time_touched,
                has_manifest: installed.manifest.is_some(),
            }
        })
        .collect();

    for (pfid, details) in &acf.item_details {
        if !acf.items_installed.contains_key(pfid) {
            entries.push(WorkshopUpdateEntry {
                published_file_id: pfid.clone(),
                time_updated: parse_u64(details.time_updated.as_deref()),
                time_touched: parse_u64(details.time_touched.as_deref()),
                has_manifest: false,
            });
        }
    }

    entries.sort_by_key(|b| std::cmp::Reverse(b.time_updated));

    Ok(entries)
}

pub fn appworkshop_acf_path(library_path: &Path) -> PathBuf {
    library_path
        .join("steamapps")
        .join("workshop")
        .join("appworkshop_294100.acf")
}

#[cfg(test)]
mod tests;
