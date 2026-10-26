import { memo } from 'react';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import { ModTypeIcon } from '@/components/mod/ModTypeIcon';
import { cn } from '@/lib/utils';
import { labelForIdentity } from '@/features/order/identity';
import { childSortableId } from '@/features/order/dndIds';
import { useDragDropNode } from '@/features/order/hooks/useDragDropNode';
import { TagColorBar } from '@/features/tags/TagColorBar';
import { colorsForIdentity } from '@/features/tags/tagModel';
import { DiagnosticIcon } from './DiagnosticIcon';
import { RowDropIndicator } from './DropIndicator';
import { GroupChildMenu } from './GroupChildMenu';
import type { GroupChildRowProps } from './rowTypes';

export const GroupChildRow = memo(function GroupChildRow({
  groupId,
  child,
  aliases,
  modByPackageId,
  tagDefs,
  modTags,
  diagnostics,
  onWarmFileInfo,
  onSelect,
  onDoubleClick,
  onEditAlias,
  onOpenModFolder,
  onOpenSteamWorkshopPage,
  onToggleModTag,
  onCreateTag,
  onRenameTag,
  onSetTagColor,
  onDeleteTag,
  onReorderModTags,
  onRemove,
  dropIndicatorStore,
}: GroupChildRowProps) {
  const rowId = childSortableId(groupId, child.id);
  const dragDrop = useDragDropNode(rowId);
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={dragDrop.setNodeRef}
          onPointerEnter={() => onWarmFileInfo(child.identity.sourceKey)}
          onDoubleClick={() => onDoubleClick(groupId, child.id)}
          className={rowClassName(dragDrop.isDragging)}
          {...dragDrop.attributes}
          {...dragDrop.listeners}
        >
          <RowDropIndicator rowId={rowId} store={dropIndicatorStore} allowInside={false} />
          <TagColorBar colors={colorsForIdentity(modTags, tagDefs, child.identity)} />
          <ModTypeIcon
            hasAssemblies={modByPackageId.get(child.identity.packageId)?.hasAssemblies ?? false}
            sourceKind={modByPackageId.get(child.identity.packageId)?.sourceKind}
          />
          <button
            type="button"
            className="h-full min-w-0 flex-1 truncate text-left text-sm"
            onPointerDown={() => onWarmFileInfo(child.identity.sourceKey, true)}
            onFocus={() => onWarmFileInfo(child.identity.sourceKey, true)}
            onClick={() => onSelect(child)}
          >
            {labelForIdentity(child.identity, aliases, modByPackageId)}
          </button>
          <DiagnosticIcon diagnostics={diagnostics} />
        </div>
      </ContextMenuTrigger>
      <GroupChildMenu
        identity={child.identity}
        sourceKey={child.identity.sourceKey}
        groupId={groupId}
        childId={child.id}
        modByPackageId={modByPackageId}
        tagDefs={tagDefs}
        modTags={modTags}
        onEditAlias={onEditAlias}
        onOpenModFolder={onOpenModFolder}
        onOpenSteamWorkshopPage={onOpenSteamWorkshopPage}
        onToggleModTag={onToggleModTag}
        onCreateTag={onCreateTag}
        onRenameTag={onRenameTag}
        onSetTagColor={onSetTagColor}
        onDeleteTag={onDeleteTag}
        onReorderModTags={onReorderModTags}
        onRemove={onRemove}
      />
    </ContextMenu>
  );
});

function rowClassName(isDragging: boolean): string {
  return cn(
    'relative flex h-6 select-none items-center gap-2 border-b border-border px-2 pl-8 last:border-b-0',
    isDragging && 'opacity-40',
  );
}
