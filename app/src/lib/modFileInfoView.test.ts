import { describe, expect, it } from 'vitest';
import type { ModFolderSizeDto, ModPreviewDto } from '@/commands';
import { currentModFolderSize, currentModPreview } from '@/lib/modFileInfoView';

function preview(sourceKey: string): ModPreviewDto {
  return {
    sourceKey,
    previewDataUrl: 'data:image/png;base64,abc',
  };
}

function folderSize(sourceKey: string): ModFolderSizeDto {
  return {
    sourceKey,
    folderSizeBytes: 1024,
  };
}

describe('currentModPreview', () => {
  it('returns null when no mod is selected', () => {
    expect(currentModPreview(null, preview('local:Core'))).toBeNull();
  });

  it('returns null when query data belongs to a previous selection', () => {
    expect(currentModPreview('local:Next', preview('local:Previous'))).toBeNull();
  });

  it('returns preview data when it belongs to the selected source key', () => {
    const data = preview('local:Core');

    expect(currentModPreview('local:Core', data)).toBe(data);
  });
});

describe('currentModFolderSize', () => {
  it('returns null when no mod is selected', () => {
    expect(currentModFolderSize(null, folderSize('local:Core'))).toBeNull();
  });

  it('returns null when query data belongs to a previous selection', () => {
    expect(currentModFolderSize('local:Next', folderSize('local:Previous'))).toBeNull();
  });

  it('returns folder size data when it belongs to the selected source key', () => {
    const data = folderSize('local:Core');

    expect(currentModFolderSize('local:Core', data)).toBe(data);
  });
});
