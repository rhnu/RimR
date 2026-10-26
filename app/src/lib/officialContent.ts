import type { ModMetadataDto } from '@/commands';

const OFFICIAL_NAMES: ReadonlyMap<string, string> = new Map([
  ['ludeon.rimworld', 'RimWorld'],
  ['ludeon.rimworld.royalty', 'RimWorld - Royalty'],
  ['ludeon.rimworld.ideology', 'RimWorld - Ideology'],
  ['ludeon.rimworld.biotech', 'RimWorld - Biotech'],
  ['ludeon.rimworld.anomaly', 'RimWorld - Anomaly'],
  ['ludeon.rimworld.odyssey', 'RimWorld - Odyssey'],
]);

const OFFICIAL_PREFIX = 'ludeon.rimworld';

export function officialDisplayName(packageId: string): string | undefined {
  const id = packageId.toLowerCase();
  const direct = OFFICIAL_NAMES.get(id);
  if (direct != null) {
    return direct;
  }
  if (id === OFFICIAL_PREFIX || !id.startsWith(`${OFFICIAL_PREFIX}.`)) {
    return undefined;
  }
  const suffix = id.slice(`${OFFICIAL_PREFIX}.`.length).trim();
  if (suffix.length === 0) {
    return undefined;
  }
  const capitalized = suffix.charAt(0).toUpperCase() + suffix.slice(1);
  return `RimWorld - ${capitalized}`;
}

export function displayModName(mod: Pick<ModMetadataDto, 'packageId' | 'name'>): string {
  return officialDisplayName(mod.packageId) ?? mod.name ?? mod.packageId;
}
