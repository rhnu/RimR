export type LibraryDialog =
  | { kind: 'newModList'; value: string }
  | { kind: 'renameModList'; modListId: string; value: string }
  | { kind: 'saveAsModList'; modListId: string; value: string }
  | { kind: 'deleteModList'; modListId: string };

export function isLibraryDialog(dialog: { kind: string } | null): dialog is LibraryDialog {
  return (
    dialog != null &&
    ['newModList', 'renameModList', 'saveAsModList', 'deleteModList'].includes(dialog.kind)
  );
}
