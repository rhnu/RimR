//! Missing and inactive dependency checks.

use crate::{
    diagnostics::{Diagnostic, DiagnosticCode, DiagnosticIdentity, DiagnosticLocation, Severity},
    domain::{ActiveModList, Dependency, ModCatalog, PackageId},
};

/// Checks for active mods that are not installed.
pub(crate) fn check_active_missing(catalog: &ModCatalog, list: &ActiveModList) -> Vec<Diagnostic> {
    let mut diagnostics = Vec::new();
    for pkg in list.iter() {
        if !catalog.contains(pkg) {
            diagnostics.push(
                Diagnostic::new(
                    Severity::Error,
                    DiagnosticCode::ActiveModMissing,
                    format!("Active mod is not installed: {pkg}"),
                )
                .with_suppression_identity(
                    DiagnosticIdentity::new().with_field("packageId", pkg.as_str()),
                )
                .with_param("packageId", pkg.as_str())
                .with_related_packages(vec![pkg.clone()]),
            );
        }
    }
    diagnostics
}

/// Checks for modDependencies targets that are not installed.
pub(crate) fn check_missing_dependencies(
    catalog: &ModCatalog,
    list: &ActiveModList,
) -> Vec<Diagnostic> {
    let mut diagnostics = Vec::new();
    for pkg in list.iter() {
        if let Some(metadata) = catalog.get(pkg) {
            for dep in &metadata.rules.mod_dependencies {
                if !catalog.contains(&dep.package_id) {
                    let alt_satisfied = dep
                        .alternative_package_ids
                        .iter()
                        .any(|alt| list.contains(alt));
                    if !alt_satisfied {
                        diagnostics.push(
                            Diagnostic::new(
                                Severity::Warning,
                                DiagnosticCode::DependencyMissing,
                                format!("{}: missing dependency {}", pkg, dep.package_id),
                            )
                            .with_location(DiagnosticLocation::about_xml(
                                &metadata.source_key,
                                "/ModMetaData/modDependencies",
                            ))
                            .with_param("packageId", pkg.as_str())
                            .with_suppression_identity(dependency_identity(pkg, dep))
                            .with_param("dependencyPackageId", dep.package_id.as_str())
                            .with_param(
                                "alternativePackageIds",
                                dep.alternative_package_ids
                                    .iter()
                                    .map(PackageId::as_str)
                                    .collect::<Vec<_>>()
                                    .join(", "),
                            )
                            .with_related_packages(vec![pkg.clone(), dep.package_id.clone()]),
                        );
                    }
                }
            }
        }
    }
    diagnostics
}

/// Checks for modDependencies targets that are installed but not active.
pub(crate) fn check_inactive_dependencies(
    catalog: &ModCatalog,
    list: &ActiveModList,
) -> Vec<Diagnostic> {
    let mut diagnostics = Vec::new();
    for pkg in list.iter() {
        if let Some(metadata) = catalog.get(pkg) {
            for dep in &metadata.rules.mod_dependencies {
                if catalog.contains(&dep.package_id) && !list.contains(&dep.package_id) {
                    let alt_satisfied = dep
                        .alternative_package_ids
                        .iter()
                        .any(|alt| list.contains(alt));
                    if !alt_satisfied {
                        diagnostics.push(
                            Diagnostic::new(
                                Severity::Warning,
                                DiagnosticCode::DependencyInactive,
                                format!(
                                    "{}: dependency {} is installed but not active",
                                    pkg, dep.package_id
                                ),
                            )
                            .with_location(DiagnosticLocation::about_xml(
                                &metadata.source_key,
                                "/ModMetaData/modDependencies",
                            ))
                            .with_param("packageId", pkg.as_str())
                            .with_suppression_identity(dependency_identity(pkg, dep))
                            .with_param("dependencyPackageId", dep.package_id.as_str())
                            .with_param(
                                "alternativePackageIds",
                                dep.alternative_package_ids
                                    .iter()
                                    .map(PackageId::as_str)
                                    .collect::<Vec<_>>()
                                    .join(", "),
                            )
                            .with_related_packages(vec![pkg.clone(), dep.package_id.clone()]),
                        );
                    }
                }
            }
        }
    }
    diagnostics
}

fn dependency_identity(package: &PackageId, dependency: &Dependency) -> DiagnosticIdentity {
    let mut alternatives = dependency
        .alternative_package_ids
        .iter()
        .map(ToString::to_string)
        .collect::<Vec<_>>();
    alternatives.sort();
    alternatives.dedup();
    DiagnosticIdentity::new()
        .version_dependent()
        .with_field("packageId", package.as_str())
        .with_field("dependencyPackageId", dependency.package_id.as_str())
        .with_list("alternatives", alternatives)
}
