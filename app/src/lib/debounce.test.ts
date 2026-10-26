import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDebouncer } from '@/lib/debounce';

describe('createDebouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not invoke the callback before the delay elapses', () => {
    const debouncer = createDebouncer(400);
    const fn = vi.fn<() => void>();
    debouncer.schedule(fn);
    vi.advanceTimersByTime(399);
    expect(fn).not.toHaveBeenCalled();
  });

  it('invokes the latest callback after the delay', () => {
    const debouncer = createDebouncer(400);
    const first = vi.fn<() => void>();
    const second = vi.fn<() => void>();
    debouncer.schedule(first);
    vi.advanceTimersByTime(100);
    debouncer.schedule(second);
    vi.advanceTimersByTime(400);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('flush runs the pending callback immediately and clears the timer', () => {
    const debouncer = createDebouncer(400);
    const fn = vi.fn<() => void>();
    debouncer.schedule(fn);
    vi.advanceTimersByTime(50);
    debouncer.flush();
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancel drops the pending callback', () => {
    const debouncer = createDebouncer(400);
    const fn = vi.fn<() => void>();
    debouncer.schedule(fn);
    debouncer.cancel();
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
  });

  it('flush is a no-op when nothing is scheduled', () => {
    const debouncer = createDebouncer(400);
    expect(() => debouncer.flush()).not.toThrow();
  });

  it('coalesces rapid schedules into a single trailing call', () => {
    const debouncer = createDebouncer(400);
    const fn = vi.fn<() => void>();
    for (let i = 0; i < 5; i++) {
      debouncer.schedule(fn);
      vi.advanceTimersByTime(50);
    }
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(400);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
