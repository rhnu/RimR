use std::path::{Component, Path, PathBuf};

pub fn find_case_insensitive_child(parent: &Path, wanted: &str) -> Option<PathBuf> {
    let entries = std::fs::read_dir(parent).ok()?;
    for entry in entries.filter_map(Result::ok) {
        if entry
            .file_name()
            .to_string_lossy()
            .eq_ignore_ascii_case(wanted)
        {
            return Some(entry.path());
        }
    }
    None
}

pub fn resolve_path_case_insensitive(base: &Path, relative: &Path) -> Option<PathBuf> {
    let mut current = base.to_path_buf();
    for component in relative.components() {
        match component {
            Component::Normal(name) => {
                let name = name.to_str()?;
                current = find_case_insensitive_child(&current, name)?;
            }
            Component::CurDir => {}
            Component::ParentDir => {
                current.pop();
            }
            Component::Prefix(_) | Component::RootDir => return None,
        }
    }
    Some(current)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn resolves_through_mixed_case_components() {
        let dir = tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("About")).unwrap();
        std::fs::write(dir.path().join("About/About.xml"), b"x").unwrap();

        let found =
            resolve_path_case_insensitive(dir.path(), Path::new("about/about.XML")).unwrap();
        assert_eq!(found, dir.path().join("About/About.xml"));
    }

    #[test]
    fn returns_none_for_missing_component() {
        let dir = tempdir().unwrap();
        assert!(
            resolve_path_case_insensitive(dir.path(), Path::new("About/Missing.xml")).is_none()
        );
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
}
