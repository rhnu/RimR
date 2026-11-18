import { useTranslation } from 'react-i18next';
import type { DiagnosticSuppressionDto, ModMetadataDto } from '@/commands';
import { formatDiagnosticMessage } from '@/domain/diagnostics/messages';
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/components/ui/context-menu';
import type { DiagnosticMenu } from '@/domain/diagnostics/suppression';
import type { OrderDiagnosticTarget } from '../model/diagnostic-targets';
import type { DiagnosticActions } from './diagnostic-report';

export type RowDiagnosticMenus = {
  forTarget: (target: OrderDiagnosticTarget) => DiagnosticMenu;
  actions: DiagnosticActions;
  modByPackageId: Map<string, ModMetadataDto>;
};

export function DiagnosticMenuItems({
  target,
  menus,
}: {
  target: OrderDiagnosticTarget;
  menus: RowDiagnosticMenus;
}) {
  const { t } = useTranslation();
  const { pending, ignored } = menus.forTarget(target);
  const commands = menus.actions;
  const { modByPackageId } = menus;
  if (pending.length === 0 && ignored.length === 0) return null;
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
        items={ignored}
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
      <ContextMenuSubContent className="max-w-[min(30rem,90vw)]">
        {codes.map((code) => {
          const group = items.filter((item) => item.code === code);
          return (
            <ContextMenuSub key={code}>
              <ContextMenuSubTrigger>
                {t(`suppression.types.${code}`)} ({group.length})
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="max-w-[min(30rem,90vw)]">
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
