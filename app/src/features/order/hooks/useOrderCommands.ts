import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { LibraryDto, ModIdentityDto, ModListDto } from '@/commands';
import {
  useApplyModListToGame,
  useSaveLibrarySettings,
  useSaveModList,
  useSetCurrentModList,
} from '@/hooks/commands';
import { upsertAlias } from '@/features/order/identity';

export function useOrderCommands({
  draft,
  library,
  replaceSavedDraft,
  refetchActiveList,
  refetchLibrary,
}: {
  draft: ModListDto | null;
  library: LibraryDto | undefined;
  replaceSavedDraft: (modList: ModListDto) => void;
  refetchActiveList: () => void;
  refetchLibrary: () => void;
}) {
  const { t } = useTranslation();
  const saveModList = useSaveModList();
  const applyModList = useApplyModListToGame();
  const saveSettings = useSaveLibrarySettings();
  const setCurrentModList = useSetCurrentModList();

  function handleSaveModList(): void {
    if (!draft) return;
    void saveModList
      .mutateAsync({ modList: draft })
      .then((modList) => {
        replaceSavedDraft(modList);
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
        refetchActiveList();
      })
      .catch(() => undefined);
  }

  function handleSaveAlias(identity: ModIdentityDto, displayAlias: string): void {
    if (!library) return;
    const aliases = upsertAlias(library.settings.aliases, identity, displayAlias.trim());
    void saveSettings
      .mutateAsync({ settings: { ...library.settings, aliases } })
      .then(() => {
        toast.success(t('toast.aliasSaved'));
        refetchLibrary();
      })
      .catch(() => undefined);
  }

  function handleSetCurrentModList(modListId: string): void {
    void setCurrentModList
      .mutateAsync({ modListId })
      .then((modList) => {
        replaceSavedDraft(modList);
        refetchLibrary();
      })
      .catch(() => undefined);
  }

  return {
    saveModList,
    applyModList,
    handleSaveModList,
    handleApply,
    handleSaveAlias,
    handleSetCurrentModList,
  };
}
