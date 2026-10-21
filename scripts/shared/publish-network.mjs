// Shared with plain-Node CI contracts. Keep this module free of runtime dependencies.
export const PUBLISH_CONCURRENCY = 8;

export function formatPublishError(error) {
  const seen = new Set();
  function describe(value) {
    if (value == null) return '';
    if (typeof value !== 'object') return String(value);
    if (seen.has(value)) return '';
    seen.add(value);
    const details = [value.message, value.code, value.details, value.hint]
      .filter(part => typeof part === 'string' && part && part !== '[object Object]');
    for (const nested of [value.cause, ...(Array.isArray(value.errors) ? value.errors : [])]) {
      const detail = describe(nested);
      if (detail) details.push(detail);
    }
    return [...new Set(details)].join(': ') || 'Unknown publication error';
  }
  let message = describe(error) || 'Unknown publication error';
  // Keep the origin/path for diagnosis, but remove URL credentials and query tokens.
  message = message.replace(/https?:\/\/[^\s<>"']+/g, raw => {
    try { const url = new URL(raw); return `${url.origin}${url.pathname}${url.search || url.hash ? '?[redacted]' : ''}`; }
    catch { return '[redacted URL]'; }
  });
  for (const key of ['SUPABASE_SERVICE_ROLE', 'SUPABASE_SERVICE_ROLE_KEY', 'WIKI_R2_ACCESS_KEY_ID', 'WIKI_R2_SECRET_ACCESS_KEY', 'REVALIDATE_SECRET', 'VPS_SUPABASE_STUDIO_PASSWORD']) {
    const secret = process.env[key];
    if (secret) message = message.split(secret).join('[redacted]');
  }
  return message;
}

export function isTransientPublishError(error, depth = 0) {
  if (!error || depth > 6) return false;
  function httpStatus(value, remaining = 6) {
    if (!value || !remaining) return 0;
    return Number(value.status || value.statusCode || value.$metadata?.httpStatusCode) || httpStatus(value.cause, remaining - 1);
  }
  const status = httpStatus(error);
  if (status) return status === 429 || status >= 500 && status <= 599;
  const code = String(error.code ?? '');
  if (['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT'].includes(code)) return true;
  if (error.name === 'TimeoutError') return true;
  const message = typeof error === 'string' ? error : error.message ?? '';
  if (/fetch failed|socket hang up|\b(?:ECONNRESET|ETIMEDOUT)\b|\b(?:request|connect|connection|socket|network) (?:timed out|timeout)\b/i.test(message)) return true;
  return isTransientPublishError(error.cause, depth + 1) || Boolean(error.errors?.some(nested => isTransientPublishError(nested, depth + 1)));
}

export async function retryPublishNetwork(work, { attempts = 3, delayMs = 250, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  for (let attempt = 1; ; attempt++) {
    try { return await work(); }
    catch (error) {
      if (attempt >= attempts || !isTransientPublishError(error)) throw error;
      await sleep(delayMs * 2 ** (attempt - 1));
    }
  }
}

const limitRead = createPublishLimiter();

// Recreate the query on every attempt. Never pass a mutation to this helper.
export async function readPublishQuery(query) {
  return retryPublishNetwork(() => limitRead(async () => {
    const result = await query();
    if (result.error) {
      // PostgREST often returns plain objects and stores transport causes in details.
      const error = new Error(formatPublishError(result.error), { cause: result.error });
      error.status = result.status;
      throw error;
    }
    return result;
  }));
}

export async function requirePublishResponse(response, context) {
  if (response.ok) return response;
  await response.body?.cancel().catch(() => {});
  const error = new Error(`${context}: HTTP ${response.status}.`);
  error.status = response.status;
  throw error;
}

export async function mapPublishConcurrent(items, work, { concurrency = PUBLISH_CONCURRENCY, label, every = 100, log = console.log } = {}) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) throw new Error('Publication concurrency must be an integer from 1 to 16.');
  const results = new Array(items.length);
  let next = 0, completed = 0, failed = false, failure;
  let lastLog = Date.now();
  const progress = () => { log(`${label} ${completed}/${items.length}`); lastLog = Date.now(); };
  const timer = label && items.length ? setInterval(() => { if (Date.now() - lastLog >= 10_000) progress(); }, 10_000) : undefined;
  timer?.unref?.();
  try {
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (!failed && next < items.length) {
        const index = next++;
        try {
          results[index] = await work(items[index], index);
          completed++;
          if (label && (completed % every === 0 || completed === items.length)) progress();
        } catch (error) {
          if (!failed) { failed = true; failure = error; }
        }
      }
    }));
    // All in-flight work settles before a caller can begin writes or another phase.
    if (failed) throw failure;
    return results;
  } finally { if (timer) clearInterval(timer); }
}

// Share one budget when page verification starts nested image batches.
export function createPublishLimiter(concurrency = PUBLISH_CONCURRENCY) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) throw new Error('Publication concurrency must be an integer from 1 to 16.');
  let active = 0;
  const waiting = [];
  return async work => {
    if (active >= concurrency) await new Promise(resolve => waiting.push(resolve));
    else active++;
    try { return await work(); }
    finally {
      const resume = waiting.shift();
      if (resume) resume();
      else active--;
    }
  };
}
