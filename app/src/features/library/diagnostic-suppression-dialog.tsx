import { CircleDashed, EyeOff, RotateCcw } from 'lucide-react';
import { useId, useLayoutEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiagnosticDto, DiagnosticSuppressionDto } from '@/commands';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FilterInput } from '@/components/ui/filter-input';
import { Col, Row } from '@/components/ui/layout';
import { collectDiagnostics, filterSuppressions } from '@/domain/diagnostics/suppression';
import { presentDiagnostic } from '@/domain/diagnostics/messages';
import { primaryModsByPackageId } from '@/domain/mods/catalog';
import { flattenModListEntries } from '@/domain/mod-list/normalize';
import { DiagnosticDetails } from '@/features/diagnostics/diagnostic-details';
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
  const managerRef = useRef<HTMLDivElement>(null);
  const focusedRestore = useRef<HTMLButtonElement | null>(null);

  useLayoutEffect(() => {
    const action = focusedRestore.current;
    const manager = managerRef.current;
    if (!action || !manager || commands.pending) return;
    if (action.isConnected && !action.disabled) return;
    focusedRestore.current = null;
    const { activeElement, body } = manager.ownerDocument;
    if (activeElement !== action && activeElement !== body) return;
    const next = manager.querySelector<HTMLButtonElement>('button[data-restore-rule]');
    (next ?? manager.querySelector('input'))?.focus();
  }, [commands.pending, visible, selectedRules.length]);

  function restore(rules: DiagnosticSuppressionDto[], button: HTMLButtonElement) {
    if (commands.pending || rules.length === 0) return;
    focusedRestore.current = button.ownerDocument.activeElement === button ? button : null;
    void commands.restore(rules).then((restored) => {
      if (!restored) {
        if (focusedRestore.current === button) focusedRestore.current = null;
        return;
      }
      const keys = new Set(rules.map((rule) => rule.key));
      setSelected((current) => new Set([...current].filter((key) => !keys.has(key))));
    });
  }

  return (
    <Col ref={managerRef} className="overflow-y-auto">
      <SuppressionFilters view={view} />
      <div className="min-h-20 max-h-[50vh] overflow-y-auto border border-border">
        {!commands.ready ? (
          <p className="p-3 text-xs text-muted-foreground">{t('order.state.modListNotLoaded')}</p>
        ) : visible.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">
            {t(commands.rules.length === 0 ? 'suppression.empty' : 'suppression.noMatches')}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((rule) => (
              <SuppressionRuleRow key={rule.key} rule={rule} view={view} onRestore={restore} />
            ))}
          </ul>
        )}
      </div>
      <Row wrap>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={visible.length === 0}
          onClick={() => setSelected(new Set(visible.map((rule) => rule.key)))}
        >
          {t('suppression.selectFiltered')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={selectedRules.length === 0}
          aria-disabled={commands.pending || undefined}
          className="aria-disabled:opacity-50"
          onClick={(event) => restore(selectedRules, event.currentTarget)}
        >
          {t('suppression.restoreSelected', { count: selectedRules.length })}
        </Button>
      </Row>
    </Col>
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
  const currentDiagnostics = useMemo(() => {
    const byRuleKey = new Map<string, DiagnosticDto>();
    for (const diagnostic of collectDiagnostics(scan.data?.diagnostics ?? [], currentValidation)) {
      if (diagnostic.suppression) byRuleKey.set(diagnostic.suppression.key, diagnostic);
    }
    return byRuleKey;
  }, [scan.data, currentValidation]);
  const modByPackageId = useMemo(
    () => primaryModsByPackageId(scan.data?.catalog.mods ?? []),
    [scan.data],
  );
  const [query, setQuery] = useState('');
  const [code, setCode] = useState('');
  const [version, setVersion] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const visible = useMemo(
    () => filterSuppressions(commands.rules, query, code, version, modByPackageId),
    [commands.rules, query, code, version, modByPackageId],
  );
  const selectedRules = visible.filter((rule) => selected.has(rule.key));
  const codes = [...new Set(commands.rules.map((rule) => rule.code))];
  const versions = [
    ...new Set(commands.rules.flatMap((rule) => (rule.gameVersion ? [rule.gameVersion] : []))),
  ].sort();
  return {
    commands,
    currentDiagnostics,
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
      <FilterInput value={query} onValueChange={setQuery} label={t('suppression.search')} />
      <Row wrap>
        <select
          value={code}
          onChange={(event) => setCode(event.target.value)}
          aria-label={t('suppression.typeFilter')}
          className="h-8 max-w-full border border-input-border bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
          className="h-8 border border-input-border bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
      </Row>
    </>
  );
}

function SuppressionRuleRow({
  rule,
  view,
  onRestore,
}: {
  rule: DiagnosticSuppressionDto;
  view: ManagerView;
  onRestore: (rules: DiagnosticSuppressionDto[], button: HTMLButtonElement) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const { selected, setSelected, currentDiagnostics, modByPackageId, commands } = view;
  const current = currentDiagnostics.get(rule.key);
  const status = t(current ? 'suppression.matching' : 'suppression.dormant');
  const StatusIcon = current ? EyeOff : CircleDashed;
  const { subject, summary, details } = presentDiagnostic(current ?? rule, t, modByPackageId);
  const messageId = `${id}-message`;
  const restoreLabel = t('suppression.restoreOne');
  const ruleDetails = [
    ...details,
    {
      label: t('suppression.versionFilter'),
      value: rule.gameVersion ?? t('suppression.anyVersion'),
    },
  ];
  return (
    <Row asChild className="min-h-8 px-2 py-0.5 text-xs">
      <li>
        <input
          id={id}
          type="checkbox"
          aria-describedby={`${id}-status`}
          className="shrink-0 accent-primary focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ring"
          checked={selected.has(rule.key)}
          onChange={(event) => {
            const checked = event.currentTarget.checked;
            setSelected((current) => {
              const next = new Set(current);
              if (checked) next.add(rule.key);
              else next.delete(rule.key);
              return next;
            });
          }}
        />
        <span title={status} className="shrink-0 text-muted-foreground">
          <StatusIcon aria-hidden="true" className="size-4" />
          <span id={`${id}-status`} className="sr-only">
            {status}
          </span>
        </span>
        <label htmlFor={id} id={messageId} className="min-w-0 flex-1 wrap-anywhere">
          {subject ? <strong className="mr-1 font-medium">{subject.label} </strong> : null}
          {summary}
        </label>
        <DiagnosticDetails details={ruleDetails} describedBy={messageId} />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={restoreLabel}
          aria-disabled={commands.pending || undefined}
          aria-describedby={messageId}
          title={restoreLabel}
          data-restore-rule
          className="size-7 shrink-0 text-muted-foreground aria-disabled:opacity-50"
          onClick={(event) => onRestore([rule], event.currentTarget)}
        >
          <RotateCcw aria-hidden="true" />
        </Button>
      </li>
    </Row>
  );
}
