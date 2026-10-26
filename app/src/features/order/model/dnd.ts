import type { DropIntent } from '@/domain/mod-list/types';

export function computeDropIntent(
  containerId: string,
  targetId: string,
  rect: { top: number; height: number },
  pointerY: number,
  allowInside: boolean,
): DropIntent {
  const offset = pointerY - rect.top;
  const third = rect.height / 3;
  if (allowInside && offset >= third && offset <= third * 2) {
    return { containerId, targetId, edge: 'inside' };
  }
  return {
    containerId,
    targetId,
    edge: offset < rect.height / 2 ? 'before' : 'after',
  };
}
