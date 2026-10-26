//! Catalog of installed mods indexed by PackageId.

use crate::domain::{ModMetadata, PackageId};
use crate::ports::ModSourceKey;
use indexmap::IndexMap;
use std::sync::Arc;

/// Result of inserting into a ModCatalog.
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
    pub fn effective_source_key(&self) -> &ModSourceKey {
        &self.source_keys[0]
    }

    /// The copies that lose to [`Self::effective_source_key`].
    pub fn shadowed_source_keys(&self) -> &[ModSourceKey] {
        &self.source_keys[1..]
    }
}

/// All installed mods indexed by PackageId.
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

    fn for_package(package_id: &PackageId) -> Self {
        Self::Package(package_id.clone())
    }
}

impl ModCatalog {
    pub fn new() -> Self {
        Self::default()
    }

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
            }
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
    pub fn len(&self) -> usize {
        self.primary.len()
    }

    pub fn is_empty(&self) -> bool {
        self.primary.is_empty()
    }

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
    pub fn duplicate_variants(&self) -> &[DuplicatePackageId] {
        &self.duplicates
    }

    /// The duplicated packageIds alone.
    pub fn duplicates(&self) -> impl Iterator<Item = &PackageId> {
        self.duplicates.iter().map(|entry| &entry.package_id)
    }

    pub fn has_duplicates(&self) -> bool {
        !self.duplicates.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::{CatalogInsertResult, ModCatalog};
    use crate::domain::{ModMetadata, PackageId, Rules};
    use crate::ports::{ModSourceKey, SourceKind};

    fn meta(id: &str, key: &str) -> ModMetadata {
        ModMetadata {
            source_key: ModSourceKey::new(key),
            source_kind: SourceKind::Local,
            package_id: PackageId::new(id),
            name: None,
            authors: Vec::new(),
            supported_versions: Vec::new(),
            description: None,
            mod_version: None,
            url: None,
            mod_icon_path: None,
            steam_app_id: None,
            has_assemblies: false,
            rules: Rules::default(),
            valid: false,
            data_malformed: false,
        }
    }

    #[test]
    fn insert_distinct_mods() {
        let mut cat = ModCatalog::new();
        assert_eq!(cat.insert(meta("a", "ka")), CatalogInsertResult::Inserted);
        assert_eq!(cat.insert(meta("b", "kb")), CatalogInsertResult::Inserted);
        assert_eq!(cat.insert(meta("c", "kc")), CatalogInsertResult::Inserted);
        assert_eq!(cat.len(), 3);
        assert!(!cat.has_duplicates());
        assert_eq!(cat.duplicates().count(), 0);
    }

    #[test]
    fn insert_duplicate_keeps_first() {
        let mut cat = ModCatalog::new();
        cat.insert(meta("foo", "first"));
        assert_eq!(
            cat.insert(meta("foo", "second")),
            CatalogInsertResult::Duplicate
        );
        assert_eq!(cat.duplicates().count(), 1);
        let got = cat.get(&PackageId::new("foo")).unwrap();
        assert_eq!(got.source_key.as_str(), "first");
    }

    #[test]
    fn contains_and_get() {
        let mut cat = ModCatalog::new();
        cat.insert(meta("x", "kx"));
        assert!(cat.contains(&PackageId::new("x")));
        assert!(!cat.contains(&PackageId::new("y")));
        assert!(cat.get(&PackageId::new("x")).is_some());
        assert!(cat.get(&PackageId::new("y")).is_none());
    }

    #[test]
    fn iter_and_package_ids() {
        let mut cat = ModCatalog::new();
        cat.insert(meta("a", "ka"));
        cat.insert(meta("b", "kb"));
        let ids: Vec<&str> = cat.package_ids().map(PackageId::as_str).collect();
        assert_eq!(ids, vec!["a", "b"]);
        let pairs: Vec<&str> = cat.iter().map(|(_, m)| m.source_key.as_str()).collect();
        assert_eq!(pairs, vec!["ka", "kb"]);
    }

    #[test]
    fn has_duplicates_true_after_duplicate() {
        let mut cat = ModCatalog::new();
        cat.insert(meta("d", "kd"));
        cat.insert(meta("d", "kd2"));
        assert!(cat.has_duplicates());
        assert_eq!(
            cat.duplicates().cloned().collect::<Vec<_>>(),
            vec![PackageId::new("d")]
        );
    }

    #[test]
    fn sentinel_package_ids_do_not_create_duplicates() {
        let mut cat = ModCatalog::new();
        assert_eq!(cat.insert(meta("", "ka")), CatalogInsertResult::Inserted);
        assert_eq!(cat.insert(meta("", "kb")), CatalogInsertResult::Inserted);
        assert_eq!(cat.insert(meta("   ", "kc")), CatalogInsertResult::Inserted);
        assert_eq!(cat.len(), 3);
        assert!(
            cat.get(&PackageId::missing()).is_none(),
            "sentinel entries are source-key addressable only"
        );
        assert!(!cat.has_duplicates());
        assert_eq!(cat.duplicates().count(), 0);
        assert!(cat.duplicate_variants().is_empty());
        assert_eq!(
            cat.get_by_source_key(&ModSourceKey::new("ka"))
                .expect("first sentinel source key should resolve")
                .source_key
                .as_str(),
            "ka"
        );
        assert_eq!(
            cat.get_by_source_key(&ModSourceKey::new("kb"))
                .expect("second sentinel source key should resolve")
                .source_key
                .as_str(),
            "kb"
        );
    }

    #[test]
    fn source_key_lookup_includes_primary_and_duplicate_variants() {
        let mut cat = ModCatalog::new();
        cat.insert(meta("foo", "first"));
        cat.insert(meta("bar", "third"));
        cat.insert(meta("foo", "second"));

        assert_eq!(
            cat.get_by_source_key(&ModSourceKey::new("first"))
                .expect("primary source key should resolve")
                .package_id,
            PackageId::new("foo")
        );
        assert_eq!(
            cat.get_by_source_key(&ModSourceKey::new("second"))
                .expect("duplicate source key should resolve")
                .package_id,
            PackageId::new("foo")
        );

        let variants = cat.duplicate_variants();
        assert_eq!(variants.len(), 1);
        assert_eq!(variants[0].package_id, PackageId::new("foo"));
        assert_eq!(
            variants[0].source_keys,
            vec![ModSourceKey::new("first"), ModSourceKey::new("second")]
        );
    }

    #[test]
    fn duplicates_are_stored_once_and_both_variants_stay_addressable() {
        let mut cat = ModCatalog::new();
        cat.insert(meta("foo", "C:/workshop/294100/12345"));
        cat.insert(meta("foo", "C:/RimWorld/Mods/Foo"));

        assert_eq!(cat.len(), 1, "a duplicated mod counts as one mod");
        assert_eq!(
            cat.iter().count(),
            1,
            "iteration yields primaries only, so ordering sees one entry"
        );
        assert_eq!(
            cat.get(&PackageId::new("foo")).unwrap().source_key.as_str(),
            "C:/workshop/294100/12345",
            "the first discovered copy stays primary"
        );
        for key in ["C:/workshop/294100/12345", "C:/RimWorld/Mods/Foo"] {
            assert_eq!(
                cat.get_by_source_key(&ModSourceKey::new(key))
                    .expect("both copies remain inspectable")
                    .source_key
                    .as_str(),
                key
            );
        }
    }

    #[test]
    fn a_third_copy_extends_the_existing_duplicate_record() {
        let mut cat = ModCatalog::new();
        cat.insert(meta("foo", "a"));
        cat.insert(meta("foo", "b"));
        cat.insert(meta("foo", "c"));

        let variants = cat.duplicate_variants();
        assert_eq!(variants.len(), 1);
        assert_eq!(
            variants[0].source_keys,
            vec![
                ModSourceKey::new("a"),
                ModSourceKey::new("b"),
                ModSourceKey::new("c"),
            ]
        );
    }
}
