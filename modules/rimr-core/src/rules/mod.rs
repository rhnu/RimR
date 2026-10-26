//! Load-order graph construction and order validation.

mod build;
mod checks;
mod graph;
mod validate;

pub use build::build_load_order_graph;
pub use graph::{Edge, EdgeKind, EdgeSource, LoadOrderGraph};
pub use validate::{ValidateOpts, ValidationReport, validate_order};
