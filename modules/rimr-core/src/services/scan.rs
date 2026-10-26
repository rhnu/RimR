//! Scans mod sources and compiles a `ModCatalog` with concurrent parsing.
//!
//! Discovery and `About.xml` reads are concurrent (bounded by
//! [`ScanOpts::concurrency`]); XML parsing and metadata compilation run
//! synchronously after IO completes. Mods with no `About.xml` or malformed
//! XML produce invalid catalog entries plus structured diagnostics instead of
//! failing the whole scan.

use crate::diagnostics::{Diagnostic, DiagnosticCode, DiagnosticLocation, Severity};
use crate::domain::{ModCatalog, ModMetadata};
use crate::error::CoreError;
use crate::formats::{CompileOpts, compile_metadata, parse_about_xml};
use crate::ports::{ModFeatures, ModSource, ModSourceKey, SourceFile, SourceKind};
use futures::stream::{self, StreamExt};
use std::sync::Arc;

type EntryReadResult = (
    ModSourceKey,
    SourceKind,
    Result<Option<SourceFile>, CoreError>,
    Result<ModFeatures, CoreError>,
);

/// Options for scanning mod metadata.
#[derive(Debug, Clone)]
pub struct ScanOpts {
    /// Compile options forwarded to metadata compilation.
    pub compile: CompileOpts,
    /// Concurrency limit for concurrent `About.xml` reads.
    pub concurrency: usize,
}

impl Default for ScanOpts {
    fn default() -> Self {
        Self {
            compile: CompileOpts::default(),
            concurrency: 16,
        }
    }
}

/// Result of scanning mod metadata.
#[derive(Debug, Clone)]
pub struct ScanReport {
    /// Compiled catalog of all discovered mods (including invalid entries).
    pub catalog: ModCatalog,
    /// Diagnostics for malformed `About.xml` files.
    pub diagnostics: Vec<Diagnostic>,
}

/// Scans a mod source: discovers all mods, concurrently reads their
/// `About.xml`, and compiles a [`ModCatalog`].
///
/// Mods with no `About.xml` or malformed XML get invalid metadata records
/// (`valid=false`, `data_malformed` set appropriately) and a diagnostic, but
/// do not fail the scan. Only host IO errors that abort discovery propagate
/// as [`CoreError`].
pub async fn scan_mod_metadata(
    source: &dyn ModSource,
    opts: &ScanOpts,
) -> Result<ScanReport, CoreError> {
    tracing::info!("starting mod metadata scan");
    let entries = source
        .discover_mods()
        .await
        .inspect_err(|e| tracing::error!(error = ?e, "mod discovery failed"))?;
    let concurrency = opts.concurrency.max(1);
    let compile_opts = &opts.compile;

    let entries_with_bytes: Vec<EntryReadResult> = stream::iter(entries)
        .map(|entry| async move {
            let bytes = source
                .read_about_xml(&entry.key)
                .await
                .map_err(CoreError::from);
            let features = source
                .read_mod_features(&entry.key)
                .await
                .map_err(CoreError::from);
            (entry.key, entry.kind, bytes, features)
        })
        .buffer_unordered(concurrency)
        .collect()
        .await;

    let mut catalog = ModCatalog::new();
    let mut diagnostics = Vec::new();

    for (key, kind, maybe_bytes, features_result) in entries_with_bytes {
        let features = features_result.unwrap_or_default();
        match maybe_bytes {
            Err(e) => {
                let mut meta = ModMetadata::invalid(key.clone(), kind);
                meta.has_assemblies = features.has_assemblies;
                catalog.insert(meta);
                diagnostics.push(
                    Diagnostic::new(
                        Severity::Error,
                        DiagnosticCode::SourceReadFailed,
                        format!("About.xml read error for {}: {}", key, e),
                    )
                    .with_location(DiagnosticLocation::about_xml(&key, "/ModMetaData"))
                    .with_param("sourceKey", key.as_str()),
                );
            }
            Ok(maybe_file) => match maybe_file {
                None => {
                    let mut meta = ModMetadata::invalid(key, kind);
                    meta.has_assemblies = features.has_assemblies;
                    catalog.insert(meta);
                }
                Some(file) => match parse_about_xml(&file.bytes) {
                    Ok(raw) => {
                        let mut meta = compile_metadata(raw, key.clone(), kind, compile_opts);
                        let package_id_missing = meta.package_id.is_sentinel();
                        meta.has_assemblies = features.has_assemblies;
                        catalog.insert(meta);
                        if package_id_missing {
                            let offset = find_xml_tag_offset(&file.bytes, "packageId")
                                .or_else(|| find_xml_tag_offset(&file.bytes, "ModMetaData"));
                            let (line, col) = offset
                                .and_then(|offset| line_col(&file.bytes, offset))
                                .unwrap_or((1, 1));
                            diagnostics.push(
                                Diagnostic::new(
                                    Severity::Error,
                                    DiagnosticCode::PackageIdMissing,
                                    format!("About.xml for {} is missing packageId", key),
                                )
                                .with_location(DiagnosticLocation {
                                    source_key: Some(key.clone()),
                                    path: file.path.clone(),
                                    xml_path: Some(Arc::from("/ModMetaData/packageId")),
                                    line: Some(line),
                                    col: Some(col),
                                    byte_offset: offset,
                                })
                                .with_param("sourceKey", key.as_str()),
                            );
                        }
                    }
                    Err(e) => {
                        let offset = e.byte_offset().or(Some(0));
                        let (line, col) = offset
                            .and_then(|offset| line_col(&file.bytes, offset))
                            .unwrap_or((1, 1));
                        let mut meta = ModMetadata::invalid(key.clone(), kind);
                        meta.data_malformed = true;
                        meta.has_assemblies = features.has_assemblies;
                        catalog.insert(meta);
                        diagnostics.push(
                            Diagnostic::new(
                                Severity::Error,
                                DiagnosticCode::XmlMalformed,
                                format!("About.xml parse error for {}: {}", key, e),
                            )
                            .with_location(DiagnosticLocation {
                                source_key: Some(key.clone()),
                                path: file.path.clone(),
                                xml_path: Some(Arc::from("/ModMetaData")),
                                line: Some(line),
                                col: Some(col),
                                byte_offset: offset,
                            })
                            .with_param("sourceKey", key.as_str())
                            .with_param("error", e.to_string()),
                        );
                    }
                },
            },
        }
    }

    tracing::info!(
        mods = catalog.len(),
        diagnostics = diagnostics.len(),
        "mod metadata scan complete"
    );
    Ok(ScanReport {
        catalog,
        diagnostics,
    })
}

fn find_xml_tag_offset(bytes: &[u8], tag: &str) -> Option<u64> {
    let needle = format!("<{}", tag);
    let needle_bytes = needle.as_bytes();
    bytes
        .windows(needle_bytes.len())
        .position(|window| window.eq_ignore_ascii_case(needle_bytes))
        .map(|offset| offset as u64)
}

fn line_col(bytes: &[u8], byte_offset: u64) -> Option<(u32, u32)> {
    let end = usize::try_from(byte_offset).ok()?.min(bytes.len());
    let text = String::from_utf8_lossy(&bytes[..end]);
    let mut line = 1u32;
    let mut col = 1u32;
    for ch in text.chars() {
        if ch == '\n' {
            line += 1;
            col = 1;
        } else {
            col += 1;
        }
    }
    Some((line, col))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::diagnostics::DiagnosticCode;
    use crate::domain::{GameVersion, PackageId};
    use crate::error::SourceError;
    use crate::formats::CompileOpts;
    use crate::ports::{ModFeatures, ModSourceEntry, SourceKind};
    use crate::services::test_support::MemoryModSource;

    const VALID_ABOUT: &str = r#"<ModMetaData>
  <packageId>test.single</packageId>
  <author>Author One</author>
  <name>Single Mod</name>
</ModMetaData>"#;

    const BY_VERSION_ABOUT: &str = r#"<ModMetaData>
  <packageId>test.bv</packageId>
  <loadAfter><li>base.mod</li></loadAfter>
  <loadAfterByVersion>
    <li>
      <li>1.5</li>
      <li>versioned.mod</li>
    </li>
  </loadAfterByVersion>
</ModMetaData>"#;

    const MALFORMED_ABOUT: &[u8] = b"<ModMetaData><packageId>test.bad</packageId";

    /// Empty source yields an empty catalog and no diagnostics.
    #[tokio::test]
    async fn empty_source_yields_empty_catalog() {
        let src = MemoryModSource::builder().build();
        let report = scan_mod_metadata(&src, &ScanOpts::default())
            .await
            .expect("scan should succeed");
        assert!(report.catalog.is_empty());
        assert!(report.diagnostics.is_empty());
    }

    /// A single mod with valid About.xml compiles into one catalog entry.
    #[tokio::test]
    async fn single_mod_compiles() {
        let src = MemoryModSource::builder()
            .mod_entry("key.single", SourceKind::Local, VALID_ABOUT)
            .build();
        let report = scan_mod_metadata(&src, &ScanOpts::default())
            .await
            .expect("scan should succeed");
        assert_eq!(report.catalog.len(), 1);
        assert!(report.diagnostics.is_empty());
        let meta = report
            .catalog
            .get(&PackageId::new("test.single"))
            .expect("mod should be present");
        assert!(meta.valid);
        assert!(!meta.data_malformed);
        assert_eq!(meta.package_id.as_str(), "test.single");
    }

    /// Multiple mods are all discovered and compiled concurrently.
    #[tokio::test]
    async fn multiple_mods_concurrent() {
        let xml = |id: &str| {
            format!(r#"<ModMetaData><packageId>{id}</packageId><author>A</author></ModMetaData>"#)
        };
        let src = MemoryModSource::builder()
            .mod_entry("k.a", SourceKind::Local, &xml("mod.a"))
            .mod_entry("k.b", SourceKind::Workshop, &xml("mod.b"))
            .mod_entry("k.c", SourceKind::Expansion, &xml("mod.c"))
            .build();
        let report = scan_mod_metadata(&src, &ScanOpts::default())
            .await
            .expect("scan should succeed");
        assert_eq!(report.catalog.len(), 3);
        assert!(report.catalog.contains(&PackageId::new("mod.a")));
        assert!(report.catalog.contains(&PackageId::new("mod.b")));
        assert!(report.catalog.contains(&PackageId::new("mod.c")));
    }

    /// A mod with no About.xml gets an invalid record and no diagnostic.
    #[tokio::test]
    async fn no_about_xml_is_invalid_record() {
        let src = MemoryModSource::builder()
            .mod_entry_no_about("key.missing", SourceKind::Local)
            .build();
        let report = scan_mod_metadata(&src, &ScanOpts::default())
            .await
            .expect("scan should succeed");
        assert_eq!(report.catalog.len(), 1);
        assert!(report.diagnostics.is_empty());
        let meta = report
            .catalog
            .get_by_source_key(&ModSourceKey::new("key.missing"))
            .expect("sentinel source key should be present");
        assert!(!meta.valid);
        assert!(!meta.data_malformed);
        assert!(meta.package_id.is_sentinel());
    }

    /// Malformed About.xml yields an invalid, malformed record and a diagnostic.
    #[tokio::test]
    async fn malformed_xml_produces_diagnostic() {
        let src = MemoryModSource::builder()
            .mod_entry_bytes("key.bad", SourceKind::Local, MALFORMED_ABOUT)
            .build();
        let report = scan_mod_metadata(&src, &ScanOpts::default())
            .await
            .expect("scan should succeed");
        assert_eq!(report.catalog.len(), 1);
        assert_eq!(report.diagnostics.len(), 1);
        let meta = report
            .catalog
            .get_by_source_key(&ModSourceKey::new("key.bad"))
            .expect("sentinel source key should be present");
        assert!(!meta.valid);
        assert!(meta.data_malformed);
        assert_eq!(report.diagnostics[0].code, DiagnosticCode::XmlMalformed);
        assert_eq!(report.diagnostics[0].severity, Severity::Error);
    }

    /// An About.xml that parses but lacks packageId marks the mod invalid and
    /// emits a PackageIdMissing diagnostic.
    #[tokio::test]
    async fn missing_package_id_produces_diagnostic() {
        let xml = r#"<ModMetaData><name>No PID</name><author>A</author></ModMetaData>"#;
        let src = MemoryModSource::builder()
            .mod_entry("key.nopid", SourceKind::Local, xml)
            .build();
        let report = scan_mod_metadata(&src, &ScanOpts::default())
            .await
            .expect("scan should succeed");
        assert_eq!(report.catalog.len(), 1);
        assert_eq!(report.diagnostics.len(), 1);
        let meta = report
            .catalog
            .get_by_source_key(&ModSourceKey::new("key.nopid"))
            .expect("sentinel source key should be present");
        assert!(!meta.valid);
        assert!(!meta.data_malformed);
        assert_eq!(report.diagnostics[0].code, DiagnosticCode::PackageIdMissing);
        assert_eq!(report.diagnostics[0].severity, Severity::Error);
        let location = report.diagnostics[0]
            .location
            .as_ref()
            .expect("missing packageId should point at About.xml");
        assert_eq!(location.path.as_ref(), "key.nopid/About/About.xml");
        assert_eq!(location.xml_path.as_deref(), Some("/ModMetaData/packageId"));
        assert_eq!(
            report.diagnostics[0]
                .params
                .get("sourceKey")
                .map(String::as_str),
            Some("key.nopid")
        );
    }

    struct ReadErrorSource;

    #[async_trait::async_trait]
    impl ModSource for ReadErrorSource {
        async fn discover_mods(&self) -> Result<Vec<ModSourceEntry>, SourceError> {
            Ok(vec![ModSourceEntry {
                key: ModSourceKey::new("key.denied"),
                kind: SourceKind::Local,
                display_name_hint: None,
            }])
        }

        async fn read_about_xml(
            &self,
            key: &ModSourceKey,
        ) -> Result<Option<SourceFile>, SourceError> {
            Err(SourceError::Io {
                source_key: key.clone(),
                message: "permission denied".to_string(),
            })
        }

        async fn read_mods_config(&self) -> Result<Option<SourceFile>, SourceError> {
            Ok(None)
        }

        async fn write_mods_config(&self, _bytes: Vec<u8>) -> Result<(), SourceError> {
            Ok(())
        }

        async fn read_mod_features(&self, key: &ModSourceKey) -> Result<ModFeatures, SourceError> {
            Err(SourceError::Io {
                source_key: key.clone(),
                message: "features unavailable".to_string(),
            })
        }
    }

    #[tokio::test]
    async fn read_about_xml_error_produces_diagnostic() {
        let report = scan_mod_metadata(&ReadErrorSource, &ScanOpts::default())
            .await
            .expect("scan should keep per-mod read errors non-fatal");
        assert_eq!(report.catalog.len(), 1);
        assert_eq!(report.diagnostics.len(), 1);
        assert_eq!(report.diagnostics[0].code, DiagnosticCode::SourceReadFailed);
        assert!(report.diagnostics[0].message.contains("permission denied"));
        let meta = report
            .catalog
            .get_by_source_key(&ModSourceKey::new("key.denied"))
            .expect("sentinel source key should be present");
        assert!(
            !meta.has_assemblies,
            "features error must fall back to false, non-fatal"
        );
    }

    struct AssembliesModSource {
        entries: Vec<ModSourceEntry>,
        about_xmls: std::collections::HashMap<ModSourceKey, Vec<u8>>,
    }

    #[async_trait::async_trait]
    impl ModSource for AssembliesModSource {
        async fn discover_mods(&self) -> Result<Vec<ModSourceEntry>, SourceError> {
            Ok(self.entries.clone())
        }

        async fn read_about_xml(
            &self,
            key: &ModSourceKey,
        ) -> Result<Option<SourceFile>, SourceError> {
            Ok(self.about_xmls.get(key).cloned().map(|bytes| {
                SourceFile::new(
                    Some(key.clone()),
                    format!("{}/About/About.xml", key.as_str()),
                    bytes,
                )
            }))
        }

        async fn read_mods_config(&self) -> Result<Option<SourceFile>, SourceError> {
            Ok(None)
        }

        async fn write_mods_config(&self, _bytes: Vec<u8>) -> Result<(), SourceError> {
            Ok(())
        }

        async fn read_mod_features(&self, _key: &ModSourceKey) -> Result<ModFeatures, SourceError> {
            Ok(ModFeatures {
                has_assemblies: true,
            })
        }
    }

    /// A mod whose source reports `has_assemblies: true` gets the flag plumbed
    /// through to the compiled catalog entry.
    #[tokio::test]
    async fn mod_with_assemblies_flagged() {
        let key = ModSourceKey::new("key.cs");
        let src = AssembliesModSource {
            entries: vec![ModSourceEntry {
                key: key.clone(),
                kind: SourceKind::Local,
                display_name_hint: Some(std::sync::Arc::from(key.as_str())),
            }],
            about_xmls: std::collections::HashMap::from([(key, VALID_ABOUT.as_bytes().to_vec())]),
        };
        let report = scan_mod_metadata(&src, &ScanOpts::default())
            .await
            .expect("scan should succeed");
        let meta = report
            .catalog
            .get(&PackageId::new("test.single"))
            .expect("mod should be present");
        assert!(meta.valid);
        assert!(
            meta.has_assemblies,
            "has_assemblies should be plumbed from read_mod_features"
        );
    }

    /// Mixed source: one valid, one missing About.xml, one malformed.
    ///
    /// The two invalid mods both resolve to the sentinel `missing.packageid`,
    /// but sentinel IDs are exempt from duplicate tracking — each missing-
    /// packageId mod is an independent error. The catalog still records all
    /// three source keys. The malformed mod additionally emits a diagnostic.
    #[tokio::test]
    async fn mixed_source_compiles_and_reports() {
        let xml = |id: &str| {
            format!(r#"<ModMetaData><packageId>{id}</packageId><author>A</author></ModMetaData>"#)
        };
        let src = MemoryModSource::builder()
            .mod_entry("k.good", SourceKind::Local, &xml("mod.good"))
            .mod_entry_no_about("k.missing", SourceKind::Local)
            .mod_entry_bytes("k.bad", SourceKind::Local, MALFORMED_ABOUT)
            .build();
        let report = scan_mod_metadata(&src, &ScanOpts::default())
            .await
            .expect("scan should succeed");
        assert_eq!(report.catalog.len(), 3);
        assert!(report.catalog.contains(&PackageId::new("mod.good")));
        assert!(
            !report.catalog.contains(&PackageId::missing()),
            "sentinel package IDs are not package-addressable catalog entries"
        );
        assert!(
            report
                .catalog
                .get_by_source_key(&ModSourceKey::new("k.missing"))
                .is_some()
        );
        assert!(
            report
                .catalog
                .get_by_source_key(&ModSourceKey::new("k.bad"))
                .is_some()
        );
        assert!(
            !report.catalog.has_duplicates(),
            "sentinel package IDs should not create duplicates"
        );
        assert_eq!(report.diagnostics.len(), 1);
        assert_eq!(report.diagnostics[0].code, DiagnosticCode::XmlMalformed);
    }

    /// ByVersion values are applied when game_version matches.
    #[tokio::test]
    async fn by_version_compilation() {
        let src = MemoryModSource::builder()
            .mod_entry("k.bv", SourceKind::Local, BY_VERSION_ABOUT)
            .build();
        let opts = ScanOpts {
            compile: CompileOpts {
                game_version: GameVersion::parse("1.5"),
                prefer_versioned: true,
            },
            concurrency: 4,
        };
        let report = scan_mod_metadata(&src, &opts)
            .await
            .expect("scan should succeed");
        let meta = report
            .catalog
            .get(&PackageId::new("test.bv"))
            .expect("mod should be present");
        let la: Vec<&str> = meta
            .rules
            .load_after
            .iter()
            .map(PackageId::as_str)
            .collect();
        assert_eq!(la, vec!["versioned.mod"]);
    }

    /// Concurrency of 1 still works (sequential fallback).
    #[tokio::test]
    async fn concurrency_one_works() {
        let src = MemoryModSource::builder()
            .mod_entry("k.a", SourceKind::Local, VALID_ABOUT)
            .build();
        let opts = ScanOpts {
            compile: CompileOpts::default(),
            concurrency: 1,
        };
        let report = scan_mod_metadata(&src, &opts)
            .await
            .expect("scan should succeed");
        assert_eq!(report.catalog.len(), 1);
    }
}
