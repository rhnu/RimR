import { DndContext, DragOverlay } from '@dnd-kit/core';
import type { DragOverlayState } from '@/features/order/view/dragOverlay';
import { TagColorBar } from '@/features/tags/TagColorBar';
import { ActiveModsPanel } from './ActiveModsPanel';
import { InactiveModsPanel } from './InactiveModsPanel';
import { MetadataPanel } from './MetadataPanel';
import { OrderToolbar } from './OrderToolbar';
import { useOrderWorkspaceDrag, useOrderWorkspaceSensors } from './context/hooks';
import { orderCollisionDetection } from './workspaceConstants';

export function OrderWorkspaceView() {
  const sensors = useOrderWorkspaceSensors();
  const drag = useOrderWorkspaceDrag();
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={orderCollisionDetection}
      onDragStart={drag.handleDragStart}
      onDragOver={drag.handleDragOver}
      onDragEnd={drag.handleDragEnd}
      onDragCancel={drag.handleDragCancel}
    >
      <div className="mx-auto flex h-full max-w-[1800px] flex-col gap-2 p-2">
        <OrderToolbar />
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(260px,0.8fr)_minmax(0,1fr)_minmax(0,1.25fr)] gap-3">
          <MetadataPanel />
          <InactiveModsPanel />
          <ActiveModsPanel />
        </div>
      </div>
      <DragOverlay>
        {drag.dragOverlay ? <OverlayContent {...drag.dragOverlay} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function OverlayContent({ label, count, icon, colors }: DragOverlayState) {
  return (
    <div className="relative flex items-center gap-2 border-b border-border bg-card px-2 py-1 text-sm shadow-lg select-none">
      <TagColorBar colors={colors ?? []} />
      {icon}
      <span>{label}</span>
      {count > 1 ? <span className="ml-2 text-xs text-muted-foreground">+{count - 1}</span> : null}
    </div>
  );
}
