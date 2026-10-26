import { describe, expect, it } from 'vitest';
import type { AppConfig } from '@/commands';
import { mergePathDraft } from './path-draft';

const config: AppConfig = {
  paths: {
    gameDir: 'game',
    gameDataDir: 'data',
    localModsDir: null,
    workshopModsDir: null,
    rimrDataDir: 'library',
  },
};

describe('path draft', () => {
  it('initializes from saved configuration', () => {
    expect(mergePathDraft(null, null, config)).toBe(config);
  });

  it('receives refreshed paths while preserving fields edited by the user', () => {
    const draft = { paths: { ...config.paths, gameDir: 'my-game' } };
    const saved = {
      paths: { ...config.paths, gameDir: 'detected-game', localModsDir: 'detected-mods' },
    };
    expect(mergePathDraft(draft, config, saved).paths).toMatchObject({
      gameDir: 'my-game',
      localModsDir: 'detected-mods',
    });
  });

  it('keeps edits made during a save request', () => {
    const submitted = { paths: { ...config.paths, gameDir: 'submitted-game' } };
    const draft = { paths: { ...submitted.paths, gameDataDir: 'later-data' } };
    expect(mergePathDraft(draft, submitted, submitted).paths).toMatchObject({
      gameDir: 'submitted-game',
      gameDataDir: 'later-data',
    });
  });
});
