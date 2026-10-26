use super::*;

#[test]
fn from_id_minimal() {
    let d = Dependency::from_id(PackageId::new("dep.x"));
    assert_eq!(d.package_id, PackageId::new("dep.x"));
    assert!(d.display_name.is_none());
    assert!(d.steam_workshop_url.is_none());
    assert!(d.download_url.is_none());
    assert_eq!(d.alternative_package_ids, [] as [crate::PackageId; 0]);
}
