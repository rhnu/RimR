import { describe, expect, it } from 'vitest';
import type { AppConfig } from '@/commands';
import { needsSetup } from '@/lib/appConfig';

function config(overrides: Partial<AppConfig['paths']>): AppConfig {
  return {
    formatVersion: 3,
    paths: {
      gameDir: null,
      gameDataDir: null,
      localModsDir: null,
      workshopModsDir: null,
      rimrDataDir: 'C:/Users/test/Documents/RimR',
      ...overrides,
    },
    ui: { theme: null, locale: null },
  };
}

describe('needsSetup', () => {
  it('requires game, config, and RimR data directories', () => {
    expect(needsSetup(config({ gameDir: 'C:/RimWorld', gameDataDir: 'C:/Config' }))).toBe(false);
    expect(needsSetup(config({ gameDir: null, gameDataDir: 'C:/Config' }))).toBe(true);
    expect(needsSetup(config({ gameDir: 'C:/RimWorld', gameDataDir: null }))).toBe(true);
    expect(
      needsSetup(
        config({
          gameDir: 'C:/RimWorld',
          gameDataDir: 'C:/Config',
          rimrDataDir: null,
        }),
      ),
    ).toBe(true);
  });
});
