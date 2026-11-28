import { memo } from 'react';
import { ModTypeIcon } from '@/components/mod/mod-type-icon';
import { cn } from '@/lib/utils';
import { labelForIdentity, resolveInstalledMod } from '@/domain/mods/identity';
import { childSortableId } from '@/features/order/dnd-ids';
import { useDragDropNode } from '@/features/order/hooks/use-drag-drop-node';
import { TagColorBar } from '@/components/mod/tags/tag-color-bar';
import { colorsForIdentity } from '@/domain/mods/tags';
import { DiagnosticIcon } from '@/features/order/ui/rows/diagnostic-icon';
import { RowDropIndicator } from '@/features/order/ui/rows/drop-indicator';
import { GroupChildMenu } from '@/features/order/ui/rows/group-child-menu';
import type { GroupChildRowProps } from '@/features/order/ui/rows/row-types';
import { DiagnosticRowMenu } from '../diagnostic-row-menu';

export const GroupChildRow = memo(function GroupChildRow({
  groupId,
  child,
  aliases,
  modByPackageId,
  tagDefs,
  modTags,
  diagnostics,
  diagnosticNavigation,
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
  const mod = resolveInstalledMod(child.identity, modByPackageId);
  return (
    <DiagnosticRowMenu
      target={{ kind: 'mod', identity: child.identity }}
      navigation={diagnosticNavigation}
      trigger={
        <div
          ref={dragDrop.setNodeRef}
          onPointerEnter={() => onWarmFileInfo(mod?.sourceKey)}
          onDoubleClick={() => onDoubleClick(groupId, child.id)}
          className={rowClassName(dragDrop.isDragging)}
          {...dragDrop.attributes}
          {...dragDrop.listeners}
        >
          <RowDropIndicator rowId={rowId} store={dropIndicatorStore} />
          <TagColorBar colors={colorsForIdentity(modTags, tagDefs, child.identity)} />
          <ModTypeIcon hasAssemblies={mod?.hasAssemblies ?? false} sourceKind={mod?.sourceKind} />
          <button
            type="button"
            className="h-full min-w-0 flex-1 truncate text-left text-sm"
            onPointerDown={() => onWarmFileInfo(mod?.sourceKey, true)}
            onFocus={() => onWarmFileInfo(mod?.sourceKey, true)}
            onClick={() => onSelect(child)}
          >
            {labelForIdentity(child.identity, aliases, modByPackageId)}
          </button>
          <DiagnosticIcon items={diagnostics} />
        </div>
      }
    >
      <GroupChildMenu
        identity={child.identity}
        mod={mod}
        groupId={groupId}
        childId={child.id}
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
    </DiagnosticRowMenu>
  );
});

function rowClassName(isDragging: boolean): string {
  return cn(
    'relative flex h-6 select-none items-center gap-2 border-b border-border px-2 pl-8 last:border-b-0',
    isDragging && 'opacity-40',
  );
}
