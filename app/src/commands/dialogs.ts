import { open, save } from '@tauri-apps/plugin-dialog';
import { ResultAsync } from 'neverthrow';
import type { RimrClientError, RimrResult } from './rimrClient';

type PickDirectoryOptions = {
  title: string;
  defaultPath?: string;
};

type PickFileOptions = {
  title: string;
  defaultPath?: string;
  extensions: string[];
};

export function pickDirectory(options: PickDirectoryOptions): RimrResult<string | null> {
  return ResultAsync.fromPromise(
    open({
      title: options.title,
      defaultPath: options.defaultPath,
      directory: true,
      multiple: false,
    }).then(singlePath),
    toTransportError,
  );
}

export function pickRimrGameConfigBackupFile(options: PickFileOptions): RimrResult<string | null> {
  return ResultAsync.fromPromise(
    open({
      title: options.title,
      defaultPath: options.defaultPath,
      filters: [{ name: 'RimR game config backup', extensions: options.extensions }],
      multiple: false,
    }).then(singlePath),
    toTransportError,
  );
}

export function pickSaveGameFile(options: PickFileOptions): RimrResult<string | null> {
  return ResultAsync.fromPromise(
    open({
      title: options.title,
      defaultPath: options.defaultPath,
      filters: [{ name: 'RimWorld save', extensions: options.extensions }],
      multiple: false,
    }).then(singlePath),
    toTransportError,
  );
}

export function chooseRimrGameConfigBackupSavePath(
  options: PickFileOptions,
): RimrResult<string | null> {
  return ResultAsync.fromPromise(
    save({
      title: options.title,
      defaultPath: options.defaultPath,
      filters: [{ name: 'RimR game config backup', extensions: options.extensions }],
    }),
    toTransportError,
  );
}

function singlePath(value: string | string[] | null): string | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function toTransportError(error: unknown): RimrClientError {
  return {
    kind: 'transport',
    message: error instanceof Error ? error.message : String(error),
    cause: error,
  };
}
