import { getVersion } from '@tauri-apps/api/app';
import { isTauri } from '@tauri-apps/api/core';

export const appClient = {
  getVersion(): Promise<string | null> {
    return isTauri() ? getVersion() : Promise.resolve(null);
  },
};
