//! Declared game-version support for active mods.

use crate::{
    diagnostics::{Diagnostic, DiagnosticCode, DiagnosticLocation, Severity},
    domain::{ActiveModList, GameVersion, ModCatalog},
};

/// Reports explicit version mismatches, leaving unknown support undecided.
pub(crate) fn check_game_versions(
    catalog: &ModCatalog,
    list: &ActiveModList,
    game_version: &GameVersion,
) -> Vec<Diagnostic> {
    if game_version.major() == 0 {
        return Vec::new();
    }

    let mut diagnostics = Vec::new();
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
        diagnostics.push(
            Diagnostic::new(
                Severity::Warning,
                DiagnosticCode::GameVersionUnsupported,
                format!(
                    "{package_id} declares support for {versions}, excluding game version {game_version}"
                ),
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
    diagnostics
}
