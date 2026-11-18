import type { ReactNode } from 'react';
import { DndContext, DragOverlay, type SensorDescriptor, type SensorOptions } from '@dnd-kit/core';
import { Layers } from 'lucide-react';
import { ModTypeIcon } from '@/components/mod/mod-type-icon';
import type { DragOverlayState } from '@/features/order/model/drag-overlay';
import { TagColorBar } from '@/components/mod/tags/tag-color-bar';
import { Col, Grid, Row } from '@/components/ui/layout';
import type { OrderDrag } from '@/features/order/workspace/workspace-types';
import { orderCollisionDetection } from '@/features/order/workspace-constants';

export function OrderWorkspaceView({
  sensors,
  drag,
  toolbar,
  metadata,
  lists,
  dialog,
}: {
  sensors: SensorDescriptor<SensorOptions>[];
  drag: OrderDrag;
  toolbar: ReactNode;
  metadata: ReactNode;
  lists: ReactNode;
  dialog: ReactNode;
}) {
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
        {toolbar}
        <Grid
          gap={3}
          className="min-h-0 flex-1 grid-cols-[minmax(260px,0.8fr)_minmax(0,1fr)_minmax(0,1.25fr)]"
        >
          {metadata}
          {lists}
        </Grid>
      </Col>
      <DragOverlay>
        {drag.dragOverlay ? <OverlayContent {...drag.dragOverlay} /> : null}
      </DragOverlay>
      {dialog}
    </DndContext>
  );
}

function OverlayContent({ label, count, icon, colors }: DragOverlayState) {
  return (
    <Row className="relative border-b border-border bg-card px-2 py-1 text-sm shadow-lg select-none">
      <TagColorBar colors={colors ?? []} />
      {icon?.kind === 'group' ? (
        <Layers className="size-4 shrink-0 text-muted-foreground" />
      ) : icon?.kind === 'mod' ? (
        <ModTypeIcon hasAssemblies={icon.hasAssemblies} />
      ) : null}
      <span>{label}</span>
      {count > 1 ? <span className="ml-2 text-xs text-muted-foreground">+{count - 1}</span> : null}
    </Row>
  );
}
