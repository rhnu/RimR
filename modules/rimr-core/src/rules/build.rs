//! Builds a `LoadOrderGraph` from a `ModCatalog`.

use crate::{
    diagnostics::DiagnosticLocation,
    domain::ModCatalog,
    rules::graph::{EdgeKind, EdgeSource, LoadOrderGraph},
};

/// Builds a dependency graph for the mods in `catalog`.
///
/// Only edges where **both endpoints are in the catalog** are created
/// (loadAfter/loadBefore entries targeting uninstalled mods
/// are silently skipped).
///
/// Incompatibilities are also only bidirectionalized between installed mods.
/// If A declares incompatible with B but B is not installed, the edge is
/// skipped.
pub fn build_load_order_graph(catalog: &ModCatalog) -> LoadOrderGraph {
    let mut graph = LoadOrderGraph::new();

    for (pkg_id, metadata) in catalog.iter() {
        let rules = &metadata.rules;

        for target in &rules.load_after {
            if catalog.contains(target) {
                graph.add_edge_with_location(
                    pkg_id.clone(),
                    target.clone(),
                    EdgeKind::LoadAfter,
                    EdgeSource::About,
                    Some(DiagnosticLocation::about_xml(
                        &metadata.source_key,
                        "/ModMetaData/loadAfter",
                    )),
                );
            }
        }

        for target in &rules.load_before {
            if catalog.contains(target) {
                graph.add_edge_with_location(
                    target.clone(),
                    pkg_id.clone(),
                    EdgeKind::LoadBefore,
                    EdgeSource::About,
                    Some(DiagnosticLocation::about_xml(
                        &metadata.source_key,
                        "/ModMetaData/loadBefore",
                    )),
                );
            }
        }

        for target in &rules.force_load_after {
            if catalog.contains(target) {
                graph.add_edge_with_location(
                    pkg_id.clone(),
                    target.clone(),
                    EdgeKind::ForceLoadAfter,
                    EdgeSource::About,
                    Some(DiagnosticLocation::about_xml(
                        &metadata.source_key,
                        "/ModMetaData/forceLoadAfter",
                    )),
                );
            }
        }

        for target in &rules.force_load_before {
            if catalog.contains(target) {
                graph.add_edge_with_location(
                    target.clone(),
                    pkg_id.clone(),
                    EdgeKind::ForceLoadBefore,
                    EdgeSource::About,
                    Some(DiagnosticLocation::about_xml(
                        &metadata.source_key,
                        "/ModMetaData/forceLoadBefore",
                    )),
                );
            }
        }

        for target in &rules.incompatible_with {
            if catalog.contains(target) {
                graph.add_incompatibility(pkg_id.clone(), target.clone());
            }
        }
    }

    graph
}

#[cfg(test)]
mod tests;
