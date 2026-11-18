import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Splash } from '@/components/splash';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PathSettingsForm } from './path-settings-form';
import { usePathSettings } from './path-settings-provider';

export function SettingsPage() {
  const { t } = useTranslation();
  const settings = usePathSettings();

  if (settings.config.isLoading) {
    return <Splash message={t('settings.loadingConfig')} />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3 p-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{t('settings.configTitle')}</CardTitle>
        </CardHeader>
        <PathSettingsForm
          allowClear
          saveLabel={t('common.save')}
          onSaved={() => toast.success(t('toast.settingsSaved'))}
        />
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{t('settings.sessionTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => settings.clearCache(() => toast.success(t('toast.cacheCleared')))}
            disabled={settings.pending != null}
          >
            {settings.pending === 'clearCache' ? <Loader2 className="size-4 animate-spin" /> : null}
            {t('settings.clearCache')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
