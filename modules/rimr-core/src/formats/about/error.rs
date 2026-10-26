//! Parse errors for About.xml metadata.

use thiserror::Error;

#[derive(Debug, Error)]
pub enum ParseError {
    #[error("XML parse error: {0}")]
    Xml(String),
    #[error("XML parse error at byte {byte_offset}: {message}")]
    XmlAt { message: String, byte_offset: u64 },
    #[error("encoding error: {0}")]
    Encoding(String),
}

impl ParseError {
    pub fn byte_offset(&self) -> Option<u64> {
        match self {
            Self::XmlAt { byte_offset, .. } => Some(*byte_offset),
            Self::Xml(_) | Self::Encoding(_) => None,
        }
    }
}
