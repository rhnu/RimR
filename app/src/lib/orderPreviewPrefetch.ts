type PreviewWarmSchedulerOptions = {
  delayMs: number;
  maxConcurrent?: number;
  isWarm: (sourceKey: string) => boolean;
  warm: (sourceKey: string) => void | Promise<void>;
  decode?: (sourceKey: string) => void | Promise<void>;
};

export type PreviewWarmScheduler = {
  schedule: (sourceKey: string | null | undefined) => void;
  warmNow: (sourceKey: string | null | undefined) => Promise<void>;
  warmNearby: (sourceKeys: ReadonlyArray<string | null | undefined>) => Promise<void>;
  cancel: () => void;
};

export function createPreviewWarmScheduler({
  delayMs,
  maxConcurrent = 2,
  isWarm,
  warm,
  decode,
}: PreviewWarmSchedulerOptions): PreviewWarmScheduler {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const decoded = new Set<string>();
  const decoding = new Map<string, Promise<void>>();

  function cancel(): void {
    if (timeout != null) {
      clearTimeout(timeout);
      timeout = null;
    }
  }

  async function decodeIfNeeded(sourceKey: string): Promise<void> {
    if (!decode || decoded.has(sourceKey)) {
      return;
    }
    const existing = decoding.get(sourceKey);
    if (existing) {
      await existing;
      return;
    }
    const next = Promise.resolve(decode(sourceKey))
      .then(() => {
        decoded.add(sourceKey);
      })
      .catch(() => undefined)
      .finally(() => {
        decoding.delete(sourceKey);
      });
    decoding.set(sourceKey, next);
    await next;
  }

  function warmIfNeeded(sourceKey: string | null | undefined): Promise<void> {
    if (sourceKey == null) {
      return Promise.resolve();
    }
    const warmed = isWarm(sourceKey) ? undefined : warm(sourceKey);
    return Promise.resolve(warmed)
      .then(() => decodeIfNeeded(sourceKey))
      .catch(() => undefined);
  }

  async function warmWithLimit(sourceKeys: ReadonlyArray<string | null | undefined>) {
    const unique = [...new Set(sourceKeys.filter((key): key is string => key != null))];
    const workerCount = Math.min(Math.max(1, maxConcurrent), unique.length);
    let nextIndex = 0;
    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (nextIndex < unique.length) {
          const sourceKey = unique[nextIndex];
          nextIndex += 1;
          await warmIfNeeded(sourceKey);
        }
      }),
    );
  }

  return {
    schedule(sourceKey) {
      cancel();
      if (sourceKey == null || isWarm(sourceKey)) {
        return;
      }
      timeout = setTimeout(() => {
        timeout = null;
        void warmIfNeeded(sourceKey);
      }, delayMs);
    },
    warmNow(sourceKey) {
      cancel();
      return warmIfNeeded(sourceKey);
    },
    warmNearby(sourceKeys) {
      return warmWithLimit(sourceKeys);
    },
    cancel,
  };
}
