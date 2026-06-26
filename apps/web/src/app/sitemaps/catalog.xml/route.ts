import { buildSitemapUrlSetXml, toIsoDate, type SitemapUrlSetEntry, withSiteUrl } from "@/lib/sitemap";
import { DECAL_CATEGORY_DEFINITIONS } from "@/lib/decal-id-categories";
import { buildAvatarCatalogPath, isAvatarCatalogCode } from "@/lib/roblox-avatar-catalog";
import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type CatalogSitemapRow = {
  code: string | null;
  updated_at: string | null;
  published_at: string | null;
  content_updated_at?: string | null;
};

export async function GET() {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("catalog_pages_view")
      .select("code, updated_at, published_at, content_updated_at")
      .eq("is_published", true)
      .not("code", "is", null)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    const rows = (data ?? []) as CatalogSitemapRow[];
    const pageMap = new Map<string, SitemapUrlSetEntry>();

    for (const row of rows) {
      const code = row.code?.trim();
      if (!code) continue;

      const path = isAvatarCatalogCode(code) ? buildAvatarCatalogPath(code) : `/catalog/${code}`;
      const updated = row.content_updated_at ?? row.updated_at ?? row.published_at;
      pageMap.set(path, {
        loc: withSiteUrl(path),
        changefreq: "weekly",
        priority: "0.9",
        lastmod: toIsoDate(updated)
      });

      if (code === "roblox-decal-ids") {
        pageMap.set("/catalog/roblox-decal-ids/curated", {
          loc: withSiteUrl("/catalog/roblox-decal-ids/curated"),
          changefreq: "weekly",
          priority: "0.85",
          lastmod: toIsoDate(updated)
        });
        pageMap.set("/catalog/roblox-decal-ids/categories", {
          loc: withSiteUrl("/catalog/roblox-decal-ids/categories"),
          changefreq: "weekly",
          priority: "0.85",
          lastmod: toIsoDate(updated)
        });
        for (const category of DECAL_CATEGORY_DEFINITIONS) {
          const categoryPath = `/catalog/roblox-decal-ids/categories/${category.slug}`;
          pageMap.set(categoryPath, {
            loc: withSiteUrl(categoryPath),
            changefreq: "weekly",
            priority: "0.8",
            lastmod: toIsoDate(updated)
          });
        }
      }
    }

    const pages = Array.from(pageMap.values()).sort((a, b) => a.loc.localeCompare(b.loc));

    return new NextResponse(buildSitemapUrlSetXml(pages), {
      headers: { "content-type": "application/xml" }
    });
  } catch (error) {
    console.error("Failed to build catalog sitemap", error);
    return new NextResponse(buildSitemapUrlSetXml([]), {
      headers: { "content-type": "application/xml" }
    });
  }
}
