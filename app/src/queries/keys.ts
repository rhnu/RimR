const workspaceKey = (epoch: number) => ['workspace', epoch] as const;

export const queryKeys = {
  appVersion: ['appVersion'] as const,
  update: ['update'] as const,
  gameVersion: (epoch: number) => [...workspaceKey(epoch), 'gameVersion'] as const,
  bootstrap: ['bootstrap'] as const,
  appConfig: ['appConfig'] as const,
  workspace: workspaceKey,
  catalogSnapshot: (epoch: number) => [...workspaceKey(epoch), 'catalog'] as const,
  activeList: (epoch: number) => [...workspaceKey(epoch), 'gameConfig'] as const,
  library: (epoch: number) => [...workspaceKey(epoch), 'library'] as const,
  modPreview: (epoch: number, sourceKey: string | null, catalogRevision: number) =>
    [...workspaceKey(epoch), 'preview', catalogRevision, sourceKey] as const,
  modFolderSize: (epoch: number, sourceKey: string | null, catalogRevision: number) =>
    [...workspaceKey(epoch), 'folderSize', catalogRevision, sourceKey] as const,
  steamWorkshopLog: (epoch: number) => [...workspaceKey(epoch), 'steamWorkshopLog'] as const,
  playerLog: (epoch: number, source: string) =>
    [...workspaceKey(epoch), 'playerLog', source] as const,
};
