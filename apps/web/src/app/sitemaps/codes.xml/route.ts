import { buildSitemapUrlSetXml, toIsoDate, type SitemapUrlSetEntry, withSiteUrl } from "@/lib/sitemap";
import { listCodePageSitemapDates, type CodePageSitemapDates } from "@/lib/db";
import { resolveCodePageModifiedAt } from "@/lib/code-content-dates";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const CODES_SITEMAP_BATCH_SIZE = 1000;
const CODES_SITEMAP_MAX_URLS = 50_000;

async function listCodeSitemapRows(): Promise<CodePageSitemapDates[]> {
  const rows: CodePageSitemapDates[] = [];

  for (let offset = 0; offset < CODES_SITEMAP_MAX_URLS; offset += CODES_SITEMAP_BATCH_SIZE) {
    const batch = await listCodePageSitemapDates(offset, CODES_SITEMAP_BATCH_SIZE);
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
      const lastmod = toIsoDate(resolveCodePageModifiedAt(row, row.codes ?? []));
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
