import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appVersion, loadTargets, releaseInfo, reportError } from './common.mjs';
import { bundleConfig, finalize } from './native-packages.mjs';
import { bundleKinds, bundleSource } from './artifacts.mjs';
import { updaterPublicKey, verifyUpdaterSignature } from './updater.mjs';

function pnpm(args) {
  // npm_execpath identifies the real pnpm JS entry or standalone binary, avoiding Windows .cmd quoting.
  const entry = process.env.npm_execpath;
  if (!entry) throw new Error('Run installer builds through pnpm bundle');
  const script = /\.[cm]?js$/i.test(entry);
  const result = spawnSync(script ? process.execPath : entry, script ? [entry, ...args] : args, {
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`pnpm ${args.join(' ')} failed (${result.status})`);
}

function signingEnvironment() {
  for (const [variable, filename] of [
    ['TAURI_SIGNING_PRIVATE_KEY', 'rimr-updater.key'],
    ['TAURI_SIGNING_PRIVATE_KEY_PASSWORD', 'rimr-updater.password'],
  ]) {
    const file = join('.secrets', filename);
    if (!process.env.CI && process.env[variable] === undefined && existsSync(file))
      process.env[variable] = readFileSync(file, 'utf8').trim();
    // `tauri build` accepts key paths, while `tauri signer sign` only accepts encoded contents.
    if (
      variable === 'TAURI_SIGNING_PRIVATE_KEY' &&
      process.env[variable] &&
      existsSync(process.env[variable])
    )
      process.env[variable] = readFileSync(process.env[variable], 'utf8').trim();
    if (!process.env[variable]?.trim())
      throw new Error(`${variable} is required for signed bundles`);
  }
}

async function verifySigningKey(version) {
  const directory = mkdtempSync(join(process.env.RUNNER_TEMP || tmpdir(), 'rimr-signing-'));
  const challenge = join(directory, 'challenge');
  const bytes = Buffer.from(`RimR updater signing check: ${version}\n`);
  writeFileSync(challenge, bytes);
  try {
    pnpm(['tauri', 'signer', 'sign', challenge, '--app-version', version]);
    await verifyUpdaterSignature(
      bytes,
      readFileSync(`${challenge}.sig`, 'utf8'),
      updaterPublicKey(),
      version,
    );
  } finally {
    if (existsSync(`${challenge}.sig`)) unlinkSync(`${challenge}.sig`);
    unlinkSync(challenge);
    rmdirSync(directory);
  }
}

try {
  const platform = { win32: 'windows', linux: 'linux', darwin: 'macos' }[process.platform];
  const target = loadTargets().include.find((item) => item.platform === platform);
  if (!target) throw new Error(`Unsupported installer build host: ${process.platform}`);
  const info = releaseInfo(appVersion());
  if (process.env.RIMR_RELEASE_TAG && process.env.RIMR_RELEASE_TAG !== info.tag)
    throw new Error('Release tag differs from the application version');
  signingEnvironment();
  await verifySigningKey(info.version);
  const nativePrerelease = info.prerelease && platform !== 'windows';
  pnpm([
    'tauri',
    'build',
    '--ci',
    '--target',
    target.target,
    ...(nativePrerelease ? ['--no-bundle'] : []),
    '--',
    '--locked',
  ]);
  if (nativePrerelease) {
    const directory = mkdtempSync(join(process.env.RUNNER_TEMP || tmpdir(), 'rimr-bundle-'));
    const config = join(directory, 'native.json');
    writeFileSync(config, `${JSON.stringify(bundleConfig(info.version, platform))}\n`);
    // AppImage retains the full SemVer; only distribution package metadata uses the numeric base.
    if (platform === 'linux')
      pnpm(['tauri', 'bundle', '--ci', '--target', target.target, '--bundles', 'appimage']);
    pnpm([
      'tauri',
      'bundle',
      '--ci',
      '--target',
      target.target,
      '--config',
      config,
      ...(platform === 'linux' ? ['--bundles', 'deb,rpm'] : []),
    ]);
    if (platform === 'linux') finalize(platform);
    // Native metadata overrides and Debian repacking must not leave a base-version or stale signature.
    const output = join('target', target.target, 'release');
    for (const kind of bundleKinds(platform).filter((kind) => kind !== 'dmg')) {
      pnpm(['tauri', 'signer', 'sign', bundleSource(output, kind), '--app-version', info.version]);
    }
  }
} catch (error) {
  reportError(error);
}
