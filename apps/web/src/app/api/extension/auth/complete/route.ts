import { NextResponse } from "next/server";
import { getCurrentAppSession } from "@/lib/auth/app-session";
import {
  createExtensionHandoffCode,
  normalizeExtensionAuthState,
  normalizeExtensionRedirectUri
} from "@/lib/auth/extension-session";
import { resolvePublicOrigin } from "@/lib/request-origin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getRequestIp } from "@/lib/security/request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const COMPLETE_PATH = "/api/extension/auth/complete";
const COMPLETE_RATE_LIMIT = {
  limit: 30,
  windowMs: 60 * 1000
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function htmlResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
    }
  });
}

function renderPage(params: {
  title: string;
  body: string;
}) {
  return `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(params.title)}</title>
        <style>
          :root { color-scheme: light dark; font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
          * { box-sizing: border-box; }
          body { align-items: center; background: #f6f7fb; color: #20263c; display: flex; justify-content: center; margin: 0; min-height: 100vh; padding: 24px; }
          main { background: #fff; border: 1px solid #dfe2ee; border-radius: 14px; box-shadow: 0 18px 50px rgb(32 38 60 / 12%); max-width: 440px; padding: 28px; width: 100%; }
          h1 { font-size: 24px; line-height: 1.2; margin: 0; }
          p { color: #626b86; font-size: 14px; line-height: 1.6; margin: 12px 0 0; }
          @media (prefers-color-scheme: dark) {
            body { background: #1f2127; color: #f1f3f7; }
            main { background: #2f323b; border-color: rgb(255 255 255 / 14%); }
            p { color: #b8becd; }
          }
        </style>
      </head>
      <body>
        <main>
          <h1>${escapeHtml(params.title)}</h1>
          <p>${escapeHtml(params.body)}</p>
        </main>
      </body>
    </html>`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirectUri = normalizeExtensionRedirectUri(url.searchParams.get("redirectUri"));
  const state = normalizeExtensionAuthState(url.searchParams.get("state"));

  if (!redirectUri || !state) {
    return htmlResponse(
      renderPage({
        title: "Invalid extension login",
        body: "Return to the Bloxodes extension and start sign-in again."
      }),
      400
    );
  }

  const ip = getRequestIp(request);
  const rateLimit = checkRateLimit({
    key: `extension-auth-complete:${ip}`,
    ...COMPLETE_RATE_LIMIT
  });
  if (!rateLimit.allowed) {
    return htmlResponse(
      renderPage({
        title: "Too many sign-in attempts",
        body: "Wait a moment, then start sign-in again from the extension."
      }),
      429
    );
  }

  const session = await getCurrentAppSession();
  if (!session) {
    const origin = resolvePublicOrigin(request.headers, url.origin);
    const completeParams = new URLSearchParams({ redirectUri, state });
    const nextPath = `${COMPLETE_PATH}?${completeParams.toString()}`;
    const loginUrl = new URL("/auth/roblox/login", origin);
    loginUrl.searchParams.set("next", nextPath);
    loginUrl.searchParams.set("source", COMPLETE_PATH);
    const response = NextResponse.redirect(loginUrl);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }

  try {
    const code = createExtensionHandoffCode(session.userId, redirectUri);
    const destination = new URL(redirectUri);
    destination.searchParams.set("code", code);
    destination.searchParams.set("state", state);
    return NextResponse.redirect(destination, 303);
  } catch (error) {
    console.error("Failed to create extension login handoff", error);
    return htmlResponse(
      renderPage({
        title: "Unable to connect extension",
        body: "Return to the extension and try signing in again."
      }),
      500
    );
  }
}
