//! Read-oriented view of an ordered set of active mod package ids.
//!
//! Reordering is a UI concern and happens in the frontend mod list reducer;
//! this type exists so the core can build an order once from `ModsConfig.xml`
//! or a mod list and then answer membership and position queries while
//! validating. It deliberately exposes no reordering operations.

use indexmap::IndexMap;

use crate::domain::PackageId;

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
    pub fn position(&self, id: &PackageId) -> Option<usize> { self.index.get(id).copied() }

    pub fn contains(&self, id: &PackageId) -> bool { self.index.contains_key(id) }

    pub fn len(&self) -> usize { self.order.len() }

    pub fn is_empty(&self) -> bool { self.order.is_empty() }

    pub fn iter(&self) -> impl Iterator<Item = &PackageId> { self.order.iter() }

    pub fn as_slice(&self) -> &[PackageId] { &self.order }

    /// Returns a vector of package ids in order.
    pub fn to_vec(&self) -> Vec<PackageId> { self.order.clone() }

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
    fn default() -> Self { Self::empty() }
}

#[cfg(test)]
mod tests;
