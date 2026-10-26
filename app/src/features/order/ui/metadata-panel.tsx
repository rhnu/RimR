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
import { useModFolderSize, useModPreview } from '@/queries/previews';
import { officialDisplayName } from '@/domain/mods/official-content';
import { currentModFolderSize, currentModPreview } from '@/domain/mods/file-info';
import { diagnosticsForTargets, entryDiagnosticTargets } from '@/domain/diagnostics/suppression';
import { identityForMod } from '@/domain/mods/identity';
import type { Selection } from '@/features/order/types';
import { resolveModTags } from '@/features/order/ui/tags-meta';
import { deriveSelection } from '@/features/order/model/metadata-selection';
import {
  EmptyMetadata,
  SelectedGroupMetadata,
  SelectedModMetadata,
  SelectedSeparatorMetadata,
} from '@/features/order/ui/metadata-view';
import {
  useOrderWorkspaceData,
  useOrderWorkspaceDerived,
  useOrderWorkspaceDraftState,
  useOrderWorkspaceSelection,
} from '@/features/order/context/hooks';

type SelectedEntry = ModListDto['entries'][number] | null | undefined;

export function MetadataPanel() {
  const { t } = useTranslation();
  const { library } = useOrderWorkspaceData();
  const { draft } = useOrderWorkspaceDraftState();
  const { selection } = useOrderWorkspaceSelection();
  const { modByPackageId, modByCatalogKey, rawDiagnostics } = useOrderWorkspaceDerived();
  const view = draft ? deriveSelection(selection, draft, modByPackageId, modByCatalogKey) : null;
  const sourceKey = view?.selectedMod?.sourceKey ?? null;
  const folderSizeEnabled = useFolderSizeEnabled(sourceKey);
  const preview = useModPreview(sourceKey);
  const folderSize = useModFolderSize(sourceKey, folderSizeEnabled);
  if (!draft || !view) return null;
  const selectedPreview = currentModPreview(sourceKey, preview.data);
  const selectedFolderSize = currentModFolderSize(sourceKey, folderSize.data);
  const previewLoading = sourceKey != null && preview.isLoading && !selectedPreview?.previewDataUrl;
  const diagnostics = diagnosticsForTargets(
    rawDiagnostics,
    view.selectedMod
      ? [identityForMod(view.selectedMod)]
      : view.selectedModIdentity
        ? [view.selectedModIdentity]
        : view.selectedEntry
          ? entryDiagnosticTargets(view.selectedEntry).map((identity) => ({
              ...identity,
              sourceKey: modByPackageId.get(identity.packageId)?.sourceKey ?? identity.sourceKey,
            }))
          : [],
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
