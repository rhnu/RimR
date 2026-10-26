import { useContext } from 'react';
import { OrderWorkspaceContext, type OrderWorkspaceValue } from './OrderWorkspaceContext';

export const useOrderWorkspace = (): OrderWorkspaceValue => {
  const ctx = useContext(OrderWorkspaceContext);
  if (!ctx) throw new Error('useOrderWorkspace must be used inside OrderWorkspaceProvider');
  return ctx;
};

export const useOrderWorkspaceData = () => useOrderWorkspace().data;
export const useOrderWorkspacePreview = () => useOrderWorkspace().preview;
export const useOrderWorkspaceDraftState = () => useOrderWorkspace().draftState;
export const useOrderWorkspaceDialog = () => {
  const { setDialog } = useOrderWorkspace();
  return { setDialog };
};
export const useOrderWorkspaceFilters = () => useOrderWorkspace().filters;
export const useOrderWorkspaceValidation = () => useOrderWorkspace().validation;
export const useOrderWorkspaceDerived = () => useOrderWorkspace().derived;
export const useOrderWorkspaceSelection = () => useOrderWorkspace().selection;
export const useOrderWorkspaceCommands = () => useOrderWorkspace().commands;
export const useOrderWorkspaceSync = () => useOrderWorkspace().sync;
export const useOrderWorkspaceEditActions = () => useOrderWorkspace().editActions;
export const useOrderWorkspaceDrag = () => useOrderWorkspace().drag;
export const useOrderWorkspaceTagCommands = () => useOrderWorkspace().tagCommands;
export const useOrderWorkspaceOpenHandlers = () => {
  const { handleOpenModFolder, handleOpenSteamWorkshopPage } = useOrderWorkspace();
  return { handleOpenModFolder, handleOpenSteamWorkshopPage };
};
export const useOrderWorkspaceSensors = () => useOrderWorkspace().sensors;
