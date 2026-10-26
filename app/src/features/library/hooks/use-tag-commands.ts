import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { ModIdentityDto, LibrarySettingsDto } from '@/commands';
import { useUpdateLibrarySettings } from '@/queries/library';
import {
  createTagDef,
  removeTagDef,
  renameTagDef,
  reorderModTags,
  setTagDefColor,
  toggleModTagForIdentities,
  toggleModTag,
  upsertModTags,
  upsertTagDef,
} from '@/domain/mods/tags';

export type TagCommands = {
  handleCreateTag: (name: string, color: string | null) => void;
  handleRenameTag: (id: string, name: string) => void;
  handleSetTagColor: (id: string, color: string | null) => void;
  handleDeleteTag: (id: string) => void;
  handleToggleModTag: (identity: ModIdentityDto, tagId: string) => void;
  handleToggleModTags: (identities: ModIdentityDto[], tagId: string) => void;
  handleSetModTags: (identity: ModIdentityDto, tagIds: string[]) => void;
  handleReorderModTags: (identity: ModIdentityDto, tagIds: string[]) => void;
};

export function useTagCommands(): TagCommands {
  const { t } = useTranslation();
  const updateSettings = useUpdateLibrarySettings();
  function commit(
    update: (current: LibrarySettingsDto) => LibrarySettingsDto,
    message?: string,
  ): void {
    void updateSettings
      .mutateAsync(update)
      .then(() => {
        if (message) toast.success(message);
      })
      .catch(() => undefined);
  }
  return {
    handleCreateTag(name, color) {
      const tag = createTagDef(name, color);
      commit(
        (current) => ({ ...current, tagDefs: upsertTagDef(current.tagDefs ?? [], tag) }),
        t('toast.tagCreated'),
      );
    },
    handleRenameTag(id, name) {
      commit(
        (current) => ({ ...current, tagDefs: renameTagDef(current.tagDefs ?? [], id, name) }),
        t('toast.tagRenamed'),
      );
    },
    handleSetTagColor(id, color) {
      commit((current) => ({
        ...current,
        tagDefs: setTagDefColor(current.tagDefs ?? [], id, color),
      }));
    },
    handleDeleteTag(id) {
      commit((current) => {
        const removed = removeTagDef(current.tagDefs ?? [], id);
        return {
          ...current,
          tagDefs: removed.defs,
          modTags: removed.bindings(current.modTags ?? []),
        };
      }, t('toast.tagDeleted'));
    },
    handleToggleModTag(identity, tagId) {
      commit((current) => ({
        ...current,
        modTags: toggleModTag(current.modTags ?? [], identity, tagId),
      }));
    },
    handleToggleModTags(identities, tagId) {
      commit((current) => ({
        ...current,
        modTags: toggleModTagForIdentities(current.modTags ?? [], identities, tagId),
      }));
    },
    handleSetModTags(identity, tagIds) {
      commit((current) => ({
        ...current,
        modTags: upsertModTags(current.modTags ?? [], identity, tagIds),
      }));
    },
    handleReorderModTags(identity, tagIds) {
      commit((current) => ({
        ...current,
        modTags: reorderModTags(current.modTags ?? [], identity, tagIds),
      }));
    },
  };
}
