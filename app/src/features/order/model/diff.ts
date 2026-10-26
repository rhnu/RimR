import type { ModListDto, ModMetadataDto } from '@/commands';
import { flattenModListEntries } from './normalize';
import type { OrderDiff, OrderDiffItem, OrderStructureEvent } from './types';

export type ApplyProjection = {
  activeMods: string[];
  events: OrderStructureEvent[];
};

export type UnifiedDiffRow =
  | { type: 'context'; packageId: string; afterIndex: number }
  | { type: 'added'; packageId: string; afterIndex: number }
  | { type: 'removed'; packageId: string; beforeIndex: number }
  | { type: 'moved'; packageId: string; fromIndex: number; toIndex: number };

export type UnifiedDiffSegment =
  | { type: 'rows'; rows: UnifiedDiffRow[] }
  | { type: 'skip'; hiddenCount: number };

const DEFAULT_DIFF_CONTEXT = 3;

export function buildUnifiedDiffHunks(
  rows: UnifiedDiffRow[],
  context: number = DEFAULT_DIFF_CONTEXT,
): UnifiedDiffSegment[] {
  if (rows.length === 0) return [];

  const changeIndices: number[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i].type !== 'context') changeIndices.push(i);
  }

  if (changeIndices.length === 0) {
    return [{ type: 'rows', rows }];
  }

  const windows: Array<{ start: number; end: number }> = [];
  for (const idx of changeIndices) {
    const start = Math.max(0, idx - context);
    const end = Math.min(rows.length - 1, idx + context);
    mergeWindow(windows, start, end);
  }

  const segments: UnifiedDiffSegment[] = [];
  let cursor = 0;
  for (const window of windows) {
    if (window.start > cursor) {
      segments.push({ type: 'skip', hiddenCount: window.start - cursor });
    }
    segments.push({ type: 'rows', rows: rows.slice(window.start, window.end + 1) });
    cursor = window.end + 1;
  }
  if (cursor < rows.length) {
    segments.push({ type: 'skip', hiddenCount: rows.length - cursor });
  }
  return segments;
}

function mergeWindow(
  windows: Array<{ start: number; end: number }>,
  start: number,
  end: number,
): void {
  const last = windows[windows.length - 1];
  if (last && start <= last.end + 1) {
    last.end = Math.max(last.end, end);
  } else {
    windows.push({ start, end });
  }
}

export function buildApplyProjection(
  modList: ModListDto,
  catalogByPackageId: Map<string, ModMetadataDto>,
): ApplyProjection {
  const activeMods: string[] = [];
  const events: OrderStructureEvent[] = [];
  for (const packageId of flattenModListEntries(modList.entries)) {
    if (catalogByPackageId.has(packageId)) {
      activeMods.push(packageId);
    } else {
      events.push({ kind: 'missingSkipped', packageId, label: packageId });
    }
  }
  return { activeMods, events };
}

export function buildOrderDiff(
  before: string[],
  after: string[],
  structureEvents: OrderStructureEvent[],
): OrderDiff {
  const items: OrderDiffItem[] = [
    ...addedItems(before, after),
    ...removedItems(before, after),
    ...movedItems(before, after),
    ...structureEvents,
  ];
  return {
    before,
    after,
    items: items.length > 0 ? items : [{ kind: 'noChange' }],
  };
}

function addedItems(before: string[], after: string[]): OrderDiffItem[] {
  const beforeSet = new Set(before);
  return after.flatMap((packageId, toIndex) =>
    beforeSet.has(packageId) ? [] : [{ kind: 'added' as const, packageId, toIndex }],
  );
}

function removedItems(before: string[], after: string[]): OrderDiffItem[] {
  const afterSet = new Set(after);
  return before.flatMap((packageId, fromIndex) =>
    afterSet.has(packageId) ? [] : [{ kind: 'removed' as const, packageId, fromIndex }],
  );
}

function movedItems(before: string[], after: string[]): OrderDiffItem[] {
  const commonBefore = before.filter((packageId) => after.includes(packageId));
  const commonAfter = after.filter((packageId) => before.includes(packageId));
  const stable = new Set(longestCommonSubsequence(commonBefore, commonAfter));
  return commonAfter.flatMap((packageId) => {
    if (stable.has(packageId)) return [];
    return [
      {
        kind: 'moved' as const,
        packageId,
        fromIndex: before.indexOf(packageId),
        toIndex: after.indexOf(packageId),
      },
    ];
  });
}

export function buildUnifiedDiff(before: string[], after: string[]): UnifiedDiffRow[] {
  const afterSet = new Set(after);
  const beforeSet = new Set(before);
  const lcs = longestCommonSubsequence(before, after);
  const rows: UnifiedDiffRow[] = [];
  let i = 0;
  let j = 0;
  for (const anchor of lcs) {
    while (i < before.length && before[i] !== anchor) {
      if (!afterSet.has(before[i])) {
        rows.push({ type: 'removed', packageId: before[i], beforeIndex: i });
      }
      i += 1;
    }
    while (j < after.length && after[j] !== anchor) {
      if (!beforeSet.has(after[j])) {
        rows.push({ type: 'added', packageId: after[j], afterIndex: j });
      } else {
        rows.push({
          type: 'moved',
          packageId: after[j],
          fromIndex: before.indexOf(after[j]),
          toIndex: j,
        });
      }
      j += 1;
    }
    rows.push({ type: 'context', packageId: anchor, afterIndex: j });
    i += 1;
    j += 1;
  }
  while (i < before.length) {
    if (!afterSet.has(before[i])) {
      rows.push({ type: 'removed', packageId: before[i], beforeIndex: i });
    }
    i += 1;
  }
  while (j < after.length) {
    if (!beforeSet.has(after[j])) {
      rows.push({ type: 'added', packageId: after[j], afterIndex: j });
    } else {
      rows.push({
        type: 'moved',
        packageId: after[j],
        fromIndex: before.indexOf(after[j]),
        toIndex: j,
      });
    }
    j += 1;
  }
  return rows;
}

function longestCommonSubsequence(a: string[], b: string[]): string[] {
  const lengths = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lengths[i][j] =
        a[i] === b[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }
  const result: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      result.push(a[i]);
      i += 1;
      j += 1;
    } else if (lengths[i + 1][j] > lengths[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return result;
}
