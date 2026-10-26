import { expect, it } from 'vitest';
import { deriveSelection } from './metadata-selection';
import { baseModList, mod } from '@/domain/mod-list/test-fixtures';
import { catalogItemKey } from '@/domain/mods/catalog';

it('inspects the selected installation while active entries use the primary installation', () => {
  const primary = mod('foo.mod', 'Primary', { sourceKey: 'primary' });
  const copy = mod('foo.mod', 'Copy', { sourceKey: 'copy' });
  const byPackage = new Map([['foo.mod', primary]]);
  const byCatalog = new Map([[catalogItemKey(copy), copy]]);
  const list = baseModList();
  expect(
    deriveSelection(
      { kind: 'mod', identity: { packageId: 'foo.mod' }, sourceKey: 'copy' },
      list,
      byPackage,
      byCatalog,
    ).selectedMod,
  ).toBe(copy);
  expect(
    deriveSelection({ kind: 'mod', identity: { packageId: 'foo.mod' } }, list, byPackage, byCatalog)
      .selectedMod,
  ).toBe(primary);
});
