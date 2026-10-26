import { useEffect, useRef } from 'react';
import type { ModListDto, ModMetadataDto } from '@/commands';
import { classifyMissingEntries, removeMissingEntries } from '@/domain/mod-list/missing-entries';
import type { OrderDialog } from '@/features/order/types';

type AutoMissingModsPromptParams = {
  draft: ModListDto | null;
  mods: ModMetadataDto[];
  hasOpenDialog: boolean;
  setDialog: (dialog: OrderDialog) => void;
};

export function useAutoMissingModsPrompt({
  draft,
  mods,
  hasOpenDialog,
  setDialog,
}: AutoMissingModsPromptParams): void {
  const lastPromptedRef = useRef<{ modListId: string; key: string } | null>(null);

  useEffect(() => {
    if (!draft) {
      lastPromptedRef.current = null;
      return;
    }
    if (mods.length === 0) return;
    if (hasOpenDialog) return;

    const missing = classifyMissingEntries(draft, mods);
    if (missing.active.length === 0) {
      const last = lastPromptedRef.current;
      if (last && last.modListId === draft.id) {
        lastPromptedRef.current = { modListId: draft.id, key: '' };
      }
      return;
    }

    const key = [...missing.active].sort().join('|');
    const last = lastPromptedRef.current;
    if (last && last.modListId === draft.id && last.key === key) return;

    lastPromptedRef.current = { modListId: draft.id, key };
    setDialog({
      kind: 'activeMissingMods',
      packageIds: missing.active,
      modList: removeMissingEntries(draft, missing.active),
    });
  }, [draft, mods, hasOpenDialog, setDialog]);
}
