import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Splash } from '@/components/Splash';
import { useAppConfig } from '@/hooks/commands';
import { needsSetup } from '@/lib/appConfig';

export function IndexPage() {
  const { t } = useTranslation();
  const config = useAppConfig();
  const navigate = useNavigate();

  useEffect(() => {
    if (!config.data) return;
    void navigate({
      to: needsSetup(config.data) ? '/setup' : '/order',
      replace: true,
    });
  }, [config.data, navigate]);

  return <Splash message={t('common.loadingRimr')} />;
}
