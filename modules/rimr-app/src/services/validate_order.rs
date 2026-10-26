//! Order validation use case.
//!
//! Thin wrapper around [`crate::rules::build_load_order_graph`] and
//! [`crate::rules::validate_order`] that returns both the validation
//! report and the dependency graph, so the host can inspect edges or feed
//! the graph to future sort strategies.

use crate::{
    domain::{ActiveModList, ModCatalog},
    rules::{self, LoadOrderGraph, ValidateOpts, ValidationReport},
};

/// Result of order validation.
#[derive(Debug, Clone)]
pub struct ValidateOrderResult {
    /// Structured diagnostics produced by validation.
    pub report: ValidationReport,
    /// The dependency graph built from the catalog.
    pub graph: LoadOrderGraph,
}

/// Validates the user-managed order against dependency rules.
///
/// Builds a dependency graph from the catalog, then validates the active
/// list order. Returns the report and the graph (for UI inspection or
/// future sort strategies).
pub fn validate_order(
    catalog: &ModCatalog,
    list: &ActiveModList,
    opts: &ValidateOpts,
) -> ValidateOrderResult {
    tracing::info!(
        mods_in_catalog = catalog.len(),
        active_mods = list.len(),
        "validating mod order"
    );
    let graph = rules::build_load_order_graph(catalog);
    let report = rules::validate_order(catalog, list, &graph, opts);
    tracing::info!(
        warnings = report.warnings.len(),
        errors = report.errors.len(),
        "mod order validation complete"
    );
    ValidateOrderResult { report, graph }
}

#[cfg(test)]
mod tests;
