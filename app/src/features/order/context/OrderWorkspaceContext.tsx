import { createContext } from 'react';
import type { useSensors } from '@dnd-kit/core';
import type { useOrderCommands } from '@/features/order/hooks/useOrderCommands';
import type { useOrderData } from '@/features/order/hooks/useOrderData';
import type { useOrderDerivedData } from '@/features/order/hooks/useOrderDerivedData';
import type { useOrderDrag } from '@/features/order/hooks/useOrderDrag';
import type { useOrderDraft } from '@/features/order/hooks/useOrderDraft';
import type { useOrderEditActions } from '@/features/order/hooks/useOrderEditActions';
import type { useOrderPreview } from '@/features/order/hooks/useOrderPreview';
import type { useOrderSelection } from '@/features/order/hooks/useOrderSelection';
import type { useOrderSync } from '@/features/order/hooks/useOrderSync';
import type { useOrderValidation } from '@/features/order/hooks/useOrderValidation';
import type { useTagCommands } from '@/features/tags/useTagCommands';
import type { SteamWorkshopOpenTarget } from '@/commands';
import type { OrderDialog } from '@/features/order/types';
import type { AvailableModSortKey, SortDirection } from '@/lib/availableMods';

type OrderCommands = ReturnType<typeof useOrderCommands> & {
  handleApplyWithDiff: () => void;
};

type OrderDerived = ReturnType<typeof useOrderDerivedData> & {
  differsFromGame: boolean;
};

export type OrderFilters = {
  availableSortKey: AvailableModSortKey;
  setAvailableSortKey: (key: AvailableModSortKey) => void;
  availableSortDirection: SortDirection;
  toggleAvailableSortDirection: () => void;
  inactiveSearch: string;
  setInactiveSearch: (value: string) => void;
  activeSearch: string;
  setActiveSearch: (value: string) => void;
};

export type OrderWorkspaceValue = {
  data: ReturnType<typeof useOrderData>;
  preview: ReturnType<typeof useOrderPreview>;
  draftState: ReturnType<typeof useOrderDraft>;
  setDialog: (dialog: OrderDialog) => void;
  filters: OrderFilters;
  validation: ReturnType<typeof useOrderValidation>;
  derived: OrderDerived;
  selection: ReturnType<typeof useOrderSelection>;
  commands: OrderCommands;
  sync: ReturnType<typeof useOrderSync>;
  editActions: ReturnType<typeof useOrderEditActions>;
  drag: ReturnType<typeof useOrderDrag>;
  tagCommands: ReturnType<typeof useTagCommands>;
  handleOpenModFolder: (sourceKey: string) => void;
  handleOpenSteamWorkshopPage: (sourceKey: string, target: SteamWorkshopOpenTarget) => void;
  sensors: ReturnType<typeof useSensors>;
};

export const OrderWorkspaceContext = createContext<OrderWorkspaceValue | null>(null);
