import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { appVersion, git, loadTargets, releaseInfo, reportError, run } from './common.mjs';
import {
  inspectAppArchive,
  nativeMetadata,
  nativeVersions,
  osSignature,
  withMountedDmg,
} from './native-packages.mjs';
import { updaterManifest, updaterPublicKey, verifyUpdaterSignature } from './updater.mjs';

const targets = loadTargets();

const extensions = {
  nsis: 'exe',
  deb: 'deb',
  rpm: 'rpm',
  dmg: 'dmg',
  appimage: 'AppImage',
  app: 'app.tar.gz',
};

export const updaterKinds = { windows: 'nsis', linux: 'appimage', macos: 'app' };

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

export function bundleSource(directory, kind) {
  const folder = join(directory, 'bundle', kind === 'app' ? 'macos' : kind);
  const candidates = readdirSync(folder).filter((name) => name.endsWith(`.${extensions[kind]}`));
  if (candidates.length !== 1) throw new Error(`Expected one ${kind} artifact in ${folder}`);
  return join(folder, candidates[0]);
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
          : kind === 'appimage'
            ? bytes.length >= 20 &&
              bytes.subarray(0, 4).toString('hex') === '7f454c46' &&
              bytes[4] === 2 &&
              bytes[5] === 1 &&
              bytes.readUInt16LE(18) === 62 &&
              bytes.subarray(8, 11).toString('hex') === '414902'
            : kind === 'app'
              ? bytes.subarray(0, 3).toString('hex') === '1f8b08'
              : kind === 'dmg' &&
                bytes.length >= 512 &&
                bytes.subarray(-512, -508).toString() === 'koly';
  if (!valid) throw new Error(`Invalid ${kind} artifact format`);
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
    const expectedFiles = kinds(definition.platform).flatMap((kind) => {
      const name = assetName(expected.version, definition, kind);
      return [
        { name, kind },
        ...(kind === 'dmg' ? [] : [{ name: `${name}.sig`, kind: 'signature', for: name }]),
      ];
    });
    if (manifest.files.length !== expectedFiles.length)
      throw new Error('Incorrect installer count');
    for (const expectedFile of expectedFiles) {
      const { name, kind } = expectedFile;
      const matches = manifest.files.filter(
        (file) => file.name === name && file.kind === kind && file.for === expectedFile.for,
      );
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

export async function collect(platform) {
  const target = targets.include.find((item) => item.platform === platform);
  if (!target) throw new Error(`Unknown platform: ${platform}`);
  const info = releaseInfo(appVersion(), process.env.RIMR_RELEASE_TAG);
  const sha = git('rev-parse', 'HEAD');
  if (process.env.RIMR_RELEASE_SHA && sha !== process.env.RIMR_RELEASE_SHA)
    throw new Error('Build commit differs from the release commit');
  const directory = join('target', target.target, 'release');
  if (platform !== 'macos') nativeMetadata(target, directory, info.version);
  mkdirSync('dist-release', { recursive: true });
  const files = [];
  const publicKey = updaterPublicKey();
  for (const kind of bundleKinds(platform)) {
    const source = bundleSource(directory, kind);
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
        ? (kind === 'dmg' ? withMountedDmg : inspectAppArchive)(source, (app) => {
            nativeMetadata(target, directory, info.version, app);
            return osSignature(platform, source, app);
          })
        : osSignature(platform, source);
    files.push({
      name,
      kind,
      size: bytes.length,
      sha256: sha256(bytes),
      osSignature: signing,
    });
    if (kind !== 'dmg') {
      const signatureBytes = readFileSync(`${source}.sig`);
      await verifyUpdaterSignature(bytes, signatureBytes.toString('utf8'), publicKey, info.version);
      const signatureName = `${name}.sig`;
      copyFileSync(`${source}.sig`, join('dist-release', signatureName));
      files.push({
        name: signatureName,
        kind: 'signature',
        for: name,
        size: signatureBytes.length,
        sha256: sha256(signatureBytes),
      });
    }
  }
  const manifest = { ...info, sha, ...target, files };
  writeFileSync(`dist-release/manifest-${platform}.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

export async function verify(directory, expected, repository) {
  const entries = readdirSync(directory);
  const manifests = entries
    .filter((name) => /^manifest-.*\.json$/.test(name))
    .map((name) => JSON.parse(readFileSync(join(directory, name), 'utf8')));
  const files = verifyManifests(manifests, expected);
  if (entries.length !== manifests.length + files.length)
    throw new Error('Unexpected files in release artifacts');
  for (const file of files) {
    const bytes = readFileSync(join(directory, file.name));
    if (file.kind !== 'signature') verifyMagic(bytes, file.kind);
    if (bytes.length !== file.size || sha256(bytes) !== file.sha256)
      throw new Error(`Installer checksum mismatch: ${file.name}`);
  }
  const publicKey = updaterPublicKey();
  for (const file of files.filter((file) => file.kind === 'signature')) {
    await verifyUpdaterSignature(
      readFileSync(join(directory, file.for)),
      readFileSync(join(directory, file.name), 'utf8'),
      publicKey,
      expected.version,
    );
  }
  const updates = manifests.map((manifest) => {
    const kind = updaterKinds[manifest.platform];
    const file = manifest.files.find((file) => file.kind === kind);
    return {
      ...manifest,
      name: file.name,
      signature: readFileSync(join(directory, `${file.name}.sig`), 'utf8').trim(),
    };
  });
  const latest = `${JSON.stringify(updaterManifest(expected.version, expected.tag, repository, updates), null, 2)}\n`;
  writeFileSync(join(directory, 'latest.json'), latest);
  const allFiles = [
    ...files,
    ...entries
      .filter((name) => /^manifest-.*\.json$/.test(name))
      .map((name) => {
        const bytes = readFileSync(join(directory, name));
        return { name, kind: 'manifest', size: bytes.length, sha256: sha256(bytes) };
      }),
    {
      name: 'latest.json',
      kind: 'manifest',
      size: Buffer.byteLength(latest),
      sha256: sha256(latest),
    },
  ].sort((a, b) => a.name.localeCompare(b.name));
  writeFileSync(
    join(directory, 'SHA256SUMS'),
    allFiles.map((file) => `${file.sha256}  ${file.name}\n`).join(''),
  );
  return allFiles;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv[2] !== 'collect')
      throw new Error('Usage: node artifacts.mjs collect <platform>');
    console.log(JSON.stringify(await collect(process.argv[3]), null, 2));
  } catch (error) {
    reportError(error);
  }
}
