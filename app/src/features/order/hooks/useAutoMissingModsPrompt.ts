import { useEffect, useRef } from 'react';
import type { ModListDto, ModMetadataDto } from '@/commands';
import { classifyMissingEntries, removeMissingEntries } from '@/features/order/model';
import type { OrderDialog } from '@/features/order/types';

type AutoMissingModsPromptParams = {
  draft: ModListDto | null;
  mods: ModMetadataDto[];
  dialog: OrderDialog;
  setDialog: (dialog: OrderDialog) => void;
};

export function useAutoMissingModsPrompt({
  draft,
  mods,
  dialog,
  setDialog,
}: AutoMissingModsPromptParams): void {
  const lastPromptedRef = useRef<{ modListId: string; key: string } | null>(null);

  useEffect(() => {
    if (!draft) {
      lastPromptedRef.current = null;
      return;
    }
    if (mods.length === 0) return;
    if (dialog !== null) return;

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
  }, [draft, mods, dialog, setDialog]);
}
