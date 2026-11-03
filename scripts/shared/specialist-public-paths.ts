import { load } from "cheerio";

/** Discover canonical shared maps and tools from their common sitemap. */
export async function specialistMapAndToolPaths(baseUrl: string, request: typeof fetch = fetch): Promise<string[]> {
  const response = await request(new URL("/sitemaps/games.xml", baseUrl), { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Shared game canonical route discovery failed: HTTP ${response.status}`);
  const $ = load(await response.text(), { xmlMode: true });
  if (!$("urlset").length) throw new Error("Shared game canonical route discovery returned invalid sitemap XML");
  return [...new Set($("loc").map((_, element) => {
    const url = new URL($(element).text());
    if (url.origin !== "https://bloxodes.com") throw new Error("Unexpected canonical origin in shared game sitemap");
    return url.pathname;
  }).get().filter(path => /^\/(?:maps|tools)\//.test(path)))];
}
