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
            },
            Component::CurDir => {},
            Component::ParentDir => {
                current.pop();
            },
            Component::Prefix(_) | Component::RootDir => return None,
        }
    }
    Some(current)
}

#[cfg(test)]
mod tests;
