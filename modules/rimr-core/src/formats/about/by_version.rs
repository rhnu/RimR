//! `ByVersion` precedence merge logic for About.xml metadata.

/// A versioned entry with a generic value.
#[derive(Debug, Clone)]
pub struct ByVersionEntry<T> {
    pub version_key: String,
    pub value: T,
}

/// Result of `ByVersion` resolution for a single field group.
#[derive(Debug, Clone)]
pub enum ByVersionResult<T> {
    /// Use the base value (no versioned match or `prefer_versioned=false`).
    Base(T),
    /// Replace base with versioned value.
    Replaced(T),
    /// Versioned match found but empty — suppress base.
    Suppressed,
}

/// Trait to check if a value is empty (for suppression logic).
pub trait IsEmpty {
    fn is_empty(&self) -> bool;
}

impl IsEmpty for Vec<String> {
    fn is_empty(&self) -> bool { Self::is_empty(self) }
}

impl IsEmpty for String {
    fn is_empty(&self) -> bool { Self::is_empty(self) }
}

impl IsEmpty for Vec<crate::formats::about::raw::RawDependency> {
    fn is_empty(&self) -> bool { Self::is_empty(self) }
}

/// Resolves a `ByVersion` field group.
///
/// Resolution rules:
/// 1. `prefer_versioned=false` → always Base.
/// 2. `prefer_versioned=true` && `version_key` matches && versioned value non-empty → Replaced.
/// 3. `prefer_versioned=true` && `version_key` matches && versioned value empty → Suppressed.
/// 4. `prefer_versioned=true` && no matching `version_key` → Base (fallback).
pub fn resolve_by_version<T>(
    base: T,
    versioned_entries: &[ByVersionEntry<T>],
    target_key: &str,
    prefer_versioned: bool,
) -> ByVersionResult<T>
where
    T: Clone + IsEmpty,
{
    if !prefer_versioned {
        return ByVersionResult::Base(base);
    }
    for entry in versioned_entries {
        if entry.version_key == target_key {
            if entry.value.is_empty() {
                return ByVersionResult::Suppressed;
            }
            return ByVersionResult::Replaced(entry.value.clone());
        }
    }
    ByVersionResult::Base(base)
}

#[cfg(test)]
mod tests;
