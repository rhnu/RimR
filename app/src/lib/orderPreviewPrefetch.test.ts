import { describe, expect, it, vi } from 'vitest';
import { createPreviewWarmScheduler } from '@/lib/orderPreviewPrefetch';

describe('createPreviewWarmScheduler', () => {
  it('warms only the latest hovered source after the intent delay', () => {
    vi.useFakeTimers();
    const warm = vi.fn<(sourceKey: string) => void>();
    const scheduler = createPreviewWarmScheduler({
      delayMs: 120,
      isWarm: () => false,
      warm,
    });

    scheduler.schedule('first');
    scheduler.schedule('second');
    vi.advanceTimersByTime(119);
    expect(warm).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(warm).toHaveBeenCalledTimes(1);
    expect(warm).toHaveBeenCalledWith('second');
    vi.useRealTimers();
  });

  it('skips delayed and immediate warms for already warm sources', () => {
    vi.useFakeTimers();
    const warm = vi.fn<(sourceKey: string) => void>();
    const scheduler = createPreviewWarmScheduler({
      delayMs: 120,
      isWarm: (sourceKey) => sourceKey === 'cached',
      warm,
    });

    scheduler.schedule('cached');
    vi.advanceTimersByTime(120);
    scheduler.warmNow('cached');

    expect(warm).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('cancels a pending delayed warm when warming immediately', () => {
    vi.useFakeTimers();
    const warm = vi.fn<(sourceKey: string) => void>();
    const scheduler = createPreviewWarmScheduler({
      delayMs: 120,
      isWarm: () => false,
      warm,
    });

    scheduler.schedule('hovered');
    scheduler.warmNow('focused');
    vi.advanceTimersByTime(120);

    expect(warm).toHaveBeenCalledTimes(1);
    expect(warm).toHaveBeenCalledWith('focused');
    vi.useRealTimers();
  });

  it('warms nearby sources with a low concurrency limit', async () => {
    let active = 0;
    let maxActive = 0;
    const warmed: string[] = [];
    const releases: Array<() => void> = [];
    const scheduler = createPreviewWarmScheduler({
      delayMs: 120,
      maxConcurrent: 2,
      isWarm: () => false,
      warm: (sourceKey) =>
        new Promise<void>((resolve) => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          warmed.push(sourceKey);
          releases.push(() => {
            active -= 1;
            resolve();
          });
        }),
    });

    const done = scheduler.warmNearby(['a', 'b', 'c']);
    await Promise.resolve();
    expect(warmed).toEqual(['a', 'b']);
    expect(maxActive).toBe(2);

    releases.shift()?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(warmed).toEqual(['a', 'b', 'c']);

    releases.shift()?.();
    releases.shift()?.();
    await done;
    expect(maxActive).toBe(2);
  });

  it('decodes each warmed source only once', async () => {
    const decode = vi.fn<(sourceKey: string) => void>();
    const scheduler = createPreviewWarmScheduler({
      delayMs: 120,
      isWarm: () => true,
      warm: vi.fn<(sourceKey: string) => void>(),
      decode,
    });

    await scheduler.warmNow('cached');
    await scheduler.warmNow('cached');
    await scheduler.warmNearby(['cached', 'cached']);

    expect(decode).toHaveBeenCalledTimes(1);
    expect(decode).toHaveBeenCalledWith('cached');
  });
});
