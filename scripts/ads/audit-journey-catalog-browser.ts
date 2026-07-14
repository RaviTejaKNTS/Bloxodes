import { chromium, type Page } from "playwright";

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";

const ROUTES = [
  "/catalog/roblox-music-ids",
  "/catalog/roblox-music-ids/page/2",
  "/catalog/roblox-music-ids/trending",
  "/catalog/roblox-music-ids/trending/page/2",
  "/catalog/roblox-music-ids/charts?range=weekly",
  "/catalog/roblox-music-ids/charts/page/2?range=weekly",
  "/catalog/roblox-music-ids/genres",
  "/catalog/roblox-music-ids/artists",
  "/catalog/roblox-decal-ids",
  "/catalog/roblox-decal-ids/page/2",
  "/catalog/roblox-decal-ids/curated",
  "/catalog/roblox-decal-ids/categories"
] as const;

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 }
] as const;

function readArg(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

async function auditHydratedPage(page: Page, baseUrl: string, route: string) {
  const url = new URL(route.replace(/^\//, ""), baseUrl);
  await page.goto(url.href, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#article-body [data-journey-item]");

  return page.evaluate(() => {
    const selectors = document.querySelectorAll<HTMLElement>("#article-body");
    if (selectors.length !== 1) throw new Error(`expected one #article-body, found ${selectors.length}`);

    const content = selectors[0];
    const allItems = [...content.querySelectorAll<HTMLElement>("[data-journey-item]")];
    const directItems = allItems.filter((item) => item.parentElement === content);
    if (!directItems.length) throw new Error("no direct Journey items found after hydration");
    if (allItems.length !== directItems.length) {
      throw new Error(`${allItems.length - directItems.length} Journey items are nested`);
    }

    const flexItems = directItems.filter((item) => {
      const display = getComputedStyle(item).display;
      return display === "flex" || display === "inline-flex";
    });
    if (flexItems.length) throw new Error(`${flexItems.length} direct Journey items render as flex containers`);

    document.querySelector("[data-journey-audit-ad]")?.remove();
    const syntheticAd = document.createElement("div");
    syntheticAd.dataset.journeyAuditAd = "true";
    syntheticAd.style.height = "90px";
    syntheticAd.style.display = "block";
    syntheticAd.textContent = "Journey placement audit";
    const insertionAnchor = directItems[Math.min(5, directItems.length - 1)];
    insertionAnchor.after(syntheticAd);

    const contentRect = content.getBoundingClientRect();
    const adRect = syntheticAd.getBoundingClientRect();
    const adStyle = getComputedStyle(syntheticAd);
    const widthDelta = Math.abs(contentRect.width - adRect.width);
    if (widthDelta > 2) {
      throw new Error(`synthetic ad is ${widthDelta.toFixed(1)}px narrower than its content lane`);
    }
    if (syntheticAd.parentElement !== content) throw new Error("synthetic ad is not a direct content child");

    return {
      adGridColumn: `${adStyle.gridColumnStart} / ${adStyle.gridColumnEnd}`,
      adWidth: Math.round(adRect.width),
      contentDisplay: getComputedStyle(content).display,
      contentWidth: Math.round(contentRect.width),
      directChildren: content.children.length,
      directItems: directItems.length,
      selectorTag: content.tagName.toLowerCase()
    };
  });
}

async function auditDecalClientUpdate(page: Page, baseUrl: string) {
  await page.goto(new URL("catalog/roblox-decal-ids", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#article-body [data-journey-item]");
  await page.selectOption("#decal-sort", "popular");
  const responsePromise = page.waitForResponse((response) =>
    response.url().includes("/api/roblox-decal-ids?") && response.status() === 200
  );
  await page.getByRole("button", { name: "Apply" }).click();
  await responsePromise;
  await page.waitForURL(/\?sort=popular$/);
  await page.getByText("Updating results...").waitFor({ state: "hidden" });

  return page.evaluate(() => {
    const content = document.querySelector<HTMLElement>("#article-body");
    if (!content) throw new Error("decal client update lost #article-body");
    const allItems = [...content.querySelectorAll<HTMLElement>("[data-journey-item]")];
    const directItems = allItems.filter((item) => item.parentElement === content);
    if (!directItems.length || directItems.length !== allItems.length) {
      throw new Error("decal client update reintroduced a nested card wrapper");
    }
    return directItems.length;
  });
}

async function main() {
  const baseUrl = normalizeBaseUrl(readArg("--base-url") ?? DEFAULT_BASE_URL);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const results = [];

  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({ viewport });
      const baseHostname = new URL(baseUrl).hostname;
      await context.route("**/*", async (route) => {
        const requestUrl = new URL(route.request().url());
        if (requestUrl.hostname === baseHostname) await route.continue();
        else await route.abort();
      });
      const page = await context.newPage();

      for (const route of ROUTES) {
        const snapshot = await auditHydratedPage(page, baseUrl, route);
        results.push({ route, viewport: viewport.name, ...snapshot });
      }

      if (viewport.name === "desktop") {
        const directItems = await auditDecalClientUpdate(page, baseUrl);
        console.log(`Decal client-side sort retained ${directItems} direct Journey items.`);
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }

  console.table(results);
  console.log(`Hydrated Journey browser audit passed for ${results.length} route and viewport combinations.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
