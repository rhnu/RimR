use tempfile::tempdir;

use super::*;

#[test]
fn resolves_through_mixed_case_components() {
    let dir = tempdir().unwrap();
    std::fs::create_dir_all(dir.path().join("About")).unwrap();
    std::fs::write(dir.path().join("About/About.xml"), b"x").unwrap();

    let found = resolve_path_case_insensitive(dir.path(), Path::new("about/about.XML")).unwrap();
    assert_eq!(found, dir.path().join("About/About.xml"));
}

#[test]
fn returns_none_for_missing_component() {
    let dir = tempdir().unwrap();
    assert!(resolve_path_case_insensitive(dir.path(), Path::new("About/Missing.xml")).is_none());
}

#[test]
fn rejects_absolute_relative() {
    let dir = tempdir().unwrap();
    let abs = if cfg!(windows) {
        Path::new("C:/anything")
    } else {
        Path::new("/anything")
    };
    assert!(resolve_path_case_insensitive(dir.path(), abs).is_none());
}

#[test]
fn checked_resolution_distinguishes_missing_from_io_failure() {
    let dir = tempdir().unwrap();
    assert!(
        resolve_path_case_insensitive_checked(dir.path(), Path::new("About/About.xml"))
            .unwrap()
            .is_none()
    );

    std::fs::write(dir.path().join("About"), b"not a directory").unwrap();
    assert!(
        resolve_path_case_insensitive_checked(dir.path(), Path::new("About/About.xml")).is_err()
    );
}
