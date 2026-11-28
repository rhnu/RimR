//! Declared game-version support for active mods.

use crate::{
    diagnostics::{Diagnostic, DiagnosticCode, DiagnosticIdentity, DiagnosticLocation, Severity},
    domain::{ActiveModList, GameVersion, ModCatalog},
    rules::{ValidateOpts, ValidationReport},
};

/// Reports explicit version mismatches, leaving unknown support undecided.
pub(crate) fn check_game_versions(
    catalog: &ModCatalog,
    list: &ActiveModList,
    opts: &ValidateOpts,
    report: &mut ValidationReport,
) {
    let Some(game_version) = &opts.game_version else {
        return;
    };
    if game_version.major() == 0 {
        return;
    }

    for package_id in list.iter() {
        let Some(metadata) = catalog.get(package_id) else {
            continue;
        };
        if !metadata.valid {
            continue;
        }
        let mut supported = metadata
            .supported_versions
            .iter()
            .filter(|v| v.major() > 0)
            .peekable();
        // No usable declaration means support is unknown, rather than excluded.
        if supported.peek().is_none()
            || supported
                .any(|v| v.major() == game_version.major() && v.minor() == game_version.minor())
        {
            continue;
        }
        let versions = metadata
            .supported_versions
            .iter()
            .map(GameVersion::raw)
            .collect::<Vec<_>>()
            .join(", ");
        let location = opts
            .no_version_warning
            .as_ref()
            .and_then(|list| list.location_for(package_id));
        let code = DiagnosticCode::GameVersionUnsupported;
        let (mismatch, diagnostics) = match location {
            Some(location) => (
                Diagnostic::new(
                    Severity::Info,
                    code,
                    format!(
                        "No Version Warning lists {package_id} for game version {game_version}"
                    ),
                )
                .with_related_locations(vec![location.clone()]),
                &mut report.infos,
            ),
            None => (
                Diagnostic::new(
                    Severity::Warning,
                    code,
                    format!(
                        "{package_id} declares support for {versions}, excluding game version {game_version}"
                    ),
                ),
                &mut report.warnings,
            ),
        };
        diagnostics.push(
            mismatch
                .with_suppression_identity(
                    DiagnosticIdentity::new()
                        .with_field("packageId", package_id.as_str())
                        .with_game_version(game_version),
                )
                .with_param("packageId", package_id.as_str())
                .with_param("gameVersion", game_version.raw())
                .with_param("supportedVersions", versions)
                .with_related_packages(vec![package_id.clone()])
                .with_location(DiagnosticLocation::about_xml(
                    &metadata.source_key,
                    "/ModMetaData/supportedVersions",
                )),
        );
    }
}
