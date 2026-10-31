import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { appVersion, loadTargets, releaseInfo, run } from './common.mjs';

export function nativeVersions(version) {
  const match = /^((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))(?:-([0-9A-Za-z.]+))?$/.exec(
    version,
  );
  if (!match)
    throw new Error(
      'Native package versions require SemVer without build metadata or hyphens in prerelease identifiers',
    );
  const [, base, prerelease] = match;
  if (prerelease?.split('.').some((part) => !part || /^0\d+$/.test(part))) {
    throw new Error('Invalid SemVer prerelease identifiers');
  }
  releaseInfo(version);
  return {
    deb: prerelease ? `${base}~${prerelease}` : base,
    rpmVersion: base,
    rpmRelease: prerelease ? `0.${prerelease}` : '1',
    bundleVersion: base,
  };
}

export function bundleConfig(version, platform) {
  if (!['linux', 'macos'].includes(platform))
    throw new Error('Native bundle platform must be linux or macos');
  const native = nativeVersions(version);
  if (native.deb === native.bundleVersion)
    throw new Error('Native version overrides are only required for prereleases');
  return platform === 'linux'
    ? { version: native.bundleVersion, bundle: { linux: { rpm: { release: native.rpmRelease } } } }
    : { version: native.bundleVersion, bundle: { macOS: { bundleVersion: native.bundleVersion } } };
}

export function debControl(source, version) {
  const native = nativeVersions(version);
  if (native.deb === native.bundleVersion)
    throw new Error('Debian version finalization requires a prerelease');
  const fields = [...source.matchAll(/^Version:[^\r\n]*$/gm)];
  if (
    fields.length !== 1 ||
    fields[0][0].slice('Version:'.length).trim() !== native.bundleVersion
  ) {
    throw new Error('Expected exactly one Debian Version field containing the native base version');
  }
  return source.replace(/^Version:[^\r\n]*$/m, `Version: ${native.deb}`);
}

export function finalize(platform) {
  if (platform !== 'linux') throw new Error('Only Linux Debian installers need finalization');
  const version = appVersion();
  const native = nativeVersions(version);
  if (native.deb === native.bundleVersion)
    throw new Error('Debian version finalization requires a prerelease');
  const target = loadTargets().include.find((item) => item.platform === platform);
  const directory = resolve('target', target.target, 'release/bundle/deb');
  const candidates = readdirSync(directory).filter((name) => name.endsWith('.deb'));
  if (candidates.length !== 1)
    throw new Error(`Expected exactly one Debian installer in ${directory}`);
  const installer = join(directory, candidates[0]);
  const extracted = mkdtempSync(join(tmpdir(), 'rimr-deb-'));
  run('dpkg-deb', ['--raw-extract', installer, extracted]);
  const control = join(extracted, 'DEBIAN/control');
  writeFileSync(control, debControl(readFileSync(control, 'utf8'), version));
  // Repack the extracted payload without rebuilding or changing application files.
  run('dpkg-deb', ['--build', '--root-owner-group', extracted, installer]);
  if (run('dpkg-deb', ['--field', installer, 'Version']) !== native.deb) {
    throw new Error('Finalized Debian installer has an unexpected version');
  }
  console.log(`Finalized ${installer}: ${native.deb}`);
}

export function withMountedDmg(installer, inspect, ops = { run, mkdtempSync, rmdirSync }) {
  const mount = ops.mkdtempSync(join(tmpdir(), 'rimr-dmg-'));
  let attached = false;
  let result;
  const errors = [];
  try {
    // The DMG includes our GPL license, which hdiutil prompts to accept when mounting.
    ops.run('hdiutil', ['attach', installer, '-readonly', '-nobrowse', '-mountpoint', mount], {
      input: 'Y\n',
    });
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

export function nativeMetadata(target, directory, version, app) {
  if (target.platform === 'linux') {
    const bytes = readFileSync(join(directory, 'RimR'));
    if (
      bytes.subarray(0, 4).toString('hex') !== '7f454c46' ||
      bytes[4] !== 2 ||
      bytes[5] !== 1 ||
      bytes.readUInt16LE(18) !== 62
    )
      throw new Error('The Linux executable is not x86_64');
    return;
  }
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

export function inspectAppArchive(source, inspect) {
  const entries = run('tar', ['-tzf', source]).split('\n');
  if (
    entries.some(
      (entry) => !/^\.?\/?RimR\.app(?:\/|$)/.test(entry) || entry.split('/').includes('..'),
    )
  )
    throw new Error('Updater archive must contain only RimR.app');
  const directory = mkdtempSync(join(tmpdir(), 'rimr-updater-app-'));
  try {
    run('tar', ['-xzf', source, '-C', directory]);
    return inspect(join(directory, 'RimR.app'));
  } finally {
    // Only the fresh extraction directory created above is removed.
    rmSync(directory, { recursive: true });
  }
}

export function osSignature(platform, installer, app) {
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
