//! Hard runtime dependency declared in `modDependencies`.

use crate::domain::PackageId;
use std::sync::Arc;

/// A single hard runtime dependency declared in `modDependencies`.
#[derive(Debug, Clone)]
pub struct Dependency {
    pub package_id: PackageId,
    pub display_name: Option<Arc<str>>,
    pub steam_workshop_url: Option<Arc<str>>,
    pub download_url: Option<Arc<str>>,
    pub alternative_package_ids: Vec<PackageId>,
}

impl Dependency {
    /// Creates a minimal dependency with only a package id.
    pub fn from_id(package_id: PackageId) -> Self {
        Self {
            package_id,
            display_name: None,
            steam_workshop_url: None,
            download_url: None,
            alternative_package_ids: Vec::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn from_id_minimal() {
        let d = Dependency::from_id(PackageId::new("dep.x"));
        assert_eq!(d.package_id, PackageId::new("dep.x"));
        assert!(d.display_name.is_none());
        assert!(d.steam_workshop_url.is_none());
        assert!(d.download_url.is_none());
        assert!(d.alternative_package_ids.is_empty());
    }
}
