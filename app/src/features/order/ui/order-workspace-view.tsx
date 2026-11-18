import { DndContext, DragOverlay } from '@dnd-kit/core';
import type { DragOverlayState } from '@/features/order/ui/view/drag-overlay';
import { TagColorBar } from '@/components/mod/tags/tag-color-bar';
import { Col, Grid, Row } from '@/components/ui/layout';
import { ActiveModsPanel } from '@/features/order/ui/active-mods-panel';
import { InactiveModsPanel } from '@/features/order/ui/inactive-mods-panel';
import { MetadataPanel } from '@/features/order/ui/metadata-panel';
import { OrderToolbar } from '@/features/order/ui/order-toolbar';
import { useOrderWorkspaceDrag, useOrderWorkspaceSensors } from '@/features/order/context/hooks';
import { orderCollisionDetection } from '@/features/order/workspace-constants';

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
      <Col className="mx-auto h-full max-w-[1800px] p-2">
        <OrderToolbar />
        <Grid
          gap={3}
          className="min-h-0 flex-1 grid-cols-[minmax(260px,0.8fr)_minmax(0,1fr)_minmax(0,1.25fr)]"
        >
          <MetadataPanel />
          <InactiveModsPanel />
          <ActiveModsPanel />
        </Grid>
      </Col>
      <DragOverlay>
        {drag.dragOverlay ? <OverlayContent {...drag.dragOverlay} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function OverlayContent({ label, count, icon, colors }: DragOverlayState) {
  return (
    <Row className="relative border-b border-border bg-card px-2 py-1 text-sm shadow-lg select-none">
      <TagColorBar colors={colors ?? []} />
      {icon}
      <span>{label}</span>
      {count > 1 ? <span className="ml-2 text-xs text-muted-foreground">+{count - 1}</span> : null}
    </Row>
  );
}
