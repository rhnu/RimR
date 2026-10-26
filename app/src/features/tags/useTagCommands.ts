import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type {
  LibraryDto,
  LibrarySettingsDto,
  ModIdentityDto,
  ModTagBindingDto,
  TagDefDto,
} from '@/commands';
import { useSaveLibrarySettings } from '@/hooks/commands';
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
} from './tagModel';

export function useTagCommands({
  library,
  refetchLibrary,
}: {
  library: LibraryDto | undefined;
  refetchLibrary: () => void;
}) {
  const { t } = useTranslation();
  const saveSettings = useSaveLibrarySettings();

  function saveSettingsWith(settings: LibrarySettingsDto): void {
    if (!library) return;
    void saveSettings
      .mutateAsync({ settings })
      .then(() => refetchLibrary())
      .catch(() => undefined);
  }

  function commit(tagDefs: TagDefDto[], modTags: ModTagBindingDto[]): void {
    if (!library) return;
    saveSettingsWith({
      ...library.settings,
      tagDefs,
      modTags,
    });
  }

  function handleCreateTag(name: string, color: string | null): void {
    if (!library) return;
    const tagDefs = upsertTagDef(library.settings.tagDefs ?? [], createTagDef(name, color));
    commit(tagDefs, library.settings.modTags ?? []);
    toast.success(t('toast.tagCreated'));
  }

  function handleRenameTag(id: string, name: string): void {
    if (!library) return;
    const tagDefs = renameTagDef(library.settings.tagDefs ?? [], id, name);
    commit(tagDefs, library.settings.modTags ?? []);
    toast.success(t('toast.tagRenamed'));
  }

  function handleSetTagColor(id: string, color: string | null): void {
    if (!library) return;
    const tagDefs = setTagDefColor(library.settings.tagDefs ?? [], id, color);
    commit(tagDefs, library.settings.modTags ?? []);
  }

  function handleDeleteTag(id: string): void {
    if (!library) return;
    const { defs, bindings } = removeTagDef(library.settings.tagDefs ?? [], id);
    commit(defs, bindings(library.settings.modTags ?? []));
    toast.success(t('toast.tagDeleted'));
  }

  function handleToggleModTag(identity: ModIdentityDto, tagId: string): void {
    if (!library) return;
    const modTags = toggleModTag(library.settings.modTags ?? [], identity, tagId);
    commit(library.settings.tagDefs ?? [], modTags);
  }

  function handleToggleModTags(identities: ModIdentityDto[], tagId: string): void {
    if (!library) return;
    const modTags = toggleModTagForIdentities(library.settings.modTags ?? [], identities, tagId);
    commit(library.settings.tagDefs ?? [], modTags);
  }

  function handleSetModTags(identity: ModIdentityDto, tagIds: string[]): void {
    if (!library) return;
    const modTags = upsertModTags(library.settings.modTags ?? [], identity, tagIds);
    commit(library.settings.tagDefs ?? [], modTags);
  }

  function handleReorderModTags(identity: ModIdentityDto, tagIds: string[]): void {
    if (!library) return;
    const modTags = reorderModTags(library.settings.modTags ?? [], identity, tagIds);
    commit(library.settings.tagDefs ?? [], modTags);
  }

  return {
    handleCreateTag,
    handleRenameTag,
    handleSetTagColor,
    handleDeleteTag,
    handleToggleModTag,
    handleToggleModTags,
    handleSetModTags,
    handleReorderModTags,
    saveSettings,
  };
}
