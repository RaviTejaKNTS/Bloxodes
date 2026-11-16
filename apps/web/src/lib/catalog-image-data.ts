import type { CatalogPageContent } from "@/lib/catalog";
import { catalogImageType } from "@/lib/catalog-image";
import { supabaseAdmin } from "@/lib/supabase";
import { pickWikiThumbnail } from "@/lib/wiki-images";
import { loadCatalogPreviewData } from "@/lib/catalog-preview-data";

export async function loadCatalogImageData(page: CatalogPageContent) {
  const type = catalogImageType(page.code.replace(/^roblox-free-items(?=\/|$)/, "free-roblox-items"));
  const data = await loadCatalogPreviewData(page.code.replace(/^roblox-free-items(?=\/|$)/, "free-roblox-items"), 1, true);
  let background: string | null = null;
  let universeId = page.universe_id;
  if (type === "game" && !universeId) {
    // Older catalog rows have no owner. Match editorial game slugs, never stats slugs.
    const slug = page.code.split("/")[2];
    for (const table of ["wiki_pages", "code_pages"] as const) {
      const { data: owner, error } = await supabaseAdmin().from(table)
        .select("universe_id").eq("slug", slug).eq("is_published", true).limit(1).maybeSingle();
      if (error) throw error;
      if (owner?.universe_id) { universeId = owner.universe_id; break; }
    }
  }
  if (type === "game" && universeId) {
    const { data: universe, error } = await supabaseAdmin().from("roblox_universes")
      .select("thumbnail_urls").eq("universe_id", universeId).maybeSingle();
    if (error) throw error;
    background = pickWikiThumbnail(universe?.thumbnail_urls);
  }
  return { ...data, background, type };
}
