import { getCurrentWindow } from '@tauri-apps/api/window';

export const windowClient = {
  close(): Promise<void> {
    return getCurrentWindow().close();
  },
  minimize(): Promise<void> {
    return getCurrentWindow().minimize();
  },
  toggleMaximize(): Promise<void> {
    return getCurrentWindow().toggleMaximize();
  },
};
