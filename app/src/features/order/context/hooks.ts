import { useContext, type Context } from 'react';
import {
  OrderContentContext,
  OrderInteractionContext,
  OrderActionsContext,
  OrderDragContext,
} from './order-workspace-context';

function useRequiredContext<T>(context: Context<T | null>): T {
  const value = useContext(context);
  if (!value) throw new Error('Order workspace hooks require OrderWorkspaceProvider');
  return value;
}
export const useOrderWorkspaceData = () => useRequiredContext(OrderContentContext).data;
export const useOrderWorkspaceDraftState = () => useRequiredContext(OrderContentContext).draftState;
export const useOrderWorkspaceValidation = () => useRequiredContext(OrderContentContext).validation;
export const useOrderWorkspaceDerived = () => useRequiredContext(OrderContentContext).derived;
export const useOrderWorkspacePreview = () => useRequiredContext(OrderInteractionContext).preview;
export const useOrderWorkspaceFilters = () => useRequiredContext(OrderInteractionContext).filters;
export const useOrderWorkspaceSelection = () =>
  useRequiredContext(OrderInteractionContext).selection;
export const useOrderWorkspaceCommands = () => useRequiredContext(OrderActionsContext).commands;
export const useOrderWorkspaceSync = () => useRequiredContext(OrderActionsContext).sync;
export const useOrderWorkspaceEditActions = () =>
  useRequiredContext(OrderActionsContext).editActions;
export const useOrderWorkspaceTagCommands = () =>
  useRequiredContext(OrderActionsContext).tagCommands;
export const useOrderWorkspaceDialog = () => ({
  setDialog: useRequiredContext(OrderActionsContext).setDialog,
});
export const useOrderWorkspaceOpenHandlers = () => {
  const { handleOpenModFolder, handleOpenSteamWorkshopPage } =
    useRequiredContext(OrderActionsContext);
  return { handleOpenModFolder, handleOpenSteamWorkshopPage };
};
export const useOrderWorkspaceDrag = () => useRequiredContext(OrderDragContext).drag;
export const useOrderWorkspaceSensors = () => useRequiredContext(OrderDragContext).sensors;
