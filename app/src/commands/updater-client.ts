import { getBundleType } from '@tauri-apps/api/app';
import { isTauri } from '@tauri-apps/api/core';
import { info, warn } from '@tauri-apps/plugin-log';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export const updaterClient = {
  isDesktop: isTauri,
  check,
  getBundleType,
  relaunch,
};

/** Logging must never turn an optional update operation into an application failure. */
export function logUpdate(message: string, failed = false): void {
  void (failed ? warn : info)(`Updater: ${message}`).catch(() => {});
}

export function updateErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
