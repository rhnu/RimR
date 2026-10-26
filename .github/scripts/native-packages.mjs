import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
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
