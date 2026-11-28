import { memo } from 'react';
import { cn } from '@/lib/utils';
import { entrySortableId } from '@/features/order/dnd-ids';
import { useDragDropNode } from '@/features/order/hooks/use-drag-drop-node';
import { TagColorBar } from '@/components/mod/tags/tag-color-bar';
import { colorsForIdentity } from '@/domain/mods/tags';
import { ActiveEntryContent } from '@/features/order/ui/rows/active-entry-content';
import { ActiveEntryMenu } from '@/features/order/ui/rows/active-entry-menu';
import { DiagnosticIcon } from '@/features/order/ui/rows/diagnostic-icon';
import { RowDropIndicator } from '@/features/order/ui/rows/drop-indicator';
import type { ActiveEntryRowProps } from '@/features/order/ui/rows/row-types';
import { DiagnosticRowMenu } from '../diagnostic-row-menu';

export const ActiveEntryRow = memo(function ActiveEntryRow({
  entry,
  aliases,
  modByPackageId,
  diagnostics,
  diagnosticNavigation,
  tagDefs,
  modTags,
  selected,
  onContextOpen,
  onWarmFileInfo,
  onDoubleClick,
  dropIndicatorStore,
  ...menuAndContentProps
}: ActiveEntryRowProps) {
  const rowId = entrySortableId(entry.id);
  const dragDrop = useDragDropNode(rowId);
  return (
    <DiagnosticRowMenu
      target={{ kind: 'entry', entry }}
      navigation={diagnosticNavigation}
      onOpen={() => onContextOpen(entry)}
      trigger={
        <div
          ref={dragDrop.setNodeRef}
          onPointerEnter={() => warmEntryPreview(entry, onWarmFileInfo)}
          onDoubleClick={() => onDoubleClick(entry)}
          className={rowClassName(selected, dragDrop.isDragging)}
          {...dragDrop.attributes}
          {...dragDrop.listeners}
        >
          <RowDropIndicator rowId={rowId} store={dropIndicatorStore} />
          {entry.kind === 'mod' && (
            <TagColorBar colors={colorsForIdentity(modTags, tagDefs, entry.identity)} />
          )}
          <div className="flex h-7 items-center gap-2 px-2">
            <ActiveEntryContent
              entry={entry}
              aliases={aliases}
              modByPackageId={modByPackageId}
              onWarmFileInfo={onWarmFileInfo}
              onSelect={menuAndContentProps.onSelect}
            />
            <DiagnosticIcon items={diagnostics} />
          </div>
        </div>
      }
    >
      <ActiveEntryMenu
        entry={entry}
        modByPackageId={modByPackageId}
        tagDefs={tagDefs}
        modTags={modTags}
        {...menuAndContentProps}
      />
    </DiagnosticRowMenu>
  );
});

function warmEntryPreview(
  entry: ActiveEntryRowProps['entry'],
  warm: ActiveEntryRowProps['onWarmFileInfo'],
): void {
  if (entry.kind === 'mod') {
    warm(entry.identity.sourceKey);
  }
}

function rowClassName(selected: boolean, isDragging: boolean): string {
  return cn(
    'relative border-b border-border bg-background select-none',
    selected && 'bg-accent',
    isDragging && 'opacity-40',
  );
}
