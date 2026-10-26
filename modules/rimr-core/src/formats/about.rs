//! About.xml metadata parsing and compilation.

mod by_version;
mod compile;
mod error;
mod parser;
mod raw;

pub use compile::{CompileOpts, compile_metadata};
pub use parser::parse_about_xml;
