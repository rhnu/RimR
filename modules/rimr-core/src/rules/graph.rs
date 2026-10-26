//! Dependency graph data structure.

use indexmap::IndexMap;

use crate::{diagnostics::DiagnosticLocation, domain::PackageId};

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

/// Dependency graph with load-order edges and incompatible pairs.
///
/// - **forward**: `A -> [B, C]` means A depends on B and C (B, C must load
///   before A).
/// - **incompatibilities**: bidirectional — if A declares incompatible with B,
///   both `A -> [B]` and `B -> [A]` are present.
#[derive(Debug, Clone, Default)]
pub struct LoadOrderGraph {
    forward: IndexMap<PackageId, Vec<Edge>>,
    incompatibilities: IndexMap<PackageId, Vec<PackageId>>,
}

impl LoadOrderGraph {
    pub fn new() -> Self { Self::default() }

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
            to,
            kind,
            source,
            location,
        };
        self.forward.entry(from).or_default().push(edge);
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
        self.forward.get(pkg).map_or(&[], std::vec::Vec::as_slice)
    }

    /// Returns the list of mods incompatible with `pkg`.
    pub fn incompatibilities(&self, pkg: &PackageId) -> &[PackageId] {
        self.incompatibilities
            .get(pkg)
            .map_or(&[], std::vec::Vec::as_slice)
    }

    /// Returns all package ids that appear in the graph.
    pub fn nodes(&self) -> impl Iterator<Item = &PackageId> { self.forward.keys() }

    /// Returns true if the graph has no edges.
    pub fn is_empty(&self) -> bool { self.forward.is_empty() && self.incompatibilities.is_empty() }
}

#[cfg(test)]
mod tests;
