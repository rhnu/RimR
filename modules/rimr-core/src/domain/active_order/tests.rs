use super::*;

fn assert_order(list: &ActiveModList, expected: &[&PackageId]) {
    let actual: Vec<&str> = list.iter().map(PackageId::as_str).collect();
    let want: Vec<&str> = expected.iter().map(|p| p.as_str()).collect();
    assert_eq!(actual, want);
}

#[test]
fn from_slice_assigns_positions() {
    let a = PackageId::new("a");
    let b = PackageId::new("b");
    let c = PackageId::new("c");
    let list = ActiveModList::from_slice(&[a.clone(), b.clone(), c.clone()]);
    assert_eq!(list.position(&a), Some(0));
    assert_eq!(list.position(&b), Some(1));
    assert_eq!(list.position(&c), Some(2));
}

#[test]
fn append_existing_is_noop() {
    let a = PackageId::new("a");
    let b = PackageId::new("b");
    let c = PackageId::new("c");
    let mut list = ActiveModList::from_slice(&[a.clone(), b.clone(), c.clone()]);
    list.append(a.clone());
    assert_eq!(list.len(), 3);
    assert_order(&list, &[&a, &b, &c]);
}

#[test]
fn position_unknown_returns_none() {
    let a = PackageId::new("a");
    let b = PackageId::new("b");
    let c = PackageId::new("c");
    let list = ActiveModList::from_slice(&[a, b, c]);
    let z = PackageId::new("z");
    assert_eq!(list.position(&z), None);
}

#[test]
fn empty_and_len() {
    let empty = ActiveModList::empty();
    assert!(empty.is_empty());
    assert_eq!(empty.len(), 0);
    let a = PackageId::new("a");
    let b = PackageId::new("b");
    let c = PackageId::new("c");
    let list = ActiveModList::from_slice(&[a, b, c]);
    assert!(!list.is_empty());
    assert_eq!(list.len(), 3);
}

#[test]
fn replace_all_rebuilds_index() {
    let x = PackageId::new("x");
    let y = PackageId::new("y");
    let z = PackageId::new("z");
    let mut list = ActiveModList::empty();
    list.replace_all(vec![x.clone(), y.clone(), z.clone()]);
    assert_eq!(list.position(&x), Some(0));
    assert_eq!(list.position(&y), Some(1));
    assert_eq!(list.position(&z), Some(2));
    assert_order(&list, &[&x, &y, &z]);
}

#[test]
fn replace_all_deduplicates_like_append() {
    let a = PackageId::new("a");
    let b = PackageId::new("b");
    let c = PackageId::new("c");
    let mut list = ActiveModList::empty();
    list.replace_all(vec![a.clone(), b.clone(), a.clone(), c.clone(), b.clone()]);
    assert_order(&list, &[&a, &b, &c]);
    assert_eq!(list.position(&a), Some(0));
    assert_eq!(list.position(&b), Some(1));
    assert_eq!(list.position(&c), Some(2));
}
