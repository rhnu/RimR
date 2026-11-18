import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Undo2,
} from 'lucide-react';

import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Row } from '@/components/ui/layout';
import { ModListSwitcher } from '@/features/library/mod-list-switcher';
import { ValidationSummaryBadge } from '@/features/order/ui/validation-summary';
export type OrderToolbarProps = ComponentProps<typeof ModListSwitcher> & {
  modListDirty: boolean;
  hasConflict: boolean;
  differsFromGame: boolean;
  validation: ComponentProps<typeof ValidationSummaryBadge>;
  savePending: boolean;
  applyPending: boolean;
  applyDisabled: boolean;
  activeListFetching: boolean;
  catalogFetching: boolean;
  launchPending: boolean;
  onSave: () => void;
  onApply: () => void;
  onDiscardDraft: () => void;
  onSyncFromGame: () => void;
  onRebuildCatalog: () => void;
  onLaunch: () => void;
};

export function OrderToolbar(props: OrderToolbarProps) {
  const { t } = useTranslation();
  return (
    <Row asChild wrap className="border-b border-border pb-1">
      <header>
        <ModListSwitcher
          modLists={props.modLists}
          current={props.current}
          onChange={props.onChange}
        />
        <Row wrap className="ml-auto min-w-0">
          <ValidationSummaryBadge {...props.validation} />
          {props.modListDirty ? (
            <Badge variant="secondary">{t('order.modListUnsaved')}</Badge>
          ) : null}
          {props.differsFromGame ? <Badge variant="outline">{t('order.notApplied')}</Badge> : null}
          <ToolbarActions
            savePending={props.savePending}
            saveDisabled={props.hasConflict}
            applyPending={props.applyPending}
            applyDisabled={props.applyDisabled}
            differsFromGame={props.differsFromGame}
            modListDirty={props.modListDirty}
            onSave={props.onSave}
            onApply={props.onApply}
            onDiscardDraft={props.onDiscardDraft}
          />
          {props.hasConflict ? (
            <Badge variant="destructive" title={t('order.conflict')}>
              {t('order.conflictLabel')}
            </Badge>
          ) : null}
          <RefreshMenu
            activeListFetching={props.activeListFetching}
            catalogFetching={props.catalogFetching}
            onSyncFromGame={props.onSyncFromGame}
            onRebuildCatalog={props.onRebuildCatalog}
          />
          <LaunchGameButton pending={props.launchPending} onLaunch={props.onLaunch} />
        </Row>
      </header>
    </Row>
  );
}

function LaunchGameButton({ pending, onLaunch }: { pending: boolean; onLaunch: () => void }) {
  const { t } = useTranslation();
  return (
    <Button
      variant="default"
      className="gap-1.5 bg-launch px-4 text-launch-foreground hover:bg-launch-hover"
      title={t('order.launchGame')}
      disabled={pending}
      onClick={onLaunch}
    >
      <Play className="size-4 fill-current" />
      {t('order.launchGame')}
    </Button>
  );
}

export function SortDirectionButton({
  direction,
  onToggle,
}: {
  direction: 'asc' | 'desc';
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Button
      size="icon"
      variant="ghost"
      className="size-7"
      onClick={onToggle}
      aria-label={t('order.aria.sortDirection')}
      title={t('order.aria.sortDirection')}
    >
      {direction === 'asc' ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
    </Button>
  );
}

function ToolbarActions({
  savePending,
  saveDisabled,
  applyPending,
  applyDisabled,
  differsFromGame,
  modListDirty,
  onSave,
  onApply,
  onDiscardDraft,
}: {
  savePending: boolean;
  saveDisabled: boolean;
  applyPending: boolean;
  applyDisabled: boolean;
  differsFromGame: boolean;
  modListDirty: boolean;
  onSave: () => void;
  onApply: () => void;
  onDiscardDraft: () => void;
}) {
  const { t } = useTranslation();
  return (
    <ButtonGroup>
      <IconAction
        label={t('order.discardDraft')}
        onClick={onDiscardDraft}
        disabled={!modListDirty}
        icon={<Undo2 className="size-4" />}
      />
      <IconAction
        label={t('order.saveModList')}
        onClick={onSave}
        disabled={!modListDirty || savePending || saveDisabled}
        loading={savePending}
        icon={<Save className="size-4" />}
      />
      <IconAction
        label={t('order.apply')}
        onClick={onApply}
        disabled={!differsFromGame || applyPending || applyDisabled}
        loading={applyPending}
        variant={differsFromGame ? 'default' : 'ghost'}
        icon={<ShieldCheck className="size-4" />}
      />
    </ButtonGroup>
  );
}

function RefreshMenu({
  activeListFetching,
  catalogFetching,
  onSyncFromGame,
  onRebuildCatalog,
}: {
  activeListFetching: boolean;
  catalogFetching: boolean;
  onSyncFromGame: () => void;
  onRebuildCatalog: () => void;
}) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 rounded-slight px-2 text-xs"
          aria-label={t('order.refresh')}
          title={t('order.refresh')}
        >
          <RefreshCw className="size-4" />
          <span>{t('order.refresh')}</span>
          <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-slight">
        <DropdownMenuItem
          onClick={onSyncFromGame}
          disabled={activeListFetching}
          className="h-7 gap-2 px-2 text-xs"
        >
          <RefreshCw className="size-4" />
          {t('order.syncFromGame')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onRebuildCatalog}
          disabled={catalogFetching}
          className="h-7 gap-2 px-2 text-xs"
        >
          <RotateCcw className="size-4" />
          {t('order.rescanCatalog')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function IconAction({
  label,
  icon,
  loading,
  onClick,
  disabled,
  variant = 'ghost',
}: {
  label: string;
  icon: React.ReactNode;
  loading?: boolean;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'ghost' | 'outline';
}) {
  return (
    <Button
      size="icon"
      variant={variant}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
    </Button>
  );
}
