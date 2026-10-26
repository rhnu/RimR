//! Duplicate packageId check.

use crate::diagnostics::{Diagnostic, DiagnosticCode, DiagnosticLocation, Severity};
use crate::domain::ModCatalog;
use crate::ports::ModSourceKey;

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
mod tests {
    use super::*;
    use crate::domain::{ModMetadata, PackageId};
    use crate::ports::SourceKind;

    fn meta(package_id: &str, kind: SourceKind, source_key: &str) -> ModMetadata {
        let mut metadata = ModMetadata::invalid(ModSourceKey::new(source_key), kind);
        metadata.package_id = PackageId::new(package_id);
        metadata
    }

    #[test]
    fn names_the_copy_that_wins_and_the_ones_that_are_ignored() {
        let mut catalog = ModCatalog::new();
        catalog.insert(meta(
            "foo.bar",
            SourceKind::Local,
            "C:/RimWorld/Mods/FooBar",
        ));
        catalog.insert(meta("foo.bar", SourceKind::Workshop, "C:/workshop/12345"));

        let diagnostics = check_duplicates(&catalog);
        assert_eq!(diagnostics.len(), 1);
        let params = &diagnostics[0].params;
        assert_eq!(
            params.get("usedPath").map(String::as_str),
            Some("C:/RimWorld/Mods/FooBar")
        );
        assert_eq!(
            params.get("shadowedPaths").map(String::as_str),
            Some("C:/workshop/12345")
        );
    }

    #[test]
    fn no_duplicates_means_no_diagnostics() {
        let mut catalog = ModCatalog::new();
        catalog.insert(meta("foo.bar", SourceKind::Local, "a"));
        catalog.insert(meta("baz.qux", SourceKind::Workshop, "b"));
        assert!(check_duplicates(&catalog).is_empty());
    }
}
