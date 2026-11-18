import { useTranslation } from 'react-i18next';
import { FolderOpen, Loader2, RotateCcw, Save, Wand2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Col, Grid, Row } from '@/components/ui/layout';
import { pathFieldKeys, type PathFieldKey } from '@/domain/workspace/path-settings';
import { usePathSettings } from './path-settings-provider';

export function PathSettingsForm({
  allowClear,
  saveLabel,
  onSaved,
}: {
  allowClear: boolean;
  saveLabel: string;
  onSaved?: () => void;
}) {
  const { t } = useTranslation();
  const settings = usePathSettings();
  return (
    <>
      <Col asChild>
        <CardContent>
          {pathFieldKeys.map((field) => {
            const label = t(`settings.paths.${field}`);
            return (
              <PathRow
                key={field}
                field={field}
                label={label}
                value={settings.paths?.[field] ?? ''}
                allowClear={allowClear}
                onBrowse={() => void settings.browse(field, label)}
                onClear={() => settings.clear(field)}
              />
            );
          })}
        </CardContent>
      </Col>
      <CardFooter className="flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={settings.autodetect}
          disabled={settings.pending != null}
        >
          {settings.pending === 'autodetect' ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Wand2 className="size-4" />
          )}
          {t('settings.autodetect')}
        </Button>
        <ButtonGroup className="ml-auto">
          <Button variant="ghost" size="sm" onClick={settings.reset} disabled={!settings.dirty}>
            <RotateCcw className="size-4" />
            {t('common.reset')}
          </Button>
          <Button
            onClick={() => settings.save(onSaved)}
            disabled={!settings.dirty || settings.pending != null}
          >
            {settings.pending === 'save' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {saveLabel}
          </Button>
        </ButtonGroup>
      </CardFooter>
    </>
  );
}

function PathRow({
  field,
  label,
  value,
  allowClear,
  onBrowse,
  onClear,
}: {
  field: PathFieldKey;
  label: string;
  value: string;
  allowClear: boolean;
  onBrowse: () => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const inputId = `path-${field}`;
  const clearLabel = t('common.clear', { label });
  return (
    <Grid className="grid-cols-[7rem_minmax(0,1fr)_auto] items-center">
      <Label htmlFor={inputId} className="text-xs">
        {label}
      </Label>
      <Input
        id={inputId}
        readOnly
        value={value}
        placeholder={t('common.notSet')}
        className="h-8 bg-muted/40 px-2 font-mono text-xs"
      />
      <Row className="w-18">
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={onBrowse}
          aria-label={t('common.browse')}
          title={t('common.browse')}
        >
          <FolderOpen className="size-4" />
        </Button>
        {allowClear && value !== '' ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={clearLabel}
            title={clearLabel}
            onClick={onClear}
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </Row>
    </Grid>
  );
}
