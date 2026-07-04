import { NextResponse } from "next/server";
import { getMobileSessionUser } from "@/lib/auth/mobile-session";
import { mobileCredentialedFallbackHeaders, mobileCredentialedHeaders } from "@/lib/mobile-api-cors";

export const dynamic = "force-dynamic";

const METHODS = "GET, OPTIONS";

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: mobileCredentialedHeaders(request, METHODS)
  });
}

export async function GET(request: Request) {
  try {
    const user = await getMobileSessionUser(request);
    return NextResponse.json(
      {
        ok: true,
        user
      },
      { headers: mobileCredentialedHeaders(request, METHODS) }
    );
  } catch (error) {
    console.error("Failed to load mobile auth session", error);
    return NextResponse.json(
      { ok: true, user: null },
      { headers: mobileCredentialedFallbackHeaders(METHODS) }
    );
  }
}
