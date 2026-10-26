export const queryKeys = {
  bootstrap: ['bootstrap'] as const,
  appConfig: ['appConfig'] as const,
  workspaceRoot: ['workspace'] as const,
  catalogSnapshot: (epoch: number) => ['workspace', epoch, 'catalog'] as const,
  activeList: (epoch: number) => ['workspace', epoch, 'gameConfig'] as const,
  library: (epoch: number) => ['workspace', epoch, 'library'] as const,
  modPreview: (epoch: number, sourceKey: string | null, catalogRevision: number) =>
    ['workspace', epoch, 'preview', catalogRevision, sourceKey] as const,
  modFolderSize: (epoch: number, sourceKey: string | null, catalogRevision: number) =>
    ['workspace', epoch, 'folderSize', catalogRevision, sourceKey] as const,
  steamWorkshopLog: (epoch: number) => ['workspace', epoch, 'steamWorkshopLog'] as const,
  playerLog: (epoch: number, source: string) => ['workspace', epoch, 'playerLog', source] as const,
};
