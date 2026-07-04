import { NextResponse } from "next/server";
import { getQuizPageByCode, loadQuizData } from "@/lib/quizzes";

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

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const normalized = decodeURIComponent(code).trim().toLowerCase();

  try {
    const [page, quizData] = await Promise.all([getQuizPageByCode(normalized), loadQuizData(normalized)]);

    if (!page || !quizData) {
      return NextResponse.json(
        { ok: false, error: "Quiz not found" },
        { status: 404, headers: RESPONSE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        code: page.code,
        title: page.title,
        description: page.seo_description ?? page.description_md ?? null,
        universeName: page.universe?.display_name ?? page.universe?.name ?? null,
        coverImage: page.universe?.icon_url ?? null,
        quizData
      },
      { headers: RESPONSE_HEADERS }
    );
  } catch (error) {
    console.error(`Failed to load mobile quiz play data for ${normalized}`, error);
    return NextResponse.json(
      { ok: false, error: "Failed to load quiz" },
      { status: 500, headers: RESPONSE_HEADERS }
    );
  }
}
