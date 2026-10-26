import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  DiagnosticDto,
  ModIdentityDto,
  ModMetadataDto,
  ModListDto,
  ModTagBindingDto,
  TagDefDto,
} from '@/commands';
import { useModFolderSize, useModPreview } from '@/hooks/commands';
import { officialDisplayName } from '@/lib/officialContent';
import { currentModFolderSize, currentModPreview } from '@/lib/modFileInfoView';
import type { Selection } from '@/features/order/types';
import { resolveModTags } from './TagsMeta';
import { deriveSelection } from './metadataSelection';
import {
  EmptyMetadata,
  SelectedGroupMetadata,
  SelectedModMetadata,
  SelectedSeparatorMetadata,
  selectionDiagnostics,
} from './metadataView';
import {
  useOrderWorkspaceData,
  useOrderWorkspaceDerived,
  useOrderWorkspaceDraftState,
  useOrderWorkspaceSelection,
} from './context/hooks';

type SelectedEntry = ModListDto['entries'][number] | null | undefined;

export function MetadataPanel() {
  const { t } = useTranslation();
  const { library } = useOrderWorkspaceData();
  const { draft } = useOrderWorkspaceDraftState();
  const { selection } = useOrderWorkspaceSelection();
  const { modByPackageId, diagnosticsMap } = useOrderWorkspaceDerived();
  const sourceKey = useSelectedSourceKey(draft, selection, modByPackageId);
  const folderSizeEnabled = useFolderSizeEnabled(sourceKey);
  const preview = useModPreview(sourceKey);
  const folderSize = useModFolderSize(sourceKey, folderSizeEnabled);
  if (!draft) return null;
  const view = deriveSelection(selection, draft, modByPackageId);
  const selectedPreview = currentModPreview(sourceKey, preview.data);
  const selectedFolderSize = currentModFolderSize(sourceKey, folderSize.data);
  const previewLoading = sourceKey != null && preview.isLoading && !selectedPreview?.previewDataUrl;
  const diagnostics = selectionDiagnostics(
    view.selectedModIdentity,
    view.selectedEntry,
    diagnosticsMap,
  );
  const title = metadataTitle(
    view.selectedModIdentity,
    view.selectedMod,
    view.selectedEntry,
    t('order.inspector.title'),
  );
  return (
    <aside className="flex min-h-0 flex-col rounded-slight border border-border bg-background">
      <div className="flex h-9 select-none items-center border-b border-border px-2">
        <h2 className="truncate text-sm font-semibold">{title}</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2 scrollbar-hidden">
        <MetadataBody
          selection={selection}
          selectedModIdentity={view.selectedModIdentity}
          selectedMod={view.selectedMod}
          selectedEntry={view.selectedEntry}
          previewLoading={previewLoading}
          previewDataUrl={selectedPreview?.previewDataUrl ?? undefined}
          folderSizeBytes={selectedFolderSize?.folderSizeBytes}
          diagnostics={diagnostics}
          modByPackageId={modByPackageId}
          tagDefs={library.data?.settings.tagDefs ?? []}
          modTags={library.data?.settings.modTags ?? []}
        />
      </div>
    </aside>
  );
}

function useSelectedSourceKey(
  draft: ModListDto | null,
  selection: Selection,
  modByPackageId: Map<string, ModMetadataDto>,
): string | null {
  if (!draft) return null;
  const { selectedMod, selectedModIdentity } = deriveSelection(selection, draft, modByPackageId);
  return selectedMod?.sourceKey ?? selectedModIdentity?.sourceKey ?? null;
}

function useFolderSizeEnabled(sourceKey: string | null): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    setEnabled(false);
    if (sourceKey == null) return;
    const timeout = window.setTimeout(() => setEnabled(true), 1200);
    return () => window.clearTimeout(timeout);
  }, [sourceKey]);
  return enabled;
}

function MetadataBody({
  selection,
  selectedModIdentity,
  selectedMod,
  selectedEntry,
  previewLoading,
  previewDataUrl,
  folderSizeBytes,
  diagnostics,
  modByPackageId,
  tagDefs,
  modTags,
}: {
  selection: Selection;
  selectedModIdentity: ModIdentityDto | null;
  selectedMod: ModMetadataDto | null | undefined;
  selectedEntry: SelectedEntry;
  previewLoading: boolean;
  previewDataUrl: string | undefined;
  folderSizeBytes: number | null | undefined;
  diagnostics: DiagnosticDto[];
  modByPackageId: Map<string, ModMetadataDto>;
  tagDefs: TagDefDto[];
  modTags: ModTagBindingDto[];
}) {
  if (!selection) return <EmptyMetadata />;
  if (selectedModIdentity) {
    return (
      <SelectedModMetadata
        identity={selectedModIdentity}
        mod={selectedMod}
        previewLoading={previewLoading}
        previewDataUrl={previewDataUrl}
        folderSizeBytes={folderSizeBytes}
        diagnostics={diagnostics}
        modByPackageId={modByPackageId}
        tags={resolveModTags(selectedModIdentity, tagDefs, modTags)}
      />
    );
  }
  if (selectedEntry?.kind === 'group') {
    return (
      <SelectedGroupMetadata
        entryCount={selectedEntry.entries.length}
        diagnostics={diagnostics}
        modByPackageId={modByPackageId}
      />
    );
  }
  if (selectedEntry?.kind === 'separator') {
    return <SelectedSeparatorMetadata id={selectedEntry.id} note={selectedEntry.note ?? null} />;
  }
  return null;
}

function metadataTitle(
  identity: ModIdentityDto | null,
  mod: ModMetadataDto | null | undefined,
  entry: SelectedEntry,
  fallback: string,
): string {
  return (
    officialDisplayName(identity?.packageId ?? '') ??
    mod?.name ??
    identity?.packageId ??
    (entry?.kind === 'group' ? entry.name : entry?.kind === 'separator' ? entry.title : fallback)
  );
}
