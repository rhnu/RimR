// Registered readers retain page-local draft ownership, including the initial setup page.
const readers = new Set<() => boolean>();

export function registerSettingsDraft(reader: () => boolean): () => void {
  readers.add(reader);
  return () => {
    readers.delete(reader);
  };
}

export function hasUnsavedSettings(): boolean {
  return [...readers].some((reader) => reader());
}
