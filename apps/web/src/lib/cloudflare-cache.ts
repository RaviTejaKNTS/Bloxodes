import "server-only";

import { normalizeOrigin, SITE_URL } from "@/lib/site-config";

type CloudflareApiMessage = {
  code?: number;
  message?: string;
};

export type CloudflarePurgeResult = {
  enabled: boolean;
  ok: boolean;
  attempted: number;
  purged: string[];
  reason?: string;
  status?: number;
  errors?: string[];
};

export type CloudflareWarmResult = {
  enabled: boolean;
  ok: boolean;
  attempted: number;
  warmed: string[];
  skipped: number;
  reason?: string;
  errors?: string[];
};

const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";
const CLOUDFLARE_PURGE_BATCH_SIZE = 30;
const DEFAULT_WARM_CONCURRENCY = 4;
const DEFAULT_WARM_MAX_PATHS = 80;

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function normalizePath(path: string) {
  const trimmed = path.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith("/")) return null;
  if (/\[[^/\]]+\]/.test(trimmed)) return null;
  if (trimmed === "/") return "/";
  return trimmed.replace(/\/+$/, "");
}

function buildPurgeUrls(paths: string[]) {
  const origin = normalizeOrigin(SITE_URL) ?? SITE_URL.replace(/\/$/, "");
  const uniquePaths = Array.from(
    new Set(
      paths
        .map(normalizePath)
        .filter((value): value is string => Boolean(value))
    )
  );

  return uniquePaths.map((path) => `${origin}${path === "/" ? "/" : path}`);
}

function readPositiveInt(name: string, fallback: number, max: number) {
  const raw = readEnv(name);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.min(Math.floor(value), max);
}

async function runLimited<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
  return results;
}

function extractErrors(payload: unknown) {
  if (!payload || typeof payload !== "object") return [];
  const errors = Array.isArray((payload as { errors?: unknown[] }).errors)
    ? ((payload as { errors: unknown[] }).errors as unknown[])
    : [];

  return errors
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const { code, message } = entry as CloudflareApiMessage;
      if (!message) return null;
      return typeof code === "number" ? `${code}: ${message}` : message;
    })
    .filter((value): value is string => Boolean(value));
}

export async function purgeCloudflarePaths(paths: string[]): Promise<CloudflarePurgeResult> {
  const apiToken = readEnv("CLOUDFLARE_API_TOKEN");
  const zoneId = readEnv("CLOUDFLARE_ZONE_ID");

  if (!apiToken || !zoneId) {
    return {
      enabled: false,
      ok: false,
      attempted: 0,
      purged: [],
      reason: "missing-config"
    };
  }

  const files = buildPurgeUrls(paths);
  if (files.length === 0) {
    return {
      enabled: true,
      ok: true,
      attempted: 0,
      purged: [],
      reason: "no-cacheable-paths"
    };
  }

  let responseStatus = 0;
  const purged: string[] = [];
  const errors: string[] = [];

  try {
    for (let index = 0; index < files.length; index += CLOUDFLARE_PURGE_BATCH_SIZE) {
      const batch = files.slice(index, index + CLOUDFLARE_PURGE_BATCH_SIZE);
      const response = await fetch(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/purge_cache`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ files: batch })
      });

      responseStatus = response.status;
      const payload = await response.json().catch(() => null);
      const successFlag =
        payload && typeof payload === "object" && typeof (payload as { success?: unknown }).success === "boolean"
          ? Boolean((payload as { success: boolean }).success)
          : response.ok;

      if (response.ok && successFlag) {
        purged.push(...batch);
      } else {
        errors.push(...extractErrors(payload));
        if (!errors.length) {
          errors.push(`Cloudflare purge batch failed with status ${response.status}`);
        }
      }
    }

    return {
      enabled: true,
      ok: purged.length === files.length,
      attempted: files.length,
      purged,
      status: responseStatus,
      reason: purged.length === files.length ? undefined : "cloudflare-api-error",
      errors
    };
  } catch (error) {
    return {
      enabled: true,
      ok: false,
      attempted: files.length,
      purged: files,
      status: responseStatus || undefined,
      reason: error instanceof Error ? error.message : "cloudflare-request-failed"
    };
  }
}

export async function warmCloudflarePaths(paths: string[]): Promise<CloudflareWarmResult> {
  if (readEnv("CLOUDFLARE_WARM_AFTER_PURGE") === "false") {
    return {
      enabled: false,
      ok: true,
      attempted: 0,
      warmed: [],
      skipped: 0,
      reason: "disabled"
    };
  }

  const apiToken = readEnv("CLOUDFLARE_API_TOKEN");
  const zoneId = readEnv("CLOUDFLARE_ZONE_ID");
  if (!apiToken || !zoneId) {
    return {
      enabled: false,
      ok: false,
      attempted: 0,
      warmed: [],
      skipped: 0,
      reason: "missing-config"
    };
  }

  const allUrls = buildPurgeUrls(paths);
  const maxPaths = readPositiveInt("CLOUDFLARE_WARM_MAX_PATHS", DEFAULT_WARM_MAX_PATHS, 500);
  const urls = allUrls.slice(0, maxPaths);
  if (!urls.length) {
    return {
      enabled: true,
      ok: true,
      attempted: 0,
      warmed: [],
      skipped: 0,
      reason: "no-cacheable-paths"
    };
  }

  const concurrency = readPositiveInt("CLOUDFLARE_WARM_CONCURRENCY", DEFAULT_WARM_CONCURRENCY, 16);
  const errors: string[] = [];
  const warmed: string[] = [];
  await runLimited(urls, concurrency, async (url) => {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "User-Agent": "BloxodesRevalidationWarmup/1.0"
        }
      });
      await response.arrayBuffer();
      if (response.ok) {
        warmed.push(url);
      } else {
        errors.push(`${url} returned ${response.status}`);
      }
    } catch (error) {
      errors.push(`${url} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  return {
    enabled: true,
    ok: errors.length === 0,
    attempted: urls.length,
    warmed,
    skipped: Math.max(0, allUrls.length - urls.length),
    reason: errors.length ? "warmup-failed" : undefined,
    errors: errors.length ? errors : undefined
  };
}
