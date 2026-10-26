//! Duplicate packageId check.

use crate::{
    diagnostics::{Diagnostic, DiagnosticCode, DiagnosticIdentity, DiagnosticLocation, Severity},
    domain::ModCatalog,
    ports::ModSourceKey,
};

/// Checks for duplicate packageIds reported by the catalog.
pub(crate) fn check_duplicates(catalog: &ModCatalog) -> Vec<Diagnostic> {
    catalog
        .duplicate_variants()
        .iter()
        .map(|dup| {
            let locations = dup
                .source_keys
                .iter()
                .map(|source_key| {
                    DiagnosticLocation::about_xml(source_key, "/ModMetaData/packageId")
                })
                .collect::<Vec<_>>();
            let diagnostic = Diagnostic::new(
                Severity::Error,
                DiagnosticCode::PackageIdDuplicate,
                format!("Duplicate package id: {}", dup.package_id),
            )
            .with_suppression_identity(
                DiagnosticIdentity::new()
                    .with_field("packageId", dup.package_id.as_str())
                    .with_sources(dup.source_keys.iter().map(ToString::to_string)),
            )
            .with_param("packageId", dup.package_id.as_str())
            .with_param("usedPath", dup.effective_source_key().as_str())
            .with_param(
                "shadowedPaths",
                dup.shadowed_source_keys()
                    .iter()
                    .map(ModSourceKey::as_str)
                    .collect::<Vec<_>>()
                    .join(", "),
            )
            .with_param(
                "paths",
                locations
                    .iter()
                    .map(|location| location.path.as_ref())
                    .collect::<Vec<_>>()
                    .join(", "),
            )
            .with_related_packages(vec![dup.package_id.clone()]);
            match locations.split_first() {
                Some((first, rest)) => diagnostic
                    .with_location(first.clone())
                    .with_related_locations(rest.to_vec()),
                None => diagnostic,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests;
