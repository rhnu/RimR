use super::*;
use crate::{DiagnosticLocation, ModSourceKey, PackageId, Severity};

fn relation(from: &str, to: &str) -> Diagnostic {
    Diagnostic::new(
        Severity::Warning,
        DiagnosticCode::DependencyMissing,
        "display",
    )
    .with_related_packages(vec![PackageId::new(from), PackageId::new(to)])
    .with_suppression_identity(
        DiagnosticIdentity::new()
            .with_field("from", from)
            .with_field("to", to),
    )
}

#[test]
fn identity_preserves_relation_roles_and_ignores_display_and_installation_changes() {
    let original = relation("a", "b").suppression().unwrap();
    let mut updated = relation("a", "b")
        .with_param("description", "changed")
        .with_location(DiagnosticLocation::about_xml(
            &ModSourceKey::new("moved"),
            "changed",
        ));
    updated.message = "translated text".into();
    assert_eq!(original.key, updated.suppression().unwrap().key);
    assert_ne!(original.key, relation("b", "a").suppression().unwrap().key);
    assert_ne!(original.key, relation("a", "c").suppression().unwrap().key);
    assert!(original.is_valid());
    assert_eq!(original.source_keys, Vec::<String>::new());
}

#[test]
fn game_hotfixes_share_identity_but_next_minor_and_unknown_do_not() {
    let identity = |version| {
        Diagnostic::new(
            Severity::Warning,
            DiagnosticCode::GameVersionUnsupported,
            "version",
        )
        .with_related_packages(vec![PackageId::new("a")])
        .with_suppression_identity(
            DiagnosticIdentity::new()
                .with_field("packageId", "a")
                .with_game_version(&GameVersion::parse(version)),
        )
        .suppression()
        .unwrap()
    };
    let original = identity("1.7.100");
    assert_eq!(original.game_version.as_deref(), Some("1.7"));
    assert_eq!(original.key, identity("1.7.200 rev4").key);
    assert_ne!(original.key, identity("1.8").key);
    assert_ne!(original.key, identity("Unknown").key);
}

#[test]
fn source_sets_are_canonical_and_new_copies_produce_new_identity() {
    let descriptor = |sources: &[&str]| {
        Diagnostic::new(Severity::Error, DiagnosticCode::XmlMalformed, "parse")
            .with_suppression_identity(
                DiagnosticIdentity::new()
                    .with_sources(sources.iter().map(|source| (*source).to_string())),
            )
            .suppression()
            .unwrap()
    };
    let original = descriptor(&["local/a", "workshop/a"]);
    assert!(original.is_valid());
    assert_eq!(
        original.key,
        descriptor(&["workshop/a", "local/a", "local/a"]).key
    );
    assert_ne!(original.key, descriptor(&["local/a"]).key);
    assert_ne!(
        original.key,
        descriptor(&["local/a", "workshop/a", "third/a"]).key
    );
}

#[test]
fn nested_sequences_cannot_collide_on_delimiters() {
    let key = |values: &[&str]| {
        relation("a", "b")
            .with_suppression_identity(DiagnosticIdentity::new().with_list(
                "alternatives",
                values.iter().map(|value| (*value).to_string()),
            ))
            .suppression()
            .unwrap()
            .key
    };
    assert_ne!(key(&["x,y", "z"]), key(&["x", "y,z"]));
    assert_ne!(key(&["a -> b", "c"]), key(&["a", "b -> c"]));
}

#[test]
fn corrupt_keys_and_mismatched_descriptor_context_are_rejected() {
    let original = relation("a", "b").suppression().unwrap();
    for key in ["v1:", "v1:999:missing", "v1:1:é", "arbitrary"] {
        let mut invalid = original.clone();
        invalid.key = key.to_string();
        assert!(!invalid.is_valid());
    }
    let mut invalid = original.clone();
    invalid.key.push_str("trailing");
    assert!(!invalid.is_valid());
    invalid = original.clone();
    invalid.code = DiagnosticCode::DependencyInactive;
    assert!(!invalid.is_valid());
    invalid = original.clone();
    invalid.game_version = Some("1.8".into());
    assert!(!invalid.is_valid());
    invalid = original.clone();
    invalid.source_keys.push("another-copy".into());
    assert!(!invalid.is_valid());
    invalid = original;
    invalid.related_packages = vec!["another.mod".into()];
    assert!(!invalid.is_valid());
}

#[test]
fn global_diagnostics_have_no_suppression_capability() {
    let diagnostic = Diagnostic::new(
        Severity::Warning,
        DiagnosticCode::GameVersionUnknown,
        "unknown",
    );
    assert!(diagnostic.suppression().is_none());
}
