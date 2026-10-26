import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';

export type LogTab = 'steam' | 'rimworld';

export function LogTabSwitcher({
  tab,
  onTabChange,
}: {
  tab: LogTab;
  onTabChange: (tab: LogTab) => void;
}) {
  const { t } = useTranslation();
  return (
    <ButtonGroup>
      <Button
        variant={tab === 'steam' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onTabChange('steam')}
      >
        {t('logs.tab.steam')}
      </Button>
      <Button
        variant={tab === 'rimworld' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onTabChange('rimworld')}
      >
        {t('logs.tab.rimworld')}
      </Button>
    </ButtonGroup>
  );
}
