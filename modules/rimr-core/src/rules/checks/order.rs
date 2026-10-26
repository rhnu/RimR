//! Order violation check: loadAfter/loadBefore/forceLoad* constraints.

use crate::diagnostics::{Diagnostic, DiagnosticCode, Severity};
use crate::domain::ActiveModList;
use crate::rules::graph::{EdgeKind, LoadOrderGraph};

/// Checks load-order constraints against the current positions.
pub(crate) fn check_order_violations(
    list: &ActiveModList,
    graph: &LoadOrderGraph,
) -> Vec<Diagnostic> {
    let mut diagnostics = Vec::new();
    for (pos, pkg) in list.iter().enumerate() {
        for edge in graph.forward_edges(pkg) {
            if let Some(target_pos) = list.position(&edge.to)
                && target_pos > pos
            {
                let kind_str = match edge.kind {
                    EdgeKind::LoadAfter => "loadAfter",
                    EdgeKind::LoadBefore => "loadBefore",
                    EdgeKind::ForceLoadAfter => "forceLoadAfter",
                    EdgeKind::ForceLoadBefore => "forceLoadBefore",
                };
                let code = match edge.kind {
                    EdgeKind::LoadAfter | EdgeKind::ForceLoadAfter => {
                        DiagnosticCode::OrderViolationLoadAfter
                    }
                    EdgeKind::LoadBefore | EdgeKind::ForceLoadBefore => {
                        DiagnosticCode::OrderViolationLoadBefore
                    }
                };
                let diagnostic = Diagnostic::new(
                    Severity::Warning,
                    code,
                    format!(
                        "{}: {} must load before {} ({} rule violated)",
                        kind_str, edge.to, pkg, kind_str
                    ),
                )
                .with_param("rule", kind_str)
                .with_param("packageId", pkg.as_str())
                .with_param("targetPackageId", edge.to.as_str())
                .with_related_packages(vec![pkg.clone(), edge.to.clone()]);
                diagnostics.push(match &edge.location {
                    Some(location) => diagnostic.with_location(location.clone()),
                    None => diagnostic,
                });
            }
        }
    }
    diagnostics
}
