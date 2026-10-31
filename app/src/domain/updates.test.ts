import { describe, expect, it } from 'vitest';
import { downloadPercent, supportsUpdateInstall } from './updates';

describe('update installation support', () => {
  it('allows supported desktop bundles and rejects package-managed Linux installations', () => {
    for (const bundle of ['nsis', 'app', 'appimage'])
      expect(supportsUpdateInstall(bundle)).toBe(true);
    for (const bundle of ['deb', 'rpm', 'msi', 'unknown'])
      expect(supportsUpdateInstall(bundle)).toBe(false);
  });
});

describe('download progress', () => {
  it('keeps unknown download sizes indeterminate', () => {
    expect(downloadPercent(1024, undefined)).toBeUndefined();
    expect(downloadPercent(1024, 0)).toBeUndefined();
  });

  it('reports progress without exceeding completion', () => {
    expect(downloadPercent(25, 100)).toBe(25);
    expect(downloadPercent(125, 100)).toBe(100);
  });
});
