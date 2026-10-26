import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bundleConfig, debControl, nativeVersions } from './native-packages.mjs';

test('stable native versions retain the numeric application version', () => {
  assert.deepEqual(nativeVersions('1.2.3'), {
    deb: '1.2.3',
    rpmVersion: '1.2.3',
    rpmRelease: '1',
    bundleVersion: '1.2.3',
  });
});

test('prereleases sort before the corresponding stable Linux package', () => {
  assert.deepEqual(nativeVersions('1.2.3-rc.1'), {
    deb: '1.2.3~rc.1',
    rpmVersion: '1.2.3',
    rpmRelease: '0.rc.1',
    bundleVersion: '1.2.3',
  });
  assert.equal(nativeVersions('2.0.0-beta.12').deb, '2.0.0~beta.12');
});

test('native version mapping rejects unsupported or ambiguous inputs', () => {
  for (const version of [
    '1.2.3+1',
    '1.2.3-rc.1+1',
    '1.2.3-rc-preview.1',
    'v1.2.3',
    '01.2.3',
    '1.2',
    '1.2.3-',
    '1.2.3-rc..1',
    '1.2.3-rc.01',
    '65536.0.0',
    '1.2.65536',
  ])
    assert.throws(() => nativeVersions(version), `accepted ${version}`);
});

test('bundle overrides change package metadata while keeping Cargo as the version source', () => {
  assert.deepEqual(bundleConfig('1.2.3-rc.1', 'linux'), {
    version: '1.2.3',
    bundle: { linux: { rpm: { release: '0.rc.1' } } },
  });
  assert.deepEqual(bundleConfig('1.2.3-rc.1', 'macos'), {
    version: '1.2.3',
    bundle: { macOS: { bundleVersion: '1.2.3' } },
  });
  assert.throws(() => bundleConfig('1.2.3', 'linux'));
  assert.throws(() => bundleConfig('1.2.3-rc.1', 'windows'));
});

test('Debian finalization edits only one matching Version field and preserves other content', () => {
  const control =
    'Package: rimr\nVersion: 1.2.3\nArchitecture: amd64\nDescription: RimR\n payload version 1.2.3\n';
  assert.equal(
    debControl(control, '1.2.3-rc.1'),
    'Package: rimr\nVersion: 1.2.3~rc.1\nArchitecture: amd64\nDescription: RimR\n payload version 1.2.3\n',
  );
  for (const invalid of [
    'Package: rimr\n',
    'Version: 1.2.2\n',
    'Version: 1.2.3\nVersion: 1.2.3\n',
    'Version: 1.2.3~rc.1\n',
  ])
    assert.throws(() => debControl(invalid, '1.2.3-rc.1'));
  assert.throws(() => debControl(control, '1.2.3'));
});
