import "server-only";
import crypto from "crypto";
import { getAppSessionFromToken } from "@/lib/auth/app-session";
import { getSessionUser, type SessionUser } from "@/lib/auth/session-user";
import { supabaseAdmin } from "@/lib/supabase";

const HANDOFF_VERSION = 1;
const HANDOFF_TTL_SECONDS = 120;
const MOBILE_APP_REDIRECT_URI = "bloxodes://auth";

type HandoffPayload = {
  v: number;
  uid: string;
  n: string;
  iat: number;
  exp: number;
};

type AppUserRow = {
  user_id: string;
  role: string | null;
  display_name: string | null;
  roblox_user_id: number | string | null;
  roblox_username: string | null;
  roblox_display_name: string | null;
  roblox_avatar_url: string | null;
  roblox_profile_url: string | null;
};

const consumedHandoffNonces = new Map<string, number>();

function getSessionSecret(): string | null {
  const secret = process.env.AUTH_SESSION_SECRET?.trim();
  return secret && secret.length > 0 ? secret : null;
}

function signPayload(payloadPart: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payloadPart).digest("base64url");
}

function pruneConsumedNonces(now: number) {
  for (const [nonce, expiresAt] of consumedHandoffNonces) {
    if (expiresAt <= now) {
      consumedHandoffNonces.delete(nonce);
    }
  }
}

export function getMobileAppRedirectUri(): string {
  return MOBILE_APP_REDIRECT_URI;
}

export function createMobileHandoffCode(userId: string): string {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error("AUTH_SESSION_SECRET is required for mobile login handoff.");
  }
  const now = Math.floor(Date.now() / 1000);
  const payload: HandoffPayload = {
    v: HANDOFF_VERSION,
    uid: userId,
    n: crypto.randomBytes(16).toString("base64url"),
    iat: now,
    exp: now + HANDOFF_TTL_SECONDS
  };
  const payloadPart = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadPart}.${signPayload(payloadPart, secret)}`;
}

export function consumeMobileHandoffCode(code: string | null | undefined): { userId: string } | null {
  if (!code) return null;
  const [payloadPart, signaturePart] = code.split(".");
  if (!payloadPart || !signaturePart) return null;

  const secret = getSessionSecret();
  if (!secret) return null;

  const expectedSignature = signPayload(payloadPart, secret);
  let providedBuf: Buffer;
  let expectedBuf: Buffer;
  try {
    providedBuf = Buffer.from(signaturePart, "base64url");
    expectedBuf = Buffer.from(expectedSignature, "base64url");
  } catch {
    return null;
  }
  if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return null;
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!decoded || typeof decoded !== "object") return null;

  const candidate = decoded as Partial<HandoffPayload>;
  if (
    candidate.v !== HANDOFF_VERSION ||
    typeof candidate.uid !== "string" ||
    typeof candidate.n !== "string" ||
    typeof candidate.exp !== "number"
  ) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (candidate.exp <= now) return null;

  pruneConsumedNonces(now);
  if (consumedHandoffNonces.has(candidate.n)) return null;
  consumedHandoffNonces.set(candidate.n, candidate.exp);

  return { userId: candidate.uid };
}

function normalizeRole(value: unknown): "admin" | "user" {
  return value === "admin" ? "admin" : "user";
}

function normalizeRobloxUserId(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isSafeInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

function mapAppUserRow(row: AppUserRow): SessionUser {
  return {
    id: row.user_id,
    role: normalizeRole(row.role),
    display_name: row.display_name ?? null,
    roblox_user_id: normalizeRobloxUserId(row.roblox_user_id),
    roblox_username: row.roblox_username ?? null,
    roblox_display_name: row.roblox_display_name ?? null,
    roblox_avatar_url: row.roblox_avatar_url ?? null,
    roblox_profile_url: row.roblox_profile_url ?? null
  };
}

export async function getSessionUserById(userId: string): Promise<SessionUser | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("app_users")
    .select(
      "user_id, role, display_name, roblox_user_id, roblox_username, roblox_display_name, roblox_avatar_url, roblox_profile_url"
    )
    .eq("user_id", userId)
    .maybeSingle<AppUserRow>();

  if (error || !data) return null;
  return mapAppUserRow(data);
}

export function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

export async function getMobileSession(request: Request) {
  const token = readBearerToken(request);
  if (!token) return null;
  return getAppSessionFromToken(token);
}

export async function getMobileSessionUser(request: Request): Promise<SessionUser | null> {
  const session = await getMobileSession(request);
  if (session) {
    return getSessionUserById(session.userId);
  }
  return getSessionUser();
}
