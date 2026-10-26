//! Dependency graph data structure.

use crate::diagnostics::DiagnosticLocation;
use crate::domain::PackageId;
use indexmap::IndexMap;

/// Kind of dependency edge.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EdgeKind {
    /// `loadAfter` constraint: `from` loads after `to` (to must precede from).
    LoadAfter,
    /// `loadBefore` constraint, represented as a dependency edge after direction flip.
    LoadBefore,
    /// `forceLoadAfter` constraint (same direction, always applied).
    ForceLoadAfter,
    /// `forceLoadBefore` constraint, represented as a dependency edge after direction flip.
    ForceLoadBefore,
}

/// Where the edge originated.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EdgeSource {
    /// From the mod's own About.xml.
    About,
}

/// A directed edge in the dependency graph.
///
/// Semantics: `from` depends on `to` — `to` must be loaded before `from`.
#[derive(Debug, Clone)]
pub struct Edge {
    pub from: PackageId,
    pub to: PackageId,
    pub kind: EdgeKind,
    pub source: EdgeSource,
    pub location: Option<DiagnosticLocation>,
}

/// Dependency graph with forward and reverse adjacency lists.
///
/// - **forward**: `A -> [B, C]` means A depends on B and C (B, C must load
///   before A).
/// - **reverse**: `B -> [A]` means A depends on B (reverse of forward).
/// - **incompatibilities**: bidirectional — if A declares incompatible with B,
///   both `A -> [B]` and `B -> [A]` are present.
#[derive(Debug, Clone, Default)]
pub struct LoadOrderGraph {
    forward: IndexMap<PackageId, Vec<Edge>>,
    reverse: IndexMap<PackageId, Vec<Edge>>,
    incompatibilities: IndexMap<PackageId, Vec<PackageId>>,
}

impl LoadOrderGraph {
    pub fn new() -> Self {
        Self::default()
    }

    /// Adds a directed edge: `from` depends on `to` (to must precede from).
    /// Self-edges (from == to) are silently ignored.
    pub fn add_edge(&mut self, from: PackageId, to: PackageId, kind: EdgeKind, source: EdgeSource) {
        self.add_edge_with_location(from, to, kind, source, None);
    }

    pub fn add_edge_with_location(
        &mut self,
        from: PackageId,
        to: PackageId,
        kind: EdgeKind,
        source: EdgeSource,
        location: Option<DiagnosticLocation>,
    ) {
        if from == to {
            return;
        }
        let edge = Edge {
            from: from.clone(),
            to: to.clone(),
            kind,
            source,
            location,
        };
        self.forward
            .entry(from.clone())
            .or_default()
            .push(edge.clone());
        self.reverse.entry(to).or_default().push(edge);
    }

    /// Adds a bidirectional incompatibility between two mods.
    /// Self-pairs are silently ignored. Duplicate pairs are not added.
    pub fn add_incompatibility(&mut self, a: PackageId, b: PackageId) {
        if a == b {
            return;
        }
        let list_a = self.incompatibilities.entry(a.clone()).or_default();
        if !list_a.contains(&b) {
            list_a.push(b.clone());
        }
        let list_b = self.incompatibilities.entry(b).or_default();
        if !list_b.contains(&a) {
            list_b.push(a);
        }
    }

    /// Returns the forward edges from `pkg` (things pkg depends on).
    pub fn forward_edges(&self, pkg: &PackageId) -> &[Edge] {
        self.forward.get(pkg).map(|v| v.as_slice()).unwrap_or(&[])
    }

    /// Returns the reverse edges to `pkg` (things that depend on pkg).
    pub fn reverse_edges(&self, pkg: &PackageId) -> &[Edge] {
        self.reverse.get(pkg).map(|v| v.as_slice()).unwrap_or(&[])
    }

    /// Returns the list of mods incompatible with `pkg`.
    pub fn incompatibilities(&self, pkg: &PackageId) -> &[PackageId] {
        self.incompatibilities
            .get(pkg)
            .map(|v| v.as_slice())
            .unwrap_or(&[])
    }

    /// Returns all package ids that appear in the graph.
    pub fn nodes(&self) -> impl Iterator<Item = &PackageId> {
        self.forward.keys()
    }

    /// Returns true if the graph has no edges.
    pub fn is_empty(&self) -> bool {
        self.forward.is_empty() && self.incompatibilities.is_empty()
    }

    /// Returns a reference to the forward adjacency map.
    pub fn forward_map(&self) -> &IndexMap<PackageId, Vec<Edge>> {
        &self.forward
    }

    /// Returns a reference to the incompatibility map.
    pub fn incompatibility_map(&self) -> &IndexMap<PackageId, Vec<PackageId>> {
        &self.incompatibilities
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn add_edge_populates_forward_and_reverse() {
        let mut g = LoadOrderGraph::new();
        let a = PackageId::new("a");
        let b = PackageId::new("b");
        g.add_edge(a.clone(), b.clone(), EdgeKind::LoadAfter, EdgeSource::About);
        let fwd = g.forward_edges(&a);
        assert_eq!(fwd.len(), 1);
        assert_eq!(fwd[0].to, b);
        assert_eq!(fwd[0].from, a);
        let rev = g.reverse_edges(&b);
        assert_eq!(rev.len(), 1);
        assert_eq!(rev[0].from, a);
        assert_eq!(rev[0].to, b);
    }

    #[test]
    fn self_edge_ignored() {
        let mut g = LoadOrderGraph::new();
        let a = PackageId::new("a");
        g.add_edge(a.clone(), a.clone(), EdgeKind::LoadAfter, EdgeSource::About);
        assert!(g.forward_edges(&a).is_empty());
        assert!(g.reverse_edges(&a).is_empty());
        assert!(g.is_empty());
    }

    #[test]
    fn add_incompatibility_bidirectional() {
        let mut g = LoadOrderGraph::new();
        let a = PackageId::new("a");
        let b = PackageId::new("b");
        g.add_incompatibility(a.clone(), b.clone());
        assert_eq!(g.incompatibilities(&a), std::slice::from_ref(&b));
        assert_eq!(g.incompatibilities(&b), std::slice::from_ref(&a));
    }

    #[test]
    fn self_incompatibility_ignored() {
        let mut g = LoadOrderGraph::new();
        let a = PackageId::new("a");
        g.add_incompatibility(a.clone(), a.clone());
        assert!(g.incompatibilities(&a).is_empty());
        assert!(g.is_empty());
    }

    #[test]
    fn duplicate_incompatibility_not_added() {
        let mut g = LoadOrderGraph::new();
        let a = PackageId::new("a");
        let b = PackageId::new("b");
        g.add_incompatibility(a.clone(), b.clone());
        g.add_incompatibility(a.clone(), b.clone());
        g.add_incompatibility(b.clone(), a.clone());
        assert_eq!(g.incompatibilities(&a).len(), 1);
        assert_eq!(g.incompatibilities(&b).len(), 1);
    }

    #[test]
    fn forward_edges_unknown_pkg_empty() {
        let g = LoadOrderGraph::new();
        let z = PackageId::new("z");
        assert!(g.forward_edges(&z).is_empty());
        assert!(g.reverse_edges(&z).is_empty());
        assert!(g.incompatibilities(&z).is_empty());
    }

    #[test]
    fn is_empty_semantics() {
        let mut g = LoadOrderGraph::new();
        assert!(g.is_empty());
        let a = PackageId::new("a");
        let b = PackageId::new("b");
        g.add_edge(a, b, EdgeKind::LoadAfter, EdgeSource::About);
        assert!(!g.is_empty());
    }
}
