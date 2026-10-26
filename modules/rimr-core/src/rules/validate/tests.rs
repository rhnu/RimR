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

fn version_report(
    target: Option<&str>,
    supported: &[&str],
    active: bool,
    valid: bool,
) -> ValidationReport {
    let mut metadata = make_mod("test.versioned", &[], &[], &[]);
    metadata.supported_versions = supported.iter().map(|v| GameVersion::parse(v)).collect();
    metadata.valid = valid;
    let catalog = make_catalog(vec![metadata]);
    let ids = if active {
        vec![PackageId::new("test.versioned")]
    } else {
        vec![]
    };
    let list = ActiveModList::from_slice(&ids);
    validate_order(
        &catalog,
        &list,
        &build_load_order_graph(&catalog),
        &ValidateOpts {
            game_version: target.map(GameVersion::parse),
        },
    )
}

#[test]
fn unsupported_game_version_warns_with_versions_and_mod_location() {
    let report = version_report(Some("1.6.4633 rev123"), &["1.4", "1.5"], true, true);
    assert!(!report.has_errors());
    assert_eq!(report.warnings.len(), 1);
    let warning = &report.warnings[0];
    assert_eq!(warning.code, DiagnosticCode::GameVersionUnsupported);
    assert_eq!(warning.severity, crate::Severity::Warning);
    assert_eq!(warning.params["packageId"], "test.versioned");
    assert_eq!(warning.params["gameVersion"], "1.6.4633 rev123");
    assert_eq!(warning.params["supportedVersions"], "1.4, 1.5");
    assert_eq!(warning.related_packages, [PackageId::new("test.versioned")]);
    let location = warning.location.as_ref().unwrap();
    assert_eq!(
        location.source_key.as_ref().unwrap().as_str(),
        "test.versioned"
    );
    assert_eq!(
        location.xml_path.as_deref(),
        Some("/ModMetaData/supportedVersions")
    );
}

#[test]
fn matching_unknown_inactive_and_invalid_versions_do_not_warn() {
    for (target, supported, active, valid) in [
        (Some("1.6.4633 rev123"), vec!["1.5", "1.6"], true, true),
        (Some("1.6"), vec!["1.6.9999 rev999"], true, true),
        (Some("1.6"), vec![], true, true),
        (Some("1.6"), vec!["garbage"], true, true),
        (Some("Unknown"), vec!["1.5"], true, true),
        (None, vec!["1.5"], true, true),
        (Some("1.6"), vec!["1.5"], false, true),
        (Some("1.6"), vec!["1.5"], true, false),
    ] {
        let report = version_report(target, &supported, active, valid);
        assert!(
            report.is_clean(),
            "unexpected diagnostic for {target:?}, {supported:?}, active={active}, valid={valid}"
        );
    }
}

#[test]
fn version_matching_compares_major_and_minor_and_uses_primary_copy() {
    // A different major version cannot match merely because the minor matches.
    let report = version_report(Some("2.6"), &["1.6"], true, true);
    assert_eq!(report.warnings.len(), 1);

    let mut primary = make_mod("test.duplicate", &[], &[], &[]);
    primary.supported_versions = vec![GameVersion::parse("1.6")];
    let mut shadowed = primary.clone();
    shadowed.source_key = ModSourceKey::new("shadowed");
    shadowed.supported_versions = vec![GameVersion::parse("1.5")];
    let catalog = make_catalog(vec![primary, shadowed]);
    let report = validate_order(
        &catalog,
        &ActiveModList::from_slice(&[PackageId::new("test.duplicate")]),
        &build_load_order_graph(&catalog),
        &ValidateOpts {
            game_version: Some(GameVersion::parse("1.6")),
        },
    );
    assert!(report.warnings.is_empty());
    assert_eq!(report.errors.len(), 1);
    assert_eq!(report.errors[0].code, DiagnosticCode::PackageIdDuplicate);
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
