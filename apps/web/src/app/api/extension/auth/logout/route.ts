import { NextResponse } from "next/server";
import { revokeAppSessionById } from "@/lib/auth/app-session";
import { getExtensionSession } from "@/lib/auth/extension-session";
import {
  extensionPrivateFallbackHeaders,
  extensionPrivateHeaders,
  isBloxodesExtensionRequest
} from "@/lib/extension-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const METHODS = "POST, OPTIONS";

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

    const session = await getExtensionSession(request);
    if (session) {
      await revokeAppSessionById(session.sessionId);
    }
    return NextResponse.json({ ok: true }, { headers });
  } catch (error) {
    console.error("Failed to log out extension session", error);
    return NextResponse.json(
      { ok: true },
      { headers: extensionPrivateFallbackHeaders(METHODS) }
    );
  }
}
