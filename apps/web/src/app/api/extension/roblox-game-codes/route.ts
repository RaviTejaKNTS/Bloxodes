import { NextResponse } from "next/server";
import { getExtensionCodes } from "@/lib/extension-codes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=60, s-maxage=300"
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const payload = await getExtensionCodes({
      placeId: searchParams.get("placeId"),
      robloxUrl: searchParams.get("robloxUrl"),
      gameName: searchParams.get("gameName"),
      limit: searchParams.get("limit")
    });

    return NextResponse.json(payload, {
      headers: CORS_HEADERS
    });
  } catch (error) {
    console.error("Failed to load extension codes", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to load Bloxodes codes"
      },
      {
        status: 500,
        headers: CORS_HEADERS
      }
    );
  }
}
