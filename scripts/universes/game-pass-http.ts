// Daily wiki passes have their own short budget. Do not change enrichment's
// retry/timeout defaults when tuning this job.
export const PASS_REFRESH_RUN_BUDGET_MS = 480_000;
export const PASS_REFRESH_REQUEST_BUDGET_MS = 45_000;
export const PASS_REFRESH_ATTEMPT_TIMEOUT_MS = 15_000;
export const PASS_REFRESH_RETRY_LIMIT = 2;

export class PassRefreshDeferredError extends Error {}

class HttpError extends Error {
  constructor(message: string, readonly retryable: boolean) { super(message); }
}

export function createGamePassHttp(options: {
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  fetch?: typeof fetch;
  runBudgetMs?: number;
  requestBudgetMs?: number;
  attemptTimeoutMs?: number;
  intervalMs?: number;
  retryLimit?: number;
} = {}) {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const fetcher = options.fetch ?? fetch;
  const deadline = now() + (options.runBudgetMs ?? PASS_REFRESH_RUN_BUDGET_MS);
  let nextRequestAt = 0;
  let retryAfterAt = 0;
  let queue = Promise.resolve();
  let stoppedReason: string | null = null;
  const shouldStop = () => {
    if (now() >= deadline) stoppedReason ??= "run_deadline";
    return stoppedReason !== null;
  };
  const checkBudget = (requestDeadline: number, delay = 0) => {
    if (shouldStop() || now() + delay >= deadline) {
      stoppedReason ??= "run_deadline";
      throw new PassRefreshDeferredError(`Game pass run deferred: ${stoppedReason}`);
    }
    if (now() + delay >= requestDeadline) throw new PassRefreshDeferredError("Game pass request deadline exhausted");
  };
  async function waitForSlot(requestDeadline: number) {
    const previous = queue;
    let release = () => {};
    queue = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try {
      while (true) {
        const delay = Math.max(0, nextRequestAt - now(), retryAfterAt - now());
        checkBudget(requestDeadline, delay);
        if (!delay) break;
        await sleep(delay);
        // Another worker may receive Retry-After while this slot is waiting.
      }
      nextRequestAt = now() + (options.intervalMs ?? 1000);
    } finally { release(); }
  }
  async function fetchJson(url: string, label: string) {
    const requestDeadline = Math.min(deadline, now() + (options.requestBudgetMs ?? PASS_REFRESH_REQUEST_BUDGET_MS));
    const retryLimit = options.retryLimit ?? PASS_REFRESH_RETRY_LIMIT;
    for (let attempt = 0; attempt <= retryLimit; attempt++) {
      await waitForSlot(requestDeadline);
      const controller = new AbortController();
      const timeoutMs = Math.min(options.attemptTimeoutMs ?? PASS_REFRESH_ATTEMPT_TIMEOUT_MS, requestDeadline - now());
      const timer = setTimeout(() => controller.abort(new Error(`Game pass ${label} timeout`)), timeoutMs);
      let retryAfter: number | null = null;
      let failure: unknown;
      try {
        const res = await fetcher(url, {
          headers: { "user-agent": "BloxodesWikiGamePassRefresh/1.0" }, signal: controller.signal
        });
        if (res.ok) return await res.json(); // Keep the timeout through body parsing.
        const value = res.headers.get("retry-after");
        if (value) {
          const seconds = Number(value);
          const parsed = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now();
          if (Number.isFinite(parsed)) retryAfter = Math.max(0, parsed);
        }
        if (retryAfter !== null) retryAfterAt = Math.max(retryAfterAt, now() + retryAfter);
        // Never shorten Retry-After, including for other workers/universes.
        if (retryAfter !== null && retryAfterAt >= requestDeadline) {
          stoppedReason = "retry_after_exceeds_budget";
          throw new PassRefreshDeferredError(`Game pass ${label} Retry-After exceeds budget`);
        }
        throw new HttpError(`Failed to fetch ${label} (${res.status}): ${await res.text()}`, res.status === 429 || res.status >= 500);
      } catch (error) { failure = error; }
      finally { clearTimeout(timer); controller.abort(); }
      if (failure instanceof PassRefreshDeferredError) throw failure;
      checkBudget(requestDeadline);
      if ((failure instanceof HttpError && !failure.retryable) || attempt === retryLimit) throw failure;
      const delay = Math.max(retryAfterAt - now(), Math.min(1000 * 2 ** attempt, 5000));
      checkBudget(requestDeadline, delay);
      await sleep(delay);
    }
    throw new Error(`Failed to fetch ${label}`);
  }
  return { fetchJson, shouldStop, get stoppedReason() { shouldStop(); return stoppedReason; } };
}
