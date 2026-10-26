//! Diagnostic value and source span types.

use crate::diagnostics::{DiagnosticCode, Severity};
use crate::domain::PackageId;
use crate::ports::ModSourceKey;
use std::collections::BTreeMap;
use std::sync::Arc;

/// Location within a source file for error reporting.
#[derive(Debug, Clone)]
pub struct DiagnosticLocation {
    pub source_key: Option<ModSourceKey>,
    pub path: Arc<str>,
    pub xml_path: Option<Arc<str>>,
    /// 1-based line number when known.
    pub line: Option<u32>,
    /// 1-based column number when known.
    pub col: Option<u32>,
    pub byte_offset: Option<u64>,
}

impl DiagnosticLocation {
    pub fn new(path: impl Into<Arc<str>>) -> Self {
        Self {
            source_key: None,
            path: path.into(),
            xml_path: None,
            line: None,
            col: None,
            byte_offset: None,
        }
    }

    pub fn about_xml(source_key: &ModSourceKey, xml_path: impl Into<Arc<str>>) -> Self {
        Self {
            source_key: Some(source_key.clone()),
            path: Arc::from(format!("{}/About/About.xml", source_key.as_str())),
            xml_path: Some(xml_path.into()),
            line: None,
            col: None,
            byte_offset: None,
        }
    }

    pub fn with_position(
        mut self,
        line: Option<u32>,
        col: Option<u32>,
        byte_offset: Option<u64>,
    ) -> Self {
        self.line = line;
        self.col = col;
        self.byte_offset = byte_offset;
        self
    }
}

/// A single non-fatal domain issue.
#[derive(Debug, Clone)]
pub struct Diagnostic {
    pub severity: Severity,
    pub code: DiagnosticCode,
    pub message: Arc<str>,
    /// Primary source location for the diagnostic.
    pub location: Option<DiagnosticLocation>,
    /// Additional source locations that help explain the diagnostic.
    pub related_locations: Vec<DiagnosticLocation>,
    /// Stable string parameters used by frontends for localization.
    pub params: BTreeMap<String, String>,
    /// Package ids involved in this diagnostic.
    pub related_packages: Vec<PackageId>,
}

impl Diagnostic {
    pub fn new(severity: Severity, code: DiagnosticCode, message: impl Into<Arc<str>>) -> Self {
        Self {
            severity,
            code,
            message: message.into(),
            location: None,
            related_locations: Vec::new(),
            params: BTreeMap::new(),
            related_packages: Vec::new(),
        }
    }

    pub fn with_location(mut self, location: DiagnosticLocation) -> Self {
        self.location = Some(location);
        self
    }

    pub fn with_related_locations(mut self, locations: Vec<DiagnosticLocation>) -> Self {
        self.related_locations = locations;
        self
    }

    pub fn with_param(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.params.insert(key.into(), value.into());
        self
    }

    pub fn with_related_packages(mut self, packages: Vec<PackageId>) -> Self {
        self.related_packages = packages;
        self
    }
}
