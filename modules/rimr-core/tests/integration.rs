//! End-to-end integration tests for rimr-core use cases.

use async_trait::async_trait;
use rimr_core::{
    ActiveModList, BackupMeta, CompileOpts, DiagnosticCode, GameVersion, ModFeatures, ModSource,
    ModSourceEntry, ModSourceKey, PackageId, ScanOpts, Severity, SourceError, SourceFile,
    SourceKind, ValidateOpts, build_mods_config_bytes, export_backup, import_backup,
    load_active_list, parse_mods_config, scan_mod_metadata, validate_order,
};
use std::collections::HashMap;
use std::sync::Arc;

// --- In-memory ModSource for integration tests ---

struct IntegrationModSource {
    entries: Vec<ModSourceEntry>,
    about_xmls: HashMap<ModSourceKey, Vec<u8>>,
    mods_config: Option<Vec<u8>>,
}

impl IntegrationModSource {
    fn builder() -> IntegrationModSourceBuilder {
        IntegrationModSourceBuilder::default()
    }
}

#[async_trait]
impl ModSource for IntegrationModSource {
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
            .clone()
            .map(|bytes| SourceFile::new(None, "ModsConfig.xml", bytes)))
    }
    async fn write_mods_config(&self, _bytes: Vec<u8>) -> Result<(), SourceError> {
        Ok(())
    }
    async fn read_mod_features(&self, _key: &ModSourceKey) -> Result<ModFeatures, SourceError> {
        Ok(ModFeatures::default())
    }
}

#[derive(Default)]
struct IntegrationModSourceBuilder {
    entries: Vec<ModSourceEntry>,
    about_xmls: HashMap<ModSourceKey, Vec<u8>>,
    mods_config: Option<Vec<u8>>,
}

impl IntegrationModSourceBuilder {
    fn mod_entry(mut self, key: &str, kind: SourceKind, about_xml: &str) -> Self {
        let k = ModSourceKey::new(key);
        self.entries.push(ModSourceEntry {
            key: k.clone(),
            kind,
            display_name_hint: Some(Arc::from(k.as_str())),
        });
        self.about_xmls.insert(k, about_xml.as_bytes().to_vec());
        self
    }
    fn mods_config(mut self, xml: &str) -> Self {
        self.mods_config = Some(xml.as_bytes().to_vec());
        self
    }
    fn build(self) -> IntegrationModSource {
        IntegrationModSource {
            entries: self.entries,
            about_xmls: self.about_xmls,
            mods_config: self.mods_config,
        }
    }
}

// --- Test data ---

const CORE_ABOUT: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<ModMetaData>
  <packageId>Ludeon.RimWorld</packageId>
  <author>Ludeon Studios</author>
  <forceLoadBefore>
    <li>Ludeon.RimWorld.Ideology</li>
    <li>Ludeon.RimWorld.Royalty</li>
  </forceLoadBefore>
</ModMetaData>"#;

const HARMONY_ABOUT: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<ModMetaData>
  <name>Harmony</name>
  <packageId>brrainz.harmony</packageId>
  <author>Andreas Pardeike</author>
  <supportedVersions><li>1.5</li></supportedVersions>
  <description>Harmony for RimWorld</description>
</ModMetaData>"#;

const FISHERY_ABOUT: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<ModMetaData>
  <name>Fishery</name>
  <packageId>bs.fishery</packageId>
  <supportedVersions><li>1.4</li><li>1.5</li></supportedVersions>
  <author>bradson</author>
  <loadBefore><li>Ludeon.RimWorld</li></loadBefore>
  <loadAfter><li>brrainz.harmony</li></loadAfter>
  <modDependencies>
    <li>
      <packageId>brrainz.harmony</packageId>
      <displayName>Harmony</displayName>
    </li>
  </modDependencies>
  <description>Fishery library</description>
</ModMetaData>"#;

const VALID_MODS_CONFIG: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<ModsConfigData>
  <version>1.5.4104 rev435</version>
  <activeMods>
    <li>brrainz.harmony</li>
    <li>bs.fishery</li>
    <li>ludeon.rimworld</li>
  </activeMods>
  <knownExpansions>
    <li>ludeon.rimworld.royalty</li>
    <li>ludeon.rimworld.ideology</li>
  </knownExpansions>
</ModsConfigData>"#;

// --- Integration tests ---

#[tokio::test]
async fn full_workflow_scan_load_validate_save_export_import() {
    let source = IntegrationModSource::builder()
        .mod_entry("core", SourceKind::Expansion, CORE_ABOUT)
        .mod_entry("harmony", SourceKind::Local, HARMONY_ABOUT)
        .mod_entry("fishery", SourceKind::Local, FISHERY_ABOUT)
        .mods_config(VALID_MODS_CONFIG)
        .build();

    // 1. Scan
    let scan_opts = ScanOpts {
        compile: CompileOpts {
            game_version: GameVersion::parse("1.5"),
            prefer_versioned: true,
        },
        concurrency: 8,
    };
    let scan_report = scan_mod_metadata(&source, &scan_opts).await.unwrap();
    assert!(scan_report.diagnostics.is_empty());
    assert_eq!(scan_report.catalog.len(), 3);
    assert!(
        scan_report
            .catalog
            .contains(&PackageId::new("ludeon.rimworld"))
    );
    assert!(
        scan_report
            .catalog
            .contains(&PackageId::new("brrainz.harmony"))
    );
    assert!(scan_report.catalog.contains(&PackageId::new("bs.fishery")));

    // 2. Load active list
    let load_result = load_active_list(&source, Some(&scan_report.catalog))
        .await
        .unwrap();
    assert_eq!(load_result.list.len(), 3);
    assert_eq!(load_result.config.version.as_ref(), "1.5.4104 rev435");
    assert!(load_result.missing.is_empty());

    // 3. Validate order (harmony -> fishery -> core is valid)
    let validate_result = validate_order(
        &scan_report.catalog,
        &load_result.list,
        &ValidateOpts::default(),
    );
    assert!(
        validate_result.report.is_clean(),
        "Expected clean report, got: {:?}",
        validate_result.report.all().collect::<Vec<_>>()
    );

    // 4. Save (build bytes)
    let bytes = build_mods_config_bytes(&load_result.list, &load_result.config).unwrap();
    let xml = std::str::from_utf8(&bytes).unwrap();
    assert!(xml.contains("ludeon.rimworld"));
    assert!(xml.contains("brrainz.harmony"));
    assert!(xml.contains("bs.fishery"));
    assert!(xml.contains("1.5.4104 rev435"));

    // 5. Export backup
    let backup_result = export_backup(
        &load_result.list,
        &load_result.config,
        BackupMeta {
            note: Some("Integration test backup".to_string()),
            ..Default::default()
        },
    )
    .unwrap();
    assert_eq!(backup_result.file.format_version, 1);
    assert!(backup_result.json.contains("Integration test backup"));
    assert!(backup_result.json.contains("1.5.4104 rev435"));

    // 6. Import backup (round-trip)
    let imported = import_backup(backup_result.json.as_bytes()).unwrap();
    assert_eq!(imported.format_version, 1);
    assert_eq!(imported.game_version, "1.5.4104 rev435");
    assert_eq!(
        imported.active_mods,
        vec!["brrainz.harmony", "bs.fishery", "ludeon.rimworld"]
    );
    assert_eq!(
        imported.rimr_meta.note.as_deref(),
        Some("Integration test backup")
    );
}

#[tokio::test]
async fn workflow_with_order_violation() {
    let source = IntegrationModSource::builder()
        .mod_entry("harmony", SourceKind::Local, HARMONY_ABOUT)
        .mod_entry("fishery", SourceKind::Local, FISHERY_ABOUT)
        .build();

    let scan_report = scan_mod_metadata(&source, &ScanOpts::default())
        .await
        .unwrap();
    assert_eq!(scan_report.catalog.len(), 2);

    // Fishery loads after Harmony. Put fishery first -> violation.
    let mut bad_order = ActiveModList::empty();
    bad_order.append(PackageId::new("bs.fishery"));
    bad_order.append(PackageId::new("brrainz.harmony"));

    let result = validate_order(&scan_report.catalog, &bad_order, &ValidateOpts::default());
    assert!(!result.report.is_clean());
    assert!(
        result
            .report
            .warnings
            .iter()
            .any(|d| d.severity == Severity::Warning)
    );
}

#[tokio::test]
async fn workflow_with_missing_dependency() {
    // Fishery depends on Harmony, but Harmony is not installed.
    let source = IntegrationModSource::builder()
        .mod_entry("fishery", SourceKind::Local, FISHERY_ABOUT)
        .build();

    let scan_report = scan_mod_metadata(&source, &ScanOpts::default())
        .await
        .unwrap();
    assert_eq!(scan_report.catalog.len(), 1);

    let mut list = ActiveModList::empty();
    list.append(PackageId::new("bs.fishery"));

    let result = validate_order(&scan_report.catalog, &list, &ValidateOpts::default());
    assert!(
        result
            .report
            .warnings
            .iter()
            .any(|d| d.code == DiagnosticCode::DependencyMissing)
    );
}

#[tokio::test]
async fn backup_round_trip_preserves_order_and_meta() {
    let source = IntegrationModSource::builder()
        .mod_entry("harmony", SourceKind::Local, HARMONY_ABOUT)
        .mod_entry("fishery", SourceKind::Local, FISHERY_ABOUT)
        .mods_config(VALID_MODS_CONFIG)
        .build();

    let scan = scan_mod_metadata(&source, &ScanOpts::default())
        .await
        .unwrap();
    let load = load_active_list(&source, Some(&scan.catalog))
        .await
        .unwrap();

    let backup = export_backup(
        &load.list,
        &load.config,
        BackupMeta {
            note: Some("Order test".to_string()),
            tags: vec!["tag1".to_string()],
            ..Default::default()
        },
    )
    .unwrap();

    let restored = import_backup(backup.json.as_bytes()).unwrap();
    assert_eq!(
        restored.active_mods,
        vec!["brrainz.harmony", "bs.fishery", "ludeon.rimworld"]
    );
    assert_eq!(restored.rimr_meta.note.as_deref(), Some("Order test"));
    assert_eq!(restored.rimr_meta.tags, vec!["tag1"]);
}

#[tokio::test]
async fn mods_config_round_trip_preserves_order() {
    let source = IntegrationModSource::builder()
        .mods_config(VALID_MODS_CONFIG)
        .build();

    let load = load_active_list(&source, None).await.unwrap();
    let bytes = build_mods_config_bytes(&load.list, &load.config).unwrap();
    let reparsed = parse_mods_config(&bytes).unwrap();

    assert_eq!(reparsed.version, load.config.version);
    assert_eq!(reparsed.active_mods, load.config.active_mods);
    assert_eq!(reparsed.known_expansions, load.config.known_expansions);
}
