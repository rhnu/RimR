import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { pickDirectory, type AppConfig } from '@/commands';
import {
  editPath,
  hasPathEdits,
  mergePathEdits,
  reconcilePathEdits,
  type PathDraft,
  type PathFieldKey,
} from '@/domain/workspace/path-settings';
import { reportError } from '@/queries/client';
import {
  isPathWritePending,
  useAppConfig,
  useConfigOperation,
  type ConfigOperation,
} from '@/queries/config';
import { queryKeys } from '@/queries/keys';
import { registerSettingsDraft } from './unsaved-settings';

const PathSettingsContext = createContext<ReturnType<typeof usePathSettingsEditor> | null>(null);

/** Keep edits through the initial setup redirect and discard them when leaving either route. */
export function PathSettingsProvider({ children }: { children: ReactNode }) {
  const editor = usePathSettingsEditor();
  return <PathSettingsContext.Provider value={editor}>{children}</PathSettingsContext.Provider>;
}

export function usePathSettings() {
  const editor = useContext(PathSettingsContext);
  if (!editor) throw new Error('PathSettingsProvider is required');
  return editor;
}

function usePathSettingsEditor() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const config = useAppConfig();
  const operations = useConfigOperation();
  const [draft, setDraft] = useState<PathDraft>({});
  const savedPaths = config.data?.paths;
  const paths = savedPaths && mergePathEdits(savedPaths, draft);

  useLayoutEffect(
    () =>
      registerSettingsDraft(() =>
        hasPathEdits(draft, client.getQueryData<AppConfig>(queryKeys.appConfig)?.paths),
      ),
    [client, draft],
  );

  function updatePath(field: PathFieldKey, value: string | null): void {
    const latest = client.getQueryData<AppConfig>(queryKeys.appConfig);
    if (!latest) return;
    const writePending = isPathWritePending(client);
    setDraft((current) => editPath(current, field, value, latest.paths, writePending));
  }

  async function browse(field: PathFieldKey, label: string): Promise<void> {
    const picked = await pickDirectory({
      title: t('dialog.selectField', { label }),
      defaultPath: paths?.[field] ?? undefined,
    }).match(
      (path) => path,
      (error) => {
        reportError(error);
        return null;
      },
    );
    if (picked !== null) updatePath(field, picked);
  }

  function writePaths(
    operation: Exclude<ConfigOperation, { type: 'clearCache' }>,
    onSaved?: () => void,
  ) {
    operations.run(operation, {
      onSuccess: (saved) => {
        if (saved) {
          const submitted = operation.type === 'save' ? operation.draft : undefined;
          setDraft((current) => reconcilePathEdits(current, saved.paths, submitted));
          onSaved?.();
        }
      },
      onError: () => {
        const latest = client.getQueryData<AppConfig>(queryKeys.appConfig);
        if (latest) setDraft((current) => reconcilePathEdits(current, latest.paths));
      },
    });
  }

  return {
    config,
    paths,
    dirty: hasPathEdits(draft, savedPaths),
    pending: operations.pending,
    browse,
    clear: (field: PathFieldKey) => updatePath(field, null),
    reset: () => setDraft({}),
    save: (onSaved?: () => void) => {
      if (!savedPaths) return;
      const submitted = reconcilePathEdits(draft, savedPaths);
      if (hasPathEdits(submitted, savedPaths))
        writePaths({ type: 'save', draft: submitted }, onSaved);
    },
    autodetect: () => writePaths({ type: 'autodetect' }),
    clearCache: (onSuccess: () => void) => operations.run({ type: 'clearCache' }, { onSuccess }),
  };
}
