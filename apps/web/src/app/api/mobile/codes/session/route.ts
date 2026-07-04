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
        userId: user?.id ?? null
      },
      { headers: mobileCredentialedHeaders(request, METHODS) }
    );
  } catch (error) {
    console.error("Failed to load mobile codes session", error);
    return NextResponse.json(
      {
        userId: null
      },
      { headers: mobileCredentialedFallbackHeaders(METHODS) }
    );
  }
}
