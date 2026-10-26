//! Individual validation checks, each returning structured diagnostics.

mod cycles;
mod dependencies;
mod duplicates;
mod incompatibilities;
mod order;

pub(crate) use cycles::check_cycles;
pub(crate) use dependencies::{
    check_active_missing, check_inactive_dependencies, check_missing_dependencies,
};
pub(crate) use duplicates::check_duplicates;
pub(crate) use incompatibilities::check_incompatibles;
pub(crate) use order::check_order_violations;
