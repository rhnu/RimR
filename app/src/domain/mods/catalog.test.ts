import { describe, expect, it } from 'vitest';
import { catalogItemKey, primaryModsByPackageId } from './catalog';
import { mod } from '../mod-list/test-fixtures';

describe('catalog installation identity', () => {
  it('keeps installations with the same package distinct', () => {
    const first = mod('foo.mod', 'Foo', { sourceKey: 'local:first' });
    const second = mod('foo.mod', 'Foo', { sourceKey: 'workshop:second' });
    expect(catalogItemKey(first)).not.toBe(catalogItemKey(second));
  });
  it('uses the first valid installation from the stable scan order', () => {
    const broken = mod(' Foo.Mod ', 'Broken', { sourceKey: 'broken', valid: false });
    const primary = mod('foo.mod', 'Primary', { sourceKey: 'primary' });
    const duplicate = mod('FOO.MOD', 'Duplicate', { sourceKey: 'duplicate' });
    expect(primaryModsByPackageId([broken, primary, duplicate]).get('foo.mod')).toBe(primary);
  });
});
