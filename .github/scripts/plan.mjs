import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { appVersion, git, loadTargets, output, releaseInfo, reportError } from './common.mjs';
import { api, requireDraft, verifyTag } from './github.mjs';

export function scopes(paths, force = false) {
  const result = { frontend: force, rust: force };
  for (const path of paths) {
    if (
      path.endsWith('.md') ||
      path.startsWith('docs/') ||
      ['LICENSE', '.rumdl.toml'].includes(path)
    )
      continue;
    if (
      path.startsWith('app/src-tauri/') ||
      path.startsWith('modules/') ||
      path.startsWith('xtask/') ||
      path.startsWith('.cargo/') ||
      /^Cargo\.(toml|lock)$/.test(path) ||
      path === 'rusteward.toml'
    ) {
      result.rust = true;
    } else if (path.startsWith('app/')) {
      result.frontend = true;
      if (path.startsWith('app/src/commands/generated/')) result.rust = true;
    } else {
      // Unknown shared inputs fail open to full validation, rather than skipping coverage.
      result.frontend = true;
      result.rust = true;
    }
  }
  return result;
}

export function selectTag(tags, requested = '') {
  const versions = tags.filter((tag) => tag.startsWith('v'));
  if (requested && !versions.includes(requested))
    throw new Error(`Tag ${requested} does not point at the selected commit`);
  if (versions.length > 1)
    throw new Error(`Multiple release tags point at this commit: ${versions.join(', ')}`);
  return requested || versions[0] || '';
}

function changedPaths(event, name, sha) {
  try {
    const before =
      name === 'pull_request' ? git('merge-base', event.pull_request.base.sha, sha) : event.before;
    if (!before || /^0+$/.test(before)) return null;
    return execFileSync('git', ['diff', '--name-only', '--no-renames', '-z', before, sha], {
      encoding: 'utf8',
    })
      .split('\0')
      .filter(Boolean);
  } catch (error) {
    console.warn(`Cannot determine changed files; running all checks: ${error.message}`);
    return null;
  }
}

export async function main() {
  const name = process.env.GITHUB_EVENT_NAME;
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  let sha = git('rev-parse', 'HEAD');
  let tag = '';
  if (name === 'workflow_dispatch') {
    if (process.env.GITHUB_REF !== 'refs/heads/main')
      throw new Error('Release retries must run from main');
    const requested = event.inputs?.tag;
    if (!requested || !/^v[0-9][0-9A-Za-z.+-]*$/.test(requested))
      throw new Error('An existing version tag is required');
    const resolved = git('rev-parse', '--verify', `refs/tags/${requested}^{commit}`);
    git('merge-base', '--is-ancestor', resolved, sha);
    git('checkout', '--detach', resolved);
    sha = resolved;
    tag = selectTag(git('tag', '--points-at', sha).split('\n'), requested);
  } else if (name === 'push' && process.env.GITHUB_REF === 'refs/heads/main') {
    tag = selectTag(git('tag', '--points-at', sha).split('\n'));
  }
  const info = tag ? releaseInfo(appVersion(), tag) : { version: '', tag: '', prerelease: false };
  if (tag && git('cat-file', '-t', `refs/tags/${tag}`) !== 'tag')
    throw new Error('Release tags must be annotated');
  if (tag) {
    await verifyTag(tag, sha);
    requireDraft(
      await api(`releases/tags/${encodeURIComponent(tag)}`, 'GET', undefined, true),
      tag,
    );
  }
  const paths = changedPaths(event, name, sha);
  const targets = loadTargets();
  output({
    sha,
    ...info,
    ...scopes(paths ?? [], Boolean(tag) || paths === null),
    targets: JSON.stringify(targets),
    'quality-runner': targets.include.find((target) => target.platform === 'windows').runner,
    'compatibility-targets': JSON.stringify({
      include: targets.include.filter((target) => target.platform !== 'windows'),
    }),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(reportError);
}
