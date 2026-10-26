//! ByVersion precedence merge logic for About.xml metadata.

/// A versioned entry with a generic value.
#[derive(Debug, Clone)]
pub struct ByVersionEntry<T> {
    pub version_key: String,
    pub value: T,
}

/// Result of ByVersion resolution for a single field group.
#[derive(Debug, Clone)]
pub enum ByVersionResult<T> {
    /// Use the base value (no versioned match or prefer_versioned=false).
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
    fn is_empty(&self) -> bool {
        Vec::is_empty(self)
    }
}

impl IsEmpty for String {
    fn is_empty(&self) -> bool {
        String::is_empty(self)
    }
}

impl IsEmpty for Vec<crate::formats::about::raw::RawDependency> {
    fn is_empty(&self) -> bool {
        Vec::is_empty(self)
    }
}

/// Resolves a ByVersion field group.
///
/// Resolution rules:
/// 1. prefer_versioned=false → always Base.
/// 2. prefer_versioned=true && version_key matches && versioned value non-empty → Replaced.
/// 3. prefer_versioned=true && version_key matches && versioned value empty → Suppressed.
/// 4. prefer_versioned=true && no matching version_key → Base (fallback).
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
mod tests {
    use super::*;

    #[test]
    fn prefer_versioned_false_always_base() {
        let base = vec!["a".to_string()];
        let versioned = vec![ByVersionEntry {
            version_key: "v1.5".to_string(),
            value: vec!["b".to_string()],
        }];
        let result = resolve_by_version(base.clone(), &versioned, "v1.5", false);
        assert!(matches!(result, ByVersionResult::Base(ref v) if v == &base));
    }

    #[test]
    fn prefer_versioned_true_match_non_empty_replaced() {
        let base = vec!["a".to_string()];
        let versioned = vec![ByVersionEntry {
            version_key: "v1.5".to_string(),
            value: vec!["b".to_string()],
        }];
        let result = resolve_by_version(base, &versioned, "v1.5", true);
        assert!(matches!(result, ByVersionResult::Replaced(ref v) if v == &vec!["b".to_string()]));
    }

    #[test]
    fn prefer_versioned_true_match_empty_suppressed() {
        let base = vec!["a".to_string()];
        let versioned = vec![ByVersionEntry {
            version_key: "v1.5".to_string(),
            value: vec![],
        }];
        let result = resolve_by_version(base, &versioned, "v1.5", true);
        assert!(matches!(result, ByVersionResult::Suppressed));
    }

    #[test]
    fn prefer_versioned_true_no_match_base() {
        let base = vec!["a".to_string()];
        let versioned = vec![ByVersionEntry {
            version_key: "v1.4".to_string(),
            value: vec!["b".to_string()],
        }];
        let result = resolve_by_version(base.clone(), &versioned, "v1.5", true);
        assert!(matches!(result, ByVersionResult::Base(ref v) if v == &base));
    }

    #[test]
    fn multiple_entries_picks_matching_one() {
        let base = vec!["a".to_string()];
        let versioned = vec![
            ByVersionEntry {
                version_key: "v1.4".to_string(),
                value: vec!["old".to_string()],
            },
            ByVersionEntry {
                version_key: "v1.5".to_string(),
                value: vec!["new".to_string()],
            },
        ];
        let result = resolve_by_version(base, &versioned, "v1.5", true);
        assert!(
            matches!(result, ByVersionResult::Replaced(ref v) if v == &vec!["new".to_string()])
        );
    }
}
