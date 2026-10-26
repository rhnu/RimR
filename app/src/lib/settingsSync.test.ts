import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Locale, Theme } from '@/commands';
import {
  createSettingsSyncController,
  decideSync,
  type BackendPrefs,
  type UiPrefs,
} from '@/lib/settingsSync';
import { createDebouncer } from '@/lib/debounce';

const en: Locale = 'en';
const zhCN: Locale = 'zh-CN';
const light: Theme = 'light';
const dark: Theme = 'dark';
const system: Theme = 'system';

function prefs(theme: Theme, locale: Locale): UiPrefs {
  return { theme, locale };
}

function backend(theme: Theme | null, locale: Locale | null): BackendPrefs {
  return { theme, locale };
}

describe('decideSync', () => {
  it('seeds from client when backend has any unset field and there is no baseline', () => {
    expect(decideSync(prefs(dark, en), backend(null, null), null)).toEqual({
      kind: 'push',
      prefs: prefs(dark, en),
    });
    expect(decideSync(prefs(dark, en), backend(dark, null), null)).toEqual({
      kind: 'push',
      prefs: prefs(dark, en),
    });
  });

  it('adopts explicit backend prefs on first load when baseline is null', () => {
    expect(decideSync(prefs(light, en), backend(dark, zhCN), null)).toEqual({
      kind: 'adopt',
      prefs: prefs(dark, zhCN),
    });
  });

  it('returns none when client and backend are both at the baseline', () => {
    const baseline = prefs(dark, en);
    expect(decideSync(prefs(dark, en), backend(dark, en), baseline)).toEqual({
      kind: 'none',
      baseline,
    });
  });

  it('pushes when the client moved away from the baseline', () => {
    const baseline = prefs(dark, en);
    expect(decideSync(prefs(light, en), backend(dark, en), baseline)).toEqual({
      kind: 'push',
      prefs: prefs(light, en),
    });
  });

  it('adopts when the backend moved and the client stayed at the baseline', () => {
    const baseline = prefs(dark, en);
    expect(decideSync(prefs(dark, en), backend(light, en), baseline)).toEqual({
      kind: 'adopt',
      prefs: prefs(light, en),
    });
  });

  it('falls back to the client value when a moved backend field is null', () => {
    const baseline = prefs(dark, en);
    expect(decideSync(prefs(dark, en), backend(null, en), baseline)).toEqual({
      kind: 'adopt',
      prefs: prefs(dark, en),
    });
  });

  it('prefers the client on conflicting moves', () => {
    const baseline = prefs(dark, en);
    expect(decideSync(prefs(light, zhCN), backend(system, en), baseline)).toEqual({
      kind: 'push',
      prefs: prefs(light, zhCN),
    });
  });
});

type Harness = ReturnType<typeof createHarness>;

function createHarness(initial: { theme: Theme; locale: Locale; backend: BackendPrefs | null }) {
  let theme = initial.theme;
  let locale = initial.locale;
  let backend = initial.backend;
  const save = vi.fn<(p: UiPrefs) => Promise<void>>();
  const debouncer = createDebouncer(400);

  const controller = createSettingsSyncController({
    getTheme: () => theme,
    setTheme: (next) => {
      theme = next;
    },
    getLocale: () => locale,
    setLocale: (next) => {
      locale = next;
    },
    getBackend: () => backend,
    save: (p) => save(p) as Promise<void>,
    debounce: debouncer,
  });

  return {
    controller,
    save,
    setBackend(next: BackendPrefs | null) {
      backend = next;
    },
    setTheme(next: Theme) {
      theme = next;
      controller.notifyClientChange();
    },
    setLocale(next: Locale) {
      locale = next;
      controller.notifyClientChange();
    },
    get theme() {
      return theme;
    },
    get locale() {
      return locale;
    },
  };
}

describe('createSettingsSyncController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adopts explicit backend prefs immediately on backend change', () => {
    const h = createHarness({ theme: light, locale: en, backend: backend(dark, zhCN) });
    h.controller.notifyBackendChange();
    expect(h.theme).toBe(dark);
    expect(h.locale).toBe(zhCN);
    expect(h.save).not.toHaveBeenCalled();
    h.controller.dispose();
  });

  it('seeds the backend from the client on first load and does not revert the client', () => {
    const h = createHarness({ theme: dark, locale: zhCN, backend: backend(null, null) });
    h.controller.notifyBackendChange();
    expect(h.save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(400);
    expect(h.save).toHaveBeenCalledTimes(1);
    expect(h.save).toHaveBeenCalledWith(prefs(dark, zhCN));
    expect(h.theme).toBe(dark);
    expect(h.locale).toBe(zhCN);
    h.controller.dispose();
  });

  it('debounces a client change into a single push', () => {
    const h = createHarness({ theme: dark, locale: en, backend: backend(dark, en) });
    h.controller.notifyBackendChange(); // establishes baseline
    h.setTheme(light);
    h.setTheme(system);
    vi.advanceTimersByTime(399);
    expect(h.save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(h.save).toHaveBeenCalledTimes(1);
    expect(h.save).toHaveBeenCalledWith(prefs(system, en));
    h.controller.dispose();
  });

  it('does not push when the backend echoes back the pushed value', async () => {
    const h: Harness = createHarness({ theme: dark, locale: en, backend: backend(dark, en) });
    h.controller.notifyBackendChange();
    h.setTheme(light);
    await vi.advanceTimersByTimeAsync(400);
    expect(h.save).toHaveBeenCalledTimes(1);
    // simulate save success -> backend now reflects the client
    h.setBackend(backend(light, en));
    h.controller.notifyBackendChange();
    await vi.advanceTimersByTimeAsync(400);
    expect(h.save).toHaveBeenCalledTimes(1);
    h.controller.dispose();
  });

  it('adopts a remote backend change without scheduling a push', () => {
    const h = createHarness({ theme: dark, locale: en, backend: backend(dark, en) });
    h.controller.notifyBackendChange();
    h.setBackend(backend(system, zhCN));
    h.controller.notifyBackendChange();
    expect(h.theme).toBe(system);
    expect(h.locale).toBe(zhCN);
    vi.advanceTimersByTime(1000);
    expect(h.save).not.toHaveBeenCalled();
    h.controller.dispose();
  });

  it('retries the next push after a save failure without auto-retrying', async () => {
    const h = createHarness({ theme: dark, locale: en, backend: backend(dark, en) });
    h.controller.notifyBackendChange();
    h.save.mockRejectedValueOnce(new Error('boom'));
    h.setTheme(light);
    await vi.advanceTimersByTimeAsync(400);
    expect(h.save).toHaveBeenCalledTimes(1);
    // backend unchanged, baseline unchanged -> no automatic retry
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.save).toHaveBeenCalledTimes(1);
    // a further client change schedules a new push
    h.setTheme(system);
    await vi.advanceTimersByTimeAsync(400);
    expect(h.save).toHaveBeenCalledTimes(2);
    expect(h.save).toHaveBeenLastCalledWith(prefs(system, en));
    h.controller.dispose();
  });

  it('adopts the explicit backend on first load even if the client moved while backend was null', () => {
    const h = createHarness({ theme: dark, locale: en, backend: null });
    h.setTheme(light);
    vi.advanceTimersByTime(400);
    expect(h.save).not.toHaveBeenCalled();
    // Backend loads with explicit prefs; the first-load adopt treats the
    // backend as authoritative and reverts the pre-load client change.
    h.setBackend(backend(dark, en));
    h.controller.notifyBackendChange();
    expect(h.theme).toBe(dark);
    expect(h.locale).toBe(en);
    vi.advanceTimersByTime(400);
    expect(h.save).not.toHaveBeenCalled();
    h.controller.dispose();
  });
});
