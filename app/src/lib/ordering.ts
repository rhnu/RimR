export type ReorderResult = {
  ids: string[];
  selected: Set<string>;
};

export function reorderOnDragEnd(
  ids: string[],
  selected: Set<string>,
  activeId: string,
  overId: string,
): ReorderResult | null {
  if (activeId === overId) return null;
  if (selected.has(activeId) && selected.size > 1) {
    if (selected.has(overId)) return null;
    const selectedIds = ids.filter((id) => selected.has(id));
    const remaining = ids.filter((id) => !selected.has(id));
    const targetIndex = remaining.indexOf(overId);
    if (targetIndex === -1) return null;
    return {
      ids: [...remaining.slice(0, targetIndex), ...selectedIds, ...remaining.slice(targetIndex)],
      selected,
    };
  }
  const from = ids.indexOf(activeId);
  const to = ids.indexOf(overId);
  if (from === -1 || to === -1) return null;
  const next = [...ids];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return { ids: next, selected: new Set([activeId]) };
}
