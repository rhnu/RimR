import assert from 'node:assert/strict';
import { test } from 'node:test';
import { releaseInfo } from './common.mjs';
import { scopes, selectTag } from './plan.mjs';
import { assetName, sha256, verifyMagic, verifyManifests, withMountedDmg } from './artifacts.mjs';
import { requireDraft } from './github.mjs';
import { releaseNotes } from './publish.mjs';

test('documentation changes avoid compilations while shared inputs force both layers', () => {
  assert.deepEqual(scopes(['README.md', 'docs/development.md', 'modules/core/README.md']), {
    frontend: false,
    rust: false,
  });
  assert.deepEqual(scopes(['app/src/app/menu.tsx']), { frontend: true, rust: false });
  assert.deepEqual(scopes(['modules/core/src/lib.rs']), { frontend: false, rust: true });
  assert.deepEqual(scopes(['app/src-tauri/tauri.windows.conf.json']), {
    frontend: false,
    rust: true,
  });
  assert.deepEqual(scopes(['app/src/commands/generated/types.ts']), { frontend: true, rust: true });
  for (const path of [
    '.github/workflows/ci.yml',
    'package.json',
    'pnpm-lock.yaml',
    'new-build-input',
  ]) {
    assert.deepEqual(scopes([path]), { frontend: true, rust: true });
  }
  assert.deepEqual(scopes([], true), { frontend: true, rust: true });
});

test('release intent requires an unambiguous version tag at the selected commit', () => {
  assert.equal(selectTag(['docs']), '');
  assert.equal(selectTag(['docs', 'v1.2.3']), 'v1.2.3');
  assert.equal(selectTag(['v1.2.3'], 'v1.2.3'), 'v1.2.3');
  assert.throws(() => selectTag(['v1.2.3', 'v1.2.4']));
  assert.throws(() => selectTag([], 'v1.2.3'));
});

test('tags must exactly match the resolved Cargo version and installers must represent it', () => {
  assert.deepEqual(releaseInfo('1.2.3'), { version: '1.2.3', tag: 'v1.2.3', prerelease: false });
  assert.equal(releaseInfo('1.2.3-rc.1').prerelease, true);
  for (const tag of ['1.2.3', 'v1.2.4', 'v01.2.3']) assert.throws(() => releaseInfo('1.2.3', tag));
  for (const version of ['65536.0.0', '0.65536.0', '0.0.65536', '1.2.3+1'])
    assert.throws(() => releaseInfo(version));
});

const definition = {
  platform: 'windows',
  architecture: 'x86_64',
  target: 'x86_64-pc-windows-msvc',
};
const expected = { sha: 'abc', tag: 'v1.2.3', version: '1.2.3' };
const file = {
  name: 'RimR-1.2.3-windows-x86_64-setup.exe',
  kind: 'nsis',
  size: 2,
  sha256: sha256(Buffer.from('MZ')),
};
const manifest = { ...definition, ...expected, files: [file] };
const kinds = () => ['nsis'];
const validate = (manifests) => verifyManifests(manifests, expected, [definition], kinds);

test('release artifacts reject incomplete sets, other commits, wrong architecture and duplicate files', () => {
  assert.equal(assetName('1.2.3', definition, 'nsis'), file.name);
  assert.deepEqual(validate([manifest]), [file]);
  for (const manifests of [
    [],
    [manifest, manifest],
    [{ ...manifest, sha: 'other' }],
    [{ ...manifest, version: '1.2.4' }],
    [{ ...manifest, tag: 'v1.2.4' }],
    [{ ...manifest, target: 'aarch64-pc-windows-msvc' }],
    [{ ...manifest, files: [] }],
    [{ ...manifest, files: [file, file] }],
    [{ ...manifest, files: [{ ...file, name: '../bad.exe' }] }],
    [{ ...manifest, files: [{ ...file, sha256: '' }] }],
    [{ ...manifest, files: [{ ...file, size: 0 }] }],
  ])
    assert.throws(() => validate(manifests));
});

test('installer signatures reject arbitrary files and mismatched formats', () => {
  verifyMagic(Buffer.from('MZpayload'), 'nsis');
  verifyMagic(Buffer.from('!<arch>\npayload'), 'deb');
  verifyMagic(Buffer.from('edabeedb', 'hex'), 'rpm');
  const dmg = Buffer.alloc(1024);
  dmg.write('koly', 512);
  verifyMagic(dmg, 'dmg');
  for (const kind of ['nsis', 'deb', 'rpm', 'dmg'])
    assert.throws(() => verifyMagic(Buffer.from('not an installer'), kind));
});

test('public releases cannot be overwritten and draft retries refresh signing notes without losing release notes', () => {
  requireDraft(null, 'v1.2.3');
  requireDraft({ draft: true }, 'v1.2.3');
  assert.throws(() => requireDraft({ draft: false }, 'v1.2.3'));
  const body = releaseNotes('Changes: fix loading.', 'Windows: unsigned');
  const refreshed = releaseNotes(body, 'Windows: signed');
  assert.ok(refreshed.includes('Changes: fix loading.'));
  assert.ok(refreshed.includes('Windows: signed'));
  assert.ok(!refreshed.includes('Windows: unsigned'));
  assert.equal(releaseNotes(refreshed, 'Windows: signed'), refreshed);
  assert.throws(() => releaseNotes('<!-- rimr-signing:start -->broken', 'new'));
});

test('DMG inspection detaches and cleans up after success or failure', () => {
  for (const failure of [false, true]) {
    const calls = [];
    const ops = {
      mkdtempSync: () => '/mount',
      rmdirSync: (path) => calls.push(['remove', path]),
      run: (command, args, options) =>
        calls.push([command, ...args, ...(options ? [options] : [])]),
    };
    const inspect = (app) => {
      assert.match(app, /RimR\.app$/);
      if (failure) throw new Error('inspection failed');
      return 'signed';
    };
    if (failure) assert.throws(() => withMountedDmg('release.dmg', inspect, ops));
    else assert.equal(withMountedDmg('release.dmg', inspect, ops), 'signed');
    assert.deepEqual(calls, [
      [
        'hdiutil',
        'attach',
        'release.dmg',
        '-readonly',
        '-nobrowse',
        '-mountpoint',
        '/mount',
        { input: 'Y\n' },
      ],
      ['hdiutil', 'detach', '/mount'],
      ['remove', '/mount'],
    ]);
  }
});

test('DMG cleanup failure fails inspection', () => {
  const ops = {
    mkdtempSync: () => '/mount',
    rmdirSync: () => {},
    run: (_command, args) => {
      if (args[0] === 'detach') throw new Error('detach failed');
    },
  };
  assert.throws(() => withMountedDmg('release.dmg', () => 'signed', ops), /detach failed/);
});
