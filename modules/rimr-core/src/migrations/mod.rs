//! Standalone on-disk format migration engine.
//!
//! This module is deliberately isolated from regular business logic: nothing
//! here knows about domain types, and no domain/service code performs version
//! upgrades inline. Callers load raw JSON, hand it to [`migrate_document`],
//! and only then deserialize into the current-version structs.
//!
//! Adding a new format version means bumping the document's `TARGET` and
//! appending one [`Step`] to its table — never editing an existing step, since
//! old steps must keep describing the historical transformation exactly.

mod app_config;
mod library;

#[cfg(test)]
mod tests;

use serde_json::Value;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum MigrationError {
    #[error("{kind} document is not a JSON object")]
    NotAnObject { kind: &'static str },

    #[error("{kind} document is missing formatVersion")]
    MissingVersion { kind: &'static str },

    #[error(
        "{kind} document has format version {found}, which is newer than the supported version {target}"
    )]
    TooNew {
        kind: &'static str,
        found: u32,
        target: u32,
    },

    #[error("no migration path for {kind} document from format version {found} to {target}")]
    NoPath {
        kind: &'static str,
        found: u32,
        target: u32,
    },

    #[error("{kind} migration {from} -> {to} failed: {reason}")]
    StepFailed {
        kind: &'static str,
        from: u32,
        to: u32,
        reason: String,
    },
}

/// A migratable on-disk document kind.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DocumentKind {
    /// Host application config (`config.json`).
    AppConfig,
    /// Library settings (`settings.json`).
    LibrarySettings,
    /// Mod list index (`mod-lists/index.json`).
    ModListIndex,
    /// A single mod list (`mod-lists/<id>.json`).
    ModList,
}

impl DocumentKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::AppConfig => "config.json",
            Self::LibrarySettings => "settings.json",
            Self::ModListIndex => "mod-lists/index.json",
            Self::ModList => "mod list",
        }
    }

    /// The format version this build reads and writes.
    pub fn target_version(self) -> u32 {
        match self {
            Self::AppConfig => app_config::TARGET,
            Self::LibrarySettings | Self::ModListIndex | Self::ModList => library::TARGET,
        }
    }

    fn steps(self) -> &'static [Step] {
        match self {
            Self::AppConfig => app_config::STEPS,
            Self::LibrarySettings => library::SETTINGS_STEPS,
            Self::ModListIndex => library::INDEX_STEPS,
            Self::ModList => library::MOD_LIST_STEPS,
        }
    }
}

/// One version-to-version transformation.
pub(crate) struct Step {
    pub(crate) from: u32,
    pub(crate) to: u32,
    pub(crate) apply: fn(&mut Value) -> Result<(), String>,
}

/// Result of running [`migrate_document`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MigrationOutcome {
    /// Version found in the document before migrating.
    pub from_version: u32,
    /// Version of the document after migrating (always the target).
    pub to_version: u32,
}

impl MigrationOutcome {
    /// True if the document was rewritten and should be persisted.
    pub fn changed(&self) -> bool {
        self.from_version != self.to_version
    }
}

/// Upgrades `value` in place to the current format version for `kind`.
///
/// Documents already at the target version are left untouched. Documents from
/// a newer build are rejected rather than silently misread.
pub fn migrate_document(
    kind: DocumentKind,
    value: &mut Value,
) -> Result<MigrationOutcome, MigrationError> {
    let name = kind.as_str();
    let target = kind.target_version();

    if !value.is_object() {
        return Err(MigrationError::NotAnObject { kind: name });
    }
    let from_version = read_version(value).ok_or(MigrationError::MissingVersion { kind: name })?;

    if from_version == target {
        return Ok(MigrationOutcome {
            from_version,
            to_version: target,
        });
    }
    if from_version > target {
        return Err(MigrationError::TooNew {
            kind: name,
            found: from_version,
            target,
        });
    }

    let steps = kind.steps();
    let mut current = from_version;
    while current < target {
        let Some(step) = steps.iter().find(|step| step.from == current) else {
            return Err(MigrationError::NoPath {
                kind: name,
                found: from_version,
                target,
            });
        };
        tracing::info!(
            document = name,
            from = step.from,
            to = step.to,
            "migrating document format"
        );
        (step.apply)(value).map_err(|reason| MigrationError::StepFailed {
            kind: name,
            from: step.from,
            to: step.to,
            reason,
        })?;
        current = step.to;
        write_version(value, current);
    }

    Ok(MigrationOutcome {
        from_version,
        to_version: target,
    })
}

fn read_version(value: &Value) -> Option<u32> {
    value
        .get("formatVersion")
        .or_else(|| value.get("format_version"))
        .and_then(Value::as_u64)
        .and_then(|v| u32::try_from(v).ok())
}

fn write_version(value: &mut Value, version: u32) {
    if let Some(obj) = value.as_object_mut() {
        obj.remove("format_version");
        obj.insert("formatVersion".to_string(), Value::from(version));
    }
}
