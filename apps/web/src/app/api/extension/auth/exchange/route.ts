import { NextResponse } from "next/server";
import { createAppSession } from "@/lib/auth/app-session";
import {
  consumeExtensionHandoffCode,
  normalizeExtensionRedirectUri
} from "@/lib/auth/extension-session";
import { getSessionUserById } from "@/lib/auth/mobile-session";
import {
  extensionPrivateFallbackHeaders,
  extensionPrivateHeaders,
  isBloxodesExtensionRequest
} from "@/lib/extension-api";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getRequestIp } from "@/lib/security/request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const METHODS = "POST, OPTIONS";
const EXCHANGE_RATE_LIMIT = {
  limit: 20,
  windowMs: 60 * 1000
};

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: extensionPrivateHeaders(request, METHODS)
  });
}

export async function POST(request: Request) {
  const headers = extensionPrivateHeaders(request, METHODS);
  try {
    if (!isBloxodesExtensionRequest(request)) {
      return NextResponse.json({ ok: false, error: "Invalid extension client." }, { status: 403, headers });
    }

    const ip = getRequestIp(request);
    const rateLimit = checkRateLimit({
      key: `extension-auth-exchange:${ip}`,
      ...EXCHANGE_RATE_LIMIT
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { ok: false, error: "Too many attempts. Please try again shortly." },
        { status: 429, headers: { ...headers, "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }

    const payload = await request.json().catch(() => ({}));
    const redirectUri = normalizeExtensionRedirectUri(payload?.redirectUri);
    const code = typeof payload?.code === "string" ? payload.code.trim() : "";
    if (!redirectUri) {
      return NextResponse.json({ ok: false, error: "Invalid extension redirect." }, { status: 400, headers });
    }

    const handoff = consumeExtensionHandoffCode(code, redirectUri);
    if (!handoff) {
      return NextResponse.json(
        { ok: false, error: "Invalid or expired login code." },
        { status: 401, headers }
      );
    }

    const user = await getSessionUserById(handoff.userId);
    if (!user) {
      return NextResponse.json({ ok: false, error: "User account not found." }, { status: 401, headers });
    }

    const session = await createAppSession(handoff.userId, request.headers.get("user-agent"), {
      loginSourcePath: "/api/extension/auth/exchange",
      loginReturnPath: null
    });

    return NextResponse.json(
      {
        ok: true,
        token: session.token,
        expiresAt: session.expiresAt,
        user
      },
      { headers }
    );
  } catch (error) {
    console.error("Failed to exchange extension login code", error);
    return NextResponse.json(
      { ok: false, error: "Unable to complete sign-in." },
      { status: 500, headers: extensionPrivateFallbackHeaders(METHODS) }
    );
  }
}
