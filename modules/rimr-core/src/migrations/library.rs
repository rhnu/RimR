//! Format history for the RimR library files (`settings.json`,
//! `mod-lists/index.json`, `mod-lists/<id>.json`).
//!
//! These files have only ever been written at format version 2, so the step
//! tables are empty. When a data-structure change bumps
//! [`crate::domain::RIMR_FORMAT_VERSION`], bump [`TARGET`] to match and append
//! the corresponding step to each affected table.

use super::Step;

/// Format version this build reads and writes.
pub(super) const TARGET: u32 = crate::domain::RIMR_FORMAT_VERSION;

pub(super) const SETTINGS_STEPS: &[Step] = &[];

pub(super) const INDEX_STEPS: &[Step] = &[];

pub(super) const MOD_LIST_STEPS: &[Step] = &[];
