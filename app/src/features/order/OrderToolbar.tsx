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

import { useTranslation } from 'react-i18next';
import type { DiagnosticDto, ModMetadataDto } from '@/commands';
import { rimrClient } from '@/commands';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ModListSwitcher } from '@/features/order/ModListSwitcher';
import { ValidationSummaryBadge } from '@/features/order/Panels';
import {
  useOrderWorkspaceCommands,
  useOrderWorkspaceData,
  useOrderWorkspaceDerived,
  useOrderWorkspaceDialog,
  useOrderWorkspaceDraftState,
  useOrderWorkspaceSync,
  useOrderWorkspaceValidation,
} from './context/hooks';

export type ValidationSummary = {
  errors: number;
  warnings: number;
  infos: number;
  isClean: boolean;
};

export function OrderToolbar() {
  const { library, activeList, scan } = useOrderWorkspaceData();
  const { draft, modListDirty } = useOrderWorkspaceDraftState();
  const derived = useOrderWorkspaceDerived();
  const validation = useOrderWorkspaceValidation();
  const commands = useOrderWorkspaceCommands();
  const sync = useOrderWorkspaceSync();
  const { setDialog } = useOrderWorkspaceDialog();
  if (!library.data || !draft) return null;
  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-border pb-1">
      <ModListSwitcher
        modLists={library.data.modListsIndex.modLists}
        current={draft}
        onChange={commands.handleSetCurrentModList}
      />
      <div className="flex-1" />
      <div className="flex flex-wrap items-center gap-2">
        <ToolbarBadges
          dirty={modListDirty}
          differsFromGame={derived.differsFromGame}
          summary={derived.validationSummary}
          validating={validation.validate.isPending}
          diagnostics={derived.allDiagnostics}
          modByPackageId={derived.modByPackageId}
        />
        <RefreshMenu
          activeListFetching={activeList.isFetching}
          catalogFetching={scan.isFetching}
          onSyncFromGame={sync.handleSyncFromGame}
          onRebuildCatalog={sync.handleRebuildCatalog}
        />
        <ToolbarActions
          savePending={commands.saveModList.isPending}
          applyPending={commands.applyModList.isPending}
          differsFromGame={derived.differsFromGame}
          modListDirty={modListDirty}
          onSave={commands.handleSaveModList}
          onApply={commands.handleApplyWithDiff}
          onDiscardDraft={() => setDialog({ kind: 'discardDraft' })}
        />
        <LaunchGameButton />
      </div>
    </header>
  );
}

function LaunchGameButton() {
  const { t } = useTranslation();
  return (
    <Button
      variant="default"
      className="gap-1.5 bg-green-600 px-4 text-white hover:bg-green-700"
      title={t('order.launchGame')}
      onClick={() => void rimrClient.launchGame()}
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

function ToolbarBadges({
  dirty,
  differsFromGame,
  summary,
  validating,
  diagnostics,
  modByPackageId,
}: {
  dirty: boolean;
  differsFromGame: boolean;
  summary: ValidationSummary;
  validating: boolean;
  diagnostics: DiagnosticDto[];
  modByPackageId: Map<string, ModMetadataDto>;
}) {
  const { t } = useTranslation();
  return (
    <>
      <ValidationSummaryBadge
        summary={summary}
        validating={validating}
        diagnostics={diagnostics}
        modByPackageId={modByPackageId}
      />
      {dirty ? <Badge variant="secondary">{t('order.modListUnsaved')}</Badge> : null}
      {differsFromGame ? <Badge variant="outline">{t('order.notApplied')}</Badge> : null}
    </>
  );
}

function ToolbarActions({
  savePending,
  applyPending,
  differsFromGame,
  modListDirty,
  onSave,
  onApply,
  onDiscardDraft,
}: {
  savePending: boolean;
  applyPending: boolean;
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
        disabled={!modListDirty || savePending}
        loading={savePending}
        icon={<Save className="size-4" />}
      />
      <IconAction
        label={t('order.apply')}
        onClick={onApply}
        disabled={!differsFromGame || applyPending}
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
