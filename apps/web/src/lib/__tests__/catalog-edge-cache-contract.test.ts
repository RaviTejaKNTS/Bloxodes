import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CACHEABLE_CATALOG_ROUTES = [
  new URL("../../app/(site)/catalog/roblox-music-ids/page.tsx", import.meta.url),
  new URL("../../app/(site)/catalog/roblox-music-ids/page/[page]/page.tsx", import.meta.url),
  new URL("../../app/(site)/catalog/roblox-decal-ids/page.tsx", import.meta.url),
  new URL("../../app/(site)/catalog/roblox-decal-ids/page/[page]/page.tsx", import.meta.url),
  new URL("../../app/(site)/catalog/roblox-decal-ids/curated/page.tsx", import.meta.url),
  new URL("../../app/(site)/catalog/roblox-decal-ids/curated/page/[page]/page.tsx", import.meta.url),
  new URL("../../app/(site)/catalog/roblox-decal-ids/categories/[category]/page.tsx", import.meta.url),
  new URL(
    "../../app/(site)/catalog/roblox-decal-ids/categories/[category]/page/[page]/page.tsx",
    import.meta.url
  )
];

const CLIENT_BROWSERS = [
  {
    path: new URL("../../app/(site)/catalog/roblox-music-ids/MusicIdsBrowser.tsx", import.meta.url),
    apiPath: "/api/roblox-music-ids"
  },
  {
    path: new URL("../../app/(site)/catalog/roblox-decal-ids/DecalIdsBrowser.tsx", import.meta.url),
    apiPath: "/api/roblox-decal-ids"
  }
];

const ON_DEMAND_ISR_ROUTES = CACHEABLE_CATALOG_ROUTES.filter((path) => path.pathname.includes("["));

describe("catalog edge-cache contracts", () => {
  it.each(CACHEABLE_CATALOG_ROUTES)("%s stays eligible for public ISR caching", (path) => {
    const source = readFileSync(path, "utf8");

    expect(source).toContain("export const revalidate = 21600");
    expect(source).not.toContain("searchParams");
    expect(source).not.toContain('dynamic = "force-dynamic"');
    expect(source).not.toContain("cookies(");
    expect(source).not.toContain("headers(");
  });

  it.each(ON_DEMAND_ISR_ROUTES)("%s opts dynamic path segments into on-demand ISR", (path) => {
    const source = readFileSync(path, "utf8");

    expect(source).toContain("export async function generateStaticParams()");
    expect(source).toContain("return []");
  });

  it.each(CLIENT_BROWSERS)("$path keeps URL filters behind a Suspense-backed API browser", ({ path, apiPath }) => {
    const source = readFileSync(path, "utf8");

    expect(source).toContain("<Suspense fallback=");
    expect(source).toContain("useSearchParams()");
    expect(source).toContain(`fetch(\`${apiPath}?`);
    // Cards sit in fixed slots so a client page change never moves the boundaries beside ads.
    expect(source).toContain("<CatalogStableItems slots={");
  });

  it("keeps failed API requests from replacing the current cards", () => {
    for (const { path } of CLIENT_BROWSERS) {
      const source = readFileSync(path, "utf8");
      expect(source).toContain("if (!res.ok)");
      expect(source).toContain("if (!payload.ok)");
      const catchBlock = source.slice(source.indexOf(".catch((err: Error)"), source.indexOf(".finally("));
      expect(catchBlock).toContain("setError(");
      expect(catchBlock).not.toContain("setSongs(");
      expect(catchBlock).not.toContain("setDecals(");
    }
  });

  it("keeps the seeder and both collectors wired to their guarded date helpers", () => {
    const scripts = new URL("../../../../../scripts/", import.meta.url);
    const seeder = readFileSync(new URL("catalog/seed-catalog-pages.ts", scripts), "utf8");
    expect(seeder).toContain("await preserveCatalogPublicationDates(sb, rows)");
    expect(seeder).toContain('.upsert(publicationRows, { onConflict: "code" })');
    expect(seeder).not.toContain("published_at: options.draft ? null : new Date()");
    for (const file of ["music/collect-top-100-songs.ts", "music/collect-curated-roblox-music-ids.ts"]) {
      const source = readFileSync(new URL(file, scripts), "utf8");
      expect(source).toContain("await getExistingMusicAssetIds(");
      expect(source).toContain("await updateMusicCatalogTimestamp(");
    }
    const reranker = readFileSync(new URL("music/rerank-roblox-music-ids.ts", scripts), "utf8");
    expect(reranker).not.toContain('from("catalog_pages")');
    expect(reranker).not.toContain("updateCatalogTimestamp");
  });

  it("keeps catalog card slots as Journey items", () => {
    const source = readFileSync(
      new URL("../../components/catalog/CatalogStableItems.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("data-journey-item");
  });
});
