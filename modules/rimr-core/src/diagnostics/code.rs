//! Structured diagnostic codes.
//!
//! Each variant maps to a specific domain issue. The UI can use the enum
//! value for icon/sorting/translation without parsing the message string.

/// Categorizes a [`super::Diagnostic`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum DiagnosticCode {
    /// `About.xml` could not be parsed as valid XML.
    XmlMalformed,
    /// `packageId` is missing, empty, or not a string.
    PackageIdMissing,
    /// Two or more mods share the same `packageId`.
    PackageIdDuplicate,
    /// An installed mod was discovered but its metadata file could not be read.
    SourceReadFailed,
    /// A hard runtime dependency is not installed.
    DependencyMissing,
    /// A package id appears in ModsConfig.xml but no installed mod matches it.
    ConfigModMissing,
    /// A package id is active in a RimR mod list but no installed mod matches it.
    ActiveModMissing,
    /// A hard runtime dependency is installed but not active.
    DependencyInactive,
    /// `loadAfter` constraint violated by current order.
    OrderViolationLoadAfter,
    /// `loadBefore` constraint violated by current order.
    OrderViolationLoadBefore,
    /// Two incompatible mods are both active.
    IncompatibleActive,
    /// Circular dependency detected in the active set.
    CircularDependency,
}
