import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { releaseInfo, reportError, run } from './common.mjs';
import { sha256, verify } from './artifacts.mjs';
import { api, requireDraft, verifyTag } from './github.mjs';

export function releaseNotes(body, notes) {
  const start = '<!-- rimr-signing:start -->';
  const end = '<!-- rimr-signing:end -->';
  const block = `${start}\n${notes}\n${end}`;
  const before = body.indexOf(start);
  const after = body.indexOf(end);
  if (before < 0 !== after < 0 || (before >= 0 && after < before))
    throw new Error('Malformed installer signing section in draft release');
  return before < 0
    ? `${body.trim()}\n\n${block}`.trim()
    : body.slice(0, before) + block + body.slice(after + end.length);
}

async function main() {
  if (!process.env.GH_TOKEN || !process.env.GITHUB_REPOSITORY)
    throw new Error('GitHub release credentials are required');
  const info = releaseInfo(process.env.RIMR_RELEASE_VERSION, process.env.RIMR_RELEASE_TAG);
  const sha = process.env.RIMR_RELEASE_SHA;
  const files = verify('dist-release', { ...info, sha });
  await verifyTag(info.tag, sha);
  let release = await api(`releases/tags/${encodeURIComponent(info.tag)}`, 'GET', undefined, true);
  requireDraft(release, info.tag);
  const notes = `Installer signing status:\n${files.map((file) => `- ${file.name}: ${file.signature}`).join('\n')}\n`;
  if (!release) {
    release = await api('releases', 'POST', {
      tag_name: info.tag,
      target_commitish: sha,
      name: `RimR ${info.tag}`,
      draft: true,
      prerelease: info.prerelease,
      generate_release_notes: true,
      body: releaseNotes('', notes),
    });
  }
  const assets = [
    ...files.map((file) => join('dist-release', file.name)),
    'dist-release/SHA256SUMS',
  ];
  run('gh', [
    'release',
    'upload',
    info.tag,
    '--repo',
    process.env.GITHUB_REPOSITORY,
    '--clobber',
    ...assets,
  ]);
  const uploaded = await api(`releases/${release.id}/assets?per_page=100`);
  const checksums = readFileSync('dist-release/SHA256SUMS');
  const expectedAssets = [
    ...files,
    { name: 'SHA256SUMS', size: checksums.length, sha256: sha256(checksums) },
  ];
  if (
    uploaded.length !== expectedAssets.length ||
    expectedAssets.some(
      (file) =>
        !uploaded.some(
          (asset) =>
            asset.name === file.name &&
            asset.size === file.size &&
            asset.digest === `sha256:${file.sha256}`,
        ),
    )
  )
    throw new Error('Uploaded release assets do not match the complete installer set');
  await verifyTag(info.tag, sha);
  await api(`releases/${release.id}`, 'PATCH', {
    draft: false,
    body: releaseNotes(release.body ?? '', notes),
    prerelease: info.prerelease,
    make_latest: info.prerelease ? 'false' : 'true',
  });
  if (process.env.GITHUB_STEP_SUMMARY)
    writeFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `Published RimR ${info.tag} from ${sha}.\n\n${notes}`,
    );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(reportError);
