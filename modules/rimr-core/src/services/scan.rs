//! Scans mod sources and compiles a `ModCatalog` with concurrent parsing.
//!
//! Discovery and `About.xml` reads are concurrent (bounded by
//! [`ScanOpts::concurrency`]); XML parsing and metadata compilation run
//! synchronously after IO completes. Mods with no `About.xml` or malformed
//! XML produce invalid catalog entries plus structured diagnostics instead of
//! failing the whole scan.

use std::sync::Arc;

use futures::stream::{self, StreamExt};

use crate::{
    diagnostics::{Diagnostic, DiagnosticCode, DiagnosticLocation, Severity},
    domain::{ModCatalog, ModMetadata},
    error::CoreError,
    formats::{CompileOpts, compile_metadata, parse_about_xml},
    ports::{ModFeatures, ModSource, ModSourceKey, SourceFile, SourceKind},
};

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
/// # Errors
///
/// Returns a source error if mod discovery fails. Individual metadata read and parse failures become diagnostics.
pub async fn scan_mod_metadata(
    source: &dyn ModSource,
    opts: &ScanOpts,
) -> Result<ScanReport, CoreError> {
    tracing::info!("starting mod metadata scan");
    let entries_with_bytes = read_entries(source, opts.concurrency).await?;
    let compile_opts = &opts.compile;

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
                        format!("About.xml read error for {key}: {e}"),
                    )
                    .with_location(DiagnosticLocation::about_xml(&key, "/ModMetaData"))
                    .with_param("sourceKey", key.as_str()),
                );
            },
            Ok(maybe_file) => match maybe_file {
                None => {
                    let mut meta = ModMetadata::invalid(key, kind);
                    meta.has_assemblies = features.has_assemblies;
                    catalog.insert(meta);
                },
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
                                    format!("About.xml for {key} is missing packageId"),
                                )
                                .with_location(DiagnosticLocation {
                                    source_key: Some(key.clone()),
                                    path: Arc::clone(&file.path),
                                    xml_path: Some(Arc::from("/ModMetaData/packageId")),
                                    line: Some(line),
                                    col: Some(col),
                                    byte_offset: offset,
                                })
                                .with_param("sourceKey", key.as_str()),
                            );
                        }
                    },
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
                                format!("About.xml parse error for {key}: {e}"),
                            )
                            .with_location(DiagnosticLocation {
                                source_key: Some(key.clone()),
                                path: Arc::clone(&file.path),
                                xml_path: Some(Arc::from("/ModMetaData")),
                                line: Some(line),
                                col: Some(col),
                                byte_offset: offset,
                            })
                            .with_param("sourceKey", key.as_str())
                            .with_param("error", e.to_string()),
                        );
                    },
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

async fn read_entries(
    source: &dyn ModSource,
    concurrency: usize,
) -> Result<Vec<EntryReadResult>, CoreError> {
    let entries = source
        .discover_mods()
        .await
        .inspect_err(|e| tracing::error!(error = ?e, "mod discovery failed"))?;
    let concurrency = concurrency.max(1);

    let entries_with_bytes = stream::iter(entries)
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

    Ok(entries_with_bytes)
}

fn find_xml_tag_offset(bytes: &[u8], tag: &str) -> Option<u64> {
    let needle = format!("<{tag}");
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
mod tests;
