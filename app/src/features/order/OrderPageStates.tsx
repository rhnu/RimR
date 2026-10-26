import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Splash } from '@/components/Splash';
import { Button } from '@/components/ui/button';
import { PageMessage } from './Panels';

export function ActiveListLoading() {
  const { t } = useTranslation();
  return <Splash message={t('order.state.loadingActive')} />;
}

export function ActiveListError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <PageMessage>
      <div className="space-y-3">
        <p>{t('order.state.loadFailed')}</p>
        <Button onClick={onRetry}>{t('common.retry')}</Button>
      </div>
    </PageMessage>
  );
}

export function NoCatalogState() {
  const { t } = useTranslation();
  return (
    <PageMessage>
      <div className="space-y-3">
        <p>{t('order.state.noCatalog')}</p>
        <Button asChild>
          <Link to="/settings">{t('common.openSettings')}</Link>
        </Button>
      </div>
    </PageMessage>
  );
}

export function ModListLoading() {
  const { t } = useTranslation();
  return <Splash message={t('order.state.loadingModList')} />;
}

export function CatalogLoading() {
  const { t } = useTranslation();
  return <Splash message={t('catalog.loading')} />;
}

export function ModListLoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <PageMessage>
      <div className="space-y-3">
        <p>{t('order.state.modListNotLoaded')}</p>
        <Button onClick={onRetry}>{t('order.state.loadModList')}</Button>
      </div>
    </PageMessage>
  );
}
