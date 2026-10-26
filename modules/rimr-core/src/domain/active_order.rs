//! Read-oriented view of an ordered set of active mod package ids.
//!
//! Reordering is a UI concern and happens in the frontend mod list reducer;
//! this type exists so the core can build an order once from `ModsConfig.xml`
//! or a mod list and then answer membership and position queries while
//! validating. It deliberately exposes no reordering operations.

use crate::domain::PackageId;
use indexmap::IndexMap;

/// An ordered set of active mod package ids.
///
/// The order is authoritative (user-controlled). Position and membership
/// lookups are O(1) via an internal reverse index maintained on append.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActiveModList {
    order: Vec<PackageId>,
    index: IndexMap<PackageId, usize>,
}

impl ActiveModList {
    /// Creates an empty list.
    pub fn empty() -> Self {
        Self {
            order: Vec::new(),
            index: IndexMap::new(),
        }
    }

    /// Creates a list from an ordered slice of package ids.
    /// Duplicate ids in the input are ignored after their first occurrence.
    pub fn from_slice(ids: &[PackageId]) -> Self {
        let mut list = Self::empty();
        for id in ids {
            list.append(id.clone());
        }
        list
    }

    /// Appends a package id to the end. No-op if already present.
    pub fn append(&mut self, id: PackageId) {
        if self.index.contains_key(&id) {
            return;
        }
        let pos = self.order.len();
        self.order.push(id.clone());
        self.index.insert(id, pos);
    }

    /// Returns the position of a package id, or None.
    pub fn position(&self, id: &PackageId) -> Option<usize> {
        self.index.get(id).copied()
    }

    pub fn contains(&self, id: &PackageId) -> bool {
        self.index.contains_key(id)
    }

    pub fn len(&self) -> usize {
        self.order.len()
    }

    pub fn is_empty(&self) -> bool {
        self.order.is_empty()
    }

    pub fn iter(&self) -> impl Iterator<Item = &PackageId> {
        self.order.iter()
    }

    pub fn as_slice(&self) -> &[PackageId] {
        &self.order
    }

    /// Returns a vector of package ids in order.
    pub fn to_vec(&self) -> Vec<PackageId> {
        self.order.clone()
    }

    /// Replaces the entire order. Duplicate ids are ignored after their first occurrence.
    pub fn replace_all(&mut self, ids: Vec<PackageId>) {
        self.order.clear();
        self.index.clear();
        for id in ids {
            self.append(id);
        }
    }
}

impl Default for ActiveModList {
    fn default() -> Self {
        Self::empty()
    }
}

#[cfg(test)]
mod tests {
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
}
