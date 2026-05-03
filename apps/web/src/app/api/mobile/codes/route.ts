import { NextResponse } from "next/server";
import { getMobileCodesIndex } from "@/lib/mobile-codes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESPONSE_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=60, s-maxage=300"
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: RESPONSE_HEADERS
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const payload = await getMobileCodesIndex(searchParams);
    return NextResponse.json(payload, {
      headers: RESPONSE_HEADERS
    });
  } catch (error) {
    console.error("Failed to load mobile codes index", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to load Bloxodes codes"
      },
      {
        status: 500,
        headers: RESPONSE_HEADERS
      }
    );
  }
}
