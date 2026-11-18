import { describe, expect, it } from 'vitest';
import { matchesOrderCommandTarget } from './order-command-store';

describe('matching a queued save import to its target', () => {
  const target = { workspaceEpoch: 3, modListId: 'edited-list' };

  it('accepts the list in the original workspace', () => {
    expect(matchesOrderCommandTarget(target, 3, 'edited-list')).toBe(true);
  });

  it('rejects a different list or an unselected list', () => {
    expect(matchesOrderCommandTarget(target, 3, 'another-list')).toBe(false);
    expect(matchesOrderCommandTarget(target, 3, undefined)).toBe(false);
  });

  it('rejects the same list after the workspace has advanced', () => {
    expect(matchesOrderCommandTarget(target, 4, 'edited-list')).toBe(false);
  });
});
