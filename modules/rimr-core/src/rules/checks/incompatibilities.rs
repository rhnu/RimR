//! Incompatible-mods-both-active check.

use crate::{
    diagnostics::{Diagnostic, DiagnosticCode, DiagnosticIdentity, DiagnosticLocation, Severity},
    domain::{ActiveModList, ModCatalog},
    rules::graph::LoadOrderGraph,
};

/// Checks for incompatible mods that are both active.
pub(crate) fn check_incompatibles(
    catalog: &ModCatalog,
    list: &ActiveModList,
    graph: &LoadOrderGraph,
) -> Vec<Diagnostic> {
    let mut diagnostics = Vec::new();
    for pkg in list.iter() {
        for incompatible in graph.incompatibilities(pkg) {
            if list.contains(incompatible) && pkg < incompatible {
                let diagnostic = Diagnostic::new(
                    Severity::Error,
                    DiagnosticCode::IncompatibleActive,
                    format!("{pkg} and {incompatible} are incompatible but both active"),
                )
                .with_suppression_identity(
                    DiagnosticIdentity::new()
                        .version_dependent()
                        .with_field("first", pkg.as_str())
                        .with_field("second", incompatible.as_str()),
                )
                .with_param("packageId", pkg.as_str())
                .with_param("incompatiblePackageId", incompatible.as_str())
                .with_related_packages(vec![pkg.clone(), incompatible.clone()]);
                diagnostics.push(match catalog.get(pkg) {
                    Some(metadata) => diagnostic.with_location(DiagnosticLocation::about_xml(
                        &metadata.source_key,
                        "/ModMetaData/incompatibleWith",
                    )),
                    None => diagnostic,
                });
            }
        }
    }
    diagnostics
}
