export type LibraryDialog =
  | { kind: 'newModList'; value: string }
  | { kind: 'renameModList'; value: string }
  | { kind: 'saveAsModList'; value: string }
  | { kind: 'deleteModList' };

export function isLibraryDialog(dialog: { kind: string } | null): dialog is LibraryDialog {
  return (
    dialog != null &&
    ['newModList', 'renameModList', 'saveAsModList', 'deleteModList'].includes(dialog.kind)
  );
}
