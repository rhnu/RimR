use rimr_core::{EntryId, ModIdentity, ModListEntry};

use super::*;

fn snapshot() -> LibrarySnapshot {
    let mut snapshot = LibrarySnapshot::default();
    create_mod_list(&mut snapshot, "First".into(), None, None);
    snapshot
}

#[test]
fn stale_save_does_not_replace_the_current_list() {
    let mut snapshot = snapshot();
    let stale = snapshot.mod_lists[0].clone();
    let mut updated = stale.clone();
    updated.name = "Updated".into();
    let saved = save_mod_list(&mut snapshot, updated).unwrap();
    assert_eq!(saved.revision, 1);
    let error = save_mod_list(&mut snapshot, stale).unwrap_err();
    assert_eq!(error.code, AppErrorCode::Conflict);
    assert_eq!(snapshot.mod_lists[0].name, "Updated");
}

#[test]
fn selecting_another_list_preserves_independent_revisions() {
    let mut snapshot = snapshot();
    let first = snapshot.mod_lists[0].clone();
    let second = create_mod_list(&mut snapshot, "Second".into(), None, None);
    set_current_mod_list(&mut snapshot, first.id).unwrap();
    save_mod_list(&mut snapshot, second).unwrap();
    assert_eq!(snapshot.mod_lists[0].revision, 0);
    assert_eq!(snapshot.settings.revision, 0);
}

#[test]
fn malformed_candidate_is_rejected_without_changing_saved_input() {
    let mut original = snapshot();
    original.mod_lists[0].entries = vec![ModListEntry::Mod {
        id: EntryId::new(),
        active: true,
        identity: ModIdentity {
            package_id: "test.mod".into(),
            source_kind: None,
            source_key: None,
            steam_app_id: None,
        },
    }];
    let mut candidate = original.clone();
    let duplicate = candidate.mod_lists[0].entries[0].clone();
    candidate.mod_lists[0].entries.push(duplicate);
    assert!(candidate.validate().is_err());
    assert!(original.validate().is_ok());
    assert_eq!(original.mod_lists[0].entries.len(), 1);
}
