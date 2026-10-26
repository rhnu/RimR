import type { DropEdge } from './types';

export function clampIndex(index: number, length: number): number {
  return Math.min(Math.max(index, 0), length);
}

export function moveByTarget<T extends { id: string }>(
  items: T[],
  itemId: string,
  targetId: string,
  edge: Exclude<DropEdge, 'inside'>,
): T[] {
  if (itemId === targetId) {
    return items;
  }
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item) {
    return items;
  }
  const without = items.filter((candidate) => candidate.id !== itemId);
  const targetIndex = without.findIndex((candidate) => candidate.id === targetId);
  if (targetIndex === -1) {
    return items;
  }
  const insertIndex = edge === 'before' ? targetIndex : targetIndex + 1;
  return [...without.slice(0, insertIndex), item, ...without.slice(insertIndex)];
}

export function moveManyByTarget<T extends { id: string }>(
  items: T[],
  itemIds: string[],
  targetId: string,
  edge: Exclude<DropEdge, 'inside'>,
): T[] {
  const selected = new Set(itemIds);
  if (selected.has(targetId)) {
    return items;
  }
  const moving = items.filter((candidate) => selected.has(candidate.id));
  if (moving.length === 0) {
    return items;
  }
  const without = items.filter((candidate) => !selected.has(candidate.id));
  const targetIndex = without.findIndex((candidate) => candidate.id === targetId);
  if (targetIndex === -1) {
    return items;
  }
  const insertIndex = edge === 'before' ? targetIndex : targetIndex + 1;
  return [...without.slice(0, insertIndex), ...moving, ...without.slice(insertIndex)];
}
