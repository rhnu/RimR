//! Stable identities and shared user decisions for suppressible diagnostics.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use super::{Diagnostic, DiagnosticCode};
use crate::domain::GameVersion;

/// Semantic identity declared by the diagnostic producer, independent of display text.
#[derive(Debug, Clone, Default)]
pub struct DiagnosticIdentity {
    fields: BTreeMap<String, String>,
    source_keys: Vec<String>,
    game_version: Option<String>,
    version_dependent: bool,
}

impl DiagnosticIdentity {
    pub fn new() -> Self { Self::default() }

    /// Adds a named, stable semantic value, preserving roles for directed relationships.
    #[must_use]
    pub fn with_field(mut self, name: &str, value: impl Into<String>) -> Self {
        self.fields.insert(name.to_string(), value.into());
        self
    }

    /// Encodes a sequence without assuming delimiters are forbidden inside package IDs.
    #[must_use]
    pub fn with_list(self, name: &str, values: impl IntoIterator<Item = String>) -> Self {
        let mut encoded = String::new();
        for value in values {
            append(&mut encoded, &value);
        }
        self.with_field(name, encoded)
    }

    /// Marks identities based on metadata rules compiled for a target game version.
    #[must_use]
    pub fn version_dependent(mut self) -> Self {
        self.version_dependent = true;
        self
    }

    pub(super) fn set_game_version(&mut self, version: &GameVersion) {
        if self.version_dependent && version.major() > 0 {
            self.game_version = Some(format!("{}.{}", version.major(), version.minor()));
        }
    }

    /// Pins file and duplicate-copy diagnostics to their exact set of installations.
    #[must_use]
    pub fn with_sources(mut self, sources: impl IntoIterator<Item = String>) -> Self {
        self.source_keys = sources.into_iter().collect();
        self.source_keys.sort();
        self.source_keys.dedup();
        self
    }

    /// Version-dependent diagnoses expire on a major/minor change, not a game hotfix.
    #[must_use]
    pub fn with_game_version(mut self, version: &GameVersion) -> Self {
        if version.major() > 0 {
            self.game_version = Some(format!("{}.{}", version.major(), version.minor()));
        }
        self
    }

    pub(super) fn descriptor(&self, diagnostic: &Diagnostic) -> DiagnosticSuppression {
        let mut packages = diagnostic
            .related_packages
            .iter()
            .filter(|package| !package.is_sentinel())
            .map(ToString::to_string)
            .collect::<Vec<_>>();
        packages.sort();
        packages.dedup();
        // Length-prefixing prevents delimiter collisions without imposing restrictions on source keys.
        let mut key = String::from("v1:");
        append(&mut key, diagnostic.code.as_str());
        append(&mut key, self.game_version.as_deref().unwrap_or_default());
        append(&mut key, &packages.len().to_string());
        for package in &packages {
            append(&mut key, package);
        }
        append(&mut key, &self.fields.len().to_string());
        for (name, value) in &self.fields {
            append(&mut key, name);
            append(&mut key, value);
        }
        append(&mut key, &self.source_keys.len().to_string());
        for source in &self.source_keys {
            append(&mut key, source);
        }
        DiagnosticSuppression {
            key,
            code: diagnostic.code,
            params: diagnostic.params.clone(),
            related_packages: packages,
            source_keys: self.source_keys.clone(),
            game_version: self.game_version.clone(),
        }
    }
}

fn append(key: &mut String, value: &str) {
    key.push_str(&value.len().to_string());
    key.push(':');
    key.push_str(value);
}

/// A shared user suppression. Display parameters remain available while the problem is dormant.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticSuppression {
    pub key: String,
    pub code: DiagnosticCode,
    pub params: BTreeMap<String, String>,
    pub related_packages: Vec<String>,
    pub source_keys: Vec<String>,
    pub game_version: Option<String>,
}

impl DiagnosticSuppression {
    /// Checks the persistence boundary without interpreting opaque matching keys in consumers.
    pub fn is_valid(&self) -> bool {
        self.matches_key()
            && self.code != DiagnosticCode::GameVersionUnknown
            && (!self.related_packages.is_empty() || !self.source_keys.is_empty())
            && self.related_packages.iter().all(|id| !id.trim().is_empty())
            && self.source_keys.iter().all(|key| !key.trim().is_empty())
            && self.game_version.as_ref().is_none_or(|version| {
                let parsed = GameVersion::parse(version);
                parsed.major() > 0 && *version == format!("{}.{}", parsed.major(), parsed.minor())
            })
    }

    fn matches_key(&self) -> bool {
        let Some(mut remaining) = self.key.strip_prefix("v1:") else {
            return false;
        };
        if take(&mut remaining) != Some(self.code.as_str())
            || take(&mut remaining) != Some(self.game_version.as_deref().unwrap_or_default())
            || !matches_subjects(&mut remaining, &self.related_packages)
        {
            return false;
        }
        let Some(fields) = take(&mut remaining).and_then(count) else {
            return false;
        };
        if fields == 0 && self.source_keys.is_empty() {
            return false;
        }
        let mut previous = None;
        for _ in 0..fields {
            let Some(name) = take(&mut remaining) else {
                return false;
            };
            if name.is_empty() || previous.is_some_and(|previous| previous >= name) {
                return false;
            }
            previous = Some(name);
            if take(&mut remaining).is_none() {
                return false;
            }
        }
        matches_subjects(&mut remaining, &self.source_keys) && remaining.is_empty()
    }
}

fn take<'a>(remaining: &mut &'a str) -> Option<&'a str> {
    let (length, value) = remaining.split_once(':')?;
    let length = count(length)?;
    let (value, rest) = value.split_at_checked(length)?;
    *remaining = rest;
    Some(value)
}

fn count(value: &str) -> Option<usize> {
    let parsed = value.parse::<usize>().ok()?;
    (parsed.to_string() == value).then_some(parsed)
}

fn matches_subjects(remaining: &mut &str, subjects: &[String]) -> bool {
    if take(remaining).and_then(count) != Some(subjects.len()) {
        return false;
    }
    let mut previous = None;
    for subject in subjects {
        if previous.is_some_and(|previous| previous >= subject)
            || take(remaining) != Some(subject.as_str())
        {
            return false;
        }
        previous = Some(subject);
    }
    true
}

#[cfg(test)]
mod tests;
