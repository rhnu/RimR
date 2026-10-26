import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { pickDirectory } from '@/commands';
import { Splash } from '@/components/Splash';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useAppConfig,
  useAutodetectPaths,
  useClearSessionCache,
  useSaveAppConfig,
} from '@/hooks/commands';
import { PathSettingsForm } from './PathSettingsForm';
import { useSettingsDraft } from './hooks/useSettingsDraft';
import type { PathFieldKey } from './pathSettingsModel';

export function SettingsPage() {
  const { t } = useTranslation();
  const configQuery = useAppConfig();
  const save = useSaveAppConfig();
  const autodetect = useAutodetectPaths();
  const clearCache = useClearSessionCache();
  const settings = useSettingsDraft(configQuery.data);

  async function choosePath(field: PathFieldKey, label: string): Promise<void> {
    const picked = await pickDirectory({
      title: t('dialog.selectField', { label }),
      defaultPath: settings.draft?.paths[field] ?? undefined,
    }).match(
      (path) => path,
      () => null,
    );
    if (picked !== null) settings.updatePath(field, picked);
  }

  function saveSettings(): void {
    if (!settings.draft) return;
    save.mutate(settings.draft, {
      onSuccess: () => toast.success(t('toast.settingsSaved')),
    });
  }

  if (configQuery.isLoading) {
    return <Splash message={t('settings.loadingConfig')} />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3 p-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{t('settings.configTitle')}</CardTitle>
        </CardHeader>
        <PathSettingsForm
          draft={settings.draft}
          dirty={settings.isDirty}
          allowClear
          saveLabel={t('common.save')}
          savePending={save.isPending}
          autodetectPending={autodetect.isPending}
          onBrowse={(field, label) => void choosePath(field, label)}
          onClear={(field) => settings.clearPath(field)}
          onReset={settings.reset}
          onSave={saveSettings}
          onAutodetect={() => autodetect.mutate()}
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
            onClick={() => {
              clearCache.mutate(undefined, {
                onSuccess: () => toast.success(t('toast.cacheCleared')),
              });
            }}
            disabled={clearCache.isPending}
          >
            {clearCache.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {t('settings.clearCache')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
