/**
 * 1Click HTTP wrapper: 429/503 Retry-After (or exponential backoff) + per-attempt timeout.
 *
 * Do not park on a Promise resolved by another request (isolate semaphore).
 * Local Miniflare shares one isolate and treats that wait as a hung Worker.
 * Production isolates do not share that mutex anyway — frontend mapPool + this
 * retry is the real rate limit.
 */

const MAX_RETRIES = 6;
const FETCH_TIMEOUT_MS = 15_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(res: Response | null, attempt: number): number {
  if (res) {
    const raw = res.headers.get("retry-after");
    const seconds = raw ? Number(raw) : NaN;
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(30_000, Math.max(0, seconds * 1000));
    }
  }
  return Math.min(8_000, 400 * 2 ** attempt);
}

async function fetchWithTimeout(input: string, init: RequestInit | undefined, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  init?.signal?.addEventListener("abort", onAbort);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    init?.signal?.removeEventListener("abort", onAbort);
  }
}

export async function fetchWithRetryAfter(
  input: string,
  init?: RequestInit,
  options: { maxRetries?: number; timeoutMs?: number } = {},
): Promise<Response> {
  const maxRetries = options.maxRetries ?? MAX_RETRIES;
  const timeoutMs = options.timeoutMs ?? FETCH_TIMEOUT_MS;
  let last: Response | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      last = await fetchWithTimeout(input, init, timeoutMs);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await sleep(retryDelayMs(null, attempt));
      continue;
    }
    if (last.status !== 429 && last.status !== 503) return last;
    if (attempt === maxRetries) return last;
    await sleep(retryDelayMs(last, attempt));
  }
  return last!;
}
