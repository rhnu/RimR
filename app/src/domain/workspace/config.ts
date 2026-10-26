import type { AppConfig } from '@/commands';

export function needsSetup(config: AppConfig | null | undefined): boolean {
  return (
    config == null ||
    !hasPath(config.paths.gameDir) ||
    !hasPath(config.paths.gameDataDir) ||
    !hasPath(config.paths.rimrDataDir)
  );
}

function hasPath(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim() !== '';
}
