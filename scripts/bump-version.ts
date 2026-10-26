#!/usr/bin/env tsx
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import semver, { type ReleaseType } from "semver";

const RELEASE_TYPES: readonly ReleaseType[] = [
  "major",
  "minor",
  "patch",
  "premajor",
  "preminor",
  "prepatch",
  "prerelease",
];

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

interface CliOptions {
  target: string;
  dryRun: boolean;
  noPush: boolean;
  preid?: string;
}

function printUsageAndExit(code: number): never {
  const lines = [
    "Usage:",
    "  pnpm bump-version <newVersion|releaseType> [options]",
    "",
    "Arguments:",
    "  newVersion    Explicit semver, e.g. 0.3.0 or 1.0.0-rc.1",
    `  releaseType   One of: ${RELEASE_TYPES.join(", ")}`,
    "",
    "Options:",
    "  --dry-run     Print actions only; do not modify files or run git/cargo",
    "  --no-push     Commit and tag, but skip pushing to origin",
    "  --preid <id>  Pre-release identifier when using a prerelease bump",
    "  -h, --help    Show this help",
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
  process.exit(code);
}

function parseArgs(argv: readonly string[]): CliOptions {
  let target: string | undefined;
  let dryRun = false;
  let noPush = false;
  let preid: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    switch (arg) {
      case "-h":
      case "--help":
        printUsageAndExit(0);
        break;
      case "--dry-run":
        dryRun = true;
        break;
      case "--no-push":
        noPush = true;
        break;
      case "--preid": {
        const next = argv[i + 1];
        if (next === undefined) {
          fail("--preid requires a value");
        }
        preid = next;
        i++;
        break;
      }
      default:
        if (arg.startsWith("-")) {
          fail(`Unknown option: ${arg}`);
        }
        if (target !== undefined) {
          fail(`Unexpected positional argument: ${arg}`);
        }
        target = arg;
        break;
    }
  }

  if (target === undefined) {
    fail("Missing required argument: <newVersion|releaseType>");
  }

  return { target, dryRun, noPush, preid };
}

function fail(message: string): never {
  process.stderr.write(`error: ${message}\n\n`);
  printUsageAndExit(1);
}

function readText(absPath: string): string {
  return readFileSync(absPath, "utf8");
}

function writeText(absPath: string, content: string): void {
  writeFileSync(absPath, content, "utf8");
}

function detectEol(content: string): "\r\n" | "\n" {
  return content.includes("\r\n") ? "\r\n" : "\n";
}

function resolveNewVersion(
  current: string,
  target: string,
  preid: string | undefined,
): string {
  if ((RELEASE_TYPES as readonly string[]).includes(target)) {
    const next =
      preid !== undefined
        ? semver.inc(current, target as ReleaseType, preid)
        : semver.inc(current, target as ReleaseType);
    if (!next) {
      fail(`Failed to compute ${target} bump from ${current}`);
    }
    return next;
  }

  const cleaned = semver.valid(target);
  if (!cleaned) {
    fail(
      `Invalid version or release type: "${target}". ` +
        `Use a semver like 1.2.3 or one of: ${RELEASE_TYPES.join(", ")}.`,
    );
  }
  if (!semver.gt(cleaned, current)) {
    fail(`New version ${cleaned} must be greater than current ${current}.`);
  }
  return cleaned;
}

function readCurrentVersion(): string {
  const pkgRaw = readText(join(REPO_ROOT, "package.json"));
  const pkg = JSON.parse(pkgRaw) as { version?: unknown };
  if (typeof pkg.version !== "string") {
    fail("package.json is missing a string `version` field");
  }
  const v = semver.valid(pkg.version);
  if (!v) {
    fail(`package.json version is not valid semver: ${pkg.version}`);
  }
  return v;
}

function updateJsonVersion(absPath: string, newVersion: string): boolean {
  const original = readText(absPath);
  const eol = detectEol(original);
  const trailingNewline = original.endsWith("\n");
  const data = JSON.parse(original) as Record<string, unknown>;
  if (data.version === newVersion) return false;
  data.version = newVersion;
  const serialized = JSON.stringify(data, null, 2).replace(/\n/g, eol);
  writeText(absPath, trailingNewline ? `${serialized}${eol}` : serialized);
  return true;
}

const WORKSPACE_PACKAGE_VERSION_RE =
  /(\[workspace\.package\][^[]*?\nversion\s*=\s*")([^"]+)(")/;

function updateRootCargoVersion(absPath: string, newVersion: string): boolean {
  const original = readText(absPath);
  const match = original.match(WORKSPACE_PACKAGE_VERSION_RE);
  if (!match) {
    fail(
      `Could not find [workspace.package] version in ${relative(REPO_ROOT, absPath)}`,
    );
  }
  if (match[2] === newVersion) return false;
  const next = original.replace(
    WORKSPACE_PACKAGE_VERSION_RE,
    (_full, prefix: string, _old: string, suffix: string) =>
      `${prefix}${newVersion}${suffix}`,
  );
  writeText(absPath, next);
  return true;
}

interface RunOptions {
  dryRun: boolean;
}

function run(
  cmd: string,
  args: readonly string[],
  options: RunOptions & { capture?: boolean } = { dryRun: false },
): string {
  const display = `${cmd} ${args.join(" ")}`.trim();
  if (options.dryRun) {
    process.stdout.write(`[dry-run] $ ${display}\n`);
    return "";
  }
  process.stdout.write(`$ ${display}\n`);
  const result = execFileSync(cmd, args, {
    cwd: REPO_ROOT,
    stdio: options.capture ? ["ignore", "pipe", "inherit"] : "inherit",
    encoding: "utf8",
    shell: false,
  });
  return typeof result === "string" ? result : "";
}

function gitStatusPorcelain(): string {
  return execFileSync("git", ["status", "--porcelain"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: false,
  });
}

function ensureCleanWorktree(): void {
  let status: string;
  try {
    status = gitStatusPorcelain();
  } catch (err) {
    fail(
      `Failed to query git status. Is this a git repo? (${(err as Error).message})`,
    );
  }
  if (status.trim() !== "") {
    process.stderr.write(
      "error: working tree is dirty. Commit or stash changes before bumping version.\n" +
        "Tip: use --dry-run to preview without touching git.\n\n" +
        `${status}\n`,
    );
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));

  if (!opts.dryRun) {
    ensureCleanWorktree();
  }

  const current = readCurrentVersion();
  const next = resolveNewVersion(current, opts.target, opts.preid);
  const tag = `v${next}`;

  process.stdout.write(
    `Bumping version: ${current} -> ${next}` +
      (opts.dryRun ? " (dry-run)" : "") +
      "\n",
  );

  const pkgPath = join(REPO_ROOT, "package.json");
  const appPkgPath = join(REPO_ROOT, "app", "package.json");
  const tauriPath = join(REPO_ROOT, "app", "src-tauri", "tauri.conf.json");
  const cargoPath = join(REPO_ROOT, "Cargo.toml");

  const updates: Array<{ label: string; changed: boolean }> = [];

  if (opts.dryRun) {
    process.stdout.write(`[dry-run] write ${relative(REPO_ROOT, pkgPath)} version=${next}\n`);
    process.stdout.write(`[dry-run] write ${relative(REPO_ROOT, appPkgPath)} version=${next}\n`);
    process.stdout.write(
      `[dry-run] write ${relative(REPO_ROOT, tauriPath)} version=${next}\n`,
    );
    process.stdout.write(
      `[dry-run] write ${relative(REPO_ROOT, cargoPath)} [workspace.package].version=${next}\n`,
    );
  } else {
    updates.push({
      label: "package.json",
      changed: updateJsonVersion(pkgPath, next),
    });
    updates.push({
      label: "app/package.json",
      changed: updateJsonVersion(appPkgPath, next),
    });
    updates.push({
      label: "app/src-tauri/tauri.conf.json",
      changed: updateJsonVersion(tauriPath, next),
    });
    updates.push({
      label: "Cargo.toml",
      changed: updateRootCargoVersion(cargoPath, next),
    });
    for (const u of updates) {
      process.stdout.write(
        `  ${u.changed ? "updated" : "unchanged"} ${u.label}\n`,
      );
    }
  }

  run("cargo", ["update", "--workspace"], { dryRun: opts.dryRun });

  run("git", ["add", "-A"], { dryRun: opts.dryRun });
  run("git", ["commit", "-m", `release: ${tag}`], { dryRun: opts.dryRun });
  run("git", ["tag", "-a", tag, "-m", `Release ${tag}`], {
    dryRun: opts.dryRun,
  });

  if (opts.noPush) {
    process.stdout.write(
      "Skipping push (--no-push). Run `git push` and `git push --tags` when ready.\n",
    );
  } else {
    run("git", ["push"], { dryRun: opts.dryRun });
    run("git", ["push", "origin", tag], { dryRun: opts.dryRun });
  }

  process.stdout.write(
    `\nDone${opts.dryRun ? " (dry-run, no changes made)" : ""}: ${tag}\n`,
  );
}

main().catch((err: unknown) => {
  process.stderr.write(`bump-version failed: ${(err as Error).message}\n`);
  process.exit(1);
});
