import { NextResponse } from "next/server";
import {
  loadUserCodeProgress,
  normalizeCodeProgressSlug,
  normalizeCodeProgressValue,
  normalizeUsedCodes,
  saveUserCodeProgress,
  updateUserCodeProgress
} from "@/lib/code-progress";
import { getExtensionSessionUser } from "@/lib/auth/extension-session";
import {
  extensionPrivateFallbackHeaders,
  extensionPrivateHeaders,
  isBloxodesExtensionRequest
} from "@/lib/extension-api";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getRequestIp } from "@/lib/security/request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const METHODS = "GET, PUT, PATCH, OPTIONS";
const PROGRESS_RATE_LIMIT = {
  limit: 120,
  windowMs: 60 * 1000
};

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: extensionPrivateHeaders(request, METHODS)
  });
}

async function authorize(request: Request) {
  if (!isBloxodesExtensionRequest(request)) {
    return { error: "Invalid extension client.", status: 403, user: null };
  }

  const user = await getExtensionSessionUser(request);
  if (!user) {
    return { error: "Unauthorized", status: 401, user: null };
  }

  const ip = getRequestIp(request);
  const rateLimit = checkRateLimit({
    key: `extension-code-progress:${user.id}:${ip}`,
    ...PROGRESS_RATE_LIMIT
  });
  if (!rateLimit.allowed) {
    return {
      error: "Too many progress updates. Please try again shortly.",
      status: 429,
      user: null,
      retryAfterSeconds: rateLimit.retryAfterSeconds
    };
  }

  return { error: null, status: 200, user };
}

export async function GET(request: Request) {
  const headers = extensionPrivateHeaders(request, METHODS);
  try {
    const authorization = await authorize(request);
    if (!authorization.user) {
      return NextResponse.json(
        { error: authorization.error },
        {
          status: authorization.status,
          headers: authorization.retryAfterSeconds
            ? { ...headers, "Retry-After": String(authorization.retryAfterSeconds) }
            : headers
        }
      );
    }

    const slug = normalizeCodeProgressSlug(new URL(request.url).searchParams.get("slug"));
    if (!slug) {
      return NextResponse.json({ error: "Game slug is required." }, { status: 400, headers });
    }

    const usedCodes = await loadUserCodeProgress(authorization.user.id, slug);
    return NextResponse.json({ usedCodes }, { headers });
  } catch (error) {
    console.error("Failed to load extension code progress", error);
    return NextResponse.json(
      { error: "Unable to load code progress." },
      { status: 500, headers: extensionPrivateFallbackHeaders(METHODS) }
    );
  }
}

export async function PUT(request: Request) {
  const headers = extensionPrivateHeaders(request, METHODS);
  try {
    const authorization = await authorize(request);
    if (!authorization.user) {
      return NextResponse.json(
        { error: authorization.error },
        {
          status: authorization.status,
          headers: authorization.retryAfterSeconds
            ? { ...headers, "Retry-After": String(authorization.retryAfterSeconds) }
            : headers
        }
      );
    }

    const payload = await request.json().catch(() => ({}));
    const slug = normalizeCodeProgressSlug(payload?.slug);
    if (!slug) {
      return NextResponse.json({ error: "Game slug is required." }, { status: 400, headers });
    }

    const usedCodes = await saveUserCodeProgress(
      authorization.user.id,
      slug,
      normalizeUsedCodes(payload?.usedCodes)
    );
    return NextResponse.json({ usedCodes }, { headers });
  } catch (error) {
    console.error("Failed to save extension code progress", error);
    return NextResponse.json(
      { error: "Unable to save code progress." },
      { status: 500, headers: extensionPrivateFallbackHeaders(METHODS) }
    );
  }
}

export async function PATCH(request: Request) {
  const headers = extensionPrivateHeaders(request, METHODS);
  try {
    const authorization = await authorize(request);
    if (!authorization.user) {
      return NextResponse.json(
        { error: authorization.error },
        {
          status: authorization.status,
          headers: authorization.retryAfterSeconds
            ? { ...headers, "Retry-After": String(authorization.retryAfterSeconds) }
            : headers
        }
      );
    }

    const payload = await request.json().catch(() => ({}));
    const slug = normalizeCodeProgressSlug(payload?.slug);
    const code = normalizeCodeProgressValue(payload?.code);
    const used = typeof payload?.used === "boolean" ? payload.used : null;
    if (!slug || !code || used === null) {
      return NextResponse.json(
        { error: "Game slug, code, and used state are required." },
        { status: 400, headers }
      );
    }

    const usedCodes = await updateUserCodeProgress({
      userId: authorization.user.id,
      gameSlug: slug,
      code,
      used
    });
    return NextResponse.json({ usedCodes }, { headers });
  } catch (error) {
    console.error("Failed to update extension code progress", error);
    return NextResponse.json(
      { error: "Unable to update code progress." },
      { status: 500, headers: extensionPrivateFallbackHeaders(METHODS) }
    );
  }
}
