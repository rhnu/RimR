//! Builds a LoadOrderGraph from a ModCatalog.

use crate::diagnostics::DiagnosticLocation;
use crate::domain::ModCatalog;
use crate::rules::graph::{EdgeKind, EdgeSource, LoadOrderGraph};

/// Builds a dependency graph for the mods in `catalog`.
///
/// Only edges where **both endpoints are in the catalog** are created
/// (loadAfter/loadBefore entries targeting uninstalled mods
/// are silently skipped).
///
/// Incompatibilities are also only bidirectionalized between installed mods.
/// If A declares incompatible with B but B is not installed, the edge is
/// skipped.
pub fn build_load_order_graph(catalog: &ModCatalog) -> LoadOrderGraph {
    let mut graph = LoadOrderGraph::new();

    for (pkg_id, metadata) in catalog.iter() {
        let rules = &metadata.rules;

        for target in &rules.load_after {
            if catalog.contains(target) {
                graph.add_edge_with_location(
                    pkg_id.clone(),
                    target.clone(),
                    EdgeKind::LoadAfter,
                    EdgeSource::About,
                    Some(DiagnosticLocation::about_xml(
                        &metadata.source_key,
                        "/ModMetaData/loadAfter",
                    )),
                );
            }
        }

        for target in &rules.load_before {
            if catalog.contains(target) {
                graph.add_edge_with_location(
                    target.clone(),
                    pkg_id.clone(),
                    EdgeKind::LoadBefore,
                    EdgeSource::About,
                    Some(DiagnosticLocation::about_xml(
                        &metadata.source_key,
                        "/ModMetaData/loadBefore",
                    )),
                );
            }
        }

        for target in &rules.force_load_after {
            if catalog.contains(target) {
                graph.add_edge_with_location(
                    pkg_id.clone(),
                    target.clone(),
                    EdgeKind::ForceLoadAfter,
                    EdgeSource::About,
                    Some(DiagnosticLocation::about_xml(
                        &metadata.source_key,
                        "/ModMetaData/forceLoadAfter",
                    )),
                );
            }
        }

        for target in &rules.force_load_before {
            if catalog.contains(target) {
                graph.add_edge_with_location(
                    target.clone(),
                    pkg_id.clone(),
                    EdgeKind::ForceLoadBefore,
                    EdgeSource::About,
                    Some(DiagnosticLocation::about_xml(
                        &metadata.source_key,
                        "/ModMetaData/forceLoadBefore",
                    )),
                );
            }
        }

        for target in &rules.incompatible_with {
            if catalog.contains(target) {
                graph.add_incompatibility(pkg_id.clone(), target.clone());
            }
        }
    }

    graph
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{ModCatalog, ModMetadata, PackageId, Rules};
    use crate::ports::{ModSourceKey, SourceKind};
    use crate::rules::graph::EdgeKind;
    use std::sync::Arc;

    fn make_mod(
        pkg: &str,
        load_after: &[&str],
        load_before: &[&str],
        force_after: &[&str],
        force_before: &[&str],
        incompatible: &[&str],
    ) -> ModMetadata {
        ModMetadata {
            source_key: ModSourceKey::new(pkg),
            source_kind: SourceKind::Local,
            package_id: PackageId::new(pkg),
            name: Some(Arc::from(pkg)),
            authors: vec![],
            supported_versions: vec![],
            description: None,
            mod_version: None,
            url: None,
            mod_icon_path: None,
            steam_app_id: None,
            has_assemblies: false,
            rules: Rules {
                load_after: load_after.iter().copied().map(PackageId::new).collect(),
                load_before: load_before.iter().copied().map(PackageId::new).collect(),
                mod_dependencies: vec![],
                incompatible_with: incompatible.iter().copied().map(PackageId::new).collect(),
                force_load_after: force_after.iter().copied().map(PackageId::new).collect(),
                force_load_before: force_before.iter().copied().map(PackageId::new).collect(),
            },
            valid: true,
            data_malformed: false,
        }
    }

    fn make_catalog(mods: Vec<ModMetadata>) -> ModCatalog {
        let mut cat = ModCatalog::new();
        for m in mods {
            cat.insert(m);
        }
        cat
    }

    #[test]
    fn load_after_creates_edge() {
        let cat = make_catalog(vec![
            make_mod("a", &["b"], &[], &[], &[], &[]),
            make_mod("b", &[], &[], &[], &[], &[]),
        ]);
        let g = build_load_order_graph(&cat);
        let fwd = g.forward_edges(&PackageId::new("a"));
        assert_eq!(fwd.len(), 1);
        assert_eq!(fwd[0].to, PackageId::new("b"));
        assert_eq!(fwd[0].kind, EdgeKind::LoadAfter);
    }

    #[test]
    fn load_before_flips_direction() {
        let cat = make_catalog(vec![
            make_mod("a", &[], &["b"], &[], &[], &[]),
            make_mod("b", &[], &[], &[], &[], &[]),
        ]);
        let g = build_load_order_graph(&cat);
        assert!(g.forward_edges(&PackageId::new("a")).is_empty());
        let fwd_b = g.forward_edges(&PackageId::new("b"));
        assert_eq!(fwd_b.len(), 1);
        assert_eq!(fwd_b[0].to, PackageId::new("a"));
        assert_eq!(fwd_b[0].kind, EdgeKind::LoadBefore);
    }

    #[test]
    fn uninstalled_target_skipped() {
        let cat = make_catalog(vec![make_mod("a", &["b"], &[], &[], &[], &[])]);
        let g = build_load_order_graph(&cat);
        assert!(g.forward_edges(&PackageId::new("a")).is_empty());
    }

    #[test]
    fn force_load_after_creates_edge() {
        let cat = make_catalog(vec![
            make_mod("a", &[], &[], &["b"], &[], &[]),
            make_mod("b", &[], &[], &[], &[], &[]),
        ]);
        let g = build_load_order_graph(&cat);
        let fwd = g.forward_edges(&PackageId::new("a"));
        assert_eq!(fwd.len(), 1);
        assert_eq!(fwd[0].to, PackageId::new("b"));
        assert_eq!(fwd[0].kind, EdgeKind::ForceLoadAfter);
    }

    #[test]
    fn force_load_before_flips_direction() {
        let cat = make_catalog(vec![
            make_mod("a", &[], &[], &[], &["b"], &[]),
            make_mod("b", &[], &[], &[], &[], &[]),
        ]);
        let g = build_load_order_graph(&cat);
        assert!(g.forward_edges(&PackageId::new("a")).is_empty());
        let fwd_b = g.forward_edges(&PackageId::new("b"));
        assert_eq!(fwd_b.len(), 1);
        assert_eq!(fwd_b[0].to, PackageId::new("a"));
        assert_eq!(fwd_b[0].kind, EdgeKind::ForceLoadBefore);
    }

    #[test]
    fn incompatible_with_bidirectional() {
        let cat = make_catalog(vec![
            make_mod("a", &[], &[], &[], &[], &["b"]),
            make_mod("b", &[], &[], &[], &[], &[]),
        ]);
        let g = build_load_order_graph(&cat);
        assert_eq!(
            g.incompatibilities(&PackageId::new("a")),
            &[PackageId::new("b")]
        );
        assert_eq!(
            g.incompatibilities(&PackageId::new("b")),
            &[PackageId::new("a")]
        );
    }

    #[test]
    fn incompatible_with_uninstalled_skipped() {
        let cat = make_catalog(vec![make_mod("a", &[], &[], &[], &[], &["b"])]);
        let g = build_load_order_graph(&cat);
        assert!(g.incompatibilities(&PackageId::new("a")).is_empty());
    }

    #[test]
    fn case_insensitive_edge_creation() {
        let cat = make_catalog(vec![
            make_mod("a", &["MOD.BETA"], &[], &[], &[], &[]),
            make_mod("mod.beta", &[], &[], &[], &[], &[]),
        ]);
        let g = build_load_order_graph(&cat);
        let fwd = g.forward_edges(&PackageId::new("a"));
        assert_eq!(fwd.len(), 1);
        assert_eq!(fwd[0].to, PackageId::new("mod.beta"));
    }
}
