import type { QueryClient } from '@tanstack/react-query';
import type { Update } from '@tauri-apps/plugin-updater';
import { updaterClient, logUpdate, updateErrorMessage } from '@/commands/updater-client';
import { hasUnsavedSettings } from '@/features/settings/unsaved-settings';
import { useOrderDraftStore } from '@/stores/order-draft-store';
import type { UpdateCheck } from '@/queries/updates';
import type { UpdateOperation } from './use-app-updater';

type PublishOperation = (operation: UpdateOperation) => void;
type Resume = 'download' | 'install' | 'restart';

function interruption(client: QueryClient): 'drafts' | 'operations' | undefined {
  if (useOrderDraftStore.getState().isDirty || hasUnsavedSettings()) return 'drafts';
  if (client.isMutating({ predicate: (mutation) => mutation.meta?.blocksUpdate === true }))
    return 'operations';
  return undefined;
}

export async function restartUpdatedApp(publish: PublishOperation): Promise<void> {
  publish({ phase: 'restarting' });
  try {
    await updaterClient.relaunch();
  } catch (error) {
    const message = updateErrorMessage(error);
    logUpdate(`Restart failed: ${message}`, true);
    publish({ phase: 'failed', message, retry: 'restart' });
  }
}

async function downloadUpdate(update: Update, publish: PublishOperation): Promise<void> {
  let downloaded = 0;
  let total: number | undefined;
  publish({ phase: 'downloading', downloaded });
  logUpdate(`Downloading version ${update.version}`);
  await update.download(
    (event) => {
      if (event.event === 'Started') total = event.data.contentLength;
      if (event.event === 'Progress') downloaded += event.data.chunkLength;
      publish(
        event.event === 'Finished'
          ? { phase: 'verifying' }
          : { phase: 'downloading', downloaded, total },
      );
    },
    { timeout: 120_000 },
  );
}

/** Re-read actual drafts and writes at each boundary that could lead to process exit. */
export async function installUpdate(
  result: UpdateCheck & { update: Update },
  operation: UpdateOperation,
  client: QueryClient,
  publish: PublishOperation,
): Promise<void> {
  const resume: Resume =
    operation.phase === 'blocked'
      ? operation.resume
      : operation.phase === 'failed' && operation.retry === 'restart'
        ? 'restart'
        : 'download';
  const reason = interruption(client);
  if (reason) {
    publish({ phase: 'blocked', resume, reason });
    return;
  }
  try {
    if (resume === 'restart') {
      await restartUpdatedApp(publish);
      return;
    }
    if (resume !== 'install') await downloadUpdate(result.update, publish);
    // A native dialog or an already pending operation may complete during download.
    const nextReason = interruption(client);
    if (nextReason) {
      publish({ phase: 'blocked', resume: 'install', reason: nextReason });
      return;
    }
    publish({ phase: 'installing' });
    logUpdate(`Installing version ${result.update.version}`);
    await result.update.install({ restartAfterInstall: true });
    // Windows exits from install and lets the installer restart the application.
    if (result.bundleType !== 'nsis') await restartUpdatedApp(publish);
  } catch (error) {
    const message = updateErrorMessage(error);
    logUpdate(`Update failed: ${message}`, true);
    publish({ phase: 'failed', message, retry: 'download' });
  }
}
