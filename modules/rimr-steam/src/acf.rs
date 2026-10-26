use serde::Deserialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
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

fn parse_u64(s: &Option<String>) -> u64 {
    s.as_deref()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(0)
}

pub fn parse_appworkshop_acf(content: &str) -> Result<Vec<WorkshopUpdateEntry>, AcfError> {
    let acf: AppWorkshopAcf =
        keyvalues_serde::from_str(content).map_err(|e| AcfError::Parse(e.to_string()))?;

    let mut entries: Vec<WorkshopUpdateEntry> = acf
        .items_installed
        .iter()
        .map(|(pfid, installed)| {
            let details = acf.item_details.get(pfid);
            let time_updated = if installed.time_updated.is_some() {
                parse_u64(&installed.time_updated)
            } else {
                details
                    .and_then(|d| d.time_updated.clone())
                    .as_ref()
                    .map(|s| s.parse::<u64>().unwrap_or(0))
                    .unwrap_or(0)
            };
            let time_touched = details.map(|d| parse_u64(&d.time_touched)).unwrap_or(0);

            WorkshopUpdateEntry {
                published_file_id: pfid.clone(),
                time_updated,
                time_touched,
                has_manifest: installed.manifest.is_some(),
            }
        })
        .collect();

    let installed_ids: std::collections::HashSet<&String> = acf.items_installed.keys().collect();
    for (pfid, details) in &acf.item_details {
        if !installed_ids.contains(pfid) {
            entries.push(WorkshopUpdateEntry {
                published_file_id: pfid.clone(),
                time_updated: parse_u64(&details.time_updated),
                time_touched: parse_u64(&details.time_touched),
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
mod tests {
    use super::*;

    const SAMPLE_ACF: &str = r#""AppWorkshop"
{
    "appid"     "294100"
    "WorkshopItemsInstalled"
    {
        "2009463077"
        {
            "timeupdated"   "1700000000"
            "manifest"      "1234567890123456789"
        }
        "837975145"
        {
            "timeupdated"   "1699000000"
        }
    }
    "WorkshopItemDetails"
    {
        "2009463077"
        {
            "timeupdated"   "1700000000"
            "timetouched"   "1700100000"
        }
        "837975145"
        {
            "timeupdated"   "1699000000"
            "timetouched"   "1699100000"
        }
        "999999999"
        {
            "timeupdated"   "1680000000"
            "timetouched"   "1680100000"
        }
    }
}"#;

    #[test]
    fn parses_installed_items_with_timestamps() {
        let entries = parse_appworkshop_acf(SAMPLE_ACF).expect("parse should succeed");
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].published_file_id, "2009463077");
        assert_eq!(entries[0].time_updated, 1700000000);
        assert_eq!(entries[0].time_touched, 1700100000);
        assert!(entries[0].has_manifest);

        assert_eq!(entries[1].published_file_id, "837975145");
        assert_eq!(entries[1].time_updated, 1699000000);
        assert_eq!(entries[1].time_touched, 1699100000);
        assert!(!entries[1].has_manifest);

        assert_eq!(entries[2].published_file_id, "999999999");
        assert_eq!(entries[2].time_updated, 1680000000);
        assert_eq!(entries[2].time_touched, 1680100000);
        assert!(!entries[2].has_manifest);
    }

    #[test]
    fn handles_empty_acf() {
        let empty = r#""AppWorkshop"
{
    "appid"     "294100"
}"#;
        let entries = parse_appworkshop_acf(empty).expect("parse should succeed");
        assert!(entries.is_empty());
    }

    #[test]
    fn computes_acf_path_for_library() {
        let path = appworkshop_acf_path(Path::new("D:/SteamLibrary"));
        assert_eq!(
            path,
            PathBuf::from("D:/SteamLibrary/steamapps/workshop/appworkshop_294100.acf")
        );
    }

    #[test]
    fn handles_missing_timeupdated() {
        let acf = r#""AppWorkshop"
{
    "WorkshopItemsInstalled"
    {
        "123"
        {
            "manifest"      "111"
        }
    }
    "WorkshopItemDetails"
    {
        "123"
        {
            "timetouched"   "999"
        }
    }
}"#;
        let entries = parse_appworkshop_acf(acf).expect("parse should succeed");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].time_updated, 0);
        assert_eq!(entries[0].time_touched, 999);
        assert!(entries[0].has_manifest);
    }
}
