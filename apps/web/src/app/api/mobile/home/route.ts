import { NextResponse } from "next/server";
import { getMobileCodesIndex } from "@/lib/mobile-codes";
import { getMobileContentIndex, type MobileContentKind } from "@/lib/mobile-content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOME_SECTION_KINDS: MobileContentKind[] = ["events", "catalog", "wiki", "tools", "quizzes", "checklists"];
const HOME_SECTION_SIZE = 8;

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

export async function GET() {
  try {
    const sectionParams = new URLSearchParams({ page: "1", pageSize: String(HOME_SECTION_SIZE) });
    const [codes, ...sectionResults] = await Promise.all([
      getMobileCodesIndex(new URLSearchParams({ page: "1", pageSize: String(HOME_SECTION_SIZE) })),
      ...HOME_SECTION_KINDS.map((kind) =>
        getMobileContentIndex(kind, sectionParams).catch((error) => {
          console.error(`Failed to load mobile home section ${kind}`, error);
          return null;
        })
      )
    ]);

    return NextResponse.json(
      {
        ok: true,
        codes,
        sections: sectionResults.filter((section) => section !== null)
      },
      { headers: RESPONSE_HEADERS }
    );
  } catch (error) {
    console.error("Failed to load mobile home", error);
    return NextResponse.json(
      { ok: false, error: "Failed to load Bloxodes home" },
      { status: 500, headers: RESPONSE_HEADERS }
    );
  }
}
