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
    assert!(matches!(result, ByVersionResult::Replaced(ref v) if v == &vec!["new".to_string()]));
}
