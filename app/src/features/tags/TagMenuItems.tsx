import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpDown, Palette, Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import type { ModIdentityDto, TagDefDto } from '@/commands';
import {
  ContextMenuCheckboxItem,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/components/ui/context-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { TAG_PALETTE } from './tagPalette';
import { TagReorderDialog } from './TagReorderDialog';

type TagMenuItemsProps = {
  identity: ModIdentityDto;
  tagDefs: TagDefDto[];
  boundTagIds: string[];
  onToggleTag: (tagId: string) => void;
  onCreateTag: (name: string, color: string | null) => void;
  onRenameTag: (tagId: string, name: string) => void;
  onSetTagColor: (tagId: string, color: string | null) => void;
  onDeleteTag: (tagId: string) => void;
  onReorderModTags: (identity: ModIdentityDto, tagIds: string[]) => void;
};

export function TagMenuItems({
  identity,
  tagDefs,
  boundTagIds,
  onToggleTag,
  onCreateTag,
  onRenameTag,
  onSetTagColor,
  onDeleteTag,
  onReorderModTags,
}: TagMenuItemsProps) {
  const { t } = useTranslation();
  const [reorderOpen, setReorderOpen] = useState(false);
  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        <Tag className="size-4" />
        {t('order.context.tags')}
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className="min-w-40">
        <ContextMenuLabel>{t('order.context.tags')}</ContextMenuLabel>
        {tagDefs.map((tag) => (
          <ContextMenuCheckboxItem
            key={tag.id}
            checked={boundTagIds.includes(tag.id)}
            onSelect={(e) => {
              e.preventDefault();
              onToggleTag(tag.id);
            }}
          >
            {tag.color ? (
              <span className="size-2 shrink-0" style={{ backgroundColor: tag.color }} />
            ) : null}
            {tag.name}
          </ContextMenuCheckboxItem>
        ))}
        {tagDefs.length > 0 ? <ContextMenuSeparator /> : null}
        <NewTagSub onCreate={onCreateTag} />
        {tagDefs.length > 0 ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuLabel>{t('order.context.manageTag')}</ContextMenuLabel>
            {tagDefs.map((tag) => (
              <ManageTagSub
                key={tag.id}
                tag={tag}
                onRename={onRenameTag}
                onSetColor={onSetTagColor}
                onDelete={onDeleteTag}
              />
            ))}
            {boundTagIds.length >= 2 ? (
              <ContextMenuItem onSelect={() => setReorderOpen(true)}>
                <ArrowUpDown className="size-4" />
                {t('order.context.reorderTags')}
              </ContextMenuItem>
            ) : null}
          </>
        ) : null}
      </ContextMenuSubContent>
      <TagReorderDialog
        open={reorderOpen}
        onOpenChange={setReorderOpen}
        identity={identity}
        tagDefs={tagDefs}
        boundTagIds={boundTagIds}
        onReorder={onReorderModTags}
      />
    </ContextMenuSub>
  );
}

function NewTagSub({ onCreate }: { onCreate: (name: string, color: string | null) => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [color, setColor] = useState<string | null>(null);

  function handleConfirm() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed, color);
    setName('');
    setColor(null);
  }

  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        <Plus className="size-4" />
        {t('order.context.newTag')}
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className="w-52 p-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
          placeholder={t('order.tag.namePlaceholder')}
          className="h-7 px-2 text-xs"
        />
        <ColorPalette selectedColor={color} onSelect={setColor} />
        <Button
          size="sm"
          className="mt-1 h-7 w-full"
          onClick={handleConfirm}
          disabled={!name.trim()}
        >
          {t('order.tag.create')}
        </Button>
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}

function ManageTagSub({
  tag,
  onRename,
  onSetColor,
  onDelete,
}: {
  tag: TagDefDto;
  onRename: (tagId: string, name: string) => void;
  onSetColor: (tagId: string, color: string | null) => void;
  onDelete: (tagId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        {tag.color ? (
          <span className="size-2 shrink-0" style={{ backgroundColor: tag.color }} />
        ) : null}
        {tag.name}
      </ContextMenuSubTrigger>
      <ContextMenuSubContent>
        <RenameTagSub tag={tag} onRename={onRename} />
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Palette className="size-4" />
            {t('order.context.setTagColor')}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48 p-1">
            <TagColorPalette tag={tag} onSetColor={onSetColor} />
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem variant="destructive" onSelect={() => onDelete(tag.id)}>
          <Trash2 className="size-4" />
          {t('order.context.deleteTag')}
        </ContextMenuItem>
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}

function RenameTagSub({
  tag,
  onRename,
}: {
  tag: TagDefDto;
  onRename: (tagId: string, name: string) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(tag.name);

  function handleConfirm() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === tag.name) return;
    onRename(tag.id, trimmed);
  }

  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        <Pencil className="size-4" />
        {t('order.context.renameTag')}
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className="w-52 p-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
          placeholder={t('order.tag.renamePlaceholder')}
          className="h-7 px-2 text-xs"
        />
        <Button
          size="sm"
          className="mt-1 h-7 w-full"
          onClick={handleConfirm}
          disabled={!name.trim() || name.trim() === tag.name}
        >
          {t('order.tag.confirm')}
        </Button>
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}

function ColorPalette({
  selectedColor,
  onSelect,
}: {
  selectedColor: string | null;
  onSelect: (color: string | null) => void;
}) {
  return (
    <div className="grid grid-cols-8 gap-1 py-1">
      {TAG_PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={color}
          className={cn(
            'size-4 border border-border',
            selectedColor === color && 'ring-1 ring-ring',
          )}
          style={{ backgroundColor: color }}
          onClick={() => onSelect(color)}
          title={color}
        />
      ))}
    </div>
  );
}

function TagColorPalette({
  tag,
  onSetColor,
}: {
  tag: TagDefDto;
  onSetColor: (tagId: string, color: string | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent"
        onClick={() => onSetColor(tag.id, null)}
      >
        <span className="size-4 border border-border" />
        {t('order.context.noColor')}
      </button>
      <ContextMenuSeparator />
      <div className="grid grid-cols-8 gap-1 p-1">
        {TAG_PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color}
            className={cn('size-4 border border-border', tag.color === color && 'ring-1 ring-ring')}
            style={{ backgroundColor: color }}
            onClick={() => onSetColor(tag.id, color)}
            title={color}
          />
        ))}
      </div>
    </>
  );
}
