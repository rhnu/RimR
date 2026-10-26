import { useCallback } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';

export function useDragDropNode(id: string) {
  const draggable = useDraggable({ id });
  const droppable = useDroppable({ id });
  const setNodeRef = useCallback(
    (node: HTMLElement | null) => {
      draggable.setNodeRef(node);
      droppable.setNodeRef(node);
    },
    [draggable, droppable],
  );

  return {
    attributes: draggable.attributes,
    isDragging: draggable.isDragging,
    listeners: draggable.listeners,
    setNodeRef,
  };
}
