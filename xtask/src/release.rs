use std::{collections::BTreeSet, fs, path::Path, process::Command};

use anyhow::{Context, Result, bail, ensure};
use clap::Args;
use semver::{BuildMetadata, Prerelease, Version};
use serde_json::{Value, json};
use toml_edit::DocumentMut;

#[cfg(test)]
mod tests;

#[derive(Debug, Args)]
pub struct Options {
    /// patch, minor, major, or an explicit semver (including e.g. 1.0.0-rc.1).
    /// Bumps increment the named component and clear prerelease/build metadata.
    target: String,
    /// Validate clean main and remote refs, then preview; no fetch, file edits or checks.
    #[arg(long)]
    dry_run: bool,
    /// Create the checked release commit and annotated tag without pushing.
    #[arg(long)]
    no_push: bool,
}

/// Read the workspace version at runtime, including when this executable is reused.
pub fn print_info(root: &Path, tag: Option<&str>) -> Result<()> {
    let manifest = read_document(&root.join("Cargo.toml"))?;
    let version = workspace_version(&manifest)?;
    println!("{}", release_info(&version, tag)?);
    Ok(())
}

pub fn run(root: &Path, options: &Options) -> Result<()> {
    let manifest_path = root.join("Cargo.toml");
    let manifest_source = fs::read_to_string(&manifest_path).context("read Cargo.toml")?;
    let manifest = manifest_source.parse().context("parse Cargo.toml")?;
    let current = workspace_version(&manifest)?;
    let next = next_version(&current, &options.target)?;
    let tag = format!("v{next}");
    let head = preflight(root, &tag, options.dry_run)?;
    let push = push_arguments(&tag);
    println!("Release {current} -> {next}");
    if options.dry_run {
        println!("[dry-run] update Cargo.toml workspace version and Cargo.lock workspace packages");
        println!("[dry-run] pnpm check");
        println!("[dry-run] git add -- Cargo.toml Cargo.lock");
        println!("[dry-run] git commit -m \"chore(release): {tag}\"");
        println!("[dry-run] git tag -a {tag} -m \"Release {tag}\"");
        println!(
            "{}git {}",
            if options.no_push {
                "Manual push: "
            } else {
                "[dry-run] "
            },
            push.join(" ")
        );
        return Ok(());
    }

    let metadata = capture(
        root,
        "cargo",
        &["metadata", "--locked", "--no-deps", "--format-version", "1"],
    )?;
    let names =
        workspace_names(&serde_json::from_str(&metadata).context("decode Cargo metadata")?)?;
    let lock_path = root.join("Cargo.lock");
    let lock = read_document(&lock_path)?;
    let new_manifest = updated_manifest(&manifest_source, &next)?;
    fs::write(&manifest_path, &new_manifest).context("write release version to Cargo.toml")?;
    // Metadata with --no-deps skips resolution and does not refresh Cargo.lock.
    run_command(root, "cargo", &["update", "--workspace", "--offline"])
        .context("refresh Cargo.lock; edited files were retained for inspection")?;
    let new_lock = read_document(&lock_path)?;
    validate_lock_change(lock, &new_lock, &names, &current, &next)
        .context("Cargo.lock changed beyond workspace versions; edited files were retained")?;

    run_checks(root).context("release checks failed; edited files were retained for inspection")?;
    ensure!(
        capture(root, "git", &["rev-parse", "HEAD"])? == head,
        "HEAD changed during release checks; files retained"
    );
    ensure!(
        capture(root, "git", &["branch", "--show-current"])? == "main",
        "branch changed during release checks; files retained"
    );
    ensure_release_changes(root)?;
    ensure!(
        fs::read_to_string(&manifest_path)? == new_manifest,
        "Cargo.toml changed during checks; inspect files"
    );
    ensure!(
        read_document(&lock_path)?.to_string() == new_lock.to_string(),
        "Cargo.lock changed during checks; inspect files"
    );
    ensure_remote(root, &head, &tag)?;
    ensure_tag_absent(root, &tag)?;
    run_command(root, "git", &["add", "--", "Cargo.toml", "Cargo.lock"])?;
    run_command(
        root,
        "git",
        &["commit", "-m", &format!("chore(release): {tag}")],
    )?;
    run_command(
        root,
        "git",
        &["tag", "-a", &tag, "-m", &format!("Release {tag}")],
    )
    .context("release commit retained; annotated tag creation failed")?;
    if options.no_push {
        println!(
            "Release commit and tag created. Push with: git {}",
            push.join(" ")
        );
    } else {
        let args: Vec<_> = push.iter().map(String::as_str).collect();
        run_command(root, "git", &args)
            .context("atomic push failed; local release commit and tag were retained")?;
        println!("Released {tag}");
    }
    Ok(())
}

fn read_document(path: &Path) -> Result<DocumentMut> {
    fs::read_to_string(path)
        .with_context(|| format!("read {}", path.display()))?
        .parse()
        .with_context(|| format!("parse {}", path.display()))
}

fn workspace_version(manifest: &DocumentMut) -> Result<Version> {
    let value = manifest
        .get("workspace")
        .and_then(|item| item.get("package"))
        .and_then(|item| item.get("version"))
        .and_then(toml_edit::Item::as_str)
        .context("Cargo.toml requires a string workspace.package.version")?;
    Version::parse(value).context("workspace.package.version must be semver")
}

fn release_info(version: &Version, tag: Option<&str>) -> Result<Value> {
    installer_version(version)?;
    let expected = format!("v{version}");
    if let Some(tag) = tag {
        let parsed = Version::parse(
            tag.strip_prefix('v')
                .context("release tag must begin with v")?,
        )
        .context("release tag must contain valid semver")?;
        ensure!(
            tag == expected && parsed == *version,
            "release tag {tag} must exactly match workspace version {expected}"
        );
    }
    Ok(
        json!({ "version": version.to_string(), "tag": expected, "prerelease": !version.pre.is_empty() }),
    )
}

fn next_version(current: &Version, target: &str) -> Result<Version> {
    let mut next = current.clone();
    let increment = |value: u64| value.checked_add(1).context("version component overflow");
    match target {
        "major" => {
            next.major = increment(next.major)?;
            next.minor = 0;
            next.patch = 0;
        },
        "minor" => {
            next.minor = increment(next.minor)?;
            next.patch = 0;
        },
        "patch" => {
            next.patch = increment(next.patch)?;
        },
        _ => {
            next = Version::parse(target)
                .context("target must be patch, minor, major, or an explicit semver")?;
        },
    }
    if matches!(target, "major" | "minor" | "patch") {
        next.pre = Prerelease::EMPTY;
        next.build = BuildMetadata::EMPTY;
    }
    ensure!(
        next.cmp_precedence(current).is_gt(),
        "new version {next} must be greater than {current} in semver precedence"
    );
    installer_version(&next)?;
    Ok(next)
}

fn installer_version(version: &Version) -> Result<()> {
    ensure!(
        [version.major, version.minor, version.patch]
            .iter()
            .all(|value| u16::try_from(*value).is_ok()),
        "Windows installer version components must be at most 65535"
    );
    ensure!(
        version.build.is_empty(),
        "release versions cannot contain build metadata because installer versions must be unambiguous"
    );
    ensure!(
        !version.pre.as_str().contains('-'),
        "prerelease identifiers cannot contain hyphens because RPM releases cannot represent them"
    );
    Ok(())
}

fn updated_manifest(source: &str, version: &Version) -> Result<String> {
    let mut manifest: DocumentMut = source.parse().context("parse Cargo.toml")?;
    workspace_version(&manifest)?;
    let value = manifest["workspace"]["package"]["version"]
        .as_value_mut()
        .context("workspace version must be a TOML value")?;
    let decor = value.decor().clone();
    *value = toml_edit::Value::from(version.to_string());
    *value.decor_mut() = decor;
    let output = manifest.to_string();
    Ok(if source.contains("\r\n") {
        output.replace('\n', "\r\n")
    } else {
        output
    })
}

fn workspace_names(metadata: &Value) -> Result<BTreeSet<String>> {
    let members = metadata["workspace_members"]
        .as_array()
        .context("Cargo metadata missing workspace_members")?;
    let packages = metadata["packages"]
        .as_array()
        .context("Cargo metadata missing packages")?;
    let mut names = BTreeSet::new();
    for package in packages {
        if members.contains(&package["id"]) {
            names.insert(
                package["name"]
                    .as_str()
                    .context("workspace package missing name")?
                    .to_owned(),
            );
        }
    }
    ensure!(
        !names.is_empty(),
        "Cargo metadata contains no workspace packages"
    );
    Ok(names)
}

/// Verify Cargo changed only workspace versions, preserving the dependency resolution.
fn validate_lock_change(
    mut lock: DocumentMut,
    refreshed: &DocumentMut,
    names: &BTreeSet<String>,
    current: &Version,
    next: &Version,
) -> Result<()> {
    let packages = lock["package"]
        .as_array_of_tables_mut()
        .context("Cargo.lock missing package entries")?;
    let mut changed = BTreeSet::new();
    for package in packages.iter_mut() {
        let name = package
            .get("name")
            .and_then(toml_edit::Item::as_str)
            .context("lock package missing name")?;
        if names.contains(name) && !package.contains_key("source") {
            ensure!(
                package.get("version").and_then(toml_edit::Item::as_str)
                    == Some(current.to_string().as_str()),
                "workspace lock version for {name} must match {current}"
            );
            changed.insert(name.to_owned());
            package["version"] = toml_edit::value(next.to_string());
        }
    }
    ensure!(
        changed == *names,
        "Cargo.lock must contain every workspace package at the current version"
    );
    ensure!(
        lock.to_string() == refreshed.to_string(),
        "Cargo changed lock data outside workspace package versions"
    );
    Ok(())
}

fn preflight(root: &Path, tag: &str, dry_run: bool) -> Result<String> {
    ensure!(
        capture(
            root,
            "git",
            &["status", "--porcelain=v1", "--untracked-files=all"]
        )?
        .is_empty(),
        "release requires a clean working tree and index"
    );
    ensure!(
        capture(root, "git", &["branch", "--show-current"])? == "main",
        "release requires the main branch"
    );
    let head = capture(root, "git", &["rev-parse", "HEAD"])?;
    ensure_tag_absent(root, tag)?;
    if !dry_run {
        run_command(
            root,
            "git",
            &[
                "fetch",
                "--no-tags",
                "origin",
                "+refs/heads/main:refs/remotes/origin/main",
            ],
        )?;
        ensure!(
            capture(root, "git", &["rev-parse", "refs/remotes/origin/main"])? == head,
            "main must exactly match fetched origin/main"
        );
    }
    ensure_remote(root, &head, tag)?;
    Ok(head)
}

fn ensure_tag_absent(root: &Path, tag: &str) -> Result<()> {
    let reference = format!("refs/tags/{tag}");
    ensure!(
        capture(
            root,
            "git",
            &["for-each-ref", "--format=%(refname)", &reference]
        )?
        .is_empty(),
        "release tag {tag} already exists locally"
    );
    Ok(())
}

fn ensure_remote(root: &Path, head: &str, tag: &str) -> Result<()> {
    let reference = format!("refs/tags/{tag}");
    let refs = capture(
        root,
        "git",
        &[
            "ls-remote",
            "--refs",
            "origin",
            "refs/heads/main",
            &reference,
        ],
    )?;
    validate_remote(&refs, head, &reference)
}

fn validate_remote(refs: &str, head: &str, tag: &str) -> Result<()> {
    let mut main = None;
    for line in refs.lines() {
        let (oid, name) = line
            .split_once('\t')
            .context("invalid git ls-remote response")?;
        ensure!(name != tag, "release tag {tag} already exists on origin");
        if name == "refs/heads/main" {
            main = Some(oid);
        }
    }
    ensure!(
        main == Some(head),
        "main must exactly match origin/main (no local or remote-only commits)"
    );
    Ok(())
}

fn ensure_release_changes(root: &Path) -> Result<()> {
    ensure!(
        capture(root, "git", &["diff", "--cached", "--name-only"])?.is_empty(),
        "index changed during release checks; inspect staged files"
    );
    let changed = capture(root, "git", &["diff", "--name-only"])?;
    ensure!(
        changed
            .lines()
            .all(|path| matches!(path, "Cargo.toml" | "Cargo.lock")),
        "checks changed files outside Cargo.toml and Cargo.lock; inspect the working tree"
    );
    ensure!(
        capture(root, "git", &["ls-files", "--others", "--exclude-standard"])?.is_empty(),
        "untracked files appeared during release checks; inspect the working tree"
    );
    Ok(())
}

fn push_arguments(tag: &str) -> Vec<String> {
    [
        "push",
        "--atomic",
        "origin",
        "HEAD:refs/heads/main",
        &format!("refs/tags/{tag}"),
    ]
    .into_iter()
    .map(str::to_owned)
    .collect()
}

fn run_checks(root: &Path) -> Result<()> {
    // Windows package-manager shims are batch files; only this fixed command uses cmd.
    #[cfg(windows)]
    let mut command = {
        let mut command = Command::new("cmd.exe");
        command.args(["/d", "/s", "/c", "pnpm check"]);
        // Versioning recompiles xtask; keep Cargo from replacing this running executable.
        command.env("CARGO_TARGET_DIR", root.join("target/release-check"));
        command
    };
    #[cfg(not(windows))]
    let mut command = {
        let mut command = Command::new("pnpm");
        command.arg("check");
        command
    };
    println!("$ pnpm check");
    let status = command
        .current_dir(root)
        .status()
        .context("execute pnpm check")?;
    ensure!(status.success(), "pnpm check failed ({status})");
    Ok(())
}

fn capture(root: &Path, program: &str, args: &[&str]) -> Result<String> {
    let output = Command::new(program)
        .args(args)
        .current_dir(root)
        .env("GIT_OPTIONAL_LOCKS", "0")
        .output()
        .with_context(|| format!("execute {program} {}", args.join(" ")))?;
    ensure!(
        output.status.success(),
        "{program} {} failed ({}): {}",
        args.join(" "),
        output.status,
        String::from_utf8_lossy(&output.stderr).trim()
    );
    Ok(String::from_utf8(output.stdout)
        .context("command output was not UTF-8")?
        .trim()
        .to_owned())
}

fn run_command(root: &Path, program: &str, args: &[&str]) -> Result<()> {
    println!("$ {program} {}", args.join(" "));
    let status = Command::new(program)
        .args(args)
        .current_dir(root)
        .status()
        .with_context(|| format!("execute {program} {}", args.join(" ")))?;
    if !status.success() {
        bail!("{program} {} failed ({status})", args.join(" "));
    }
    Ok(())
}
