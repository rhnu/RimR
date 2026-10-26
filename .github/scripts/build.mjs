import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appVersion, loadTargets, releaseInfo, reportError } from './common.mjs';
import { bundleConfig, finalize } from './native-packages.mjs';

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

try {
  const platform = { win32: 'windows', linux: 'linux', darwin: 'macos' }[process.platform];
  const target = loadTargets().include.find((item) => item.platform === platform);
  if (!target) throw new Error(`Unsupported installer build host: ${process.platform}`);
  const info = releaseInfo(appVersion());
  if (process.env.RIMR_RELEASE_TAG && process.env.RIMR_RELEASE_TAG !== info.tag)
    throw new Error('Release tag differs from the application version');
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
    // Only installer metadata is overridden: bundle does not recompile the full SemVer application.
    pnpm(['tauri', 'bundle', '--ci', '--target', target.target, '--config', config]);
    if (platform === 'linux') finalize(platform);
  }
} catch (error) {
  reportError(error);
}
