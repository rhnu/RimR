import { useCallback } from 'react';
import type { DisplayAliasDto, ModIdentityDto, ModMetadataDto } from '@/commands';
import {
  baseDisplayName,
  baseLabelForIdentity,
  findAlias,
  identityForMod,
} from '@/features/order/identity';
import type { OrderDialog } from '@/features/order/types';

export function useEditInactiveAlias(
  aliases: DisplayAliasDto[],
  setDialog: (dialog: OrderDialog) => void,
) {
  return useCallback(
    (mod: ModMetadataDto): void => {
      const identity = identityForMod(mod);
      const baseValue = baseDisplayName(mod);
      const existingAlias = findAlias(aliases, identity);
      const initialValue = existingAlias?.displayAlias ?? baseValue;
      setDialog({
        kind: 'editAlias',
        identity,
        value: initialValue,
        baseValue,
        initialValue,
        hadAlias: existingAlias != null,
      });
    },
    [aliases, setDialog],
  );
}

export function useEditActiveAlias(
  modByPackageId: Map<string, ModMetadataDto>,
  aliases: DisplayAliasDto[],
  setDialog: (dialog: OrderDialog) => void,
) {
  return useCallback(
    (identity: ModIdentityDto): void => {
      const baseValue = baseLabelForIdentity(identity, modByPackageId);
      const existingAlias = findAlias(aliases, identity);
      const initialValue = existingAlias?.displayAlias ?? baseValue;
      setDialog({
        kind: 'editAlias',
        identity,
        value: initialValue,
        baseValue,
        initialValue,
        hadAlias: existingAlias != null,
      });
    },
    [aliases, modByPackageId, setDialog],
  );
}
