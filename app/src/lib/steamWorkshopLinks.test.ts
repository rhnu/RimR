import { describe, expect, it } from 'vitest';
import type { ModIdentityDto, ModMetadataDto } from '@/commands';
import { isSteamWorkshopLinkAvailable, steamWorkshopSourceKey } from '@/lib/steamWorkshopLinks';

describe('isSteamWorkshopLinkAvailable', () => {
  it('is available for Workshop identities with a source key', () => {
    const identity: ModIdentityDto = {
      packageId: 'brrainz.harmony',
      sourceKind: 'workshop',
      sourceKey: 'C:/Steam/steamapps/workshop/content/294100/2009463077',
      steamAppId: null,
    };

    expect(isSteamWorkshopLinkAvailable(identity, new Map())).toBe(true);
  });

  it('is unavailable for local mods even when they have a source key', () => {
    const identity: ModIdentityDto = {
      packageId: 'local.mod',
      sourceKind: 'local',
      sourceKey: 'C:/RimWorld/Mods/LocalMod',
      steamAppId: null,
    };

    expect(isSteamWorkshopLinkAvailable(identity, new Map())).toBe(false);
  });

  it('falls back to catalog metadata for active identities missing source details', () => {
    const identity: ModIdentityDto = {
      packageId: 'workshop.mod',
    };
    const modByPackageId = new Map<string, ModMetadataDto>([
      [
        'workshop.mod',
        {
          sourceKey: 'C:/Steam/steamapps/workshop/content/294100/1234567890',
          sourceKind: 'workshop',
          packageId: 'workshop.mod',
          path: 'C:/Steam/steamapps/workshop/content/294100/1234567890',
          modifiedAtMs: 1,
          name: 'Workshop Mod',
          authors: [],
          supportedVersions: [],
          description: null,
          modVersion: null,
          url: null,
          modIconPath: null,
          steamAppId: null,
          hasAssemblies: false,
          rules: {
            loadAfter: [],
            loadBefore: [],
            modDependencies: [],
            incompatibleWith: [],
            forceLoadAfter: [],
            forceLoadBefore: [],
          },
          valid: true,
          dataMalformed: false,
        },
      ],
    ]);

    expect(isSteamWorkshopLinkAvailable(identity, modByPackageId)).toBe(true);
    expect(steamWorkshopSourceKey(identity, modByPackageId)).toBe(
      'C:/Steam/steamapps/workshop/content/294100/1234567890',
    );
  });
});
