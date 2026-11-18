import { useEffect, useState } from 'react';
import type { ModListDto, ModMetadataDto, ModTagBindingDto, TagDefDto } from '@/commands';
import type { DiagnosticItem } from '@/domain/diagnostics/suppression';
import { useModFolderSize, useModPreview } from '@/queries/previews';
import { currentModFolderSize, currentModPreview } from '@/domain/mods/file-info';
import type { OrderDiagnosticTarget } from '../model/diagnostic-targets';
import { deriveSelection } from '../model/metadata-selection';
import type { Selection } from '../types';
import { DiagnosticReport, type DiagnosticActions } from '../ui/diagnostic-report';
import { MetadataPanel } from '../ui/metadata-panel';
import { resolveModTags } from '../ui/tags-meta';

export function OrderInspector({
  draft,
  selection,
  modByPackageId,
  modByCatalogKey,
  settings,
  diagnosticsForTarget,
  diagnosticActions,
}: {
  draft: ModListDto;
  selection: Selection;
  modByPackageId: Map<string, ModMetadataDto>;
  modByCatalogKey: Map<string, ModMetadataDto>;
  settings: { tagDefs: TagDefDto[]; modTags: ModTagBindingDto[] };
  diagnosticsForTarget: (target: OrderDiagnosticTarget) => DiagnosticItem[];
  diagnosticActions: DiagnosticActions;
}) {
  const view = selection
    ? deriveSelection(selection, draft, modByPackageId, modByCatalogKey)
    : null;
  const sourceKey = view?.selectedMod?.sourceKey ?? null;
  const folderSizeEnabled = useFolderSizeEnabled(sourceKey);
  const preview = useModPreview(sourceKey);
  const folderSize = useModFolderSize(sourceKey, folderSizeEnabled);
  const previewDataUrl = currentModPreview(sourceKey, preview.data)?.previewDataUrl ?? undefined;
  const diagnosticTarget = selectedDiagnosticTarget(view, selection);
  const diagnostics = diagnosticTarget ? diagnosticsForTarget(diagnosticTarget) : [];
  const tags = view?.selectedModIdentity
    ? resolveModTags(view.selectedModIdentity, settings.tagDefs, settings.modTags)
    : [];
  return (
    <MetadataPanel
      view={view}
      tags={tags}
      diagnosticReport={
        diagnostics.length > 0 ? (
          <DiagnosticReport
            diagnostics={diagnostics}
            modByPackageId={modByPackageId}
            commands={diagnosticActions}
          />
        ) : null
      }
      previewLoading={sourceKey != null && preview.isLoading && !previewDataUrl}
      previewDataUrl={previewDataUrl}
      folderSizeBytes={currentModFolderSize(sourceKey, folderSize.data)?.folderSizeBytes}
    />
  );
}

function selectedDiagnosticTarget(
  view: ReturnType<typeof deriveSelection> | null,
  selection: Selection,
): OrderDiagnosticTarget | null {
  if (view?.selectedMod) return { kind: 'catalog', mod: view.selectedMod };
  if (view?.selectedModIdentity) {
    return {
      kind: selection?.kind === 'mod' && selection.sourceKey ? 'source' : 'mod',
      identity: view.selectedModIdentity,
    };
  }
  return view?.selectedEntry ? { kind: 'entry', entry: view.selectedEntry } : null;
}

function useFolderSizeEnabled(sourceKey: string | null): boolean {
  const [enabledSource, setEnabledSource] = useState<string | null>(null);
  useEffect(() => {
    setEnabledSource(null);
    if (sourceKey == null) return;
    const timeout = window.setTimeout(() => setEnabledSource(sourceKey), 1200);
    return () => window.clearTimeout(timeout);
  }, [sourceKey]);
  return sourceKey !== null && enabledSource === sourceKey;
}
