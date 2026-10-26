import { Binary, Crown, FileCode2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SourceKindDto } from '@/commands';

export function ModTypeIcon({
  hasAssemblies,
  sourceKind,
}: {
  hasAssemblies: boolean;
  sourceKind?: SourceKindDto;
}) {
  const { t } = useTranslation();
  if (sourceKind === 'expansion') {
    return (
      <span title={t('order.modType.expansion')} className="shrink-0">
        <Crown className="size-4 shrink-0 text-muted-foreground" />
      </span>
    );
  }
  const title = hasAssemblies ? t('order.modType.csharp') : t('order.modType.xml');
  const Icon = hasAssemblies ? Binary : FileCode2;
  return (
    <span title={title} className="shrink-0">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
    </span>
  );
}
