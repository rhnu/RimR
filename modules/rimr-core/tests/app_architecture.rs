use async_trait::async_trait;
use rimr_core::{
    ActiveModList, AppClock, Clock, CoreError, GameVersion, ModFeatures, ModList, ModSource,
    ModSourceEntry, ModSourceKey, PackageId, RimrFileKind, RimrFileParseError, RimrFileSerializer,
    SourceError, SourceFile, SourceKind, WorkspaceSession,
};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[derive(Default)]
struct MemorySource {
    entries: Vec<ModSourceEntry>,
    about_xmls: HashMap<ModSourceKey, Vec<u8>>,
    mods_config: Mutex<Option<Vec<u8>>>,
}

#[async_trait]
impl ModSource for MemorySource {
    async fn discover_mods(&self) -> Result<Vec<ModSourceEntry>, SourceError> {
        Ok(self.entries.clone())
    }

    async fn read_about_xml(&self, key: &ModSourceKey) -> Result<Option<SourceFile>, SourceError> {
        Ok(self.about_xmls.get(key).cloned().map(|bytes| {
            SourceFile::new(
                Some(key.clone()),
                format!("{}/About/About.xml", key.as_str()),
                bytes,
            )
        }))
    }

    async fn read_mods_config(&self) -> Result<Option<SourceFile>, SourceError> {
        Ok(self
            .mods_config
            .lock()
            .unwrap()
            .clone()
            .map(|bytes| SourceFile::new(None, "ModsConfig.xml", bytes)))
    }

    async fn write_mods_config(&self, bytes: Vec<u8>) -> Result<(), SourceError> {
        *self.mods_config.lock().unwrap() = Some(bytes);
        Ok(())
    }

    async fn read_mod_features(&self, _key: &ModSourceKey) -> Result<ModFeatures, SourceError> {
        Ok(ModFeatures::default())
    }
}

struct FixedClock;

impl Clock for FixedClock {
    fn now_rfc3339(&self) -> String {
        "2026-06-20T00:00:00Z".to_string()
    }
}

fn source() -> MemorySource {
    let key = ModSourceKey::new("local");
    MemorySource {
        entries: vec![ModSourceEntry {
            key: key.clone(),
            kind: SourceKind::Local,
            display_name_hint: Some(Arc::from("local")),
        }],
        about_xmls: HashMap::from([(
            key,
            br#"<ModMetaData>
  <packageId>local.mod</packageId>
  <name>Local Mod</name>
</ModMetaData>"#
                .to_vec(),
        )]),
        mods_config: Mutex::new(Some(
            br#"<?xml version="1.0" encoding="utf-8"?>
<ModsConfigData>
  <version>1.5.4104 rev435</version>
  <activeMods>
    <li>local.mod</li>
  </activeMods>
  <knownExpansions>
    <li>ludeon.rimworld.royalty</li>
  </knownExpansions>
</ModsConfigData>"#
                .to_vec(),
        )),
    }
}

#[tokio::test]
async fn app_use_cases_update_core_owned_session() {
    let source = source();
    let mut session = WorkspaceSession::default();

    let scan = session
        .scan_mods(
            &source,
            &rimr_core::ScanOpts {
                compile: rimr_core::CompileOpts {
                    game_version: GameVersion::parse("1.5"),
                    prefer_versioned: true,
                },
                concurrency: 1,
            },
        )
        .await
        .unwrap();
    assert_eq!(scan.catalog.len(), 1);
    assert!(session.catalog().is_some());
    assert!(session.source_metadata("local").is_some());

    let loaded = session.load_game_config(&source).await.unwrap();
    assert_eq!(loaded.active_mods, vec!["local.mod"]);
    assert!(session.active_mods().is_some());
    assert!(session.mods_config().is_some());

    let validation = session
        .validate_active_order(vec!["local.mod".to_string()])
        .unwrap();
    assert!(validation.report.is_clean());
}

#[tokio::test]
async fn write_game_config_preserves_game_version_and_known_expansions() {
    let source = source();
    let mut session = WorkspaceSession::default();
    session.load_game_config(&source).await.unwrap();

    let written = session
        .write_game_config(&source, vec!["local.mod".to_string()])
        .await
        .unwrap();

    assert_eq!(written.config.version.as_ref(), "1.5.4104 rev435");
    assert_eq!(
        written.config.known_expansions,
        vec![PackageId::new("ludeon.rimworld.royalty")]
    );
    let bytes = source.mods_config.lock().unwrap().clone().unwrap();
    let text = String::from_utf8(bytes).unwrap();
    assert!(text.contains("<version>1.5.4104 rev435</version>"));
    assert!(text.contains("<li>ludeon.rimworld.royalty</li>"));
}

#[test]
fn rimr_file_serializer_writes_v2_and_rejects_old_versions() {
    let clock = FixedClock;
    let serializer = RimrFileSerializer::new(&clock);
    let list = ActiveModList::from_slice(&[PackageId::new("local.mod")]);
    let config = rimr_core::ModsConfig {
        version: Arc::from("1.5.4104 rev435"),
        active_mods: vec![PackageId::new("local.mod")],
        known_expansions: vec![PackageId::new("ludeon.rimworld.royalty")],
    };

    let exported = serializer
        .export_game_config_backup(&list, &config, Some("note".to_string()))
        .unwrap();
    assert_eq!(exported.file.kind, RimrFileKind::GameConfigBackup);
    assert_eq!(exported.file.format_version, 2);
    assert_eq!(exported.file.backup_at, "2026-06-20T00:00:00Z");

    let old = br#"{
        "kind": "gameConfigBackup",
        "formatVersion": 1,
        "backupAt": "2026-06-20T00:00:00Z",
        "gameVersion": "1.5",
        "activeMods": [],
        "knownExpansions": []
    }"#;
    let error = serializer.import_game_config_backup(old).unwrap_err();
    assert!(matches!(
        error,
        CoreError::RimrFile(RimrFileParseError::UnsupportedFormatVersion { found: 1, .. })
    ));
}

#[test]
fn mod_list_file_uses_mod_list_language() {
    let serializer = RimrFileSerializer::new(&AppClock);
    let file = serializer
        .export_mod_list(
            &ModList {
                format_version: 2,
                id: "default".to_string(),
                name: "Default".to_string(),
                note: None,
                entries: Vec::new(),
                active_mods: vec!["local.mod".to_string()],
            },
            Some("1.5".to_string()),
        )
        .unwrap();

    assert_eq!(file.file.format_version, 2);
    assert_eq!(file.file.mod_list.id, "default");
    assert!(file.json.contains("\"modList\""));
    assert!(!file.json.contains("profile"));
}
