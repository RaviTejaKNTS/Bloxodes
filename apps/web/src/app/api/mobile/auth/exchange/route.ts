import { NextResponse } from "next/server";
import { createAppSession } from "@/lib/auth/app-session";
import { consumeMobileHandoffCode, getSessionUserById } from "@/lib/auth/mobile-session";
import { mobileCredentialedFallbackHeaders, mobileCredentialedHeaders } from "@/lib/mobile-api-cors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getRequestIp } from "@/lib/security/request";

export const dynamic = "force-dynamic";

const EXCHANGE_RATE_LIMIT = {
  limit: 20,
  windowMs: 60 * 1000
};

const METHODS = "POST, OPTIONS";

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: mobileCredentialedHeaders(request, METHODS)
  });
}

export async function POST(request: Request) {
  const headers = mobileCredentialedHeaders(request, METHODS);
  try {
    const ip = getRequestIp(request);
    const rateLimit = checkRateLimit({
      key: `mobile-auth-exchange:${ip}`,
      ...EXCHANGE_RATE_LIMIT
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { ok: false, error: "Too many attempts. Please try again shortly." },
        { status: 429, headers: { ...headers, "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }

    const payload = await request.json().catch(() => ({}));
    const code = typeof payload?.code === "string" ? payload.code.trim() : "";
    const handoff = consumeMobileHandoffCode(code);

    if (!handoff) {
      return NextResponse.json(
        { ok: false, error: "Invalid or expired login code." },
        { status: 401, headers }
      );
    }

    const user = await getSessionUserById(handoff.userId);
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "User account not found." },
        { status: 401, headers }
      );
    }

    const session = await createAppSession(handoff.userId, request.headers.get("user-agent"), {
      loginSourcePath: "/api/mobile/auth/exchange",
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
    console.error("Failed to exchange mobile login code", error);
    return NextResponse.json(
      { ok: false, error: "Unable to complete sign-in." },
      { status: 500, headers: mobileCredentialedFallbackHeaders(METHODS) }
    );
  }
}
