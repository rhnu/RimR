import { describe, expect, it } from 'vitest';
import { modFolderSizeQueryOptions, modPreviewQueryOptions } from '@/hooks/commands';

describe('mod file info query options', () => {
  it('keeps lazy file info caches bounded', () => {
    expect(modPreviewQueryOptions('source').gcTime).toBeGreaterThan(0);
    expect(modPreviewQueryOptions('source').gcTime).toBeLessThan(Infinity);
    expect(modFolderSizeQueryOptions('source').gcTime).toBeGreaterThan(0);
    expect(modFolderSizeQueryOptions('source').gcTime).toBeLessThan(Infinity);
  });
});
