import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session-user";

export const dynamic = "force-dynamic";

function responseHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "private, no-store, max-age=0"
  };
}

const FALLBACK_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "private, no-store, max-age=0"
};

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: responseHeaders(request)
  });
}

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    return NextResponse.json(
      {
        userId: user?.id ?? null
      },
      { headers: responseHeaders(request) }
    );
  } catch (error) {
    console.error("Failed to load mobile codes session", error);
    return NextResponse.json(
      {
        userId: null
      },
      { headers: FALLBACK_HEADERS }
    );
  }
}
