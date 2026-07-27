import "server-only";
import crypto from "crypto";
import { getAppSessionFromToken } from "@/lib/auth/app-session";
import { getSessionUserById } from "@/lib/auth/mobile-session";

const HANDOFF_VERSION = 1;
const HANDOFF_AUDIENCE = "bloxodes-extension";
const HANDOFF_TTL_SECONDS = 120;
const EXTENSION_REDIRECT_PATH = "/bloxodes-auth";
const EXTENSION_ID_PATTERN = /^[a-p]{32}$/;
const EXTENSION_STATE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

type ExtensionHandoffPayload = {
  v: number;
  aud: string;
  uid: string;
  rid: string;
  n: string;
  iat: number;
  exp: number;
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

export function normalizeExtensionRedirectUri(value: unknown): string | null {
  if (typeof value !== "string") return null;

  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  const extensionId = hostname.endsWith(".chromiumapp.org")
    ? hostname.slice(0, -".chromiumapp.org".length)
    : "";

  if (
    parsed.protocol !== "https:" ||
    !EXTENSION_ID_PATTERN.test(extensionId) ||
    parsed.pathname !== EXTENSION_REDIRECT_PATH ||
    parsed.port ||
    parsed.username ||
    parsed.password
  ) {
    return null;
  }

  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

export function normalizeExtensionAuthState(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return EXTENSION_STATE_PATTERN.test(trimmed) ? trimmed : null;
}

export function createExtensionHandoffCode(userId: string, redirectUri: string): string {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error("AUTH_SESSION_SECRET is required for extension login handoff.");
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: ExtensionHandoffPayload = {
    v: HANDOFF_VERSION,
    aud: HANDOFF_AUDIENCE,
    uid: userId,
    rid: redirectUri,
    n: crypto.randomBytes(16).toString("base64url"),
    iat: now,
    exp: now + HANDOFF_TTL_SECONDS
  };
  const payloadPart = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadPart}.${signPayload(payloadPart, secret)}`;
}

export function consumeExtensionHandoffCode(
  code: string | null | undefined,
  redirectUri: string
): { userId: string } | null {
  if (!code) return null;
  const [payloadPart, signaturePart] = code.split(".");
  if (!payloadPart || !signaturePart) return null;

  const secret = getSessionSecret();
  if (!secret) return null;

  const expectedSignature = signPayload(payloadPart, secret);
  let providedSignature: Buffer;
  let expectedSignatureBuffer: Buffer;
  try {
    providedSignature = Buffer.from(signaturePart, "base64url");
    expectedSignatureBuffer = Buffer.from(expectedSignature, "base64url");
  } catch {
    return null;
  }

  if (
    providedSignature.length !== expectedSignatureBuffer.length ||
    !crypto.timingSafeEqual(providedSignature, expectedSignatureBuffer)
  ) {
    return null;
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!decoded || typeof decoded !== "object") return null;

  const candidate = decoded as Partial<ExtensionHandoffPayload>;
  if (
    candidate.v !== HANDOFF_VERSION ||
    candidate.aud !== HANDOFF_AUDIENCE ||
    typeof candidate.uid !== "string" ||
    typeof candidate.rid !== "string" ||
    candidate.rid !== redirectUri ||
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

export async function getExtensionSession(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = /^Bearer\s+(.+)$/i.exec(authorization?.trim() ?? "")?.[1]?.trim() ?? null;
  return getAppSessionFromToken(token);
}

export async function getExtensionSessionUser(request: Request) {
  const session = await getExtensionSession(request);
  if (!session) return null;
  return getSessionUserById(session.userId);
}
