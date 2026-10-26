import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';

export function loadTargets() {
  return JSON.parse(readFileSync(new URL('../release-targets.json', import.meta.url), 'utf8'));
}

export function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: 'utf8', ...options }).trim();
}

export function git(...args) {
  return run('git', args);
}

export function appVersion() {
  const metadata = JSON.parse(
    run('cargo', ['metadata', '--locked', '--no-deps', '--format-version', '1']),
  );
  const app = metadata.packages.find((pkg) => pkg.name === 'rimr-tauri');
  if (!app) throw new Error('Cargo metadata does not contain rimr-tauri');
  return app.version;
}

export function releaseInfo(version, tag = `v${version}`) {
  // Cargo validates SemVer; additionally reject versions that installers cannot distinguish.
  const numbers = version.split('-')[0].split('.').map(Number);
  if (
    version.includes('+') ||
    version.split('-').length > 2 ||
    numbers.length !== 3 ||
    numbers.some((n) => !Number.isInteger(n) || n < 0 || n > 65535)
  ) {
    throw new Error(`Version cannot be represented by the installers: ${version}`);
  }
  if (tag !== `v${version}`) throw new Error(`Tag ${tag} does not match Cargo version ${version}`);
  return { version, tag, prerelease: version.includes('-') };
}

export function output(values) {
  const lines = Object.entries(values)
    .map(([key, value]) => `${key}=${value}\n`)
    .join('');
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, lines);
  process.stdout.write(lines);
}

export function reportError(error) {
  console.error(error);
  process.exitCode = 1;
}
