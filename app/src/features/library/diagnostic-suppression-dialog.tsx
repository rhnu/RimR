import { useMemo, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiagnosticSuppressionDto } from '@/commands';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { collectDiagnostics, filterSuppressions } from '@/domain/diagnostics/suppression';
import { formatDiagnosticMessage, formatPackageLabel } from '@/domain/diagnostics/messages';
import { primaryModsByPackageId } from '@/domain/mods/catalog';
import { flattenModListEntries } from '@/domain/mod-list/normalize';
import { useCatalogSnapshot } from '@/queries/catalog';
import { useValidationStore } from '@/stores/validation';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useOrderDraftStore } from '@/stores/order-draft-store';
import { useDiagnosticSuppression } from './hooks/use-diagnostic-suppression';

export function DiagnosticSuppressionDialog({
  open,
  onOpenChange,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: ComponentProps<typeof DialogContent>['onCloseAutoFocus'];
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{t('suppression.manage')}</DialogTitle>
          <DialogDescription>{t('suppression.manageDescription')}</DialogDescription>
        </DialogHeader>
        {open ? <SuppressionManager /> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('window.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SuppressionManager() {
  const { t } = useTranslation();
  const view = useSuppressionManagerState();
  const { commands, visible, selectedRules, setSelected } = view;
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <SuppressionFilters view={view} />
      <div className="max-h-[50vh] min-h-20 overflow-auto border border-border">
        {!commands.ready ? (
          <p className="p-3 text-xs text-muted-foreground">{t('order.state.modListNotLoaded')}</p>
        ) : visible.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">
            {t(commands.rules.length === 0 ? 'suppression.empty' : 'suppression.noMatches')}
          </p>
        ) : (
          visible.map((rule) => <SuppressionRuleRow key={rule.key} rule={rule} view={view} />)
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={visible.length === 0}
          onClick={() => setSelected(new Set(visible.map((rule) => rule.key)))}
        >
          {t('suppression.selectFiltered')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={commands.pending || selectedRules.length === 0}
          onClick={() => commands.restore(selectedRules)}
        >
          {t('suppression.restoreSelected', { count: selectedRules.length })}
        </Button>
      </div>
    </div>
  );
}

function useSuppressionManagerState() {
  const commands = useDiagnosticSuppression();
  const scan = useCatalogSnapshot();
  const epoch = useWorkspaceStore((state) => state.epoch);
  const draft = useOrderDraftStore((state) => state.draft);
  const validation = useValidationStore();
  const inputKey =
    draft && scan.data
      ? JSON.stringify([epoch, scan.dataUpdatedAt, draft.id, flattenModListEntries(draft.entries)])
      : null;
  const currentValidation =
    validation.inputKey === inputKey && validation.phase === 'ready' ? validation.result : null;
  const diagnostics = collectDiagnostics(scan.data?.diagnostics ?? [], currentValidation);
  const currentKeys = new Set(
    diagnostics.flatMap((item) => (item.suppression ? [item.suppression.key] : [])),
  );
  const modByPackageId = useMemo(
    () => primaryModsByPackageId(scan.data?.catalog.mods ?? []),
    [scan.data],
  );
  const [query, setQuery] = useState('');
  const [code, setCode] = useState('');
  const [version, setVersion] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const visible = filterSuppressions(commands.rules, query, code, version, modByPackageId);
  const selectedRules = visible.filter((rule) => selected.has(rule.key));
  const codes = [...new Set(commands.rules.map((rule) => rule.code))];
  const versions = [
    ...new Set(commands.rules.flatMap((rule) => (rule.gameVersion ? [rule.gameVersion] : []))),
  ].sort();
  return {
    commands,
    currentKeys,
    modByPackageId,
    query,
    setQuery,
    code,
    setCode,
    version,
    setVersion,
    selected,
    setSelected,
    visible,
    selectedRules,
    codes,
    versions,
  };
}

type ManagerView = ReturnType<typeof useSuppressionManagerState>;

function SuppressionFilters({ view }: { view: ManagerView }) {
  const { t } = useTranslation();
  const { query, setQuery, code, setCode, version, setVersion, codes, versions, visible } = view;
  return (
    <>
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t('suppression.search')}
        aria-label={t('suppression.search')}
      />
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={code}
          onChange={(event) => setCode(event.target.value)}
          aria-label={t('suppression.typeFilter')}
          className="h-8 max-w-full border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">{t('suppression.allTypes')}</option>
          {codes.map((value) => (
            <option key={value} value={value}>
              {t(`suppression.types.${value}`)}
            </option>
          ))}
        </select>
        <select
          value={version}
          onChange={(event) => setVersion(event.target.value)}
          aria-label={t('suppression.versionFilter')}
          className="h-8 border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">{t('suppression.allVersions')}</option>
          <option value="independent">{t('suppression.anyVersion')}</option>
          {versions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          {t('suppression.ruleCount', { count: visible.length })}
        </span>
      </div>
    </>
  );
}

function SuppressionRuleRow({ rule, view }: { rule: DiagnosticSuppressionDto; view: ManagerView }) {
  const { t } = useTranslation();
  const { selected, setSelected, currentKeys, modByPackageId, commands } = view;
  return (
    <label
      key={rule.key}
      className="flex items-start gap-2 border-b border-border p-2 text-xs last:border-b-0"
    >
      <input
        type="checkbox"
        className="mt-0.5 accent-primary"
        checked={selected.has(rule.key)}
        onChange={(event) =>
          setSelected((current) => {
            const next = new Set(current);
            if (event.target.checked) next.add(rule.key);
            else next.delete(rule.key);
            return next;
          })
        }
      />
      <span className="min-w-0 flex-1 space-y-1">
        <span className="block break-words">
          {formatDiagnosticMessage(suppressionMessage(rule), t, modByPackageId)}
        </span>
        <span className="block break-all text-muted-foreground">
          {[
            ...rule.relatedPackages.map((pkg) => formatPackageLabel(pkg, modByPackageId)),
            ...rule.sourceKeys,
          ].join(' · ')}
        </span>
        <span className="block text-muted-foreground">
          {t(`suppression.types.${rule.code}`)} · {rule.gameVersion ?? t('suppression.anyVersion')}{' '}
          · {t(currentKeys.has(rule.key) ? 'suppression.matching' : 'suppression.dormant')}
        </span>
      </span>
      <Button
        size="sm"
        variant="outline"
        disabled={commands.pending}
        onClick={(event) => {
          event.preventDefault();
          commands.restore([rule]);
        }}
      >
        {t('suppression.restore')}
      </Button>
    </label>
  );
}

function suppressionMessage(rule: DiagnosticSuppressionDto) {
  return { code: rule.code, params: rule.params, message: rule.code };
}
