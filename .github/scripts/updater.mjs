import { readFileSync } from 'node:fs';
import { MinisignVerifier } from '@kaito-tokyo/minisign-verify';

export function updaterPublicKey() {
  const config = JSON.parse(
    readFileSync(new URL('../../app/src-tauri/tauri.conf.json', import.meta.url), 'utf8'),
  );
  const key = config.plugins?.updater?.pubkey;
  if (!key) throw new Error('The application updater public key is required');
  return key;
}

function decodeBox(encoded, label) {
  const value = encoded.trim();
  const bytes = Buffer.from(value, 'base64');
  if (!value || bytes.toString('base64') !== value)
    throw new Error(`Invalid Tauri ${label} encoding`);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/** Verify Tauri's base64-wrapped minisign signature, including its signed release version. */
export async function verifyUpdaterSignature(bytes, encodedSignature, encodedPublicKey, version) {
  const publicBox = decodeBox(encodedPublicKey, 'public key').trim().split(/\r?\n/);
  if (publicBox.length !== 2 || !publicBox[0].startsWith('untrusted comment: '))
    throw new Error('Invalid Tauri updater public key');
  const verifier = await MinisignVerifier.create(publicBox[1]);
  const result = await verifier.verify([bytes], decodeBox(encodedSignature, 'signature'));
  if (!result.ok) throw new Error('Updater signature does not match the artifact and public key');
  const versions = result.trustedComment
    .split('\t')
    .filter((field) => field.startsWith('version:'));
  if (versions.length !== 1 || versions[0] !== `version:${version}`)
    throw new Error(`Updater signature does not authenticate version ${version}`);
}

/** Build the static Tauri response from the verified release asset names and signature contents. */
export function updaterManifest(version, tag, repository, updates) {
  if (!/^[\w-]+\/[\w.-]+$/.test(repository)) throw new Error('Invalid GitHub repository');
  const platforms = Object.fromEntries(
    updates.map(({ platform, architecture, name, signature }) => [
      `${platform === 'macos' ? 'darwin' : platform}-${architecture === 'arm64' ? 'aarch64' : architecture}`,
      {
        signature,
        url: `https://github.com/${repository}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(name)}`,
      },
    ]),
  );
  return { version, platforms };
}
