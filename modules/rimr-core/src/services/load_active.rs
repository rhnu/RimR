//! Loads the active mod list from the game's `ModsConfig.xml`.

use crate::diagnostics::{Diagnostic, DiagnosticCode, DiagnosticLocation, Severity};
use crate::domain::{ActiveModList, ModCatalog, PackageId};
use crate::error::CoreError;
use crate::formats::{ModsConfig, parse_mods_config};
use crate::ports::ModSource;
use std::sync::Arc;

/// Result of loading the active mod list.
#[derive(Debug, Clone)]
pub struct ActiveLoadResult {
    /// The active mod list in load order.
    pub list: ActiveModList,
    /// The parsed `ModsConfig.xml` content (version + known expansions preserved).
    pub config: ModsConfig,
    /// Package ids present in the config but not in the catalog (when a
    /// catalog was supplied).
    pub missing: Vec<PackageId>,
    /// Diagnostics for missing mods.
    pub diagnostics: Vec<Diagnostic>,
}

/// Loads the active mod list from the game's `ModsConfig.xml` via the source.
///
/// When `catalog` is `Some`, package ids in the config but not installed are
/// reported as `DependencyMissing` warnings in `diagnostics` and collected in
/// `missing`. When `catalog` is `None`, no missing-mod analysis is performed.
pub async fn load_active_list(
    source: &dyn ModSource,
    catalog: Option<&ModCatalog>,
) -> Result<ActiveLoadResult, CoreError> {
    tracing::info!("loading active mod list");
    let file = source.read_mods_config().await?;
    let Some(file) = file else {
        return Err(CoreError::ModsConfigInvalid(
            "ModsConfig.xml not found".to_string(),
        ));
    };

    let config = parse_mods_config(&file.bytes)?;
    let list = ActiveModList::from_slice(&config.active_mods);

    let mut missing = Vec::new();
    let mut diagnostics = Vec::new();

    if let Some(cat) = catalog {
        for (index, pkg) in config.active_mods.iter().enumerate() {
            if !cat.contains(pkg) {
                missing.push(pkg.clone());
                diagnostics.push(
                    Diagnostic::new(
                        Severity::Warning,
                        DiagnosticCode::ConfigModMissing,
                        format!("Mod in config but not installed: {}", pkg),
                    )
                    .with_location(DiagnosticLocation {
                        source_key: file.source_key.clone(),
                        path: file.path.clone(),
                        xml_path: Some(Arc::from(format!(
                            "/ModsConfigData/activeMods/li[{}]",
                            index + 1
                        ))),
                        line: None,
                        col: None,
                        byte_offset: None,
                    })
                    .with_param("packageId", pkg.as_str())
                    .with_related_packages(vec![pkg.clone()]),
                );
            }
        }
    }

    tracing::info!(
        active_mods = list.len(),
        missing = missing.len(),
        diagnostics = diagnostics.len(),
        "active mod list loaded"
    );
    Ok(ActiveLoadResult {
        list,
        config,
        missing,
        diagnostics,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::diagnostics::DiagnosticCode;
    use crate::domain::{ModCatalog, ModMetadata, PackageId, Rules};
    use crate::ports::{ModSourceKey, SourceKind};
    use crate::services::test_support::MemoryModSource;

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
        assert!(result.missing.is_empty());
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
            other => panic!("expected ModsConfigInvalid, got {:?}", other),
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
        assert!(result.missing.is_empty());
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

    /// A malformed ModsConfig.xml propagates a ModsConfigInvalid error.
    #[tokio::test]
    async fn malformed_mods_config_errors() {
        let src = MemoryModSource::builder().mods_config("not xml").build();
        let result = load_active_list(&src, None).await;
        assert!(matches!(result, Err(CoreError::ModsConfigInvalid(_))));
    }
}
