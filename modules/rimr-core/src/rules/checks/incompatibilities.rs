//! Incompatible-mods-both-active check.

use crate::diagnostics::{Diagnostic, DiagnosticCode, DiagnosticLocation, Severity};
use crate::domain::{ActiveModList, ModCatalog, PackageId};
use crate::rules::graph::LoadOrderGraph;
use std::collections::HashSet;

/// Checks for incompatible mods that are both active.
pub(crate) fn check_incompatibles(
    catalog: &ModCatalog,
    list: &ActiveModList,
    graph: &LoadOrderGraph,
    active_set: &HashSet<&PackageId>,
) -> Vec<Diagnostic> {
    let mut diagnostics = Vec::new();
    for pkg in list.iter() {
        for incompatible in graph.incompatibilities(pkg) {
            if active_set.contains(incompatible) && pkg < incompatible {
                let diagnostic = Diagnostic::new(
                    Severity::Error,
                    DiagnosticCode::IncompatibleActive,
                    format!(
                        "{} and {} are incompatible but both active",
                        pkg, incompatible
                    ),
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
