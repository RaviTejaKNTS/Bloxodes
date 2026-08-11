import { NextResponse } from "next/server";
import {
  generateUsernameCandidates,
  isRobloxUsernameFormat,
  mapRobloxValidationResponse,
  normalizeUsernameGeneratorOptions,
  type CheckedUsernameResult,
  type RobloxUsernameValidation
} from "@/lib/roblox-username-generator";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getRequestIp, isTrustedMutationOrigin } from "@/lib/security/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USER_AGENT =
  process.env.ROBLOX_SCRAPER_UA ??
  "BloxodesUsernameGenerator/1.0 (+https://bloxodes.com; contact@bloxodes.com)";
const SERVICE_BIRTHDAY = "2016-01-01";
const UPSTREAM_TIMEOUT_MS = 8_000;
const OVERALL_DEADLINE_MS = 15_000;
const MAX_UPSTREAM_CHECKS = 48;
const VALIDATION_CONCURRENCY = 4;
const GLOBAL_UPSTREAM_CONCURRENCY = 12;
const REQUEST_RATE_LIMIT = { limit: 6, windowMs: 60_000 };
const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

type ValidationCacheEntry = {
  expiresAt: number;
  result: InternalValidationResult;
};

type InternalValidationResult = {
  validation: RobloxUsernameValidation;
  checkedAt: string | null;
  rateLimited: boolean;
  retryAfterSeconds: number | null;
};

const validationCache = new Map<string, ValidationCacheEntry>();
const inflightChecks = new Map<string, Promise<InternalValidationResult>>();
let activeUpstreamChecks = 0;
const upstreamWaiters: Array<() => void> = [];

function cacheTtlMs(status: RobloxUsernameValidation["status"]): number {
  if (status === "available") return 30_000;
  if (status === "taken") return 10 * 60_000;
  if (status === "inappropriate" || status === "invalid") return 60 * 60_000;
  return 0;
}

function readValidationCache(username: string): InternalValidationResult | null {
  const key = username.toLowerCase();
  const entry = validationCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    validationCache.delete(key);
    return null;
  }
  return entry.result;
}

function writeValidationCache(username: string, result: InternalValidationResult) {
  const ttl = cacheTtlMs(result.validation.status);
  if (!ttl) return;
  if (validationCache.size >= 2_000) {
    const oldest = validationCache.keys().next().value;
    if (oldest) validationCache.delete(oldest);
  }
  validationCache.set(username.toLowerCase(), { expiresAt: Date.now() + ttl, result });
}

async function acquireUpstreamSlot(): Promise<void> {
  if (activeUpstreamChecks < GLOBAL_UPSTREAM_CONCURRENCY) {
    activeUpstreamChecks += 1;
    return;
  }
  await new Promise<void>((resolve) => upstreamWaiters.push(resolve));
  activeUpstreamChecks += 1;
}

function releaseUpstreamSlot() {
  activeUpstreamChecks = Math.max(0, activeUpstreamChecks - 1);
  upstreamWaiters.shift()?.();
}

function retryAfterSeconds(response: Response): number | null {
  const value = Number(response.headers.get("retry-after"));
  return Number.isFinite(value) && value > 0 ? Math.ceil(value) : null;
}

async function fetchExactUsername(username: string, deadline: number): Promise<InternalValidationResult> {
  const timeoutMs = Math.min(UPSTREAM_TIMEOUT_MS, deadline - Date.now());
  if (timeoutMs <= 0) {
    return {
      validation: mapRobloxValidationResponse(null, null),
      checkedAt: null,
      rateLimited: false,
      retryAfterSeconds: null
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": USER_AGENT
      },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
    });
    if (!response.ok) {
      return {
        validation: mapRobloxValidationResponse(null, null),
        checkedAt: null,
        rateLimited: response.status === 429,
        retryAfterSeconds: retryAfterSeconds(response)
      };
    }
    const payload = (await response.json()) as { data?: unknown[] };
    if ((payload.data?.length ?? 0) > 0) {
      return {
        validation: mapRobloxValidationResponse(1, "Username is already in use"),
        checkedAt: new Date().toISOString(),
        rateLimited: false,
        retryAfterSeconds: null
      };
    }
    return {
      validation: mapRobloxValidationResponse(null, null),
      checkedAt: null,
      rateLimited: false,
      retryAfterSeconds: null
    };
  } catch {
    return {
      validation: mapRobloxValidationResponse(null, null),
      checkedAt: null,
      rateLimited: false,
      retryAfterSeconds: null
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function performRobloxValidation(username: string, deadline: number): Promise<InternalValidationResult> {
  const timeoutMs = Math.min(UPSTREAM_TIMEOUT_MS, deadline - Date.now());
  if (timeoutMs <= 0) {
    return {
      validation: mapRobloxValidationResponse(null, null),
      checkedAt: null,
      rateLimited: false,
      retryAfterSeconds: null
    };
  }

  await acquireUpstreamSlot();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const params = new URLSearchParams({
      "request.username": username,
      "request.birthday": SERVICE_BIRTHDAY,
      "request.context": "Signup"
    });
    const response = await fetch(`https://auth.roblox.com/v2/usernames/validate?${params}`, {
      cache: "no-store",
      signal: controller.signal,
      headers: { accept: "application/json", "user-agent": USER_AGENT }
    });

    if (!response.ok) {
      if (response.status === 429) {
        return {
          validation: mapRobloxValidationResponse(null, null),
          checkedAt: null,
          rateLimited: true,
          retryAfterSeconds: retryAfterSeconds(response)
        };
      }
      return fetchExactUsername(username, deadline);
    }

    const payload = (await response.json()) as { code?: unknown; message?: unknown };
    const validation = mapRobloxValidationResponse(payload.code, payload.message);
    const result: InternalValidationResult = {
      validation,
      checkedAt: validation.status === "unverified" ? null : new Date().toISOString(),
      rateLimited: false,
      retryAfterSeconds: null
    };
    writeValidationCache(username, result);
    return result;
  } catch {
    return fetchExactUsername(username, deadline);
  } finally {
    clearTimeout(timeout);
    releaseUpstreamSlot();
  }
}

async function validateUsername(username: string, deadline: number): Promise<InternalValidationResult> {
  const cached = readValidationCache(username);
  if (cached) return cached;

  const key = username.toLowerCase();
  const existing = inflightChecks.get(key);
  if (existing) return existing;

  const pending = performRobloxValidation(username, deadline).finally(() => {
    inflightChecks.delete(key);
  });
  inflightChecks.set(key, pending);
  return pending;
}

function checkedResult(
  username: string,
  tags: string[],
  result: InternalValidationResult
): CheckedUsernameResult {
  return {
    username,
    status: result.validation.status,
    message: result.validation.message,
    checkedAt: result.checkedAt,
    length: username.length,
    tags
  };
}

async function validateCandidates(
  candidates: ReturnType<typeof generateUsernameCandidates>,
  amount: number,
  deadline: number
) {
  const available: CheckedUsernameResult[] = [];
  let attempted = 0;
  let rateLimited = false;
  let retryAfter: number | null = null;
  const maximum = Math.min(MAX_UPSTREAM_CHECKS, candidates.length);

  for (let offset = 0; offset < maximum && available.length < amount && Date.now() < deadline; offset += VALIDATION_CONCURRENCY) {
    const batch = candidates.slice(offset, Math.min(maximum, offset + VALIDATION_CONCURRENCY));
    const validations = await Promise.all(
      batch.map(async (candidate) => ({ candidate, result: await validateUsername(candidate.username, deadline) }))
    );
    attempted += batch.length;

    for (const { candidate, result } of validations) {
      if (result.validation.status === "available" && available.length < amount) {
        available.push(checkedResult(candidate.username, candidate.tags, result));
      }
      if (result.rateLimited) {
        rateLimited = true;
        retryAfter = Math.max(retryAfter ?? 0, result.retryAfterSeconds ?? 0) || null;
      }
    }
    if (rateLimited) break;
  }

  return { available, attempted, rateLimited, retryAfter };
}

function json(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...NO_STORE_HEADERS, ...(init?.headers ?? {}) }
  });
}

export async function POST(request: Request) {
  if (!isTrustedMutationOrigin(request)) {
    return json({ ok: false, error: { code: "INVALID_ORIGIN", message: "Invalid request origin." } }, { status: 403 });
  }

  const rateLimit = checkRateLimit({
    key: `roblox-username-generator:${getRequestIp(request)}`,
    ...REQUEST_RATE_LIMIT
  });
  if (!rateLimit.allowed) {
    return json(
      {
        ok: false,
        error: {
          code: "TOO_MANY_REQUESTS",
          message: "Too many username checks in a short time. Wait a moment and try again.",
          retryAfterSeconds: rateLimit.retryAfterSeconds
        }
      },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: { code: "INVALID_JSON", message: "Send a valid JSON request." } }, { status: 400 });
  }

  const body = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const deadline = Date.now() + OVERALL_DEADLINE_MS;

  if (body.action === "check") {
    const username = typeof body.username === "string" ? body.username.trim().replace(/^@+/, "") : "";
    if (!isRobloxUsernameFormat(username)) {
      return json(
        {
          ok: false,
          error: { code: "INVALID_USERNAME", message: "Use 3 to 20 letters or numbers with at most one internal underscore." }
        },
        { status: 400 }
      );
    }
    const result = await validateUsername(username, deadline);
    if (result.rateLimited && result.validation.status === "unverified") {
      return json(
        {
          ok: false,
          error: {
            code: "ROBLOX_RATE_LIMITED",
            message: "Roblox is limiting checks right now. Try again shortly.",
            retryAfterSeconds: result.retryAfterSeconds
          }
        },
        {
          status: 429,
          headers: result.retryAfterSeconds ? { "Retry-After": String(result.retryAfterSeconds) } : undefined
        }
      );
    }
    return json({ ok: true, result: checkedResult(username, [], result) });
  }

  const normalized = normalizeUsernameGeneratorOptions(body);
  if (!normalized.ok) {
    return json({ ok: false, error: normalized.error }, { status: 400 });
  }

  const seed = `${Date.now()}:${crypto.randomUUID()}`;
  const candidates = generateUsernameCandidates(normalized.options, seed, 320);
  const validation = await validateCandidates(candidates, normalized.options.amount, deadline);
  const warnings: string[] = [];
  if (validation.rateLimited) warnings.push("Roblox is limiting checks, so this batch may be smaller than requested.");
  if (Date.now() >= deadline) warnings.push("The check reached its time limit. Generate again for more choices.");
  if (!validation.available.length && !validation.rateLimited) {
    warnings.push("No available names matched these settings. Widen the length or allow numbers and try again.");
  }

  return json({
    ok: true,
    results: validation.available,
    attempted: validation.attempted,
    exhausted: validation.available.length < normalized.options.amount,
    warnings,
    retryAfterSeconds: validation.retryAfter
  });
}
