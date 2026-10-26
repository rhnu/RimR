export interface Debouncer {
  schedule: (fn: () => void) => void;
  cancel: () => void;
  flush: () => void;
}

export function createDebouncer(delayMs: number): Debouncer {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: (() => void) | null = null;

  return {
    schedule(fn) {
      pending = fn;
      if (timer != null) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = null;
        const f = pending;
        pending = null;
        f?.();
      }, delayMs);
    },
    cancel() {
      if (timer != null) {
        clearTimeout(timer);
        timer = null;
      }
      pending = null;
    },
    flush() {
      if (timer != null) {
        clearTimeout(timer);
        timer = null;
      }
      const f = pending;
      pending = null;
      f?.();
    },
  };
}
