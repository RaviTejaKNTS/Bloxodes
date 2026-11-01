import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Read-only discovery runs in GitHub against the preview's managed database.
const managedUrl = "https://bbtcaurrtyoukvjbxbbj.supabase.co";
const kinds = ["wiki", "collection", "code", "tool", "map", "quiz", "catalog", "checklist", "hub"] as const;
const cases = [...kinds, "root-wiki", "child-wiki", "collection-page-2", "non-collection-page-2", "unknown-path"] as const;
type Entry = { id: string; game_id: string; namespace: string; canonical_path: string; title: string };

async function seo(page: Page) {
  return {
    canonical: await page.locator('link[rel="canonical"]').getAttribute("href"),
    ogUrl: await page.locator('meta[property="og:url"]').getAttribute("content"),
    ogTitle: await page.locator('meta[property="og:title"]').getAttribute("content"),
    title: await page.title(),
  };
}

for (const coverageCase of cases) {
  test(`registry coverage: ${coverageCase}`, async ({ page }, info) => {
    test.skip(process.env.GITHUB_ACTIONS !== "true", "Managed-development browser coverage runs on GitHub only");
    expect(process.env.SUPABASE_URL).toBe(managedUrl);
    const sb = createClient(managedUrl, process.env.SUPABASE_SERVICE_ROLE!, { auth: { persistSession: false, autoRefreshToken: false } });
    const report = (status: string, reason: string) => console.log(`[registry coverage] ${coverageCase}: ${status} - ${reason}`);
    const { data: roots, error: rootError } = await sb.from("games").select("id,namespace,title")
      .is("parent_id", null).eq("is_published", true).not("namespace", "in", "(gta,red-dead,minecraft,roblox)").order("namespace");
    expect(rootError).toBeNull();
    if (!roots?.length) {
      report("SKIPPED", "no eligible published namespace roots");
      test.skip(true, "No eligible namespace roots");
      return;
    }
    let selected: Entry | undefined;
    let kind: typeof kinds[number] = "wiki";
    if (coverageCase === "hub" || coverageCase === "unknown-path") {
      // Moved roots use their wiki route; only unmoved roots have a live hub.
      const { data: routes, error } = await sb.from("site_routes")
        .select("path,page_type,game_id").eq("source", "game").eq("status", "live")
        .in("page_type", ["hub", "wiki"]).in("game_id", roots.map(root => root.id)).order("path");
      expect(error).toBeNull();
      const route = routes?.[0];
      const root = roots.find(root => root.id === route?.game_id);
      if (root && route) {
        kind = route.page_type as "hub" | "wiki";
        if (kind === "hub") selected = { ...root, game_id: root.id, canonical_path: route.path };
        else {
          const { data: wiki, error: wikiError } = await sb.from("game_wiki_pages_view")
            .select("id,game_id,namespace,canonical_path,title").eq("game_id", root.id).single();
          expect(wikiError).toBeNull();
          selected = wiki ?? undefined;
        }
      }
    } else {
      kind = coverageCase === "collection-page-2" ? "collection" : coverageCase.endsWith("wiki") || coverageCase === "non-collection-page-2" ? "wiki" : coverageCase as typeof kinds[number];
      let query = sb.from(`game_${kind}_pages_view`).select("id,game_id,namespace,canonical_path,title")
        .in("namespace", roots.map(row => row.namespace));
      if (kind !== "checklist") query = query.eq("is_published", true);
      if (kind === "collection") query = query.not("published_dataset_id", "is", null);
      if (kind === "map") query = query.eq("renderer_key", "image-pins");
      const { data, error } = await query.order("id");
      expect(error).toBeNull();
      const candidates = (data ?? []) as Entry[];
      if (coverageCase === "root-wiki") selected = candidates.find(row => roots.some(root => root.id === row.game_id));
      else if (coverageCase === "child-wiki") selected = candidates.find(row => roots.some(root => root.namespace === row.namespace && root.id !== row.game_id));
      else if (coverageCase === "collection-page-2") {
        // Use the canonical collection's own pagination: item counts alone do not
        // determine pages because the renderer groups and weighs sections.
        for (const candidate of candidates) {
          const response = await page.goto(candidate.canonical_path, { waitUntil: "domcontentloaded" });
          expect(response?.status()).toBe(200);
          if (await page.locator(`a[href="${candidate.canonical_path}/page/2"]`).count()) {
            selected = candidate;
            break;
          }
        }
      } else selected = candidates[0];
    }
    if (!selected) {
      report("SKIPPED", coverageCase === "collection-page-2" ? "no published collection exposes a second page" : "no eligible published page in managed development");
      test.skip(true, `No data for ${coverageCase}`);
      return;
    }
    const entry = selected;
    const { data: route, error } = await sb.from("site_routes").select("source,page_type,page_id,game_id,status")
      .eq("path", entry.canonical_path).maybeSingle();
    expect(error).toBeNull();
    expect(route).toMatchObject({ source: "game", page_type: kind, page_id: entry.id, game_id: entry.game_id, status: "live" });
    const path = coverageCase === "unknown-path" ? `${entry.canonical_path}/__registry_missing_page__`
      : coverageCase.endsWith("page-2") ? `${entry.canonical_path}/page/2` : entry.canonical_path;
    await info.attach("registry-selection.json", { body: JSON.stringify({ coverageCase, path, route }), contentType: "application/json" });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(new URL(page.url()).pathname).toBe(path);
    expect(response?.request().redirectedFrom()).toBeNull();
    const missing = coverageCase === "non-collection-page-2" || coverageCase === "unknown-path";
    expect(response?.status()).toBe(missing ? 404 : 200);
    if (missing) {
      // A 404 must never advertise the healthy base page as its canonical URL.
      const canonicalLink = page.locator('link[rel="canonical"]');
      const canonical = await canonicalLink.count() ? await canonicalLink.getAttribute("href") : null;
      if (canonical) {
        expect(canonical).toBe(`https://bloxodes.com${path}`);
        const metadata = await seo(page);
        expect(metadata.ogUrl).toBe(canonical);
        expect(metadata.title).toContain(metadata.ogTitle);
      } else {
        // Early notFound uses layout metadata. Compare its OG URL/title with
        // another early 404 instead of demanding successful-page metadata.
        const og = async () => ({
          // Layout-level 404 metadata can repeat these tags; compare the first.
          url: await page.locator('meta[property="og:url"]').first().getAttribute("content"),
          title: await page.locator('meta[property="og:title"]').first().getAttribute("content"),
        });
        const actual = await og();
        const fallback = await page.goto(`${entry.canonical_path}/__registry_missing_page__/page/2`, { waitUntil: "domcontentloaded" });
        expect(fallback?.status()).toBe(404);
        expect(actual).toEqual(await og());
      }
    } else {
      await expect(page.locator("main")).toBeVisible();
      await expect(page.locator("h1")).toHaveCount(1);
      if (kind !== "hub") await expect(page.locator("h1")).toContainText(entry.title);
      const metadata = await seo(page);
      if (kind === "hub") expect([`https://bloxodes.com${path}`, `https://bloxodes.com${path}/wiki`]).toContain(metadata.canonical);
      else expect(metadata.canonical).toBe(`https://bloxodes.com${path}`);
      expect(metadata.ogUrl).toBe(metadata.canonical);
      expect(metadata.ogTitle).toBeTruthy();
      expect(metadata.title).toBeTruthy();
      // Follow the declared canonical URL on the preview origin and compare all
      // metadata, including namespace roots that canonically point to /wiki.
      const canonicalResponse = await page.goto(new URL(metadata.canonical!).pathname, { waitUntil: "domcontentloaded" });
      expect(canonicalResponse?.status()).toBe(200);
      expect(await seo(page)).toEqual(metadata);
    }
    expect(errors).toEqual([]);
    await page.screenshot({ path: info.outputPath(`registry-${coverageCase}.png`), fullPage: true });
    report("COVERED", path);
  });
}
