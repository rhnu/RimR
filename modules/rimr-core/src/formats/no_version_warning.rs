//! Package IDs listed by No Version Warning for one game version.

use std::{collections::HashSet, sync::Arc};

use quick_xml::{events::Event, reader::Reader};

use crate::{
    diagnostics::DiagnosticLocation,
    domain::PackageId,
    formats::xml::{XmlReadError, decode_xml_bytes, read_text},
    ports::SourceFile,
};

/// Parsed list with the source used to explain version diagnostics.
#[derive(Debug, Clone)]
pub struct NoVersionWarning {
    packages: HashSet<PackageId>,
    location: DiagnosticLocation,
}

impl NoVersionWarning {
    /// Parses the XML file selected for the current game version.
    ///
    /// # Errors
    ///
    /// Returns an error if the file is malformed or lacks the expected list structure.
    pub fn parse(file: &SourceFile) -> Result<Self, NoVersionWarningParseError> {
        let bytes = decode_xml_bytes(&file.bytes)?;
        let mut reader = Reader::from_reader(bytes.as_ref());
        reader.config_mut().expand_empty_elements = true;

        if !matches!(next_content(&mut reader)?, Event::Start(tag) if tag.name().as_ref() == "ModIdsToFix")
        {
            return Err(NoVersionWarningParseError::Invalid(
                "expected ModIdsToFix root",
            ));
        }

        let mut packages = HashSet::new();
        loop {
            match next_content(&mut reader)? {
                Event::Start(tag) if tag.name().as_ref() == "li" => {
                    if let Some(id) = read_text(&mut reader)?.map(|text| PackageId::new(&text))
                        && !id.is_sentinel()
                    {
                        packages.insert(id);
                    }
                },
                Event::End(tag) if tag.name().as_ref() == "ModIdsToFix" => break,
                _ => {
                    return Err(NoVersionWarningParseError::Invalid(
                        "expected li or end of list",
                    ));
                },
            }
        }
        if !matches!(next_content(&mut reader)?, Event::Eof) {
            return Err(NoVersionWarningParseError::Invalid(
                "unexpected content after list",
            ));
        }

        let location = DiagnosticLocation {
            source_key: file.source_key.clone(),
            xml_path: Some(Arc::from("/ModIdsToFix/li")),
            ..DiagnosticLocation::new(Arc::clone(&file.path))
        };
        Ok(Self { packages, location })
    }

    pub fn location_for(&self, package_id: &PackageId) -> Option<&DiagnosticLocation> {
        self.packages.contains(package_id).then_some(&self.location)
    }
}

#[derive(Debug, thiserror::Error)]
pub enum NoVersionWarningParseError {
    #[error("invalid No Version Warning list: {0}")]
    Invalid(&'static str),

    #[error("could not parse No Version Warning XML")]
    Xml(#[from] XmlReadError),
}

fn next_content<'a>(reader: &mut Reader<&'a [u8]>) -> Result<Event<'a>, XmlReadError> {
    loop {
        match reader.read_event()? {
            Event::Comment(_) | Event::Decl(_) | Event::PI(_) => {},
            Event::Text(text) if text.trim().is_empty() => {},
            event => return Ok(event),
        }
    }
}

#[cfg(test)]
mod tests;
