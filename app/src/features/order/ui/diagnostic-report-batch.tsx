import { CheckSquare, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiagnosticDto } from '@/commands';
import { Button } from '@/components/ui/button';
import { Row } from '@/components/ui/layout';
import type { DiagnosticActions } from './diagnostic-report';

/** Keeps batch actions scoped to the current visible, ignorable diagnostics. */
export function useDiagnosticBatch(diagnostics: DiagnosticDto[], commands: DiagnosticActions) {
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectable = diagnostics.flatMap((diagnostic) =>
    diagnostic.suppression ? [{ diagnostic, rule: diagnostic.suppression }] : [],
  );
  const filtered = selectable.filter(({ diagnostic }) => !code || diagnostic.code === code);
  const selectedRules = filtered.flatMap(({ rule }) => (selected.has(rule.key) ? [rule] : []));
  const allSelected = filtered.length > 0 && selectedRules.length === filtered.length;
  const busy = commands.pending || !commands.ready;

  function filterByCode(value: string) {
    setCode(value);
    setSelected(new Set());
  }

  async function ignoreSelected() {
    if (busy || selectedRules.length === 0) return;
    if (await commands.suppress(selectedRules)) setSelected(new Set());
  }

  return {
    available: editing || selectable.length > 0,
    editing,
    toggleEditing: () => {
      setEditing(!editing);
      filterByCode('');
    },
    code,
    codes: [
      ...new Set([...selectable.map(({ diagnostic }) => diagnostic.code), ...(code ? [code] : [])]),
    ],
    filterByCode,
    items: filtered.map(({ diagnostic }) => diagnostic),
    selected,
    toggleSelected: (key: string) => {
      setSelected((current) => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
    allSelected,
    selectFiltered: () =>
      setSelected(allSelected ? new Set() : new Set(filtered.map(({ rule }) => rule.key))),
    selectedCount: selectedRules.length,
    ignoreSelected,
    busy,
  };
}

export function DiagnosticBatchControls({
  batch,
}: {
  batch: ReturnType<typeof useDiagnosticBatch>;
}) {
  const { t } = useTranslation();
  return (
    <Row
      gap={2}
      className="sticky top-0 z-10 flex-wrap items-center border-b border-border bg-background px-2 py-1"
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 aria-pressed:bg-accent"
        aria-pressed={batch.editing}
        disabled={batch.busy}
        onClick={batch.toggleEditing}
      >
        <CheckSquare aria-hidden="true" />
        {t('suppression.batchIgnore')}
      </Button>
      {batch.editing ? (
        <>
          <select
            aria-label={t('suppression.typeFilter')}
            className="h-7 min-w-0 max-w-full border border-input-border bg-background px-2 text-xs focus-visible:ring-1 focus-visible:ring-ring"
            disabled={batch.busy}
            value={batch.code}
            onChange={(event) => batch.filterByCode(event.target.value)}
          >
            <option value="">{t('suppression.allTypes')}</option>
            {batch.codes.map((value) => (
              <option key={value} value={value}>
                {t(`suppression.types.${value}`, { defaultValue: value })}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7"
            disabled={batch.busy || batch.items.length === 0}
            onClick={batch.selectFiltered}
          >
            {t(batch.allSelected ? 'suppression.clearSelection' : 'suppression.selectFiltered')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 aria-disabled:opacity-50"
            aria-disabled={batch.busy || batch.selectedCount === 0}
            onClick={() => void batch.ignoreSelected()}
          >
            <EyeOff aria-hidden="true" />
            {t('suppression.ignoreSelected', { count: batch.selectedCount })}
          </Button>
        </>
      ) : null}
    </Row>
  );
}
