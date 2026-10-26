import { describe, expect, it } from 'vitest';
import type { ModCleanupPreviewDto } from '@/commands';
import {
  cleanupSourceKeys,
  shouldOpenModCleanupDialog,
  TOOL_CLEANUP_ITEMS,
} from './toolsMenuModel';

describe('tools menu model', () => {
  it('exposes both cleanup tools', () => {
    expect(TOOL_CLEANUP_ITEMS.map((item) => item.kind)).toEqual(['textureOnlyInvalid', 'invalid']);
  });

  it('opens confirmation only when preview has candidates', () => {
    expect(shouldOpenModCleanupDialog(preview([]))).toBe(false);
    expect(shouldOpenModCleanupDialog(preview(['local:a']))).toBe(true);
  });

  it('uses preview candidates as cleanup source keys', () => {
    expect(cleanupSourceKeys(preview(['local:a', 'workshop:b']))).toEqual([
      'local:a',
      'workshop:b',
    ]);
  });
});

function preview(sourceKeys: string[]): ModCleanupPreviewDto {
  return {
    kind: 'textureOnlyInvalid',
    candidates: sourceKeys.map((sourceKey) => ({
      sourceKey,
      sourceKind: 'local',
      path: `C:/Mods/${sourceKey}`,
      packageId: 'missing.packageid',
      name: null,
      reason: 'textureOnlyInvalid',
      fileCount: 1,
    })),
  };
}
