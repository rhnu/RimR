import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical } from 'lucide-react';
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ModIdentityDto, TagDefDto } from '@/commands';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { defById } from '@/features/tags/tagModel';
import { TagColorBar } from '@/features/tags/TagColorBar';

type TagReorderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  identity: ModIdentityDto;
  tagDefs: TagDefDto[];
  boundTagIds: string[];
  onReorder: (identity: ModIdentityDto, tagIds: string[]) => void;
};

export function TagReorderDialog({
  open,
  onOpenChange,
  identity,
  tagDefs,
  boundTagIds,
  onReorder,
}: TagReorderDialogProps) {
  const { t } = useTranslation();
  const boundKey = JSON.stringify(boundTagIds);
  const [order, setOrder] = useState<string[]>(boundTagIds);
  useEffect(() => {
    setOrder(JSON.parse(boundKey) as string[]);
  }, [open, boundKey]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const dirty = order.join('|') !== boundTagIds.join('|');
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOrder((prev) => {
        const from = prev.indexOf(String(active.id));
        const to = prev.indexOf(String(over.id));
        return from >= 0 && to >= 0 ? arrayMove(prev, from, to) : prev;
      });
    }
  }
  function handleSave() {
    onReorder(identity, order);
    onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('order.tag.reorderTitle')}</DialogTitle>
          <DialogDescription>{t('order.tag.reorderDesc')}</DialogDescription>
        </DialogHeader>
        <TagReorderList
          order={order}
          tagDefs={tagDefs}
          sensors={sensors}
          onDragEnd={handleDragEnd}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button disabled={!dirty} onClick={handleSave}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TagReorderList({
  order,
  tagDefs,
  sensors,
  onDragEnd,
}: {
  order: string[];
  tagDefs: TagDefDto[];
  sensors: ReturnType<typeof useSensors>;
  onDragEnd: (event: DragEndEvent) => void;
}) {
  const colors = order
    .map((id) => defById(tagDefs, id)?.color)
    .filter((color): color is string => Boolean(color));
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      {colors.length > 0 ? (
        <div className="relative mb-2 h-5 border border-border">
          <TagColorBar colors={colors} />
        </div>
      ) : null}
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <div className="min-h-0 flex-1 overflow-y-auto border border-border">
          {order.map((id) => {
            const tag = defById(tagDefs, id);
            if (!tag) return null;
            return <TagReorderItem key={id} tag={tag} />;
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function TagReorderItem({ tag }: { tag: TagDefDto }) {
  const sortable = useSortable({ id: tag.id });
  return (
    <div
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }}
      className="flex h-7 items-center gap-2 border-b border-border px-2 last:border-b-0"
    >
      <GripVertical className="size-4 cursor-grab text-muted-foreground" {...sortable.listeners} />
      {tag.color ? (
        <span className="size-2 shrink-0" style={{ backgroundColor: tag.color }} />
      ) : null}
      <span className="text-sm">{tag.name}</span>
    </div>
  );
}
