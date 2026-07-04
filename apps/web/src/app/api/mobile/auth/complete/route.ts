import { NextResponse } from "next/server";
import { getCurrentAppSession } from "@/lib/auth/app-session";
import { createMobileHandoffCode, getMobileAppRedirectUri } from "@/lib/auth/mobile-session";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getRequestIp } from "@/lib/security/request";
import { resolvePublicOrigin } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

const COMPLETE_RATE_LIMIT = {
  limit: 30,
  windowMs: 60 * 1000
};
const LOGIN_PATH = "/auth/roblox/login";
const COMPLETE_PATH = "/api/mobile/auth/complete";

function withNoIndexHeaders(response: NextResponse) {
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export async function GET(request: Request) {
  const origin = resolvePublicOrigin(request.headers, new URL(request.url).origin);
  const ip = getRequestIp(request);
  const rateLimit = checkRateLimit({
    key: `mobile-auth-complete:${ip}`,
    ...COMPLETE_RATE_LIMIT
  });

  if (!rateLimit.allowed) {
    const response = NextResponse.redirect(`${getMobileAppRedirectUri()}?error=rate_limited`);
    response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
    return withNoIndexHeaders(response);
  }

  const session = await getCurrentAppSession();
  if (!session) {
    const loginUrl = `${origin}${LOGIN_PATH}?next=${encodeURIComponent(COMPLETE_PATH)}&source=${encodeURIComponent(COMPLETE_PATH)}`;
    return withNoIndexHeaders(NextResponse.redirect(loginUrl));
  }

  try {
    const code = createMobileHandoffCode(session.userId);
    return withNoIndexHeaders(NextResponse.redirect(`${getMobileAppRedirectUri()}?code=${encodeURIComponent(code)}`));
  } catch (error) {
    console.error("Failed to create mobile login handoff", error);
    return withNoIndexHeaders(NextResponse.redirect(`${getMobileAppRedirectUri()}?error=handoff_failed`));
  }
}
