//! Catalog of installed mods indexed by `PackageId`.

use std::sync::Arc;

use indexmap::IndexMap;

use crate::{
    domain::{ModMetadata, PackageId},
    ports::ModSourceKey,
};

/// Result of inserting into a `ModCatalog`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CatalogInsertResult {
    /// Inserted as a new entry.
    Inserted,
    /// A mod with the same packageId already existed; the first entry is kept
    /// and the packageId is recorded as a duplicate.
    Duplicate,
}

/// A packageId installed more than once, with every source it was found at.
///
/// `source_keys` is in discovery order, so the first element is always the
/// copy the catalog treats as primary — the one the game will actually load.
/// The rest are shadowed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DuplicatePackageId {
    pub package_id: PackageId,
    pub source_keys: Vec<ModSourceKey>,
}

impl DuplicatePackageId {
    /// The copy that wins: the first one discovered.
    pub fn effective_source_key(&self) -> &ModSourceKey { &self.source_keys[0] }

    /// The copies that lose to [`Self::effective_source_key`].
    pub fn shadowed_source_keys(&self) -> &[ModSourceKey] { &self.source_keys[1..] }
}

/// All installed mods indexed by `PackageId`.
///
/// Every discovered mod — including duplicates — is stored once behind an
/// `Arc` and addressed through two indices, so a mod installed in both the
/// Workshop and the local folder is not cloned per index:
///
/// - `primary` resolves a packageId to the first entry inserted for it, which
///   is the one that participates in ordering and validation.
/// - `by_source_key` resolves every entry, including the shadowed duplicates,
///   so the UI can still inspect and act on the copy the user is looking at.
#[derive(Debug, Clone, Default)]
pub struct ModCatalog {
    entries: Vec<Arc<ModMetadata>>,
    primary: IndexMap<CatalogStorageKey, usize>,
    by_source_key: IndexMap<ModSourceKey, usize>,
    duplicates: Vec<DuplicatePackageId>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
enum CatalogStorageKey {
    Package(PackageId),
    Source(Arc<str>),
}

impl CatalogStorageKey {
    fn for_metadata(metadata: &ModMetadata) -> Self {
        if metadata.package_id.is_sentinel() {
            Self::Source(Arc::from(metadata.source_key.as_str()))
        } else {
            Self::Package(metadata.package_id.clone())
        }
    }

    fn for_package(package_id: &PackageId) -> Self { Self::Package(package_id.clone()) }
}

impl ModCatalog {
    pub fn new() -> Self { Self::default() }

    /// Inserts a mod. If the packageId already exists, the existing entry stays
    /// primary, the packageId is recorded as a duplicate, and
    /// `CatalogInsertResult::Duplicate` is returned. The new entry is still
    /// stored and remains reachable via [`Self::get_by_source_key`].
    ///
    /// Sentinel package IDs (missing/invalid) are exempt from duplicate
    /// tracking — each missing-packageId mod is an independent error, not a
    /// duplicate of other missing-packageId mods.
    pub fn insert(&mut self, metadata: ModMetadata) -> CatalogInsertResult {
        let storage_key = CatalogStorageKey::for_metadata(&metadata);
        let source_key = metadata.source_key.clone();
        let package_id = metadata.package_id.clone();

        let position = self.entries.len();
        self.entries.push(Arc::new(metadata));
        self.by_source_key.insert(source_key.clone(), position);

        let Some(&primary) = self.primary.get(&storage_key) else {
            self.primary.insert(storage_key, position);
            return CatalogInsertResult::Inserted;
        };
        if !package_id.is_sentinel() {
            self.record_duplicate(
                package_id,
                &self.entries[primary].source_key.clone(),
                source_key,
            );
        }
        CatalogInsertResult::Duplicate
    }

    fn record_duplicate(
        &mut self,
        package_id: PackageId,
        primary_source_key: &ModSourceKey,
        source_key: ModSourceKey,
    ) {
        match self
            .duplicates
            .iter_mut()
            .find(|duplicate| duplicate.package_id == package_id)
        {
            Some(duplicate) => {
                if !duplicate.source_keys.contains(&source_key) {
                    duplicate.source_keys.push(source_key);
                }
            },
            None => self.duplicates.push(DuplicatePackageId {
                package_id,
                source_keys: vec![primary_source_key.clone(), source_key],
            }),
        }
    }

    /// Returns the primary entry for a packageId.
    ///
    /// Sentinel (missing packageId) mods are addressable only by source key.
    pub fn get(&self, id: &PackageId) -> Option<&ModMetadata> {
        if id.is_sentinel() {
            return None;
        }
        self.primary
            .get(&CatalogStorageKey::for_package(id))
            .map(|&position| self.entries[position].as_ref())
    }

    /// Returns any entry — primary or shadowed duplicate — by source key.
    pub fn get_by_source_key(&self, source_key: &ModSourceKey) -> Option<&ModMetadata> {
        self.by_source_key
            .get(source_key)
            .map(|&position| self.entries[position].as_ref())
    }

    pub fn contains(&self, id: &PackageId) -> bool {
        !id.is_sentinel()
            && self
                .primary
                .contains_key(&CatalogStorageKey::for_package(id))
    }

    /// Number of primary entries: what the user sees as one mod each.
    pub fn len(&self) -> usize { self.primary.len() }

    pub fn is_empty(&self) -> bool { self.primary.is_empty() }

    /// Iterates the primary entries in discovery order.
    pub fn iter(&self) -> impl Iterator<Item = (&PackageId, &ModMetadata)> {
        self.primary
            .values()
            .map(|&position| self.entries[position].as_ref())
            .map(|metadata| (&metadata.package_id, metadata))
    }

    pub fn package_ids(&self) -> impl Iterator<Item = &PackageId> {
        self.iter().map(|(package_id, _)| package_id)
    }

    /// Every packageId that was found at more than one source, with all of the
    /// sources it was found at.
    pub fn duplicate_variants(&self) -> &[DuplicatePackageId] { &self.duplicates }

    /// The duplicated packageIds alone.
    pub fn duplicates(&self) -> impl Iterator<Item = &PackageId> {
        self.duplicates.iter().map(|entry| &entry.package_id)
    }

    pub fn has_duplicates(&self) -> bool { !self.duplicates.is_empty() }
}

#[cfg(test)]
mod tests;
