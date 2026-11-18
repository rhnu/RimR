import { describe, expect, it } from 'vitest';
import {
  canScanConfig,
  editPath,
  hasPathEdits,
  mergePathEdits,
  reconcilePathEdits,
} from './path-settings';

const savedPaths = {
  gameDir: 'game',
  gameDataDir: 'data',
  localModsDir: 'mods',
  workshopModsDir: null,
  rimrDataDir: 'library',
};

describe('path settings', () => {
  it('applies only edited paths to a refreshed configuration, including explicit clears', () => {
    const draft = editPath({}, 'localModsDir', null, savedPaths, false);
    const refreshed = { ...savedPaths, gameDir: 'detected-game', localModsDir: 'detected-mods' };

    expect(mergePathEdits(refreshed, draft)).toEqual({ ...refreshed, localModsDir: null });
  });

  it('drops a path edit when it is changed back to the saved value before writing', () => {
    const draft = editPath({}, 'gameDir', 'other-game', savedPaths, false);
    const reverted = editPath(draft, 'gameDir', savedPaths.gameDir, savedPaths, false);

    expect(hasPathEdits(reverted, savedPaths)).toBe(false);
    expect(mergePathEdits({ ...savedPaths, gameDir: 'refreshed-game' }, reverted).gameDir).toBe(
      'refreshed-game',
    );
  });

  it('keeps newer choices for both submitted and unsubmitted fields', () => {
    const submitted = editPath({}, 'gameDir', 'other-game', savedPaths, false);
    const revertedWhileWriting = editPath(
      submitted,
      'gameDir',
      savedPaths.gameDir,
      savedPaths,
      true,
    );
    const draft = editPath(revertedWhileWriting, 'gameDataDir', 'other-data', savedPaths, true);
    const saved = { ...savedPaths, gameDir: 'other-game' };
    const remaining = reconcilePathEdits(draft, saved, submitted);

    expect(hasPathEdits(remaining, saved)).toBe(true);
    expect(mergePathEdits(saved, remaining)).toEqual({ ...savedPaths, gameDataDir: 'other-data' });
  });

  it('acknowledges the submitted change and edits whose values have already been saved', () => {
    const submitted = editPath({}, 'gameDir', 'other-game', savedPaths, false);
    const draft = editPath(submitted, 'gameDataDir', 'detected-data', savedPaths, true);
    const saved = { ...savedPaths, gameDir: 'saved-game', gameDataDir: 'detected-data' };
    const remaining = reconcilePathEdits(draft, saved, submitted);

    expect(hasPathEdits(remaining, saved)).toBe(false);
    expect(mergePathEdits(saved, remaining)).toEqual(saved);
  });

  it('keeps manual edits when auto-detection saves different paths', () => {
    const draft = editPath({}, 'gameDir', 'custom-game', savedPaths, false);
    const detected = { ...savedPaths, gameDir: 'detected-game', gameDataDir: 'detected-data' };
    const remaining = reconcilePathEdits(draft, detected);

    expect(hasPathEdits(remaining, detected)).toBe(true);
    expect(mergePathEdits(detected, remaining)).toEqual({ ...detected, gameDir: 'custom-game' });
  });

  it('allows scanning once game and config directories are present', () => {
    expect(canScanConfig({ paths: savedPaths })).toBe(true);
    expect(canScanConfig({ paths: { ...savedPaths, gameDataDir: null } })).toBe(false);
  });
});
