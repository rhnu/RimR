import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import type { ModIdentityDto, ModMetadataDto, ModListDto, TagDefDto } from '@/commands';
import { officialDisplayName } from '@/domain/mods/official-content';
import { WorkspacePanel } from '@/features/order/ui/panels';
import type { deriveSelection } from '@/features/order/model/metadata-selection';
import {
  EmptyMetadata,
  SelectedGroupMetadata,
  SelectedModMetadata,
  SelectedSeparatorMetadata,
} from '@/features/order/ui/metadata-view';
type SelectedEntry = ModListDto['entries'][number] | null | undefined;

export function MetadataPanel({
  view,
  diagnosticReport,
  tags,
  previewLoading,
  previewDataUrl,
  folderSizeBytes,
}: {
  view: ReturnType<typeof deriveSelection> | null;
  diagnosticReport: ReactNode;
  tags: TagDefDto[];
  previewLoading: boolean;
  previewDataUrl: string | undefined;
  folderSizeBytes?: number | null;
}) {
  const { t } = useTranslation();
  const { selectedModIdentity, selectedMod, selectedEntry } = view ?? {};
  const title = metadataTitle(
    selectedModIdentity,
    selectedMod,
    selectedEntry,
    t('order.inspector.title'),
  );

  return (
    <WorkspacePanel as="aside" title={title}>
      {!view ? (
        <EmptyMetadata />
      ) : selectedModIdentity ? (
        <SelectedModMetadata
          key={selectedMod?.sourceKey ?? selectedModIdentity.packageId}
          identity={selectedModIdentity}
          mod={selectedMod}
          previewLoading={previewLoading}
          previewDataUrl={previewDataUrl}
          folderSizeBytes={folderSizeBytes}
          diagnosticReport={diagnosticReport}
          tags={tags}
        />
      ) : selectedEntry?.kind === 'group' ? (
        <SelectedGroupMetadata
          key={selectedEntry.id}
          entryCount={selectedEntry.entries.length}
          diagnosticReport={diagnosticReport}
        />
      ) : selectedEntry?.kind === 'separator' ? (
        <SelectedSeparatorMetadata
          key={selectedEntry.id}
          id={selectedEntry.id}
          note={selectedEntry.note ?? null}
        />
      ) : null}
    </WorkspacePanel>
  );
}

function metadataTitle(
  identity: ModIdentityDto | null | undefined,
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
