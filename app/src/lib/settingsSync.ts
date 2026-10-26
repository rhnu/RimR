import type { Locale, Theme } from '@/commands';
import { createDebouncer, type Debouncer } from '@/lib/debounce';

export type UiPrefs = { theme: Theme; locale: Locale };
export type BackendPrefs = { theme: Theme | null; locale: Locale | null };

export type SyncAction =
  | { kind: 'none'; baseline: UiPrefs | null }
  | { kind: 'push'; prefs: UiPrefs }
  | { kind: 'adopt'; prefs: UiPrefs };

/**
 * Decide how to reconcile the client-side UI preferences with the backend's
 * stored preferences, given the last baseline both sides agreed on.
 *
 * - `push`: the client moved and the backend has not (or both moved; client
 *   wins) — persist the client value.
 * - `adopt`: the backend moved and the client has not — write the backend
 *   value back into the client stores.
 * - `none`: client and backend already agree (relative to the baseline).
 *
 * On the very first sync (`baseline == null`):
 * - if the backend has any unset field, seed it from the client (`push`);
 * - otherwise adopt the backend's explicit prefs.
 */
export function decideSync(
  client: UiPrefs,
  backend: BackendPrefs,
  baseline: UiPrefs | null,
): SyncAction {
  if (baseline == null) {
    if (backend.theme == null || backend.locale == null) {
      return { kind: 'push', prefs: client };
    }
    const prefs: UiPrefs = { theme: backend.theme, locale: backend.locale };
    return { kind: 'adopt', prefs };
  }

  const clientMoved = client.theme !== baseline.theme || client.locale !== baseline.locale;
  const backendMoved = backend.theme !== baseline.theme || backend.locale !== baseline.locale;

  if (clientMoved && !backendMoved) {
    return { kind: 'push', prefs: client };
  }
  if (!clientMoved && backendMoved) {
    const prefs: UiPrefs = {
      theme: backend.theme ?? client.theme,
      locale: backend.locale ?? client.locale,
    };
    return { kind: 'adopt', prefs };
  }
  if (clientMoved && backendMoved) {
    return { kind: 'push', prefs: client };
  }
  return { kind: 'none', baseline };
}

export interface SyncDeps {
  getTheme: () => Theme;
  setTheme: (theme: Theme) => void;
  getLocale: () => Locale;
  setLocale: (locale: Locale) => void;
  getBackend: () => BackendPrefs | null;
  save: (prefs: UiPrefs) => Promise<void>;
  debounce?: Debouncer;
}

export interface SyncController {
  /** Called when a client store (theme/locale) changes. Schedules a debounced push. */
  notifyClientChange: () => void;
  /** Called when the backend AppConfig data changes. May adopt immediately or schedule a push. */
  notifyBackendChange: () => void;
  dispose: () => void;
}

export function createSettingsSyncController(deps: SyncDeps): SyncController {
  const debounce = deps.debounce ?? createDebouncer(400);
  let baseline: UiPrefs | null = null;
  let saving = false;

  function client(): UiPrefs {
    return { theme: deps.getTheme(), locale: deps.getLocale() };
  }

  function attempt(): void {
    const backend = deps.getBackend();
    if (backend == null) return;
    const action = decideSync(client(), backend, baseline);
    switch (action.kind) {
      case 'none':
        baseline = action.baseline;
        return;
      case 'adopt':
        baseline = action.prefs;
        if (deps.getTheme() !== action.prefs.theme) deps.setTheme(action.prefs.theme);
        if (deps.getLocale() !== action.prefs.locale) deps.setLocale(action.prefs.locale);
        return;
      case 'push':
        debounce.schedule(flush);
        return;
    }
  }

  async function flush(): Promise<void> {
    if (saving) {
      debounce.schedule(flush);
      return;
    }
    const backend = deps.getBackend();
    if (backend == null) return;
    const action = decideSync(client(), backend, baseline);
    if (action.kind !== 'push') {
      if (action.kind === 'none') baseline = action.baseline;
      return;
    }
    saving = true;
    try {
      await deps.save(action.prefs);
      baseline = action.prefs;
    } catch {
      // Leave baseline unchanged so a subsequent change retries the push.
    } finally {
      saving = false;
    }
  }

  return {
    notifyClientChange: () => debounce.schedule(flush),
    notifyBackendChange: () => attempt(),
    dispose: () => debounce.cancel(),
  };
}
