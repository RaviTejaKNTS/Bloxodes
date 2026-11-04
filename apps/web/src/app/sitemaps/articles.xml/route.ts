import { buildSitemapUrlSetXml, toIsoDate, type SitemapUrlSetEntry, withSiteUrl } from "@/lib/sitemap";
import { listArticleGameSummaries } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type ArticleSitemapRow = {
  slug: string | null;
  updated_at: string | null;
};

export async function GET() {
  try {
    const sb = supabaseAdmin();
    const data: ArticleSitemapRow[] = [];
    for (let offset=0;;offset+=1000) {
      const result=await sb.from("published_articles_view").select("slug,updated_at").order("slug").range(offset,offset+999);
      if(result.error) throw result.error;
      data.push(...result.data);
      if(result.data.length<1000) break;
    }

    const [rows, articleGames] = [(data ?? []) as ArticleSitemapRow[], await listArticleGameSummaries()];
    const pages: SitemapUrlSetEntry[] = [];
    for (const game of articleGames) {
      pages.push({
        loc: withSiteUrl(`/articles/games/${game.slug}`),
        changefreq: "weekly",
        priority: game.articleCount > 1 ? "0.8" : "0.6",
        lastmod: toIsoDate(game.latestUpdatedAt)
      });
    }
    for (const row of rows) {
      if (!row.slug) continue;
      pages.push({
        loc: withSiteUrl(`/articles/${row.slug}`),
        changefreq: "weekly",
        priority: "0.9",
        lastmod: toIsoDate(row.updated_at)
      });
    }

    return new NextResponse(buildSitemapUrlSetXml(pages), {
      headers: { "content-type": "application/xml" }
    });
  } catch (error) {
    console.error("Failed to build articles sitemap", error);
    return new NextResponse(buildSitemapUrlSetXml([]), {
      headers: { "content-type": "application/xml" }
    });
  }
}
