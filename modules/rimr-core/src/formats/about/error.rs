//! Parse errors for About.xml metadata.

use thiserror::Error;

#[derive(Debug, Error)]
pub enum ParseError {
    #[error("XML parse error: {0}")]
    Xml(#[source] quick_xml::Error),
    #[error("XML parse error at byte {byte_offset}: {source}")]
    XmlAt {
        #[source]
        source: quick_xml::Error,
        byte_offset: u64,
    },
    #[error("encoding error: {0}")]
    Encoding(#[source] quick_xml::encoding::EncodingError),
    #[error("{0}")]
    UnknownEntity(String),
}

impl ParseError {
    pub fn byte_offset(&self) -> Option<u64> {
        match self {
            Self::XmlAt { byte_offset, .. } => Some(*byte_offset),
            Self::Xml(_) | Self::Encoding(_) | Self::UnknownEntity(_) => None,
        }
    }
}
