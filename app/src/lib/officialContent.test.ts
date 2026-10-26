import { describe, expect, it } from 'vitest';
import type { ModMetadataDto } from '@/commands';
import { displayModName, officialDisplayName } from '@/lib/officialContent';

describe('officialDisplayName', () => {
  it('returns exact names for the known official package ids', () => {
    expect(officialDisplayName('ludeon.rimworld')).toBe('RimWorld');
    expect(officialDisplayName('ludeon.rimworld.royalty')).toBe('RimWorld - Royalty');
    expect(officialDisplayName('ludeon.rimworld.ideology')).toBe('RimWorld - Ideology');
    expect(officialDisplayName('ludeon.rimworld.biotech')).toBe('RimWorld - Biotech');
    expect(officialDisplayName('ludeon.rimworld.anomaly')).toBe('RimWorld - Anomaly');
    expect(officialDisplayName('ludeon.rimworld.odyssey')).toBe('RimWorld - Odyssey');
  });

  it('is case-insensitive', () => {
    expect(officialDisplayName('Ludeon.RimWorld.Royalty')).toBe('RimWorld - Royalty');
  });

  it('capitalizes the suffix for unknown ludeon.rimworld.* packages', () => {
    expect(officialDisplayName('ludeon.rimworld.archaeology')).toBe('RimWorld - Archaeology');
  });

  it('returns undefined for a trailing dot with an empty suffix', () => {
    expect(officialDisplayName('ludeon.rimworld.')).toBeUndefined();
  });

  it('returns undefined for community mod ids', () => {
    expect(officialDisplayName('brrainz.harmony')).toBeUndefined();
  });
});

describe('displayModName', () => {
  it('prefers the official name over mod.name', () => {
    expect(displayModName({ packageId: 'ludeon.rimworld.royalty', name: 'Royalty' })).toBe(
      'RimWorld - Royalty',
    );
  });

  it('uses mod.name when the package is not official', () => {
    expect(displayModName({ packageId: 'brrainz.harmony', name: 'Harmony' })).toBe('Harmony');
  });

  it('falls back to packageId when name is null', () => {
    const mod: Pick<ModMetadataDto, 'packageId' | 'name'> = {
      packageId: 'orphan.mod',
      name: null,
    };
    expect(displayModName(mod)).toBe('orphan.mod');
  });
});
