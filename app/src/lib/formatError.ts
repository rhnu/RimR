import type { RimrClientError } from '@/commands';

export type FormattedError = {
  title: string;
  description?: string;
  descriptionKey?: 'error.transport';
};

export function formatRimrError(error: unknown): FormattedError {
  if (isRimrClientError(error)) {
    if (error.kind === 'command') {
      const cmd = error.error;
      const parts: string[] = [cmd.code];
      if (cmd.sourceKey) parts.push(cmd.sourceKey);
      if (cmd.path) parts.push(cmd.path);
      return { title: cmd.message, description: parts.join(' · ') };
    }
    return { title: error.message, descriptionKey: 'error.transport' };
  }
  return { title: String(error) };
}

export function isRimrClientError(value: unknown): value is RimrClientError {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as { kind?: unknown };
  if (candidate.kind === 'command') {
    const cmd = (value as { error?: unknown }).error;
    return (
      typeof cmd === 'object' &&
      cmd !== null &&
      typeof (cmd as { code?: unknown }).code === 'string' &&
      typeof (cmd as { message?: unknown }).message === 'string'
    );
  }
  if (candidate.kind === 'transport') {
    return typeof (value as { message?: unknown }).message === 'string';
  }
  return false;
}
