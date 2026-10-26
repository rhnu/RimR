//! Order validation: checks a user-managed order against dependency rules.

use crate::{
    diagnostics::Diagnostic,
    domain::{ActiveModList, GameVersion, ModCatalog},
    rules::{checks, graph::LoadOrderGraph},
};

/// Options for order validation.
#[derive(Debug, Clone, Default)]
pub struct ValidateOpts {
    /// Target version used when compiling this catalog; absent when unavailable.
    pub game_version: Option<GameVersion>,
}

/// Result of order validation: a collection of diagnostics.
#[derive(Debug, Clone, Default)]
pub struct ValidationReport {
    pub errors: Vec<Diagnostic>,
    pub warnings: Vec<Diagnostic>,
    pub infos: Vec<Diagnostic>,
}

impl ValidationReport {
    pub fn is_clean(&self) -> bool {
        self.errors.is_empty() && self.warnings.is_empty() && self.infos.is_empty()
    }

    pub fn has_errors(&self) -> bool { !self.errors.is_empty() }

    pub fn all(&self) -> impl Iterator<Item = &Diagnostic> {
        self.errors
            .iter()
            .chain(self.warnings.iter())
            .chain(self.infos.iter())
    }
}

/// Validates the user-managed order against dependency rules.
///
/// Produces a [`ValidationReport`] with structured diagnostics. Never returns
/// an error — all issues are reported as diagnostics. The caller decides
/// whether to block the save based on the report.
///
/// Checks performed:
/// 1. **Order violations**: for each active mod, loadAfter/loadBefore/forceLoad*
///    constraints are checked against the current position.
/// 2. **Circular dependencies**: DFS cycle detection on the active subgraph.
/// 3. **Missing dependencies**: modDependencies targets not installed.
/// 4. **Inactive dependencies**: modDependencies targets installed but not
///    active.
/// 5. **Incompatible mods**: two incompatible mods both active.
/// 6. **Duplicate packageIds**: reported from the catalog.
/// 7. **Unsupported game versions**: active mods whose declared versions exclude the target.
pub fn validate_order(
    catalog: &ModCatalog,
    list: &ActiveModList,
    graph: &LoadOrderGraph,
    opts: &ValidateOpts,
) -> ValidationReport {
    tracing::info!(active_mods = list.len(), "running order validation checks");
    let mut warnings = checks::check_order_violations(list, graph);
    warnings.extend(checks::check_missing_dependencies(catalog, list));
    warnings.extend(checks::check_inactive_dependencies(catalog, list));
    if let Some(version) = &opts.game_version {
        warnings.extend(checks::check_game_versions(catalog, list, version));
    }

    let mut errors = checks::check_active_missing(catalog, list);
    errors.extend(checks::check_cycles(graph, list));
    errors.extend(checks::check_incompatibles(catalog, list, graph));
    errors.extend(checks::check_duplicates(catalog));

    let report = ValidationReport {
        errors,
        warnings,
        infos: Vec::new(),
    };
    tracing::info!(
        errors = report.errors.len(),
        warnings = report.warnings.len(),
        "order validation checks complete"
    );
    report
}

#[cfg(test)]
mod tests;
