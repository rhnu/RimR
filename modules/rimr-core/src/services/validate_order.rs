//! Order validation use case.
//!
//! Thin wrapper around [`crate::rules::build_load_order_graph`] and
//! [`crate::rules::validate_order`] that returns both the validation
//! report and the dependency graph, so the host can inspect edges or feed
//! the graph to future sort strategies.

use crate::domain::{ActiveModList, ModCatalog};
use crate::rules::{self, LoadOrderGraph, ValidateOpts, ValidationReport};

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
mod tests {
    use super::*;
    use crate::diagnostics::DiagnosticCode;
    use crate::domain::{ModCatalog, ModMetadata, PackageId, Rules};
    use crate::ports::{ModSourceKey, SourceKind};
    use crate::rules::ValidateOpts;
    use std::sync::Arc;

    fn make_mod(pkg: &str, load_after: &[&str]) -> ModMetadata {
        ModMetadata {
            source_key: ModSourceKey::new(pkg),
            source_kind: SourceKind::Local,
            package_id: PackageId::new(pkg),
            name: Some(Arc::from(pkg)),
            authors: Vec::new(),
            supported_versions: Vec::new(),
            description: None,
            mod_version: None,
            url: None,
            mod_icon_path: None,
            steam_app_id: None,
            has_assemblies: false,
            rules: Rules {
                load_after: load_after.iter().copied().map(PackageId::new).collect(),
                load_before: Vec::new(),
                mod_dependencies: Vec::new(),
                incompatible_with: Vec::new(),
                force_load_after: Vec::new(),
                force_load_before: Vec::new(),
            },
            valid: true,
            data_malformed: false,
        }
    }

    fn make_catalog(mods: Vec<ModMetadata>) -> ModCatalog {
        let mut cat = ModCatalog::new();
        for m in mods {
            cat.insert(m);
        }
        cat
    }

    /// A correct order produces a clean report.
    #[test]
    fn clean_order_no_violations() {
        let cat = make_catalog(vec![make_mod("a", &["b"]), make_mod("b", &[])]);
        let list = ActiveModList::from_slice(&[PackageId::new("b"), PackageId::new("a")]);
        let result = validate_order(&cat, &list, &ValidateOpts::default());
        assert!(result.report.is_clean());
    }

    /// A violated loadAfter constraint produces a warning.
    #[test]
    fn violated_order_produces_warning() {
        let cat = make_catalog(vec![make_mod("a", &["b"]), make_mod("b", &[])]);
        let list = ActiveModList::from_slice(&[PackageId::new("a"), PackageId::new("b")]);
        let result = validate_order(&cat, &list, &ValidateOpts::default());
        assert!(!result.report.is_clean());
        assert!(
            result
                .report
                .warnings
                .iter()
                .any(|d| d.code == DiagnosticCode::OrderViolationLoadAfter)
        );
    }

    /// The returned graph contains the edge built from the catalog.
    #[test]
    fn graph_returned_with_edges() {
        let cat = make_catalog(vec![make_mod("a", &["b"]), make_mod("b", &[])]);
        let list = ActiveModList::from_slice(&[PackageId::new("b"), PackageId::new("a")]);
        let result = validate_order(&cat, &list, &ValidateOpts::default());
        assert!(!result.graph.is_empty());
        let fwd = result.graph.forward_edges(&PackageId::new("a"));
        assert_eq!(fwd.len(), 1);
        assert_eq!(fwd[0].to, PackageId::new("b"));
    }

    /// An empty catalog yields an empty graph and clean report.
    #[test]
    fn empty_catalog_clean() {
        let cat = ModCatalog::new();
        let list = ActiveModList::empty();
        let result = validate_order(&cat, &list, &ValidateOpts::default());
        assert!(result.report.is_clean());
        assert!(result.graph.is_empty());
    }
}
