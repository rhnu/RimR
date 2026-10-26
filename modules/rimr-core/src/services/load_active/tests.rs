use super::*;
use crate::{
    diagnostics::DiagnosticCode,
    domain::{ModCatalog, ModMetadata, PackageId, Rules},
    ports::{ModSourceKey, SourceKind},
    services::test_support::MemoryModSource,
};

const MODS_CONFIG_XML: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<ModsConfigData>
  <version>1.5.4104 rev435</version>
  <activeMods>
    <li>brrainz.harmony</li>
    <li>ludeon.rimworld</li>
  </activeMods>
  <knownExpansions>
    <li>ludeon.rimworld.royalty</li>
  </knownExpansions>
</ModsConfigData>"#;

fn catalog_with(ids: &[&str]) -> ModCatalog {
    let mut cat = ModCatalog::new();
    for id in ids {
        let mut meta = ModMetadata::invalid(ModSourceKey::new(*id), SourceKind::Local);
        meta.package_id = PackageId::new(id);
        meta.valid = true;
        meta.rules = Rules::default();
        cat.insert(meta);
    }
    cat
}

/// A valid ModsConfig.xml parses into list + config.
#[tokio::test]
async fn loads_valid_mods_config() {
    let src = MemoryModSource::builder()
        .mods_config(MODS_CONFIG_XML)
        .build();
    let result = load_active_list(&src, None)
        .await
        .expect("load should succeed");
    assert_eq!(result.list.len(), 2);
    assert_eq!(result.list.as_slice()[0], PackageId::new("brrainz.harmony"));
    assert_eq!(result.list.as_slice()[1], PackageId::new("ludeon.rimworld"));
    assert_eq!(&*result.config.version, "1.5.4104 rev435");
    assert_eq!(result.config.known_expansions.len(), 1);
    assert_eq!(result.missing, [] as [crate::PackageId; 0]);
    assert!(result.diagnostics.is_empty());
}

/// Missing ModsConfig.xml (read returns None) is a fatal error.
#[tokio::test]
async fn missing_mods_config_errors() {
    let src = MemoryModSource::builder().build();
    let result = load_active_list(&src, None).await;
    assert!(result.is_err());
    match result {
        Err(CoreError::ModsConfigInvalid(msg)) => assert!(msg.contains("not found")),
        other => panic!("expected ModsConfigInvalid, got {other:?}"),
    }
}

/// With a catalog, mods in config but not installed are reported missing.
#[tokio::test]
async fn catalog_detects_missing_mods() {
    let src = MemoryModSource::builder()
        .mods_config(MODS_CONFIG_XML)
        .build();
    let cat = catalog_with(&["brrainz.harmony"]);
    let result = load_active_list(&src, Some(&cat))
        .await
        .expect("load should succeed");
    assert_eq!(result.missing, vec![PackageId::new("ludeon.rimworld")]);
    assert_eq!(result.diagnostics.len(), 1);
    assert_eq!(result.diagnostics[0].code, DiagnosticCode::ConfigModMissing);
    let diagnostic = &result.diagnostics[0];
    assert_eq!(
        diagnostic.params.get("packageId").map(String::as_str),
        Some("ludeon.rimworld")
    );
    let location = diagnostic
        .location
        .as_ref()
        .expect("missing config mod should point at ModsConfig.xml entry");
    assert_eq!(location.path.as_ref(), "ModsConfig.xml");
    assert_eq!(
        location.xml_path.as_deref(),
        Some("/ModsConfigData/activeMods/li[2]")
    );
}

/// Without a catalog, no missing-mod analysis is performed.
#[tokio::test]
async fn no_catalog_means_no_missing_analysis() {
    let src = MemoryModSource::builder()
        .mods_config(MODS_CONFIG_XML)
        .build();
    let result = load_active_list(&src, None)
        .await
        .expect("load should succeed");
    assert_eq!(result.missing, [] as [crate::PackageId; 0]);
    assert!(result.diagnostics.is_empty());
    assert_eq!(result.list.len(), 2);
}

/// An empty catalog reports every config mod as missing.
#[tokio::test]
async fn empty_catalog_reports_all_missing() {
    let src = MemoryModSource::builder()
        .mods_config(MODS_CONFIG_XML)
        .build();
    let cat = ModCatalog::new();
    let result = load_active_list(&src, Some(&cat))
        .await
        .expect("load should succeed");
    assert_eq!(result.missing.len(), 2);
    assert_eq!(result.diagnostics.len(), 2);
}

/// A malformed ModsConfig.xml propagates a `ModsConfigInvalid` error.
#[tokio::test]
async fn malformed_mods_config_errors() {
    let src = MemoryModSource::builder().mods_config("not xml").build();
    let result = load_active_list(&src, None).await;
    assert!(matches!(result, Err(CoreError::ModsConfigInvalid(_))));
}
