import { expect, test, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const managedUrl = "https://bbtcaurrtyoukvjbxbbj.supabase.co";
const siteUrl = "https://bloxodes.com";
// PR B sets this in CI; A keeps unmoved production pilots valid.
const requirePilotMoves = process.env.REQUIRE_PILOT_PAGE_TYPE_URLS === "true";
const pilots = ["peak", "risk-of-rain"];
const indexes: Record<string, string> = {
  wiki: "/wiki", code: "/codes", tool: "/tools", map: "/maps",
  quiz: "/quizzes", checklist: "/checklists", catalog: "/catalog"
};
type Route = {
  path: string; page_type: string; page_id: string | null; target_url: string | null;
};
type Coverage = Array<{ path: string; expected: string; status: string }>;

function database() {
  expect(process.env.SUPABASE_URL).toBe(managedUrl);
  expect(process.env.SUPABASE_SERVICE_ROLE).toBeTruthy();
  return createClient(managedUrl, process.env.SUPABASE_SERVICE_ROLE!, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function renders(page: Page, path: string, coverage: Coverage, checkSeo = true) {
  const entry = { path, expected: checkSeo ? "200; canonical/og:url/title" : "200; index links/title", status: "STARTED" };
  coverage.push(entry);
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response?.status(), path).toBe(200);
  // A redirected navigation returning 200 must not pass as a direct render.
  expect(new URL(page.url()).pathname, path).toBe(path);
  expect(response?.request().redirectedFrom(), path).toBeNull();
  if (checkSeo) {
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${siteUrl}${path}`);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", `${siteUrl}${path}`);
  }
  await expect(page).toHaveTitle(/\S/);
  entry.status = "PASSED";
}

async function redirects(request: APIRequestContext, oldPath: string, newPath: string, coverage: Coverage) {
  const entry = { path: oldPath, expected: `301/308 -> ${newPath}`, status: "STARTED" };
  coverage.push(entry);
  const response = await request.get(oldPath, { maxRedirects: 0 });
  expect([301, 308], oldPath).toContain(response.status());
  expect(response.headers().location, oldPath).toBeTruthy();
  // Preview hosts differ from the canonical host. Check the complete resolved
  // Location against the preview origin, including any query or hash suffix.
  expect(new URL(response.headers().location, response.url()).href, oldPath)
    .toBe(new URL(newPath, response.url()).href);
  entry.status = "PASSED";
}

async function report(info: TestInfo, coverage: Coverage) {
  console.log(`[URL move coverage] ${info.title}\n${coverage.map(row => `${row.status}: ${row.path} [${row.expected}]`).join("\n")}`);
  await info.attach("url-move-coverage.json", {
    body: JSON.stringify(coverage, null, 2), contentType: "application/json"
  });
}

for (const namespace of pilots) {
  test(`page-type move: ${namespace}`, async ({ page, request }, info) => {
    test.skip(process.env.GITHUB_ACTIONS !== "true", "GitHub managed-development coverage only");
    test.setTimeout(240_000);
    const coverage: Coverage = [];
    try {
      const db = database();
      const { data: games, error } = await db.from("games").select("id,parent_id,url_style,is_published").eq("namespace", namespace);
      expect(error).toBeNull();
      const moved = !!games?.length && games.every(game => game.url_style === "page_type");
      if (!requirePilotMoves && !moved) test.skip(true, "Pilot move is reserved for PR B");
      expect(games?.length, `${namespace} pilot must exist`).toBeGreaterThan(0);
      expect(games!.every(game => game.url_style === "page_type"), `${namespace} pilot cutover must be applied`).toBe(true);
      const root = games!.find(game => !game.parent_id);
      expect(root?.is_published, `${namespace} root must be published`).toBe(true);

      // Read all batches: PostgREST's row cap must not silently drop coverage.
      async function routes(status: string, namespacePaths = false, pageIds?: string[]) {
        const rows: Route[] = [];
        for (let offset = 0;; offset += 500) {
          let query = db.from("site_routes").select("path,page_type,page_id,target_url").eq("status", status);
          query = namespacePaths ? query.like("path", `/${namespace}/%`)
            : pageIds ? query.eq("source", "game").in("page_id", pageIds)
              : query.eq("source", "game").in("game_id", games!.map(game => game.id));
          const { data, error } = await query.order("path").range(offset, offset + 499);
          expect(error).toBeNull();
          rows.push(...(data ?? []));
          if (!data || data.length < 500) return rows;
        }
      }
      const live = await routes("live");
      expect(live.length).toBeGreaterThan(0);
      // Also compare the published page inventory so a missing live registry
      // row cannot quietly remove a wiki or collection from this test.
      for (const kind of ["wiki", "collection"]) {
        const { data: pages, error: pagesError } = await db.from(`game_${kind}_pages_view`)
          .select("id,canonical_path").eq("namespace", namespace);
        expect(pagesError).toBeNull();
        expect(pages?.length, `${namespace} ${kind} inventory`).toBeGreaterThan(0);
        expect(live.filter(route => route.page_type === kind).map(route => `${route.page_id}:${route.path}`).sort())
          .toEqual(pages!.map(row => `${row.id}:${row.canonical_path}`).sort());
      }
      const rootWiki = live.find(route => route.page_type === "wiki" && route.path === (namespace === "peak" ? "/wiki/peak" : "/games/risk-of-rain"));
      expect(rootWiki, "root wiki must have its new live URL").toBeTruthy();
      const mainPath = rootWiki!.path;
      // Synthetic directory aliases have no page/game owner. Include them by
      // namespace path, as well as all historical aliases linked to pilot pages.
      const aliases = new Map((await routes("old", false, live.map(route => route.page_id!))).map(route => [route.path, route]));
      for (const route of await routes("old", true)) aliases.set(route.path, route);
      const { data: rootAlias, error: rootAliasError } = await db.from("site_routes")
        .select("path,page_type,page_id,target_url,status").eq("path", `/${namespace}`).single();
      expect(rootAliasError).toBeNull();
      expect(rootAlias?.status).toBe("old");
      aliases.set(rootAlias!.path, rootAlias!);
      const requiredAliases = [`/${namespace}`, `/${namespace}/wiki`];
      if (namespace === "risk-of-rain") requiredAliases.push("/risk-of-rain/wiki/risk-of-rain-2");
      for (const [kind, index] of Object.entries(indexes)) {
        if (kind !== "wiki" && live.some(route => route.page_type === kind)) requiredAliases.push(`/${namespace}${index}`);
      }
      for (const path of requiredAliases) expect(aliases.has(path), `missing old root/wiki/directory route ${path}`).toBe(true);

      const destinations = new Map<string, string>();
      for (const alias of aliases.values()) {
        const owner = alias.page_id ? live.find(route => route.page_type === alias.page_type && route.page_id === alias.page_id) : undefined;
        const target = owner?.path ?? alias.target_url;
        expect(target, `old route ${alias.path} needs a live target`).toBeTruthy();
        const newPath = new URL(target!, siteUrl).pathname;
        expect(live.some(route => route.path === newPath), `alias target ${newPath} must be live`).toBe(true);
        destinations.set(alias.path, newPath);
      }
      for (const path of [`/${namespace}`, `/${namespace}/wiki`]) expect(destinations.get(path)).toBe(mainPath);
      if (namespace === "risk-of-rain") expect(destinations.get("/risk-of-rain/wiki/risk-of-rain-2")).toBe("/wiki/risk-of-rain-2");

      for (const route of live) {
        const oldPaths = [...destinations].filter(([, target]) => target === route.path).map(([path]) => path);
        expect(oldPaths.length, `live page ${route.path} must retain its old URL`).toBeGreaterThan(0);
        await renders(page, route.path, coverage);
        if (route.page_type === "collection") {
          // Section weights, rather than item counts, control pagination. Use
          // the renderer's own navigation, just like registry E2E coverage.
          const pageTwo = `${route.path}/page/2`;
          const hasPageTwo = await page.locator(`a[href="${pageTwo}"]`).count() > 0;
          console.log(`[URL move pagination] ${route.path}: ${hasPageTwo ? "page 2 required" : "single page"}`);
          if (hasPageTwo) {
            await renders(page, pageTwo, coverage);
            for (const alias of aliases.values()) {
              if (alias.page_type === "collection" && alias.page_id === route.page_id) {
                await redirects(request, `${alias.path}/page/2`, pageTwo, coverage);
              }
            }
          }
        }
      }
      for (const [oldPath, newPath] of destinations) await redirects(request, oldPath, newPath, coverage);

      // Cover every supported index, including existing numbered index routes.
      // An empty pilot family has no pilot links or Other games section to require.
      for (const [kind, index] of Object.entries(indexes)) {
        const expectedLinks = live.filter(route => route.page_type === kind);
        await renders(page, index, coverage, false);
        const numberedIndex = `${index}/page/2`;
        const hasNumberedIndex = ["wiki", "code", "tool", "checklist"].includes(kind)
          && await page.locator(`a[href="${numberedIndex}"]`).count() > 0;
        for (const path of [index, ...(hasNumberedIndex ? [numberedIndex] : [])]) {
          if (path !== index) await renders(page, path, coverage, false);
          if (expectedLinks.length) {
            const section = page.locator("section").filter({ has: page.getByRole("heading", { name: "Other games", exact: true }) });
            await expect(section).toHaveCount(1);
            for (const route of expectedLinks) await expect(section.locator(`a[href="${route.path}"]`)).toHaveCount(1);
          }
        }
      }
      await renders(page, "/games", coverage, false);
      for (const path of ["/games/risk-of-rain", "/wiki/peak"]) {
        await expect(page.locator(`a[href="${path}"]`).first()).toBeVisible();
      }
    } finally {
      await report(info, coverage);
    }
  });
}

test("batch namespaces use page-type URLs and one-hop aliases", async ({ page, request }, info) => {
  test.skip(process.env.GITHUB_ACTIONS !== "true", "GitHub managed-development coverage only");
  test.setTimeout(240_000);
  const coverage: Coverage = [];
  try {
    const db = database();
    const { data: roots, error } = await db.from("games").select("id,namespace,url_style")
      .is("parent_id", null).eq("is_published", true)
      .not("namespace", "in", "(gta,red-dead,minecraft,peak,risk-of-rain)").order("namespace");
    expect(error).toBeNull();
    const { data: wikis, error: wikiError } = await db.from("game_wiki_pages_view")
      .select("id,game_id,namespace,canonical_path").in("game_id", (roots ?? []).map(root => root.id));
    expect(wikiError).toBeNull();
    const { data: oldRoots, error: aliasError } = await db.from("site_routes").select("path")
      .eq("source", "game").eq("status", "old").eq("match_type", "exact")
      .in("path", (roots ?? []).map(root => `/${root.namespace}`));
    expect(aliasError).toBeNull();
    const eligible = (roots ?? []).filter(root => oldRoots?.some(alias => alias.path === `/${root.namespace}`)
      && wikis?.some(wiki => wiki.game_id === root.id));
    expect(eligible.length, "at least two batch namespaces need published root wikis").toBeGreaterThanOrEqual(2);
    // Choose from the current inventory, rather than pinning games that may be
    // absent in another database. Root aliases distinguish moved namespaces from
    // games created on page-type URLs. A pending batch fails the count above.
    for (const root of eligible.slice(0, 3)) {
      expect(root.url_style, `${root.namespace} batch cutover must be applied`).toBe("page_type");
      const wiki = wikis!.find(wiki => wiki.game_id === root.id)!;
      await renders(page, wiki.canonical_path, coverage);
      for (const oldPath of [`/${root.namespace}`, `/${root.namespace}/wiki`]) {
        await redirects(request, oldPath, wiki.canonical_path, coverage);
      }

      // Include a collection when available, without requiring every namespace
      // to publish one. Its old page URL must also resolve directly to the new URL.
      const { data: collections, error: collectionError } = await db.from("game_collection_pages_view")
        .select("id,canonical_path").eq("namespace", root.namespace)
        .not("published_dataset_id", "is", null).order("canonical_path").limit(1);
      expect(collectionError).toBeNull();
      for (const collection of collections ?? []) {
        const { data: aliases, error: aliasError } = await db.from("site_routes").select("path")
          .eq("source", "game").eq("page_type", "collection").eq("page_id", collection.id)
          .eq("status", "old").eq("match_type", "exact").like("path", `/${root.namespace}/%`);
        expect(aliasError).toBeNull();
        expect(aliases?.length, `${collection.canonical_path} needs an old namespace URL`).toBeGreaterThan(0);
        await renders(page, collection.canonical_path, coverage);
        for (const alias of aliases!) await redirects(request, alias.path, collection.canonical_path, coverage);
      }
    }
  } finally {
    await report(info, coverage);
  }
});

test("GTA, Red Dead and Minecraft move while Roblox retains its URL", async ({ page, request }, info) => {
  test.skip(process.env.GITHUB_ACTIONS !== "true", "GitHub managed-development coverage only");
  const coverage: Coverage = [];
  try {
    const db = database();
    const { data: roots, error } = await db.from("games").select("namespace,url_style")
      .in("namespace", ["gta", "red-dead", "minecraft"]).is("parent_id", null).order("namespace");
    expect(error).toBeNull();
    expect(roots?.map(root => root.namespace)).toEqual(["gta", "minecraft", "red-dead"]);
    expect(roots!.every(root => root.url_style === "page_type")).toBe(true);
    for (const namespace of ["gta", "red-dead", "minecraft"]) {
      const path = `/games/${namespace}`;
      await renders(page, path, coverage);
      for (const oldPath of [`/${namespace}`, `/${namespace}/wiki`]) {
        await redirects(request, oldPath, path, coverage);
      }
    }
    await renders(page, "/wiki/minecraft-java", coverage);
    await redirects(request, "/minecraft/java/wiki", "/wiki/minecraft-java", coverage);
    await renders(page, "/wiki/blox-fruits", coverage);
  } finally {
    await report(info, coverage);
  }
});


test("unknown page-type paths return 404 before and after pilot moves", async ({ request }) => {
  for (const path of ["/games/url-review-missing", "/wiki/url-review-missing", "/wiki/url-review-missing/items",
    "/maps/url-review-missing", "/codes/url-review-missing", "/tools/url-review-missing",
    "/quizzes/url-review-missing", "/checklists/url-review-missing", "/catalog/url-review-missing"]) {
    expect((await request.get(path, { maxRedirects: 0 })).status(), path).toBe(404);
  }
});
