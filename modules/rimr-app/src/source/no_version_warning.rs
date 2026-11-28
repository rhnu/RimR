//! Locates the version list in the installed No Version Warning mod.

use std::{io::ErrorKind, path::Path};

use rimr_core::{GameVersion, ModCatalog, NoVersionWarning, PackageId, SourceFile, SourceKind};

/// Reads the current version's list from the same installed copy selected by the catalog.
pub(crate) async fn load_no_version_warning(
    catalog: &ModCatalog,
    version: &GameVersion,
) -> Option<NoVersionWarning> {
    if version.major() == 0 {
        return None;
    }
    let metadata = catalog.get(&PackageId::new("mlie.noversionwarning"))?;
    if !metadata.valid || metadata.source_kind == SourceKind::Expansion {
        return None;
    }

    let path = Path::new(metadata.source_key.as_str())
        .join(format!("{}.{}", version.major(), version.minor()))
        .join("ModIdsToFix.xml");
    let bytes = match tokio::fs::read(&path).await {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == ErrorKind::NotFound => return None,
        Err(error) => {
            tracing::warn!(?path, ?error, "reading No Version Warning list failed");
            return None;
        },
    };
    let file = SourceFile::new(
        Some(metadata.source_key.clone()),
        path.to_string_lossy().into_owned(),
        bytes,
    );
    match NoVersionWarning::parse(&file) {
        Ok(list) => {
            tracing::debug!(?path, "loaded No Version Warning list");
            Some(list)
        },
        Err(error) => {
            tracing::warn!(?path, ?error, "parsing No Version Warning list failed");
            None
        },
    }
}
