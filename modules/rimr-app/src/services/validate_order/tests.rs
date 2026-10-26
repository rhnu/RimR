use std::sync::Arc;

use super::*;
use crate::{
    diagnostics::DiagnosticCode,
    domain::{ModCatalog, ModMetadata, PackageId, Rules},
    ports::{ModSourceKey, SourceKind},
    rules::ValidateOpts,
};

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

/// An empty catalog and active list yield a clean report.
#[test]
fn empty_catalog_clean() {
    let cat = ModCatalog::new();
    let list = ActiveModList::empty();
    let result = validate_order(&cat, &list, &ValidateOpts::default());
    assert!(result.report.is_clean());
}
