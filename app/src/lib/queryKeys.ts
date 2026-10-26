export const queryKeys = {
  appConfig: ['appConfig'] as const,
  catalogSnapshot: ['catalogSnapshot'] as const,
  modPreviewRoot: ['modPreview'] as const,
  modPreview: (sourceKey: string | null) => ['modPreview', sourceKey] as const,
  modFolderSizeRoot: ['modFolderSize'] as const,
  modFolderSize: (sourceKey: string | null) => ['modFolderSize', sourceKey] as const,
  activeList: ['activeList'] as const,
  library: ['library'] as const,
  steamWorkshopLog: ['steamWorkshopLog'] as const,
  playerLog: (source: string) => ['playerLog', source] as const,
};

export const sessionBoundQueryKeys = [
  queryKeys.catalogSnapshot,
  queryKeys.activeList,
  queryKeys.library,
  queryKeys.modPreviewRoot,
  queryKeys.modFolderSizeRoot,
] as const;
