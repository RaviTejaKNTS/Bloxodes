import "server-only";

import { NextResponse } from "next/server";

import { checkAdminToken } from "@/lib/admin/auth";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getRequestIp } from "@/lib/security/request";

const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const SLUG_PATTERN = /^[a-z0-9-]{1,160}$/;

/** Thrown by admin helpers for caller mistakes; routes map it to HTTP 400 with the message. */
export class AdminInputError extends Error {}

export function adminJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: HEADERS });
}

/** Token + rate-limit gate shared by all `/api/admin/*` routes. Returns a response to send, or null to continue. */
export function guardAdminRequest(request: Request, scope: string) {
  const auth = checkAdminToken(request);
  if (!auth.ok) {
    return auth.status === 404 ? adminJson({ error: "Not found" }, 404) : adminJson({ error: "Unauthorized" }, 401);
  }
  const limit = checkRateLimit({ key: `admin-${scope}:${getRequestIp(request)}`, limit: 60, windowMs: 60_000 });
  if (!limit.allowed) return adminJson({ error: "Too many requests" }, 429);
  return null;
}

export function readAdminSlug(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const slug = value.trim().toLowerCase();
  return SLUG_PATTERN.test(slug) ? slug : null;
}

export async function readAdminPatchBody(
  request: Request,
  allowedFields: ReadonlySet<string>
): Promise<{ slug: string; patch: Record<string, unknown> } | Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return adminJson({ error: "Invalid JSON body" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return adminJson({ error: "Invalid JSON body" }, 400);

  const input = body as Record<string, unknown>;
  const slug = readAdminSlug(input.slug);
  if (!slug) return adminJson({ error: "Missing or invalid slug" }, 400);

  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (key === "slug") continue;
    if (!allowedFields.has(key)) return adminJson({ error: `Unknown field: ${key}` }, 400);
    patch[key] = value;
  }
  return { slug, patch };
}

/** Maps helper/database failures from an admin write to a response. */
export function adminWriteErrorResponse(error: unknown, label: string) {
  if (error instanceof AdminInputError) return adminJson({ error: error.message }, 400);
  const dbError = error as { code?: string; message?: string } | null;
  if (dbError?.code === "23503") return adminJson({ error: `A referenced record does not exist (${dbError.message ?? "foreign key"})` }, 400);
  if (dbError?.code === "22P02") return adminJson({ error: `Invalid value (${dbError.message ?? "bad input"})` }, 400);
  console.error(`admin/${label} write failed`, error);
  return adminJson({ error: dbError?.message ? `Failed to update ${label}: ${dbError.message}` : `Failed to update ${label}` }, 500);
}

/** Returns a canonical http(s) URL, `null` for empty input, or throws for anything else. */
export function normalizeAdminUrl(value: unknown, field = "URL"): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new AdminInputError(`${field} must be a string`);
  let trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) trimmed = `https://${trimmed.replace(/^[\s/]+/, "")}`;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new AdminInputError(`${field} is not a valid URL: ${value}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AdminInputError(`${field} is not a valid URL: ${value}`);
  }
  return trimmed;
}

/** Trims trailing whitespace; blank input becomes null. */
export function normalizeAdminText(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new AdminInputError(`${field} must be a string`);
  const trimmed = value.replace(/\s+$/, "");
  return trimmed.trim() ? trimmed : null;
}

export function normalizeAdminRequiredText(value: unknown, field: string): string {
  const text = normalizeAdminText(value, field);
  if (!text) throw new AdminInputError(`${field} is required`);
  return text;
}

export function normalizeAdminUniverseId(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  throw new AdminInputError("universe_id must be a positive integer or null");
}
