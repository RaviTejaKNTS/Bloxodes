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
    expect(source).toContain("data-journey-item");
  });
});
