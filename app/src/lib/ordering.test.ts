import { describe, it, expect } from 'vitest';
import { reorderOnDragEnd } from '@/lib/ordering';

describe('reorderOnDragEnd', () => {
  it('single move down places active before over with selection {active}', () => {
    const result = reorderOnDragEnd(['a', 'b', 'c', 'd'], new Set(['b']), 'b', 'd');
    expect(result).toEqual({
      ids: ['a', 'c', 'd', 'b'],
      selected: new Set(['b']),
    });
  });

  it('single move up places active at the over position', () => {
    const result = reorderOnDragEnd(['a', 'b', 'c', 'd'], new Set(['d']), 'd', 'a');
    expect(result).toEqual({
      ids: ['d', 'a', 'b', 'c'],
      selected: new Set(['d']),
    });
  });

  it('multi block move inserts the selected block before over and preserves selection', () => {
    const result = reorderOnDragEnd(['a', 'b', 'c', 'd', 'e'], new Set(['b', 'c']), 'b', 'e');
    expect(result).toEqual({
      ids: ['a', 'd', 'b', 'c', 'e'],
      selected: new Set(['b', 'c']),
    });
  });

  it('multi drop onto a selected item returns null', () => {
    const result = reorderOnDragEnd(['a', 'b', 'c'], new Set(['b', 'c']), 'b', 'c');
    expect(result).toBeNull();
  });

  it('selection of size 1 falls through to single-drag behavior', () => {
    const result = reorderOnDragEnd(['a', 'b', 'c'], new Set(['b']), 'a', 'c');
    expect(result).toEqual({
      ids: ['b', 'c', 'a'],
      selected: new Set(['a']),
    });
  });

  it('returns null when active equals over', () => {
    const result = reorderOnDragEnd(['a', 'b', 'c'], new Set(['b']), 'b', 'b');
    expect(result).toBeNull();
  });

  it('returns null when active is not in ids', () => {
    const result = reorderOnDragEnd(['a', 'b'], new Set(), 'x', 'a');
    expect(result).toBeNull();
  });

  it('returns null when over is absent from remaining in multi-drag', () => {
    const result = reorderOnDragEnd(['a', 'b', 'c'], new Set(['b', 'c']), 'b', 'z');
    expect(result).toBeNull();
  });
});
