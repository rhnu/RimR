//! Backup export use case.
//!
//! Combines [`crate::formats::portable::build_backup`] and
//! [`crate::formats::portable::serialize_backup`] into a single call that
//! produces both the structured [`BackupFile`] and the serialized JSON string.

use crate::domain::ActiveModList;
use crate::error::CoreError;
use crate::formats::{BackupFile, BackupMeta, ModsConfig, build_backup, serialize_backup};

/// Result of exporting a backup.
#[derive(Debug, Clone)]
pub struct ExportBackupResult {
    /// The structured backup file.
    pub file: BackupFile,
    /// Pretty-printed `.rimr.json` content.
    pub json: String,
}

/// Exports the current active list and config as a `.rimr.json` backup.
///
/// `config.version` becomes the `game_version` snapshot;
/// `config.known_expansions` becomes the `known_expansions` list. The
/// `rimr_meta` note/tags/groups are carried through from `meta`.
pub fn export_backup(
    list: &ActiveModList,
    config: &ModsConfig,
    meta: BackupMeta,
) -> Result<ExportBackupResult, CoreError> {
    tracing::info!(active_mods = list.len(), "exporting game config backup");
    let file = build_backup(list, &config.version, &config.known_expansions, meta);
    let json = serialize_backup(&file)?;
    tracing::info!("game config backup serialized");
    Ok(ExportBackupResult { file, json })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::PackageId;
    use crate::formats::{BackupMeta, ModsConfig};
    use std::sync::Arc;

    fn ids(raw: &[&str]) -> Vec<PackageId> {
        raw.iter().copied().map(PackageId::new).collect()
    }

    fn sample_config() -> ModsConfig {
        ModsConfig {
            version: Arc::from("1.5.4104 rev435"),
            active_mods: ids(&["a", "b"]),
            known_expansions: ids(&["ludeon.rimworld.royalty"]),
        }
    }

    /// Basic export produces a file and JSON with the expected content.
    #[test]
    fn basic_export() {
        let list = ActiveModList::from_slice(&ids(&["a", "b"]));
        let config = sample_config();
        let meta = BackupMeta {
            note: Some("test".to_string()),
            tags: Vec::new(),
            groups: Vec::new(),
        };
        let result = export_backup(&list, &config, meta).expect("export should succeed");
        assert_eq!(result.file.active_mods, vec!["a", "b"]);
        assert_eq!(result.file.game_version, "1.5.4104 rev435");
        assert_eq!(
            result.file.known_expansions,
            vec!["ludeon.rimworld.royalty"]
        );
        assert_eq!(result.file.rimr_meta.note.as_deref(), Some("test"));
        assert!(!result.json.is_empty());
    }

    /// The serialized JSON contains all top-level fields.
    #[test]
    fn json_contains_all_fields() {
        let list = ActiveModList::from_slice(&ids(&["a", "b"]));
        let config = sample_config();
        let result =
            export_backup(&list, &config, BackupMeta::default()).expect("export should succeed");
        assert!(result.json.contains("format_version"));
        assert!(result.json.contains("backup_at"));
        assert!(result.json.contains("game_version"));
        assert!(result.json.contains("active_mods"));
        assert!(result.json.contains("known_expansions"));
        assert!(result.json.contains("rimr_meta"));
    }

    /// The note is preserved in the JSON output.
    #[test]
    fn note_preserved_in_json() {
        let list = ActiveModList::from_slice(&ids(&["a"]));
        let config = sample_config();
        let meta = BackupMeta {
            note: Some("my note".to_string()),
            tags: Vec::new(),
            groups: Vec::new(),
        };
        let result = export_backup(&list, &config, meta).expect("export should succeed");
        assert!(result.json.contains("my note"));
    }

    /// The game version snapshot comes from the config.
    #[test]
    fn game_version_from_config() {
        let list = ActiveModList::from_slice(&ids(&["a"]));
        let config = ModsConfig {
            version: Arc::from("1.6.0 rev999"),
            active_mods: Vec::new(),
            known_expansions: Vec::new(),
        };
        let result =
            export_backup(&list, &config, BackupMeta::default()).expect("export should succeed");
        assert_eq!(result.file.game_version, "1.6.0 rev999");
    }

    /// Order is preserved in the exported active mods.
    #[test]
    fn order_preserved() {
        let list = ActiveModList::from_slice(&ids(&["c", "a", "b"]));
        let config = sample_config();
        let result =
            export_backup(&list, &config, BackupMeta::default()).expect("export should succeed");
        assert_eq!(result.file.active_mods, vec!["c", "a", "b"]);
    }
}
