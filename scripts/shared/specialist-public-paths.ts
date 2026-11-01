import { load } from "cheerio";

/** Specialist sitemaps expose the saved canonical paths for either URL style. */
export async function specialistMapAndToolPaths(baseUrl: string, request: typeof fetch = fetch): Promise<string[]> {
  const sources = [
    { sitemap: "gta", accepts: (path: string) => /^\/(?:gta\/maps|maps)(?:\/|$)/.test(path) },
    { sitemap: "minecraft", accepts: (path: string) => /^\/(?:minecraft\/tools(?:\/|$)|tools\/minecraft-)/.test(path) },
  ];
  const paths = await Promise.all(sources.map(async ({ sitemap, accepts }) => {
    const response = await request(new URL(`/sitemaps/${sitemap}.xml`, baseUrl), { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`${sitemap} canonical route discovery failed: HTTP ${response.status}`);
    const $ = load(await response.text(), { xmlMode: true });
    if (!$("urlset").length) throw new Error(`${sitemap} canonical route discovery returned invalid sitemap XML`);
    return $("loc").map((_, element) => {
      const url = new URL($(element).text());
      if (url.origin !== "https://bloxodes.com") throw new Error(`Unexpected canonical origin in ${sitemap} sitemap`);
      return url.pathname;
    }).get().filter(accepts);
  }));
  return [...new Set(paths.flat())];
}
