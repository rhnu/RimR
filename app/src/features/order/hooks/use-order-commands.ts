import type { OrderCommands } from '../context/workspace-types';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { ModIdentityDto, ModListDto } from '@/commands';
import { useApplyModListToGame } from '@/queries/game-config';
import { useUpdateLibrarySettings, useSaveModList, useSetCurrentModList } from '@/queries/library';
import { upsertAlias } from '@/domain/mods/identity';

export function useOrderCommands({
  draft,
  acceptSaved,
}: {
  draft: ModListDto | null;
  acceptSaved: (submitted: ModListDto, saved: ModListDto) => void;
}): OrderCommands {
  const { t } = useTranslation();
  const saveModList = useSaveModList();
  const applyModList = useApplyModListToGame();
  const saveSettings = useUpdateLibrarySettings();
  const setCurrentModList = useSetCurrentModList();

  function handleSaveModList(): void {
    if (!draft) return;
    void saveModList
      .mutateAsync({ modList: draft })
      .then((modList) => {
        acceptSaved(draft, modList);
        toast.success(t('toast.modListSaved'));
      })
      .catch(() => undefined);
  }

  function handleApply(modList: ModListDto | null = draft): void {
    if (!modList) return;
    void applyModList
      .mutateAsync({ modList })
      .then(() => {
        toast.success(t('toast.appliedToGame'));
      })
      .catch(() => undefined);
  }

  function handleSaveAlias(identity: ModIdentityDto, displayAlias: string): void {
    void saveSettings
      .mutateAsync((current) => ({
        ...current,
        aliases: upsertAlias(current.aliases, identity, displayAlias.trim()),
      }))
      .then(() => {
        toast.success(t('toast.aliasSaved'));
      })
      .catch(() => undefined);
  }

  function handleSetCurrentModList(modListId: string): void {
    setCurrentModList.mutate({ modListId });
  }

  return {
    savePending: saveModList.isPending,
    applyPending: applyModList.isPending,
    handleSaveModList,
    handleApply,
    handleSaveAlias,
    handleSetCurrentModList,
  };
}
