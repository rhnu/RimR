use super::*;
use crate::ports::{ModSourceKey, SourceKind};

#[test]
fn invalid_metadata_uses_sentinel() {
    let m = ModMetadata::invalid(ModSourceKey::new("k"), SourceKind::Local);
    assert!(!m.valid);
    assert!(m.package_id.is_sentinel());
    assert_eq!(m.authors, [] as [std::sync::Arc<str>; 0]);
    assert_eq!(m.supported_versions, [] as [crate::GameVersion; 0]);
    assert!(m.rules.mod_dependencies.is_empty());
}
