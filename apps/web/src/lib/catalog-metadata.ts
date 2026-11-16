import type { Metadata } from "next";
import { catalogCodeCandidates } from "@/lib/catalog-code-candidates";
import type { CatalogPageContent } from "@/lib/catalog";
import { getCatalogPageContentByCodes } from "@/lib/catalog";
import { resolveCatalogImage } from "@/lib/catalog-image";
import { loadCatalogPreviewData } from "@/lib/catalog-preview-data";
import { catalogTitleCount } from "@/lib/catalog-title-count";
import { SITE_URL } from "@/lib/seo";

/** Apply the same count and cover to all three metadata title/image fields. */
export async function finalizeCatalogMetadata(metadata: Metadata, options: { catalog?: CatalogPageContent | null; count?: number; path?: string } = {}): Promise<Metadata> {
  const canonical = options.path ?? metadata.alternates?.canonical;
  if (typeof canonical !== "string" && !(canonical instanceof URL)) return metadata;
  const path = new URL(String(canonical), SITE_URL).pathname;
  if (!path.startsWith("/catalog/")) return metadata;
  const code = path.slice("/catalog/".length)
    .replace(/\/page\/\d+\/?$/, "")
    .split("/").map(decodeURIComponent).join("/");
  const catalog = options.catalog !== undefined ? options.catalog : await getCatalogPageContentByCodes(catalogCodeCandidates(code));
  // The total doesn't depend on the page. Reading page 1 keeps out-of-range
  // page numbers out of the loader, so the route's own 404 still decides them.
  const count = options.count ?? (await loadCatalogPreviewData(code, 1, false)).count;
  const counted = (title: unknown) => typeof title === "string" ? catalogTitleCount(title, count) : title;
  const title = counted(metadata.title) as Metadata["title"];
  const image = resolveCatalogImage(catalog ?? { code: code.split("/")[0] });
  return {
    ...metadata,
    title,
    openGraph: { ...metadata.openGraph, title: counted(metadata.openGraph?.title ?? title) as string, images: [image] },
    twitter: { ...metadata.twitter, card: "summary_large_image", title: counted(metadata.twitter?.title ?? title) as string, images: [image] }
  };
}
