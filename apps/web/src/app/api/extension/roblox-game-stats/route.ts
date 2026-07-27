import { NextResponse } from "next/server";
import { normalizeRobloxPlaceId } from "@/lib/extension-codes-utils";
import { getExtensionGameStats } from "@/lib/extension-stats";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getRequestIp } from "@/lib/security/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DISCOVERY_RATE_LIMIT = {
  limit: 20,
  windowMs: 60 * 60 * 1000
};

const PUBLIC_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Bloxodes-Extension",
  "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=1800",
  "X-Robots-Tag": "noindex, nofollow"
};

const PRIVATE_HEADERS = {
  ...PUBLIC_HEADERS,
  "Cache-Control": "private, no-store, max-age=0"
};

function isExtensionDiscoveryRequest(request: Request): boolean {
  const client = request.headers.get("x-bloxodes-extension")?.trim();
  if (!client?.startsWith("Bloxodes/")) return false;

  const origin = request.headers.get("origin")?.trim();
  if (!origin) return true;
  return /^chrome-extension:\/\/[a-p]{32}$/i.test(origin);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: PUBLIC_HEADERS
  });
}

export async function GET(request: Request) {
  try {
    const placeId = normalizeRobloxPlaceId(new URL(request.url).searchParams.get("placeId"));
    if (!placeId) {
      return NextResponse.json(
        { ok: false, error: "Invalid Roblox place ID" },
        { status: 400, headers: PUBLIC_HEADERS }
      );
    }

    return NextResponse.json(await getExtensionGameStats(placeId), {
      headers: PUBLIC_HEADERS
    });
  } catch (error) {
    console.error("Failed to load extension game stats", error);
    return NextResponse.json(
      { ok: false, error: "Failed to load Bloxodes player history" },
      { status: 500, headers: PRIVATE_HEADERS }
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!isExtensionDiscoveryRequest(request)) {
      return NextResponse.json(
        { ok: false, error: "Invalid extension request" },
        { status: 403, headers: PRIVATE_HEADERS }
      );
    }

    const rateLimit = checkRateLimit({
      key: `extension-stats-discovery:${getRequestIp(request)}`,
      ...DISCOVERY_RATE_LIMIT
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { ok: false, error: "Too many game discovery requests" },
        {
          status: 429,
          headers: {
            ...PRIVATE_HEADERS,
            "Retry-After": String(rateLimit.retryAfterSeconds)
          }
        }
      );
    }

    const body = (await request.json()) as { placeId?: unknown };
    const placeId = normalizeRobloxPlaceId(
      typeof body.placeId === "string" || typeof body.placeId === "number"
        ? body.placeId
        : null
    );
    if (!placeId) {
      return NextResponse.json(
        { ok: false, error: "Invalid Roblox place ID" },
        { status: 400, headers: PRIVATE_HEADERS }
      );
    }

    return NextResponse.json(
      await getExtensionGameStats(placeId, { discover: true }),
      { headers: PRIVATE_HEADERS }
    );
  } catch (error) {
    console.error("Failed to discover extension game stats", error);
    return NextResponse.json(
      { ok: false, error: "Failed to start Bloxodes player tracking" },
      { status: 500, headers: PRIVATE_HEADERS }
    );
  }
}
