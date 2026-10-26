//! Order validation use case.
//!
//! Builds the catalog's load-order graph and returns validation diagnostics.

use crate::{
    domain::{ActiveModList, ModCatalog},
    rules::{self, ValidateOpts, ValidationReport},
};

/// Result of order validation.
#[derive(Debug, Clone)]
pub struct ValidateOrderResult {
    /// Structured diagnostics produced by validation.
    pub report: ValidationReport,
}

/// Validates the user-managed order against dependency rules.
///
/// Builds a dependency graph from the catalog, then validates the active
/// list order and returns the diagnostics report.
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
    ValidateOrderResult { report }
}

#[cfg(test)]
mod tests;
