use super::*;

#[test]
fn add_edge_preserves_direction() {
    let mut g = LoadOrderGraph::new();
    let a = PackageId::new("a");
    let b = PackageId::new("b");
    g.add_edge(a.clone(), b.clone(), EdgeKind::LoadAfter, EdgeSource::About);
    let fwd = g.forward_edges(&a);
    assert_eq!(fwd.len(), 1);
    assert_eq!(fwd[0].to, b);
    assert_eq!(fwd[0].from, a);
}

#[test]
fn self_edge_ignored() {
    let mut g = LoadOrderGraph::new();
    let a = PackageId::new("a");
    g.add_edge(a.clone(), a.clone(), EdgeKind::LoadAfter, EdgeSource::About);
    assert!(g.forward_edges(&a).is_empty());
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
    assert_eq!(g.incompatibilities(&a), []);
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
    assert_eq!(g.incompatibilities(&z), []);
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
