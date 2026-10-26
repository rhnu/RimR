//! Loads the active mod list from the game's `ModsConfig.xml`.

use std::sync::Arc;

use crate::{
    diagnostics::{Diagnostic, DiagnosticCode, DiagnosticIdentity, DiagnosticLocation, Severity},
    domain::{ActiveModList, ModCatalog, PackageId},
    error::{AppError, AppErrorCode, AppResult},
    formats::{ModsConfig, parse_mods_config},
    ports::ModSource,
};

/// Result of loading the active mod list.
#[derive(Debug, Clone)]
pub struct ActiveLoadResult {
    /// The active mod list in load order.
    pub list: ActiveModList,
    /// The parsed `ModsConfig.xml` content (version + known expansions preserved).
    pub config: ModsConfig,
    /// Package ids present in the config but not in the catalog (when a
    /// catalog was supplied).
    pub missing: Vec<PackageId>,
    /// Diagnostics for missing mods.
    pub diagnostics: Vec<Diagnostic>,
}

/// Loads the active mod list from the game's `ModsConfig.xml` via the source.
///
/// When `catalog` is `Some`, package ids in the config but not installed are
/// reported as `ConfigModMissing` warnings in `diagnostics` and collected in
/// `missing`. When `catalog` is `None`, no missing-mod analysis is performed.
/// # Errors
///
/// Returns a source error if reading fails, or an invalid-config error if the file is missing or malformed.
pub async fn load_active_list(
    source: &dyn ModSource,
    catalog: Option<&ModCatalog>,
) -> AppResult<ActiveLoadResult> {
    tracing::info!("loading active mod list");
    let (config, file) = load_mods_config(source).await?;
    let list = ActiveModList::from_slice(&config.active_mods);

    let mut missing = Vec::new();
    let mut diagnostics = Vec::new();

    if let Some(cat) = catalog {
        for (index, pkg) in config.active_mods.iter().enumerate() {
            if !cat.contains(pkg) {
                missing.push(pkg.clone());
                diagnostics.push(
                    Diagnostic::new(
                        Severity::Warning,
                        DiagnosticCode::ConfigModMissing,
                        format!("Mod in config but not installed: {pkg}"),
                    )
                    .with_location(DiagnosticLocation {
                        source_key: file.source_key.clone(),
                        path: Arc::clone(&file.path),
                        xml_path: Some(Arc::from(format!(
                            "/ModsConfigData/activeMods/li[{}]",
                            index + 1
                        ))),
                        line: None,
                        col: None,
                        byte_offset: None,
                    })
                    .with_suppression_identity(
                        DiagnosticIdentity::new().with_field("packageId", pkg.as_str()),
                    )
                    .with_param("packageId", pkg.as_str())
                    .with_related_packages(vec![pkg.clone()]),
                );
            }
        }
    }

    tracing::info!(
        active_mods = list.len(),
        missing = missing.len(),
        diagnostics = diagnostics.len(),
        "active mod list loaded"
    );
    Ok(ActiveLoadResult {
        list,
        config,
        missing,
        diagnostics,
    })
}

pub(super) async fn load_mods_config(
    source: &dyn ModSource,
) -> AppResult<(ModsConfig, crate::ports::SourceFile)> {
    let file = source.read_mods_config().await?;
    let Some(file) = file else {
        return Err(AppError::new(
            AppErrorCode::ModsConfigInvalid,
            "ModsConfig.xml not found",
        ));
    };

    let config = parse_mods_config(&file.bytes)?;
    Ok((config, file))
}

#[cfg(test)]
mod tests;
