import { describe, expect, it } from 'vitest';
import type { DisplayAliasDto, LibrarySettingsDto } from '@/commands';
import { mergeGlobalAliases } from '@/lib/globalConfig';

function alias(packageId: string, displayAlias: string, sourceKey?: string): DisplayAliasDto {
  return {
    identity: {
      packageId,
      sourceKind: sourceKey ? 'local' : null,
      sourceKey: sourceKey ?? null,
      steamAppId: null,
    },
    displayAlias,
  };
}

describe('mergeGlobalAliases', () => {
  it('replaces imported aliases with the same identity and preserves unrelated local aliases', () => {
    const local: LibrarySettingsDto = {
      formatVersion: 2,
      aliases: [alias('a.mod', 'Old A', 'local:A'), alias('b.mod', 'Local B', 'local:B')],
    };
    const imported: LibrarySettingsDto = {
      formatVersion: 2,
      aliases: [alias('a.mod', 'Imported A', 'local:A'), alias('c.mod', 'Imported C', 'local:C')],
    };

    expect(mergeGlobalAliases(local, imported)).toEqual({
      formatVersion: 2,
      aliases: [
        alias('b.mod', 'Local B', 'local:B'),
        alias('a.mod', 'Imported A', 'local:A'),
        alias('c.mod', 'Imported C', 'local:C'),
      ],
    });
  });
});
