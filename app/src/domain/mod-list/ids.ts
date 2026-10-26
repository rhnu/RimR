import type { EntryIdGenerator } from './types';

export const createEntryId: EntryIdGenerator = () => crypto.randomUUID();

export function createGroupId(generate: EntryIdGenerator = createEntryId): string {
  return generate();
}

export function createSeparatorId(generate: EntryIdGenerator = createEntryId): string {
  return generate();
}
