import type { AppConfig, ConfiguredDirectoryKind } from '@/commands';

export function isConfiguredDirectoryAvailable(
  paths: AppConfig['paths'] | undefined,
  kind: ConfiguredDirectoryKind,
): boolean {
  if (!paths) return false;
  switch (kind) {
    case 'gameDir':
      return Boolean(paths.gameDir);
    case 'gameDataDir':
      return Boolean(paths.gameDataDir);
    case 'localModsDir':
      return Boolean(paths.localModsDir);
    case 'workshopModsDir':
      return Boolean(paths.workshopModsDir);
    case 'rimrDataDir':
    case 'rimrModListsDir':
      return Boolean(paths.rimrDataDir);
    case 'rimrLogsDir':
      return true;
    default:
      return false;
  }
}
