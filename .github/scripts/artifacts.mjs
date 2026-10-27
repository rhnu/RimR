import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { appVersion, git, loadTargets, releaseInfo, reportError, run } from './common.mjs';
import { nativeVersions } from './native-packages.mjs';

const targets = loadTargets();

const extensions = { nsis: 'exe', deb: 'deb', rpm: 'rpm', dmg: 'dmg' };

export function bundleKinds(platform) {
  const config = JSON.parse(
    readFileSync(
      new URL(`../../app/src-tauri/tauri.${platform}.conf.json`, import.meta.url),
      'utf8',
    ),
  );
  return config.bundle.targets;
}

export function assetName(version, target, kind) {
  const extension = extensions[kind];
  if (!extension) throw new Error(`Unsupported installer type: ${kind}`);
  return `RimR-${version}-${target.platform}-${target.architecture}${kind === 'nsis' ? '-setup' : ''}.${extension}`;
}

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function verifyMagic(bytes, kind) {
  const valid =
    kind === 'nsis'
      ? bytes.subarray(0, 2).toString() === 'MZ'
      : kind === 'deb'
        ? bytes.subarray(0, 8).toString() === '!<arch>\n'
        : kind === 'rpm'
          ? bytes.subarray(0, 4).toString('hex') === 'edabeedb'
          : kind === 'dmg' &&
            bytes.length >= 512 &&
            bytes.subarray(-512, -508).toString() === 'koly';
  if (!valid) throw new Error(`Invalid ${kind} installer signature`);
}

export function verifyManifests(
  manifests,
  expected,
  definitions = targets.include,
  kinds = bundleKinds,
) {
  if (manifests.length !== definitions.length) throw new Error('Incomplete platform manifests');
  const names = new Set();
  for (const definition of definitions) {
    const matches = manifests.filter((manifest) => manifest.platform === definition.platform);
    if (matches.length !== 1) throw new Error(`Expected one ${definition.platform} manifest`);
    const manifest = matches[0];
    for (const key of ['sha', 'tag', 'version']) {
      if (manifest[key] !== expected[key])
        throw new Error(`Wrong ${key} in ${definition.platform} manifest`);
    }
    if (manifest.target !== definition.target || manifest.architecture !== definition.architecture)
      throw new Error('Wrong installer architecture');
    const expectedKinds = kinds(definition.platform);
    if (manifest.files.length !== expectedKinds.length)
      throw new Error('Incorrect installer count');
    for (const kind of expectedKinds) {
      const name = assetName(expected.version, definition, kind);
      const matches = manifest.files.filter((file) => file.name === name && file.kind === kind);
      if (matches.length !== 1 || names.has(name))
        throw new Error(`Missing or duplicate installer: ${name}`);
      const file = matches[0];
      if (!/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.size) || file.size <= 0)
        throw new Error(`Invalid installer digest: ${name}`);
      names.add(name);
    }
  }
  return manifests
    .flatMap((manifest) => manifest.files)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function withMountedDmg(installer, inspect, ops = { run, mkdtempSync, rmdirSync }) {
  const mount = ops.mkdtempSync(join(tmpdir(), 'rimr-dmg-'));
  let attached = false;
  let result;
  const errors = [];
  try {
    ops.run('hdiutil', ['attach', installer, '-readonly', '-nobrowse', '-mountpoint', mount]);
    attached = true;
    result = inspect(join(mount, 'RimR.app'));
  } catch (error) {
    errors.push(error);
  } finally {
    if (attached) {
      try {
        ops.run('hdiutil', ['detach', mount]);
      } catch (error) {
        errors.push(error);
      }
    }
    try {
      ops.rmdirSync(mount);
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, 'DMG inspection or cleanup failed');
  return result;
}

function nativeMetadata(target, directory, version, app) {
  if (target.platform === 'windows') {
    const binary = join(directory, 'RimR.exe');
    const bytes = readFileSync(binary);
    const offset = bytes.readUInt32LE(0x3c);
    if (
      bytes.subarray(0, 2).toString() !== 'MZ' ||
      bytes.subarray(offset, offset + 4).toString('hex') !== '50450000' ||
      bytes.readUInt16LE(offset + 4) !== 0x8664
    )
      throw new Error('The Windows executable is not x86_64');
    const actual = run(
      'pwsh',
      [
        '-NoProfile',
        '-Command',
        '(Get-Item -LiteralPath $env:RIMR_BINARY).VersionInfo.ProductVersion',
      ],
      { env: { ...process.env, RIMR_BINARY: binary } },
    );
    if (actual !== version)
      throw new Error(`Windows executable version ${actual} differs from ${version}`);
    return;
  }
  if (target.platform === 'macos') {
    const architectures = run('lipo', ['-archs', join(app, 'Contents/MacOS/RimR')]);
    if (architectures !== 'arm64')
      throw new Error(`Unexpected macOS architectures: ${architectures}`);
    const actual = run('plutil', [
      '-extract',
      'CFBundleShortVersionString',
      'raw',
      '-o',
      '-',
      join(app, 'Contents/Info.plist'),
    ]);
    if (actual !== nativeVersions(version).bundleVersion)
      throw new Error(`Unexpected macOS version: ${actual}`);
    const buildVersion = run('plutil', [
      '-extract',
      'CFBundleVersion',
      'raw',
      '-o',
      '-',
      join(app, 'Contents/Info.plist'),
    ]);
    if (buildVersion !== nativeVersions(version).bundleVersion)
      throw new Error(`Unexpected macOS bundle version: ${buildVersion}`);
  }
}

function signature(platform, installer, app) {
  if (platform === 'windows') {
    return run(
      'pwsh',
      [
        '-NoProfile',
        '-Command',
        '(Get-AuthenticodeSignature -LiteralPath $env:RIMR_INSTALLER).Status.ToString()',
      ],
      { env: { ...process.env, RIMR_INSTALLER: installer } },
    );
  }
  if (platform === 'macos') {
    const result = spawnSync('codesign', ['-d', '--verbose=4', app], { encoding: 'utf8' });
    if (result.error) throw result.error;
    return result.status !== 0
      ? 'unsigned'
      : result.stderr.includes('Signature=adhoc')
        ? 'ad-hoc'
        : 'signed';
  }
  return 'unsigned';
}

export function collect(platform) {
  const target = targets.include.find((item) => item.platform === platform);
  if (!target) throw new Error(`Unknown platform: ${platform}`);
  const info = releaseInfo(appVersion(), process.env.RIMR_RELEASE_TAG);
  const sha = git('rev-parse', 'HEAD');
  if (process.env.RIMR_RELEASE_SHA && sha !== process.env.RIMR_RELEASE_SHA)
    throw new Error('Build commit differs from the release commit');
  const directory = join('target', target.target, 'release');
  if (platform !== 'macos') nativeMetadata(target, directory, info.version);
  mkdirSync('dist-release', { recursive: true });
  const files = bundleKinds(platform).map((kind) => {
    const folder = join(directory, 'bundle', kind);
    const candidates = readdirSync(folder).filter((name) => name.endsWith(`.${extensions[kind]}`));
    if (candidates.length !== 1) throw new Error(`Expected one ${kind} installer in ${folder}`);
    const source = join(folder, candidates[0]);
    if (kind === 'deb') {
      if (
        run('dpkg-deb', ['--field', source, 'Architecture']) !== 'amd64' ||
        run('dpkg-deb', ['--field', source, 'Version']) !== nativeVersions(info.version).deb
      )
        throw new Error('Incorrect Debian package metadata');
    } else if (kind === 'rpm') {
      if (
        run('rpm', [
          '--query',
          '--package',
          '--queryformat',
          '%{ARCH}:%{VERSION}:%{RELEASE}',
          source,
        ]) !==
        `x86_64:${nativeVersions(info.version).rpmVersion}:${nativeVersions(info.version).rpmRelease}`
      )
        throw new Error('Incorrect RPM package metadata');
    }
    const bytes = readFileSync(source);
    verifyMagic(bytes, kind);
    const name = assetName(info.version, target, kind);
    copyFileSync(source, join('dist-release', name));
    const signing =
      platform === 'macos'
        ? withMountedDmg(source, (app) => {
            nativeMetadata(target, directory, info.version, app);
            return signature(platform, source, app);
          })
        : signature(platform, source);
    return {
      name,
      kind,
      size: bytes.length,
      sha256: sha256(bytes),
      signature: signing,
    };
  });
  const manifest = { ...info, sha, ...target, files };
  writeFileSync(`dist-release/manifest-${platform}.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

export function verify(directory, expected) {
  const entries = readdirSync(directory);
  const manifests = entries
    .filter((name) => /^manifest-.*\.json$/.test(name))
    .map((name) => JSON.parse(readFileSync(join(directory, name), 'utf8')));
  const files = verifyManifests(manifests, expected);
  if (entries.length !== manifests.length + files.length)
    throw new Error('Unexpected files in release artifacts');
  for (const file of files) {
    const bytes = readFileSync(join(directory, file.name));
    verifyMagic(bytes, file.kind);
    if (bytes.length !== file.size || sha256(bytes) !== file.sha256)
      throw new Error(`Installer checksum mismatch: ${file.name}`);
  }
  writeFileSync(
    join(directory, 'SHA256SUMS'),
    files.map((file) => `${file.sha256}  ${file.name}\n`).join(''),
  );
  return files;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv[2] !== 'collect')
      throw new Error('Usage: node artifacts.mjs collect <platform>');
    console.log(JSON.stringify(collect(process.argv[3]), null, 2));
  } catch (error) {
    reportError(error);
  }
}
