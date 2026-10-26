import { describe, expect, it } from 'vitest';
import type { AppConfig } from '@/commands';
import {
  canScanConfig,
  clearPathDraft,
  pathDraftDirty,
  updatePathDraft,
} from './pathSettingsModel';

const config: AppConfig = {
  formatVersion: 1,
  paths: {
    gameDir: 'C:/RimWorld',
    gameDataDir: 'C:/Users/me/AppData/LocalLow/Ludeon Studios/RimWorld',
    localModsDir: null,
    workshopModsDir: null,
    rimrDataDir: 'C:/RimR',
  },
  ui: { theme: null, locale: null },
};

describe('path settings model', () => {
  it('tracks dirty state against the saved config snapshot', () => {
    expect(pathDraftDirty(config, config)).toBe(false);
    expect(
      pathDraftDirty({ ...config, paths: { ...config.paths, gameDir: 'D:/RimWorld' } }, config),
    ).toBe(true);
    expect(pathDraftDirty(null, config)).toBe(false);
  });

  it('updates and clears individual path fields without mutating the original draft', () => {
    const updated = updatePathDraft(config, 'localModsDir', 'C:/Mods');
    expect(updated?.paths.localModsDir).toBe('C:/Mods');
    expect(config.paths.localModsDir).toBeNull();

    const cleared = clearPathDraft(updated, 'localModsDir');
    expect(cleared?.paths.localModsDir).toBeNull();
  });

  it('allows scanning once game and config directories are present', () => {
    expect(canScanConfig(config)).toBe(true);
    expect(canScanConfig({ ...config, paths: { ...config.paths, gameDataDir: null } })).toBe(false);
  });
});
