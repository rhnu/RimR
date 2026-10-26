import { useTranslation } from 'react-i18next';
import type {
  DiagnosticSuppressionDto,
  ModIdentityDto,
  ModListEntryDto,
  ModMetadataDto,
} from '@/commands';
import { formatDiagnosticMessage } from '@/domain/diagnostics/messages';
import {
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/components/ui/context-menu';
import { diagnosticsForTargets, entryDiagnosticTargets } from '@/domain/diagnostics/suppression';
import { identityForMod, resolveSourceKey } from '@/domain/mods/identity';
import { catalogItemKey } from '@/domain/mods/catalog';
import { useDiagnosticSuppression } from '@/features/library/hooks/use-diagnostic-suppression';
import {
  useOrderWorkspaceDerived,
  useOrderWorkspaceDraftState,
  useOrderWorkspaceSelection,
} from '@/features/order/context/hooks';

export function DiagnosticMenuItems({
  entry,
  identity,
  catalog = false,
}: {
  entry?: ModListEntryDto;
  identity?: ModIdentityDto;
  catalog?: boolean;
}) {
  const { t } = useTranslation();
  const { rawDiagnostics, mods, modByPackageId } = useOrderWorkspaceDerived();
  const { draft } = useOrderWorkspaceDraftState();
  const selection = useOrderWorkspaceSelection();
  const commands = useDiagnosticSuppression();
  let targets = entry ? entryDiagnosticTargets(entry) : identity ? [identity] : [];
  if (entry && selection.selectedEntryIds.has(entry.id)) {
    targets = (draft?.entries ?? [])
      .filter((candidate) => selection.selectedEntryIds.has(candidate.id))
      .flatMap(entryDiagnosticTargets);
  } else if (catalog && identity) {
    const clicked = mods.find((mod) => mod.sourceKey === identity.sourceKey);
    if (clicked && selection.selectedInactiveCatalogKeys.has(catalogItemKey(clicked))) {
      targets = mods
        .filter((mod) => selection.selectedInactiveCatalogKeys.has(catalogItemKey(mod)))
        .map(identityForMod);
    }
  }
  if (!catalog)
    targets = targets.map((target) => ({
      ...target,
      sourceKey: resolveSourceKey(target, modByPackageId) ?? target.sourceKey,
    }));
  const descriptors = diagnosticsForTargets(rawDiagnostics, targets).flatMap((diagnostic) =>
    diagnostic.suppression ? [diagnostic.suppression] : [],
  );
  const existingKeys = new Set(commands.rules.map((rule) => rule.key));
  const pending = descriptors.filter((item) => !existingKeys.has(item.key));
  // Dormant rules remain recoverable even after the report or the mod disappears.
  const restored = commands.rules.filter(
    (rule) =>
      diagnosticsForTargets(
        [
          {
            severity: 'info',
            code: rule.code,
            params: rule.params,
            relatedPackages: rule.relatedPackages,
            message: '',
            location: null,
            relatedLocations: [],
            suppression: rule,
          },
        ],
        targets,
      ).length > 0,
  );
  if (targets.length === 0 || (pending.length === 0 && restored.length === 0)) return null;
  return (
    <>
      <ContextMenuSeparator />
      <DiagnosticMenuGroup
        label={t('suppression.suppressMenu')}
        items={pending}
        disabled={commands.pending || !commands.ready}
        action={commands.suppress}
        modByPackageId={modByPackageId}
      />
      <DiagnosticMenuGroup
        label={t('suppression.restoreMenu')}
        items={restored}
        disabled={commands.pending || !commands.ready}
        action={commands.restore}
        modByPackageId={modByPackageId}
      />
    </>
  );
}

function DiagnosticMenuGroup({
  label,
  items,
  disabled,
  action,
  modByPackageId,
}: {
  label: string;
  items: DiagnosticSuppressionDto[];
  disabled: boolean;
  action: (items: DiagnosticSuppressionDto[]) => void;
  modByPackageId: Map<string, ModMetadataDto>;
}) {
  const { t } = useTranslation();
  if (items.length === 0) return null;
  const codes = [...new Set(items.map((item) => item.code))];
  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger disabled={disabled}>
        {label} ({items.length})
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className="max-h-96 max-w-[min(30rem,90vw)] overflow-y-auto">
        <ContextMenuLabel>{t('suppression.sharedScope')}</ContextMenuLabel>
        {codes.map((code) => {
          const group = items.filter((item) => item.code === code);
          return (
            <ContextMenuSub key={code}>
              <ContextMenuSubTrigger>
                {t(`suppression.types.${code}`)} ({group.length})
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="max-h-96 max-w-[min(30rem,90vw)] overflow-y-auto">
                {group.map((item) => (
                  <ContextMenuItem key={item.key} onSelect={() => action([item])}>
                    <span className="min-w-0 whitespace-normal break-words">
                      {formatDiagnosticMessage(
                        { code: item.code, params: item.params, message: item.code },
                        t,
                        modByPackageId,
                      )}
                      {item.sourceKeys.length > 0 ? (
                        <span className="block break-all text-xs text-muted-foreground">
                          {item.sourceKeys.join(', ')}
                        </span>
                      ) : null}
                      {item.gameVersion ? (
                        <span className="block text-xs text-muted-foreground">
                          {item.gameVersion}
                        </span>
                      ) : null}
                    </span>
                  </ContextMenuItem>
                ))}
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={() => action(group)}>
                  {t('suppression.allCurrent', { count: group.length })}
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
          );
        })}
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => action(items)}>
          {t('suppression.allCurrent', { count: items.length })}
        </ContextMenuItem>
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}
