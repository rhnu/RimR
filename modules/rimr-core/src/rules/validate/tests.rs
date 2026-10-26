use std::sync::Arc;

use super::*;
use crate::{
    diagnostics::DiagnosticCode,
    domain::{ActiveModList, Dependency, ModCatalog, ModMetadata, PackageId, Rules},
    ports::{ModSourceKey, SourceKind},
    rules::build::build_load_order_graph,
};

fn make_mod(
    pkg: &str,
    load_after: &[&str],
    load_before: &[&str],
    incompatible: &[&str],
) -> ModMetadata {
    ModMetadata {
        source_key: ModSourceKey::new(pkg),
        source_kind: SourceKind::Local,
        package_id: PackageId::new(pkg),
        name: Some(Arc::from(pkg)),
        authors: vec![],
        supported_versions: vec![],
        description: None,
        mod_version: None,
        url: None,
        mod_icon_path: None,
        steam_app_id: None,
        has_assemblies: false,
        rules: Rules {
            load_after: load_after.iter().copied().map(PackageId::new).collect(),
            load_before: load_before.iter().copied().map(PackageId::new).collect(),
            mod_dependencies: vec![],
            incompatible_with: incompatible.iter().copied().map(PackageId::new).collect(),
            force_load_after: vec![],
            force_load_before: vec![],
        },
        valid: true,
        data_malformed: false,
    }
}

fn make_mod_with_deps(pkg: &str, deps: Vec<Dependency>) -> ModMetadata {
    let mut m = make_mod(pkg, &[], &[], &[]);
    m.rules.mod_dependencies = deps;
    m
}

fn make_catalog(mods: Vec<ModMetadata>) -> ModCatalog {
    let mut cat = ModCatalog::new();
    for m in mods {
        cat.insert(m);
    }
    cat
}

#[test]
fn clean_order_no_violations() {
    let cat = make_catalog(vec![
        make_mod("a", &["b"], &[], &[]),
        make_mod("b", &[], &[], &[]),
    ]);
    let g = build_load_order_graph(&cat);
    let list = ActiveModList::from_slice(&[PackageId::new("b"), PackageId::new("a")]);
    let report = validate_order(&cat, &list, &g, &ValidateOpts::default());
    assert!(report.is_clean());
}

#[test]
fn order_violation_load_after() {
    let cat = make_catalog(vec![
        make_mod("a", &["b"], &[], &[]),
        make_mod("b", &[], &[], &[]),
    ]);
    let g = build_load_order_graph(&cat);
    let list = ActiveModList::from_slice(&[PackageId::new("a"), PackageId::new("b")]);
    let report = validate_order(&cat, &list, &g, &ValidateOpts::default());
    assert_eq!(report.warnings.len(), 1);
    assert_eq!(
        report.warnings[0].code,
        DiagnosticCode::OrderViolationLoadAfter
    );
    let location = report.warnings[0]
        .location
        .as_ref()
        .expect("order violation should point at the declaring About.xml rule");
    assert_eq!(location.path.as_ref(), "a/About/About.xml");
    assert_eq!(location.xml_path.as_deref(), Some("/ModMetaData/loadAfter"));
}

#[test]
fn order_violation_load_before() {
    let cat = make_catalog(vec![
        make_mod("a", &[], &["b"], &[]),
        make_mod("b", &[], &[], &[]),
    ]);
    let g = build_load_order_graph(&cat);
    let list = ActiveModList::from_slice(&[PackageId::new("b"), PackageId::new("a")]);
    let report = validate_order(&cat, &list, &g, &ValidateOpts::default());
    assert_eq!(report.warnings.len(), 1);
    assert_eq!(
        report.warnings[0].code,
        DiagnosticCode::OrderViolationLoadBefore
    );
    assert!(report.warnings[0].message.contains("loadBefore"));
}

#[test]
fn circular_dependency_detected() {
    let cat = make_catalog(vec![
        make_mod("a", &["b"], &[], &[]),
        make_mod("b", &["a"], &[], &[]),
    ]);
    let g = build_load_order_graph(&cat);
    let list = ActiveModList::from_slice(&[PackageId::new("a"), PackageId::new("b")]);
    let report = validate_order(&cat, &list, &g, &ValidateOpts::default());
    assert!(report.has_errors());
    assert_eq!(report.errors.len(), 1);
    assert_eq!(report.errors[0].code, DiagnosticCode::CircularDependency);
}

#[test]
fn inactive_mod_rules_do_not_report_cycles_or_incompatibilities() {
    let cat = make_catalog(vec![
        make_mod("a", &["b"], &[], &["b"]),
        make_mod("b", &["a"], &[], &[]),
    ]);
    let graph = build_load_order_graph(&cat);
    let list = ActiveModList::from_slice(&[PackageId::new("a")]);

    let report = validate_order(&cat, &list, &graph, &ValidateOpts::default());

    assert!(report.is_clean());
}

#[test]
fn self_dependency_not_a_cycle() {
    let cat = make_catalog(vec![make_mod("a", &["a"], &[], &[])]);
    let g = build_load_order_graph(&cat);
    let list = ActiveModList::from_slice(&[PackageId::new("a")]);
    let report = validate_order(&cat, &list, &g, &ValidateOpts::default());
    assert!(report.is_clean());
}

#[test]
fn missing_dependency_warning() {
    let cat = make_catalog(vec![make_mod_with_deps(
        "a",
        vec![Dependency::from_id(PackageId::new("b"))],
    )]);
    let g = build_load_order_graph(&cat);
    let list = ActiveModList::from_slice(&[PackageId::new("a")]);
    let report = validate_order(&cat, &list, &g, &ValidateOpts::default());
    assert!(
        report
            .warnings
            .iter()
            .any(|d| d.code == DiagnosticCode::DependencyMissing)
    );
    let diagnostic = report
        .warnings
        .iter()
        .find(|d| d.code == DiagnosticCode::DependencyMissing)
        .expect("missing dependency diagnostic");
    let location = diagnostic
        .location
        .as_ref()
        .expect("missing dependency should point at modDependencies");
    assert_eq!(location.path.as_ref(), "a/About/About.xml");
    assert_eq!(
        location.xml_path.as_deref(),
        Some("/ModMetaData/modDependencies")
    );
}

#[test]
fn inactive_dependency_warning() {
    let cat = make_catalog(vec![
        make_mod_with_deps("a", vec![Dependency::from_id(PackageId::new("b"))]),
        make_mod("b", &[], &[], &[]),
    ]);
    let g = build_load_order_graph(&cat);
    let list = ActiveModList::from_slice(&[PackageId::new("a")]);
    let report = validate_order(&cat, &list, &g, &ValidateOpts::default());
    assert!(
        report
            .warnings
            .iter()
            .any(|d| d.code == DiagnosticCode::DependencyInactive)
    );
}

#[test]
fn alternative_id_satisfies_dependency() {
    let cat = make_catalog(vec![
        make_mod_with_deps(
            "a",
            vec![Dependency {
                package_id: PackageId::new("b"),
                display_name: None,
                steam_workshop_url: None,
                download_url: None,
                alternative_package_ids: vec![PackageId::new("c")],
            }],
        ),
        make_mod("b", &[], &[], &[]),
        make_mod("c", &[], &[], &[]),
    ]);
    let g = build_load_order_graph(&cat);
    let list = ActiveModList::from_slice(&[PackageId::new("a"), PackageId::new("c")]);
    let report = validate_order(&cat, &list, &g, &ValidateOpts::default());
    assert!(!report.warnings.iter().any(|d| {
        d.code == DiagnosticCode::DependencyMissing || d.code == DiagnosticCode::DependencyInactive
    }));
}

#[test]
fn incompatible_both_active_error() {
    let cat = make_catalog(vec![
        make_mod("a", &[], &[], &["b"]),
        make_mod("b", &[], &[], &[]),
    ]);
    let g = build_load_order_graph(&cat);
    let list = ActiveModList::from_slice(&[PackageId::new("a"), PackageId::new("b")]);
    let report = validate_order(&cat, &list, &g, &ValidateOpts::default());
    assert_eq!(report.errors.len(), 1);
    assert_eq!(report.errors[0].code, DiagnosticCode::IncompatibleActive);
}

#[test]
fn incompatible_not_duplicated() {
    let cat = make_catalog(vec![
        make_mod("a", &[], &[], &["b"]),
        make_mod("b", &[], &[], &[]),
    ]);
    let g = build_load_order_graph(&cat);
    let list = ActiveModList::from_slice(&[PackageId::new("a"), PackageId::new("b")]);
    let report = validate_order(&cat, &list, &g, &ValidateOpts::default());
    let count = report
        .errors
        .iter()
        .filter(|d| d.code == DiagnosticCode::IncompatibleActive)
        .count();
    assert_eq!(count, 1);
}

#[test]
fn duplicate_package_id_error() {
    let cat = make_catalog(vec![
        make_mod("dup", &[], &[], &[]),
        make_mod("dup", &[], &[], &[]),
    ]);
    let g = build_load_order_graph(&cat);
    let list = ActiveModList::from_slice(&[PackageId::new("dup")]);
    let report = validate_order(&cat, &list, &g, &ValidateOpts::default());
    assert!(
        report
            .errors
            .iter()
            .any(|d| d.code == DiagnosticCode::PackageIdDuplicate)
    );
    let diagnostic = report
        .errors
        .iter()
        .find(|d| d.code == DiagnosticCode::PackageIdDuplicate)
        .expect("duplicate diagnostic");
    assert!(diagnostic.location.is_some());
    assert_eq!(diagnostic.related_locations.len(), 1);
}

#[test]
fn active_mod_missing_from_catalog_is_error() {
    let cat = make_catalog(vec![make_mod("a", &[], &[], &[])]);
    let g = build_load_order_graph(&cat);
    let list = ActiveModList::from_slice(&[PackageId::new("a"), PackageId::new("missing.active")]);

    let report = validate_order(&cat, &list, &g, &ValidateOpts::default());

    let diagnostic = report
        .errors
        .iter()
        .find(|d| d.code == DiagnosticCode::ActiveModMissing)
        .expect("active missing mod diagnostic");
    assert_eq!(
        diagnostic.params.get("packageId").map(String::as_str),
        Some("missing.active")
    );
    assert_eq!(
        diagnostic.related_packages,
        vec![PackageId::new("missing.active")]
    );
}

#[test]
fn chain_clean_and_violated() {
    let cat = make_catalog(vec![
        make_mod("a", &["b"], &[], &[]),
        make_mod("b", &["c"], &[], &[]),
        make_mod("c", &[], &[], &[]),
    ]);
    let g = build_load_order_graph(&cat);
    let clean = ActiveModList::from_slice(&[
        PackageId::new("c"),
        PackageId::new("b"),
        PackageId::new("a"),
    ]);
    let report = validate_order(&cat, &clean, &g, &ValidateOpts::default());
    assert!(report.is_clean());

    let bad = ActiveModList::from_slice(&[
        PackageId::new("a"),
        PackageId::new("b"),
        PackageId::new("c"),
    ]);
    let report = validate_order(&cat, &bad, &g, &ValidateOpts::default());
    assert_eq!(report.warnings.len(), 2);
}
