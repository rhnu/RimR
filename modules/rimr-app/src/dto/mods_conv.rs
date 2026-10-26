use std::{path::Path, time::UNIX_EPOCH};

use rimr_bindings::dto::{
    ActiveListLoadDto, CatalogSnapshotDto, DependencyDto, DiagnosticCodeDto, DiagnosticDto,
    DiagnosticLocationDto, DuplicatePackageIdDto, ModCatalogDto, ModMetadataDto, ModsConfigDto,
    RulesDto, SeverityDto, SourceKindDto, ValidateOrderDto, ValidationReportDto,
};
use rimr_core::{
    Dependency, Diagnostic, DiagnosticCode, DuplicatePackageId, ModCatalog, ModMetadata,
    ModsConfig, Rules, Severity, SourceKind, ValidationReport,
};

use super::packages;
use crate::{ActiveLoadResult, ValidateOrderResult};

pub fn catalog_snapshot(catalog: &ModCatalog, diagnostics: &[Diagnostic]) -> CatalogSnapshotDto {
    CatalogSnapshotDto {
        catalog: mod_catalog(catalog),
        diagnostics: diagnostics.iter().map(diagnostic).collect(),
    }
}

pub fn mod_catalog(catalog: &ModCatalog) -> ModCatalogDto {
    ModCatalogDto {
        mods: catalog
            .iter()
            .map(|(_, metadata)| mod_metadata(metadata))
            .collect(),
        duplicate_package_ids: catalog
            .duplicates()
            .map(|package_id| package_id.as_str().to_string())
            .collect(),
        duplicate_variants: catalog
            .duplicate_variants()
            .iter()
            .map(duplicate_package_id)
            .collect(),
    }
}

fn duplicate_package_id(duplicate: &DuplicatePackageId) -> DuplicatePackageIdDto {
    DuplicatePackageIdDto {
        package_id: duplicate.package_id.as_str().to_string(),
        source_keys: duplicate
            .source_keys
            .iter()
            .map(|source_key| source_key.as_str().to_string())
            .collect(),
    }
}

pub fn mod_metadata(metadata: &ModMetadata) -> ModMetadataDto {
    let path = metadata.source_key.as_str().to_string();
    ModMetadataDto {
        source_key: path.clone(),
        source_kind: source_kind(metadata.source_kind),
        package_id: metadata.package_id.as_str().to_string(),
        modified_at_ms: modified_at_ms(&path),
        path,
        name: metadata.name.as_deref().map(str::to_string),
        authors: metadata
            .authors
            .iter()
            .map(std::string::ToString::to_string)
            .collect(),
        supported_versions: metadata
            .supported_versions
            .iter()
            .map(ToString::to_string)
            .collect(),
        description: metadata.description.as_deref().map(str::to_string),
        mod_version: metadata.mod_version.as_deref().map(str::to_string),
        url: metadata.url.as_deref().map(str::to_string),
        mod_icon_path: metadata.mod_icon_path.as_deref().map(str::to_string),
        steam_app_id: metadata.steam_app_id,
        has_assemblies: metadata.has_assemblies,
        rules: rules(&metadata.rules),
        valid: metadata.valid,
        data_malformed: metadata.data_malformed,
    }
}

fn modified_at_ms(path: &str) -> u64 {
    let Ok(metadata) = std::fs::metadata(Path::new(path)) else {
        return 0;
    };
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map_or(0, |duration| {
            u64::try_from(duration.as_millis()).unwrap_or(u64::MAX)
        })
}

pub fn active_load(result: &ActiveLoadResult) -> ActiveListLoadDto {
    ActiveListLoadDto {
        active_mods: packages(result.list.as_slice()),
        config: mods_config(&result.config),
        missing: packages(&result.missing),
        diagnostics: result.diagnostics.iter().map(diagnostic).collect(),
    }
}

pub fn mods_config(config: &ModsConfig) -> ModsConfigDto {
    ModsConfigDto {
        version: config.version.to_string(),
        active_mods: packages(&config.active_mods),
        known_expansions: packages(&config.known_expansions),
    }
}

pub fn validate_order(result: &ValidateOrderResult) -> ValidateOrderDto {
    ValidateOrderDto {
        report: validation_report(&result.report),
    }
}

pub fn validation_report(report: &ValidationReport) -> ValidationReportDto {
    ValidationReportDto {
        errors: report.errors.iter().map(diagnostic).collect(),
        warnings: report.warnings.iter().map(diagnostic).collect(),
        infos: report.infos.iter().map(diagnostic).collect(),
        is_clean: report.is_clean(),
        has_errors: report.has_errors(),
    }
}

fn rules(rules: &Rules) -> RulesDto {
    RulesDto {
        load_after: packages(&rules.load_after),
        load_before: packages(&rules.load_before),
        mod_dependencies: rules.mod_dependencies.iter().map(dependency).collect(),
        incompatible_with: packages(&rules.incompatible_with),
        force_load_after: packages(&rules.force_load_after),
        force_load_before: packages(&rules.force_load_before),
    }
}

fn dependency(dependency: &Dependency) -> DependencyDto {
    DependencyDto {
        package_id: dependency.package_id.as_str().to_string(),
        display_name: dependency.display_name.as_deref().map(str::to_string),
        steam_workshop_url: dependency.steam_workshop_url.as_deref().map(str::to_string),
        download_url: dependency.download_url.as_deref().map(str::to_string),
        alternative_package_ids: packages(&dependency.alternative_package_ids),
    }
}

fn diagnostic(diagnostic: &Diagnostic) -> DiagnosticDto {
    DiagnosticDto {
        severity: severity(diagnostic.severity),
        code: diagnostic_code(diagnostic.code),
        message: diagnostic.message.to_string(),
        location: diagnostic.location.as_ref().map(diagnostic_location),
        related_locations: diagnostic
            .related_locations
            .iter()
            .map(diagnostic_location)
            .collect(),
        params: diagnostic.params.clone(),
        related_packages: packages(&diagnostic.related_packages),
    }
}

fn diagnostic_location(location: &rimr_core::DiagnosticLocation) -> DiagnosticLocationDto {
    DiagnosticLocationDto {
        source_key: location
            .source_key
            .as_ref()
            .map(|source_key| source_key.as_str().to_string()),
        path: location.path.to_string(),
        xml_path: location.xml_path.as_deref().map(str::to_string),
        line: location.line,
        col: location.col,
        byte_offset: location.byte_offset,
    }
}

pub fn source_kind_to_core(dto: SourceKindDto) -> SourceKind {
    match dto {
        SourceKindDto::Expansion => SourceKind::Expansion,
        SourceKindDto::Local => SourceKind::Local,
        SourceKindDto::Workshop => SourceKind::Workshop,
    }
}

pub fn source_kind(kind: SourceKind) -> SourceKindDto {
    match kind {
        SourceKind::Expansion => SourceKindDto::Expansion,
        SourceKind::Local => SourceKindDto::Local,
        SourceKind::Workshop => SourceKindDto::Workshop,
    }
}

fn severity(severity: Severity) -> SeverityDto {
    match severity {
        Severity::Error => SeverityDto::Error,
        Severity::Warning => SeverityDto::Warning,
        Severity::Info => SeverityDto::Info,
    }
}

fn diagnostic_code(code: DiagnosticCode) -> DiagnosticCodeDto {
    match code {
        DiagnosticCode::GameVersionUnknown => DiagnosticCodeDto::GameVersionUnknown,
        DiagnosticCode::XmlMalformed => DiagnosticCodeDto::XmlMalformed,
        DiagnosticCode::PackageIdMissing => DiagnosticCodeDto::PackageIdMissing,
        DiagnosticCode::PackageIdDuplicate => DiagnosticCodeDto::PackageIdDuplicate,
        DiagnosticCode::SourceReadFailed => DiagnosticCodeDto::SourceReadFailed,
        DiagnosticCode::DependencyMissing => DiagnosticCodeDto::DependencyMissing,
        DiagnosticCode::ConfigModMissing => DiagnosticCodeDto::ConfigModMissing,
        DiagnosticCode::ActiveModMissing => DiagnosticCodeDto::ActiveModMissing,
        DiagnosticCode::DependencyInactive => DiagnosticCodeDto::DependencyInactive,
        DiagnosticCode::OrderViolationLoadAfter => DiagnosticCodeDto::OrderViolationLoadAfter,
        DiagnosticCode::OrderViolationLoadBefore => DiagnosticCodeDto::OrderViolationLoadBefore,
        DiagnosticCode::IncompatibleActive => DiagnosticCodeDto::IncompatibleActive,
        DiagnosticCode::CircularDependency => DiagnosticCodeDto::CircularDependency,
    }
}
