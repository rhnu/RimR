use std::path::{Component, Path, PathBuf};

fn find_case_insensitive_child(parent: &Path, wanted: &str) -> std::io::Result<Option<PathBuf>> {
    let entries = match std::fs::read_dir(parent) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error),
    };
    for entry in entries {
        let entry = entry?;
        if entry
            .file_name()
            .to_string_lossy()
            .eq_ignore_ascii_case(wanted)
        {
            return Ok(Some(entry.path()));
        }
    }
    Ok(None)
}

/// Resolves optional preview assets on a best-effort basis.
pub fn resolve_path_case_insensitive(base: &Path, relative: &Path) -> Option<PathBuf> {
    resolve_path_case_insensitive_checked(base, relative)
        .ok()
        .flatten()
}

/// Resolves a path without treating inaccessible directories as missing components.
pub fn resolve_path_case_insensitive_checked(
    base: &Path,
    relative: &Path,
) -> std::io::Result<Option<PathBuf>> {
    let mut current = base.to_path_buf();
    for component in relative.components() {
        match component {
            Component::Normal(name) => {
                let Some(name) = name.to_str() else {
                    return Ok(None);
                };
                let Some(child) = find_case_insensitive_child(&current, name)? else {
                    return Ok(None);
                };
                current = child;
            },
            Component::CurDir => {},
            Component::ParentDir => {
                current.pop();
            },
            Component::Prefix(_) | Component::RootDir => return Ok(None),
        }
    }
    Ok(Some(current))
}

#[cfg(test)]
mod tests;
