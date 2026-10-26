use super::*;

fn version(text: &str) -> Version { Version::parse(text).unwrap() }

#[test]
fn bumps_reset_lower_components_and_prerelease() {
    let current = version("1.2.3-rc.1");
    for (target, expected) in [("patch", "1.2.4"), ("minor", "1.3.0"), ("major", "2.0.0")] {
        assert_eq!(next_version(&current, target).unwrap(), version(expected));
    }
    assert_eq!(next_version(&current, "1.2.3").unwrap(), version("1.2.3"));
    assert_eq!(
        next_version(&current, "1.2.3-rc.2").unwrap(),
        version("1.2.3-rc.2")
    );
}

#[test]
fn refuses_non_increasing_or_ambiguous_versions() {
    let current = version("1.2.3");
    for target in [
        "1.2.3",
        "1.2.2",
        "1.2.3-rc.1",
        "v2.0.0",
        "2.0",
        "prepatch",
        "1.2.3+1",
        "2.0.0+1",
        "2.0.0-rc-preview.1",
    ] {
        assert!(next_version(&current, target).is_err(), "accepted {target}");
    }
}

#[test]
fn respects_windows_installer_component_limits() {
    assert!(next_version(&version("65534.0.0"), "65535.65535.65535-rc.1").is_ok());
    for target in ["65536.0.0", "1.65536.0", "1.0.65536"] {
        assert!(next_version(&version("0.0.0"), target).is_err());
    }
    assert!(next_version(&version("0.0.65535"), "patch").is_err());
    assert!(next_version(&version("18446744073709551615.0.0"), "major").is_err());
}

#[test]
fn metadata_requires_canonical_matching_tag_and_marks_prereleases() {
    let stable = release_info(&version("1.2.3"), Some("v1.2.3")).unwrap();
    assert_eq!(
        stable,
        json!({"version":"1.2.3", "tag":"v1.2.3", "prerelease":false})
    );
    let prerelease = release_info(&version("2.0.0-rc.1"), None).unwrap();
    assert_eq!(prerelease["tag"], "v2.0.0-rc.1");
    assert_eq!(prerelease["prerelease"], true);
    for tag in ["1.2.3", "v1.2.4", "v01.2.3", "refs/tags/v1.2.3", "v1.2.3+1"] {
        assert!(
            release_info(&version("1.2.3"), Some(tag)).is_err(),
            "accepted {tag}"
        );
    }
}

#[test]
fn edits_only_workspace_version_and_keeps_comments() {
    let source = "# release version\n[workspace.package]\nversion = '1.2.3' # shared\nedition = '2024'\n\n[workspace.dependencies]\nother = '1.2.3'\n";
    let output = updated_manifest(source, &version("1.3.0-rc.1")).unwrap();
    assert_eq!(
        output,
        "# release version\n[workspace.package]\nversion = \"1.3.0-rc.1\" # shared\nedition = '2024'\n\n[workspace.dependencies]\nother = '1.2.3'\n"
    );
    for source in [
        "[package]\nversion='1.2.3'",
        "[workspace.package]\nversion=3",
    ] {
        assert!(updated_manifest(source, &version("2.0.0")).is_err());
    }
    let crlf = "[workspace.package]\r\nversion = \"1.2.3\"\r\n";
    assert_eq!(
        updated_manifest(crlf, &version("1.3.0")).unwrap(),
        "[workspace.package]\r\nversion = \"1.3.0\"\r\n"
    );
}

fn lock_fixture(local_version: &str, registry_version: &str) -> DocumentMut {
    format!("version = 4\n\n[[package]]\nname = \"local\"\nversion = \"{local_version}\"\ndependencies = [\"remote\"]\n\n[[package]]\nname = \"remote\"\nversion = \"{registry_version}\"\nsource = \"registry+https://github.com/rust-lang/crates.io-index\"\nchecksum = \"unchanged\"\n").parse().unwrap()
}

#[test]
fn lock_validation_allows_only_workspace_version_changes() {
    let names = BTreeSet::from(["local".to_owned()]);
    let validate = |after: &DocumentMut| {
        validate_lock_change(
            lock_fixture("1.0.0", "5.0.0"),
            after,
            &names,
            &version("1.0.0"),
            &version("1.1.0"),
        )
    };
    assert!(validate(&lock_fixture("1.1.0", "5.0.0")).is_ok());
    assert!(validate(&lock_fixture("1.1.0", "5.1.0")).is_err());
    assert!(validate(&lock_fixture("1.0.0", "5.0.0")).is_err());
    let mut checksum_change = lock_fixture("1.1.0", "5.0.0");
    checksum_change["package"]
        .as_array_of_tables_mut()
        .unwrap()
        .get_mut(1)
        .unwrap()["checksum"] = toml_edit::value("changed");
    assert!(validate(&checksum_change).is_err());
    let missing = BTreeSet::from(["local".to_owned(), "absent".to_owned()]);
    assert!(
        validate_lock_change(
            lock_fixture("1.0.0", "5.0.0"),
            &lock_fixture("1.1.0", "5.0.0"),
            &missing,
            &version("1.0.0"),
            &version("1.1.0")
        )
        .is_err()
    );
}

#[test]
fn workspace_metadata_excludes_non_members() {
    let metadata = json!({"workspace_members":["local-id"], "packages":[{"id":"local-id", "name":"local"}, {"id":"external-id", "name":"remote"}]});
    assert_eq!(
        workspace_names(&metadata).unwrap(),
        BTreeSet::from(["local".to_owned()])
    );
    assert!(workspace_names(&json!({"workspace_members":[], "packages":[]})).is_err());
}

#[test]
fn remote_requires_exact_main_and_absent_release_tag() {
    assert!(validate_remote("abc\trefs/heads/main\n", "abc", "refs/tags/v1.2.3").is_ok());
    for refs in [
        "",
        "def\trefs/heads/main",
        "abc\trefs/heads/main\nxyz\trefs/tags/v1.2.3",
        "malformed",
    ] {
        assert!(validate_remote(refs, "abc", "refs/tags/v1.2.3").is_err());
    }
}

#[test]
fn push_updates_only_main_and_one_tag_atomically() {
    assert_eq!(
        push_arguments("v1.2.3-rc.1"),
        [
            "push",
            "--atomic",
            "origin",
            "HEAD:refs/heads/main",
            "refs/tags/v1.2.3-rc.1"
        ]
    );
}

#[test]
fn cli_parses_release_modes_and_rejects_unknown_flags() {
    use clap::Parser;

    assert!(
        crate::Cli::try_parse_from(["xtask", "release", "1.2.3-rc.1", "--dry-run", "--no-push"])
            .is_ok()
    );
    assert!(crate::Cli::try_parse_from(["xtask", "release-info", "--tag", "v1.2.3"]).is_ok());
    assert!(crate::Cli::try_parse_from(["xtask", "release", "patch", "--force"]).is_err());
    assert!(crate::Cli::try_parse_from(["xtask", "release"]).is_err());
}
