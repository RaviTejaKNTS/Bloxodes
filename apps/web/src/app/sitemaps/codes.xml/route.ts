import { buildSitemapUrlSetXml, toIsoDate, type SitemapUrlSetEntry, withSiteUrl } from "@/lib/sitemap";
import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type GameSitemapRow = {
  slug: string | null;
  updated_at: string | null;
  content_updated_at?: string | null;
};

const CODES_SITEMAP_BATCH_SIZE = 1000;
const CODES_SITEMAP_MAX_URLS = 50_000;

async function listCodeSitemapRows(): Promise<GameSitemapRow[]> {
  const sb = supabaseAdmin();
  const rows: GameSitemapRow[] = [];

  for (let offset = 0; offset < CODES_SITEMAP_MAX_URLS; offset += CODES_SITEMAP_BATCH_SIZE) {
    const { data, error } = await sb
      .from("code_pages_index_view")
      .select("slug, updated_at, content_updated_at")
      .eq("is_published", true)
      .not("slug", "is", null)
      .order("updated_at", { ascending: false })
      .range(offset, offset + CODES_SITEMAP_BATCH_SIZE - 1);

    if (error) throw error;

    const batch = (data ?? []) as GameSitemapRow[];
    rows.push(...batch);
    if (batch.length < CODES_SITEMAP_BATCH_SIZE) break;
  }

  return rows.slice(0, CODES_SITEMAP_MAX_URLS);
}

export async function GET() {
  try {
    const rows = await listCodeSitemapRows();
    const pages: SitemapUrlSetEntry[] = [];
    for (const row of rows) {
      if (!row.slug) continue;
      const lastmod = toIsoDate(row.content_updated_at ?? row.updated_at);
      pages.push({
        loc: withSiteUrl(`/codes/${row.slug}`),
        changefreq: "weekly",
        priority: "0.7",
        lastmod
      });
    }

    return new NextResponse(buildSitemapUrlSetXml(pages), {
      headers: { "content-type": "application/xml" }
    });
  } catch (error) {
    console.error("Failed to build codes sitemap", error);
    return new NextResponse(buildSitemapUrlSetXml([]), {
      headers: { "content-type": "application/xml" }
    });
  }
}
