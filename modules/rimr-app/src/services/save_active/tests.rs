use std::sync::Arc;

use super::*;
use crate::{domain::PackageId, formats::parse_mods_config};

fn ids(raw: &[&str]) -> Vec<PackageId> { raw.iter().copied().map(PackageId::new).collect() }

fn original_config(version: &str, known: &[&str]) -> ModsConfig {
    ModsConfig {
        version: Arc::from(version),
        active_mods: Vec::new(),
        known_expansions: ids(known),
    }
}

/// Built bytes contain every active mod package id.
#[test]
fn bytes_contain_active_mods() {
    let list = ActiveModList::from_slice(&ids(&["a", "b", "c"]));
    let original = original_config("1.5", &[]);
    let bytes = build_mods_config_bytes(&list, &original).expect("build should succeed");
    let text = std::str::from_utf8(&bytes).expect("bytes are utf-8");
    assert!(text.contains('a'));
    assert!(text.contains('b'));
    assert!(text.contains('c'));
}

/// The game version is preserved in the output.
#[test]
fn preserves_version() {
    let list = ActiveModList::from_slice(&ids(&["a"]));
    let original = original_config("1.5.4104 rev435", &[]);
    let bytes = build_mods_config_bytes(&list, &original).expect("build should succeed");
    let text = std::str::from_utf8(&bytes).expect("bytes are utf-8");
    assert!(text.contains("1.5.4104 rev435"));
}

/// Known expansions are preserved in the output.
#[test]
fn preserves_known_expansions() {
    let list = ActiveModList::from_slice(&ids(&["a"]));
    let original = original_config("1.5", &["x", "y"]);
    let bytes = build_mods_config_bytes(&list, &original).expect("build should succeed");
    let text = std::str::from_utf8(&bytes).expect("bytes are utf-8");
    assert!(text.contains('x'));
    assert!(text.contains('y'));
}

/// Built bytes round-trip through `parse_mods_config` with matching active mods.
#[test]
fn roundtrip_through_parse() {
    let list = ActiveModList::from_slice(&ids(&["brrainz.harmony", "ludeon.rimworld"]));
    let original = original_config("1.5.4104 rev435", &["ludeon.rimworld.royalty"]);
    let bytes = build_mods_config_bytes(&list, &original).expect("build should succeed");
    let reparsed = parse_mods_config(&bytes).expect("reparse should succeed");
    assert_eq!(reparsed.active_mods, list.to_vec());
    assert_eq!(reparsed.known_expansions, original.known_expansions);
    assert_eq!(reparsed.version, original.version);
}

/// An empty active list serializes without any `<li>` entries.
#[test]
fn empty_list_serializes() {
    let list = ActiveModList::empty();
    let original = original_config("1.5", &[]);
    let bytes = build_mods_config_bytes(&list, &original).expect("build should succeed");
    let reparsed = parse_mods_config(&bytes).expect("reparse should succeed");
    assert_eq!(reparsed.active_mods, [] as [rimr_core::PackageId; 0]);
}
