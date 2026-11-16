import "server-only";

import { SITE_URL } from "@/lib/seo";
import { isSearchIndexingEnabledForHost } from "@/lib/site-config";

const DEFAULT_INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const DEFAULT_INDEXNOW_KEY = "3f48868cb2e04bfe8b1fb18849d4519f";
const MAX_URLS_PER_REQUEST = 10_000;
// A claimed URL is never retried, so give the one send a fair chance.
const SEND_TIMEOUT_MS = 5_000;

type IndexNowConfig = {
  endpoint: string;
  siteOrigin: string;
  host: string;
  key: string;
  keyLocation: string;
};

export type IndexNowSubmitResult = {
  enabled: boolean;
  attempted: number;
  submitted: number;
  successfulBatches: number;
  failedBatches: number;
  reason?: string;
};

let warnedConfig = false;

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") return true;
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") return false;
  return fallback;
}

function normalizeOrigin(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function warnConfigOnce(message: string) {
  if (warnedConfig) return;
  warnedConfig = true;
  console.warn(message);
}

function resolveSiteOrigin(): string {
  const raw =
    process.env.SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    SITE_URL;

  return normalizeOrigin(raw) ?? SITE_URL.replace(/\/$/, "");
}

export function isIndexNowEnabled(): boolean {
  return process.env.NODE_ENV === "production"
    && isSearchIndexingEnabledForHost(new URL(resolveSiteOrigin()).hostname)
    // Off unless explicitly switched on: a submission cannot be taken back.
    && parseBoolean(process.env.INDEXNOW_ENABLED, false);
}

function resolveIndexNowConfig(): IndexNowConfig | null {
  const enabled = isIndexNowEnabled();
  if (!enabled) return null;

  const siteOrigin = resolveSiteOrigin();
  const host = new URL(siteOrigin).host;
  const key = process.env.INDEXNOW_KEY?.trim() || DEFAULT_INDEXNOW_KEY;

  if (!key) {
    warnConfigOnce("IndexNow skipped: set INDEXNOW_KEY and host the same key in /public/<key>.txt.");
    return null;
  }

  const keyLocationInput = (process.env.INDEXNOW_KEY_LOCATION ?? `${siteOrigin}/${key}.txt`).trim();
  let keyLocation: string;
  try {
    const parsedKeyLocation = new URL(keyLocationInput, siteOrigin);
    if (parsedKeyLocation.protocol !== "https:" && parsedKeyLocation.protocol !== "http:") {
      throw new Error("invalid protocol");
    }
    if (parsedKeyLocation.host !== host) {
      warnConfigOnce("IndexNow skipped: INDEXNOW_KEY_LOCATION must be hosted on the same site host.");
      return null;
    }
    parsedKeyLocation.hash = "";
    keyLocation = parsedKeyLocation.toString();
  } catch {
    warnConfigOnce("IndexNow skipped: INDEXNOW_KEY_LOCATION is invalid.");
    return null;
  }

  const endpointInput = (process.env.INDEXNOW_ENDPOINT ?? DEFAULT_INDEXNOW_ENDPOINT).trim();
  let endpoint: string;
  try {
    const parsedEndpoint = new URL(endpointInput);
    if (parsedEndpoint.protocol !== "https:" && parsedEndpoint.protocol !== "http:") {
      throw new Error("invalid protocol");
    }
    parsedEndpoint.hash = "";
    endpoint = parsedEndpoint.toString();
  } catch {
    warnConfigOnce("IndexNow skipped: INDEXNOW_ENDPOINT is invalid.");
    return null;
  }

  return {
    endpoint,
    siteOrigin,
    host,
    key,
    keyLocation
  };
}

function normalizeIndexNowUrl(value: string, siteOrigin: string, host: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed, siteOrigin);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (parsed.host !== host) return null;
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function submitIndexNowUrls(urls: string[], signal?: AbortSignal): Promise<IndexNowSubmitResult> {
  const config = resolveIndexNowConfig();
  if (!config) {
    return {
      enabled: false,
      attempted: 0,
      submitted: 0,
      successfulBatches: 0,
      failedBatches: 0,
      reason: "disabled-or-misconfigured"
    };
  }

  const uniqueUrls = Array.from(
    new Set(
      urls
        .map((url) => normalizeIndexNowUrl(url, config.siteOrigin, config.host))
        .filter((url): url is string => Boolean(url))
    )
  );

  if (!uniqueUrls.length) {
    return {
      enabled: true,
      attempted: 0,
      submitted: 0,
      successfulBatches: 0,
      failedBatches: 0,
      reason: "no-valid-urls"
    };
  }

  const batches = chunkArray(uniqueUrls, MAX_URLS_PER_REQUEST);
  let submitted = 0;
  let successfulBatches = 0;
  let failedBatches = 0;
  let failureReason: string | undefined;

  for (const batch of batches) {
    try {
      const res = await fetch(config.endpoint, {
        method: "POST",
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(SEND_TIMEOUT_MS)]) : AbortSignal.timeout(SEND_TIMEOUT_MS),
        headers: {
          "Content-Type": "application/json; charset=utf-8"
        },
        body: JSON.stringify({
          host: config.host,
          key: config.key,
          keyLocation: config.keyLocation,
          urlList: batch
        })
      });

      if (!res.ok) {
        failedBatches += 1;
        failureReason = `indexnow-http-${res.status}`;
        console.warn(`IndexNow submission failed: HTTP ${res.status}`);
        continue;
      }

      submitted += batch.length;
      successfulBatches += 1;
    } catch {
      failedBatches += 1;
      failureReason = "indexnow-network-error-or-timeout";
      console.warn("IndexNow submission failed: network error or timeout");
    }
  }

  return {
    enabled: true,
    attempted: uniqueUrls.length,
    submitted,
    successfulBatches,
    failedBatches,
    ...(failureReason ? { reason: failureReason } : {})
  };
}

export async function submitIndexNowPaths(paths: string[], signal?: AbortSignal): Promise<IndexNowSubmitResult> {
  const siteOrigin = resolveSiteOrigin();
  const normalizedUrls = paths
    .map((path) => {
      const trimmed = path.trim();
      if (!trimmed) return "";
      if (/^https?:\/\//i.test(trimmed)) return trimmed;
      const normalizedPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
      return `${siteOrigin}${normalizedPath}`;
    })
    .filter((url) => Boolean(url));

  return submitIndexNowUrls(normalizedUrls, signal);
}
