import { useTranslation } from 'react-i18next';
import { ButtonGroup } from '@/components/ui/button-group';
import { Input } from '@/components/ui/input';
import type { AvailableModSortKey, SortDirection } from '@/lib/availableMods';
import { SortDirectionButton } from './OrderToolbar';

const availableSortKeys: ReadonlyArray<AvailableModSortKey> = [
  'name',
  'packageId',
  'author',
  'source',
  'modifiedAt',
];

export function InactivePanelActions({
  search,
  sortKey,
  sortDirection,
  onSearchChange,
  onSortKeyChange,
  onToggleSortDirection,
}: {
  search: string;
  sortKey: AvailableModSortKey;
  sortDirection: SortDirection;
  onSearchChange: (value: string) => void;
  onSortKeyChange: (value: AvailableModSortKey) => void;
  onToggleSortDirection: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1">
      <Input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={t('order.searchInactive')}
        aria-label={t('order.searchInactive')}
        className="h-7 w-36 px-2 text-xs shadow-none"
      />
      <ButtonGroup>
        <select
          value={sortKey}
          onChange={(event) => onSortKeyChange(event.target.value as AvailableModSortKey)}
          className="h-7 border border-input bg-background px-1.5 text-xs"
          aria-label={t('order.aria.sortAvailable')}
        >
          {availableSortKeys.map((key) => (
            <option key={key} value={key}>
              {t(`order.sort.${key}`)}
            </option>
          ))}
        </select>
        <SortDirectionButton direction={sortDirection} onToggle={onToggleSortDirection} />
      </ButtonGroup>
    </div>
  );
}
