import type { EntryIdGenerator } from './types';

let fallbackCounter = 0;

export function createGroupId(generate: EntryIdGenerator = randomToken): string {
  return `group-${generate()}`;
}

export function createSeparatorId(generate: EntryIdGenerator = randomToken): string {
  return `sep-${generate()}`;
}

export function createTestIdGenerator(prefix = 'test'): EntryIdGenerator {
  let next = 0;
  return () => `${prefix}-${(next += 1)}`;
}

export function stableToken(value: string): string {
  const token = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return token || 'entry';
}

function randomToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  fallbackCounter += 1;
  return `fallback-${fallbackCounter.toString(36)}`;
}
