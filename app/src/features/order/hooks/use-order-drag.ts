import { useRef, useState } from 'react';
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import type { ModListDto } from '@/commands';
import type { ModListAction } from '@/domain/mod-list/types';
import { resolveDragAction, resolveDropIndicator } from '../model/drag-actions';
import {
  dragOverlayForSource,
  type DragOverlayLabels,
  type DragOverlayState,
} from '../model/drag-overlay';
import { resolveDragSource, type DragSelection, type DragSource } from '../model/drag-source';
import type { OrderDrag } from '../workspace/workspace-types';
import { createDropIndicatorStore, type DropIndicatorStore } from './drop-indicator-store';

type OrderDragInput = DragSelection &
  DragOverlayLabels & {
    draft: ModListDto;
    applyDraft: (action: ModListAction) => void;
  };

type DragSession = {
  draft: ModListDto;
  catalog: DragSelection['modByCatalogKey'];
  source: DragSource | null;
};

export function useOrderDrag(input: OrderDragInput): OrderDrag {
  const { draft, applyDraft, modByCatalogKey } = input;
  const [dragOverlay, setDragOverlay] = useState<DragOverlayState | null>(null);
  const session = useRef<DragSession | null>(null);
  const indicatorStore = useRef<DropIndicatorStore | null>(null);
  indicatorStore.current ??= createDropIndicatorStore();
  const dropIndicatorStore = indicatorStore.current;

  function handleDragStart(event: DragStartEvent): void {
    dropIndicatorStore.set(null);
    const source = resolveDragSource(String(event.active.id), draft, input);
    session.current = { draft, catalog: modByCatalogKey, source };
    setDragOverlay(dragOverlayForSource(source, input));
  }

  function handleDragOver(event: DragOverEvent): void {
    const { active, over } = event;
    const source = currentSource();
    if (!source || !over) {
      dropIndicatorStore.set(null);
      return;
    }
    // Keyboard drags also supply a translated rectangle; the target centre is the fallback.
    const rect = active.rect.current.translated ?? over.rect;
    dropIndicatorStore.set(
      resolveDropIndicator(draft, source, String(over.id), over.rect, rect.top + rect.height / 2),
    );
  }

  function handleDragEnd(event: DragEndEvent): void {
    const source = currentSource();
    const dropIndicator = dropIndicatorStore.getSnapshot();
    clearDrag();
    if (!source || !event.over) return;
    const action = resolveDragAction(draft, source, String(event.over.id), dropIndicator);
    if (action) applyDraft(action);
  }

  function clearDrag(): void {
    session.current = null;
    setDragOverlay(null);
    dropIndicatorStore.set(null);
  }

  function currentSource(): DragSource | null {
    const started = session.current;
    if (started?.draft.id !== draft.id || started.draft.entries !== draft.entries) return null;
    if (started.source?.kind === 'catalog' && started.catalog !== modByCatalogKey) return null;
    return started.source;
  }

  return {
    dragOverlay,
    dropIndicatorStore,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel: clearDrag,
  };
}
