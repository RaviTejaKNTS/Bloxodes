import { NextResponse } from "next/server";
import { revokeAppSessionById } from "@/lib/auth/app-session";
import { getMobileSession } from "@/lib/auth/mobile-session";
import { mobileCredentialedFallbackHeaders, mobileCredentialedHeaders } from "@/lib/mobile-api-cors";

export const dynamic = "force-dynamic";

const METHODS = "POST, OPTIONS";

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: mobileCredentialedHeaders(request, METHODS)
  });
}

export async function POST(request: Request) {
  try {
    const session = await getMobileSession(request);
    if (session) {
      await revokeAppSessionById(session.sessionId);
    }
    return NextResponse.json({ ok: true }, { headers: mobileCredentialedHeaders(request, METHODS) });
  } catch (error) {
    console.error("Failed to log out mobile session", error);
    return NextResponse.json({ ok: true }, { headers: mobileCredentialedFallbackHeaders(METHODS) });
  }
}
