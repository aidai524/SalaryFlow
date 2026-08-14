export interface MapPoolOptions {
  concurrency?: number;
  onProgress?: (done: number, total: number) => void;
}

/**
 * Run async work over `items` with a concurrency cap.
 * Results keep input order. Rejects if any `fn` throws.
 */
export async function mapPool<T, R>(
  items: readonly T[],
  fn: (item: T, index: number) => Promise<R>,
  options: MapPoolOptions = {},
): Promise<R[]> {
  const total = items.length;
  if (total === 0) return [];
  const concurrency = Math.max(1, options.concurrency ?? 3);
  const results: R[] = new Array(total);
  let next = 0;
  let done = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = next;
      next += 1;
      if (index >= total) return;
      results[index] = await fn(items[index], index);
      done += 1;
      options.onProgress?.(done, total);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
  await Promise.all(workers);
  return results;
}

export interface SettledResult<T> {
  status: "fulfilled" | "rejected";
  value?: T;
  reason?: unknown;
}

/** Like mapPool but captures per-item errors instead of failing the batch. */
export async function mapPoolSettled<T, R>(
  items: readonly T[],
  fn: (item: T, index: number) => Promise<R>,
  options: MapPoolOptions = {},
): Promise<Array<SettledResult<R>>> {
  return mapPool(
    items,
    async (item, index) => {
      try {
        const value = await fn(item, index);
        return { status: "fulfilled" as const, value };
      } catch (reason) {
        return { status: "rejected" as const, reason };
      }
    },
    options,
  );
}
