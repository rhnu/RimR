//! Structured diagnostics for rimr-core.
//!
//! Non-fatal domain issues are reported as [`Diagnostic`] values collected
//! into reports, not thrown as errors. This lets the UI decide how to present
//! them without parsing message strings.

mod code;
mod diagnostic;
mod severity;

pub use code::DiagnosticCode;
pub use diagnostic::{Diagnostic, DiagnosticLocation};
pub use severity::Severity;
