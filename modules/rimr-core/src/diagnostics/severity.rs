//! Diagnostic severity levels.

/// Severity of a [`super::Diagnostic`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Severity {
    /// Blocks correct operation (e.g. circular dependency, incompatible mods
    /// both active). Reported but does not block save in v1.
    Error,
    /// Potential issue the user should review (e.g. order violation, missing
    /// dependency).
    Warning,
    /// Informational note (e.g. alternative package id satisfied a
    /// dependency, version mismatch).
    Info,
}
