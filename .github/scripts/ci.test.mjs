import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { releaseInfo } from './common.mjs';
import { scopes, selectTag } from './plan.mjs';
import { assetName, sha256, verifyMagic, verifyManifests } from './artifacts.mjs';
import { requireDraft } from './github.mjs';
import { releaseNotes } from './publish.mjs';
import { withMountedDmg } from './native-packages.mjs';
import { updaterManifest, verifyUpdaterSignature } from './updater.mjs';

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
const signatureFile = {
  name: `${file.name}.sig`,
  kind: 'signature',
  for: file.name,
  size: 100,
  sha256: sha256(Buffer.from('signature')),
};
const manifest = { ...definition, ...expected, files: [file, signatureFile] };
const kinds = () => ['nsis'];
const validate = (manifests) => verifyManifests(manifests, expected, [definition], kinds);

test('release artifacts reject incomplete sets, other commits, wrong architecture and duplicate files', () => {
  assert.equal(assetName('1.2.3', definition, 'nsis'), file.name);
  assert.deepEqual(validate([manifest]), [file, signatureFile]);
  for (const manifests of [
    [],
    [manifest, manifest],
    [{ ...manifest, sha: 'other' }],
    [{ ...manifest, version: '1.2.4' }],
    [{ ...manifest, tag: 'v1.2.4' }],
    [{ ...manifest, target: 'aarch64-pc-windows-msvc' }],
    [{ ...manifest, files: [] }],
    [{ ...manifest, files: [file, file] }],
    [{ ...manifest, files: [file, { ...signatureFile, for: 'other.exe' }] }],
    [{ ...manifest, files: [{ ...file, name: '../bad.exe' }, signatureFile] }],
    [{ ...manifest, files: [{ ...file, sha256: '' }, signatureFile] }],
    [{ ...manifest, files: [{ ...file, size: 0 }, signatureFile] }],
  ])
    assert.throws(() => validate(manifests));
});

test('release completeness includes every native package, updater archive and companion signature', () => {
  const linux = { platform: 'linux', architecture: 'x86_64', target: 'x86_64-unknown-linux-gnu' };
  const macos = { platform: 'macos', architecture: 'arm64', target: 'aarch64-apple-darwin' };
  const artifact = (name, kind) => ({ name, kind, size: 1, sha256: sha256('artifact') });
  const signed = (name, kind) => [
    artifact(name, kind),
    { ...artifact(`${name}.sig`, 'signature'), for: name },
  ];
  const manifests = [
    manifest,
    {
      ...linux,
      ...expected,
      files: [
        ...signed('RimR-1.2.3-linux-x86_64.AppImage', 'appimage'),
        ...signed('RimR-1.2.3-linux-x86_64.deb', 'deb'),
        ...signed('RimR-1.2.3-linux-x86_64.rpm', 'rpm'),
      ],
    },
    {
      ...macos,
      ...expected,
      files: [
        artifact('RimR-1.2.3-macos-arm64.dmg', 'dmg'),
        ...signed('RimR-1.2.3-macos-arm64.app.tar.gz', 'app'),
      ],
    },
  ];
  const kinds = (platform) =>
    ({ windows: ['nsis'], linux: ['appimage', 'deb', 'rpm'], macos: ['app', 'dmg'] })[platform];
  const verify = (values) => verifyManifests(values, expected, [definition, linux, macos], kinds);
  assert.equal(verify(manifests).length, 11);
  for (let platform = 0; platform < manifests.length; platform++) {
    for (const missing of manifests[platform].files) {
      const incomplete = manifests.map((item, index) =>
        index === platform
          ? { ...item, files: item.files.filter((file) => file !== missing) }
          : item,
      );
      assert.throws(() => verify(incomplete));
    }
  }
});

test('installer signatures reject arbitrary files and mismatched formats', () => {
  verifyMagic(Buffer.from('MZpayload'), 'nsis');
  verifyMagic(Buffer.from('!<arch>\npayload'), 'deb');
  verifyMagic(Buffer.from('edabeedb', 'hex'), 'rpm');
  const dmg = Buffer.alloc(1024);
  dmg.write('koly', 512);
  verifyMagic(dmg, 'dmg');
  const appimage = Buffer.alloc(64);
  appimage.write('\x7fELF');
  appimage[4] = 2;
  appimage[5] = 1;
  appimage.write('AI\x02', 8);
  appimage.writeUInt16LE(62, 18);
  verifyMagic(appimage, 'appimage');
  verifyMagic(Buffer.from('1f8b08', 'hex'), 'app');
  appimage.writeUInt16LE(183, 18);
  assert.throws(() => verifyMagic(appimage, 'appimage'));
  for (const kind of ['nsis', 'deb', 'rpm', 'dmg', 'appimage', 'app'])
    assert.throws(() => verifyMagic(Buffer.from('not an installer'), kind));
});

function signedUpdater(bytes, version = '1.2.3-rc.1') {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const keyId = Buffer.from('12345678');
  const encode = (text) => Buffer.from(text).toString('base64');
  const publicBytes = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  const publicBox = `untrusted comment: test key\n${Buffer.concat([Buffer.from('Ed'), keyId, publicBytes]).toString('base64')}\n`;
  const signature = sign(null, createHash('blake2b512').update(bytes).digest(), privateKey);
  const trusted = `timestamp:1\tfile:installer\tversion:${version}`;
  const global = sign(null, Buffer.concat([signature, Buffer.from(trusted)]), privateKey);
  const signatureBox = `untrusted comment: test signature\n${Buffer.concat([Buffer.from('ED'), keyId, signature]).toString('base64')}\ntrusted comment: ${trusted}\n${global.toString('base64')}\n`;
  return { publicKey: encode(publicBox), signature: encode(signatureBox) };
}

test('updater verification authenticates bytes, public key, trusted comment and full SemVer', async () => {
  const bytes = Buffer.from('installer bytes');
  const fixture = signedUpdater(bytes);
  await verifyUpdaterSignature(bytes, fixture.signature, fixture.publicKey, '1.2.3-rc.1');
  await assert.rejects(() =>
    verifyUpdaterSignature(
      Buffer.from('changed'),
      fixture.signature,
      fixture.publicKey,
      '1.2.3-rc.1',
    ),
  );
  await assert.rejects(() =>
    verifyUpdaterSignature(bytes, fixture.signature, signedUpdater(bytes).publicKey, '1.2.3-rc.1'),
  );
  await assert.rejects(() =>
    verifyUpdaterSignature(bytes, fixture.signature, fixture.publicKey, '1.2.3'),
  );
  const tampered = Buffer.from(
    Buffer.from(fixture.signature, 'base64')
      .toString()
      .replace('version:1.2.3-rc.1', 'version:1.2.3'),
  ).toString('base64');
  await assert.rejects(() => verifyUpdaterSignature(bytes, tampered, fixture.publicKey, '1.2.3'));
  for (const invalid of ['', 'not base64', Buffer.from('broken signature').toString('base64')])
    await assert.rejects(() =>
      verifyUpdaterSignature(bytes, invalid, fixture.publicKey, '1.2.3-rc.1'),
    );
});

test('updater manifests preserve prereleases and reference stable GitHub release asset names', () => {
  const manifest = updaterManifest('1.2.3-rc.1', 'v1.2.3-rc.1', 'owner/repo', [
    { platform: 'windows', architecture: 'x86_64', name: 'setup.exe', signature: 'windows-sig' },
    { platform: 'linux', architecture: 'x86_64', name: 'RimR.AppImage', signature: 'linux-sig' },
    { platform: 'macos', architecture: 'arm64', name: 'RimR.app.tar.gz', signature: 'macos-sig' },
  ]);
  assert.deepEqual(manifest, {
    version: '1.2.3-rc.1',
    platforms: {
      'windows-x86_64': {
        signature: 'windows-sig',
        url: 'https://github.com/owner/repo/releases/download/v1.2.3-rc.1/setup.exe',
      },
      'linux-x86_64': {
        signature: 'linux-sig',
        url: 'https://github.com/owner/repo/releases/download/v1.2.3-rc.1/RimR.AppImage',
      },
      'darwin-aarch64': {
        signature: 'macos-sig',
        url: 'https://github.com/owner/repo/releases/download/v1.2.3-rc.1/RimR.app.tar.gz',
      },
    },
  });
  assert.throws(() => updaterManifest('1.2.3', 'v1.2.3', '../repository', []));
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
