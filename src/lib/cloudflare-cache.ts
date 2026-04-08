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

const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";

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

  let payload: unknown = null;
  let responseStatus = 0;

  try {
    const response = await fetch(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/purge_cache`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ files })
    });

    responseStatus = response.status;
    payload = await response.json().catch(() => null);

    const successFlag =
      payload && typeof payload === "object" && typeof (payload as { success?: unknown }).success === "boolean"
        ? Boolean((payload as { success: boolean }).success)
        : response.ok;

    return {
      enabled: true,
      ok: response.ok && successFlag,
      attempted: files.length,
      purged: files,
      status: responseStatus,
      reason: response.ok && successFlag ? undefined : "cloudflare-api-error",
      errors: extractErrors(payload)
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
