import { NextResponse } from "next/server";
import { getMobileCodeDetail } from "@/lib/mobile-codes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESPONSE_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=60, s-maxage=300"
};

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: RESPONSE_HEADERS
  });
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const payload = await getMobileCodeDetail(slug);

    if (!payload) {
      return NextResponse.json(
        {
          ok: false,
          error: "Code page not found"
        },
        {
          status: 404,
          headers: RESPONSE_HEADERS
        }
      );
    }

    return NextResponse.json(payload, {
      headers: RESPONSE_HEADERS
    });
  } catch (error) {
    console.error("Failed to load mobile code detail", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to load Bloxodes code page"
      },
      {
        status: 500,
        headers: RESPONSE_HEADERS
      }
    );
  }
}
