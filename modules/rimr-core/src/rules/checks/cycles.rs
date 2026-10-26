//! Circular dependency detection via DFS three-color marking.

use crate::diagnostics::{Diagnostic, DiagnosticCode, Severity};
use crate::domain::PackageId;
use crate::rules::graph::LoadOrderGraph;
use std::collections::{HashMap, HashSet};

/// Checks for circular dependencies in the active subgraph.
pub(crate) fn check_cycles(
    graph: &LoadOrderGraph,
    active: &HashSet<&PackageId>,
) -> Vec<Diagnostic> {
    let cycles = find_cycles(graph, active);
    cycles
        .into_iter()
        .map(|cycle| {
            let path = cycle
                .iter()
                .map(|p| p.to_string())
                .collect::<Vec<_>>()
                .join(" -> ");
            let locations = cycle_locations(graph, &cycle);
            let diagnostic = Diagnostic::new(
                Severity::Error,
                DiagnosticCode::CircularDependency,
                format!("Circular dependency: {} -> {}", path, cycle[0]),
            )
            .with_param("cycle", format!("{} -> {}", path, cycle[0]))
            .with_related_packages(cycle);
            match locations.split_first() {
                Some((first, rest)) => diagnostic
                    .with_location(first.clone())
                    .with_related_locations(rest.to_vec()),
                None => diagnostic,
            }
        })
        .collect()
}

fn cycle_locations(
    graph: &LoadOrderGraph,
    cycle: &[PackageId],
) -> Vec<crate::diagnostics::DiagnosticLocation> {
    let mut locations = Vec::new();
    for i in 0..cycle.len() {
        let from = &cycle[i];
        let to = &cycle[(i + 1) % cycle.len()];
        if let Some(location) = graph
            .forward_edges(from)
            .iter()
            .find(|edge| &edge.to == to)
            .and_then(|edge| edge.location.clone())
        {
            locations.push(location);
        }
    }
    locations
}

/// Detects cycles in the active subgraph using DFS three-color marking.
/// Returns a list of cycles, each being a path of PackageIds.
fn find_cycles(graph: &LoadOrderGraph, active: &HashSet<&PackageId>) -> Vec<Vec<PackageId>> {
    let mut color: HashMap<&PackageId, u8> = HashMap::new();
    let mut cycles: Vec<Vec<PackageId>> = Vec::new();
    let mut stack: Vec<&PackageId> = Vec::new();

    for node in active {
        if color.get(node).copied().unwrap_or(0) == 0 {
            dfs_cycle(graph, active, node, &mut stack, &mut color, &mut cycles);
        }
    }

    dedup_cycles(&mut cycles);

    cycles
}

fn dfs_cycle<'a>(
    graph: &'a LoadOrderGraph,
    active: &HashSet<&PackageId>,
    node: &'a PackageId,
    stack: &mut Vec<&'a PackageId>,
    color: &mut HashMap<&'a PackageId, u8>,
    cycles: &mut Vec<Vec<PackageId>>,
) {
    color.insert(node, 1);
    stack.push(node);

    for edge in graph.forward_edges(node) {
        if !active.contains(&edge.to) {
            continue;
        }
        let to_color = color.get(&edge.to).copied().unwrap_or(0);
        if to_color == 0 {
            dfs_cycle(graph, active, &edge.to, stack, color, cycles);
        } else if to_color == 1
            && let Some(idx) = stack.iter().position(|&n| n == &edge.to)
        {
            let cycle: Vec<PackageId> = stack[idx..].iter().map(|&p| p.clone()).collect();
            cycles.push(cycle);
        }
    }

    stack.pop();
    color.insert(node, 2);
}

fn dedup_cycles(cycles: &mut Vec<Vec<PackageId>>) {
    let mut seen: HashSet<Vec<PackageId>> = HashSet::new();
    let mut result: Vec<Vec<PackageId>> = Vec::new();
    for cycle in cycles.drain(..) {
        if cycle.is_empty() {
            continue;
        }
        let min_idx = cycle
            .iter()
            .enumerate()
            .min_by_key(|(_, p)| *p)
            .map(|(i, _)| i)
            .unwrap_or(0);
        let len = cycle.len();
        let normalized: Vec<PackageId> = (0..len)
            .map(|i| cycle[(min_idx + i) % len].clone())
            .collect();
        if seen.insert(normalized.clone()) {
            result.push(normalized);
        }
    }
    *cycles = result;
}
