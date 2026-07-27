import { NextResponse } from "next/server";
import { getExtensionSessionUser } from "@/lib/auth/extension-session";
import {
  extensionPrivateFallbackHeaders,
  extensionPrivateHeaders,
  isBloxodesExtensionRequest
} from "@/lib/extension-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const METHODS = "GET, OPTIONS";

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: extensionPrivateHeaders(request, METHODS)
  });
}

export async function GET(request: Request) {
  const headers = extensionPrivateHeaders(request, METHODS);
  try {
    if (!isBloxodesExtensionRequest(request)) {
      return NextResponse.json({ ok: false, error: "Invalid extension client." }, { status: 403, headers });
    }

    const user = await getExtensionSessionUser(request);
    return NextResponse.json({ ok: true, user }, { headers });
  } catch (error) {
    console.error("Failed to load extension auth session", error);
    return NextResponse.json(
      { ok: true, user: null },
      { headers: extensionPrivateFallbackHeaders(METHODS) }
    );
  }
}
