import { chromium, type BrowserContext, type Page } from "playwright";

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
  "/catalog/roblox-music-ids/games",
  "/catalog/roblox-music-ids/games/jujutsu-shenanigans",
  "/catalog/roblox-decal-ids",
  "/catalog/roblox-decal-ids/page/2",
  "/catalog/roblox-decal-ids/curated",
  "/catalog/roblox-decal-ids/categories",
  "/catalog/roblox-decal-ids/games",
  "/catalog/roblox-decal-ids/games/da-hood"
] as const;

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 }
] as const;

const GRID_BREAKPOINTS = [
  { name: "decal-two-column", width: 500, height: 900, routes: ["/catalog/roblox-decal-ids"] },
  {
    name: "tablet",
    width: 900,
    height: 1000,
    routes: [
      "/catalog/roblox-music-ids",
      "/catalog/roblox-decal-ids",
      "/catalog/roblox-music-ids/genres"
    ]
  },
  { name: "decal-five-column", width: 1600, height: 1000, routes: ["/catalog/roblox-decal-ids"] }
] as const;

function readArg(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

async function installClsObserver(context: BrowserContext) {
  await context.addInitScript(() => {
    const observedWindow = window as typeof window & { __journeyAuditCls?: number };
    observedWindow.__journeyAuditCls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
        if (!shift.hadRecentInput) {
          observedWindow.__journeyAuditCls =
            (observedWindow.__journeyAuditCls ?? 0) + (shift.value ?? 0);
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}

async function waitForHydration(page: Page) {
  await page.waitForLoadState("load");
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
}

async function auditHydratedPage(page: Page, baseUrl: string, route: string) {
  const url = new URL(route.replace(/^\//, ""), baseUrl);
  await page.goto(url.href, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#article-body [data-journey-item]");
  await waitForHydration(page);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);

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

    if (content.tagName !== "SECTION") {
      throw new Error(`Journey selector uses ${content.tagName.toLowerCase()} instead of a neutral section`);
    }
    if (document.querySelector(".content_hint,.content_mobile_hint,.content_desktop_hint")) {
      throw new Error("manual Mediavine content hints are present after hydration");
    }

    const duplicateIds = [...content.querySelectorAll<HTMLElement>("[id]")]
      .map((element) => element.id)
      .filter((id, index, ids) => ids.indexOf(id) !== index);
    if (duplicateIds.length) {
      throw new Error(`duplicate IDs found: ${[...new Set(duplicateIds)].join(", ")}`);
    }

    const positiveTabIndexes = [...document.querySelectorAll<HTMLElement>("[tabindex]")].filter(
      (element) => element.tabIndex > 0
    );
    if (positiveTabIndexes.length) {
      throw new Error(`${positiveTabIndexes.length} elements use a positive tabindex`);
    }

    const interactiveElements = [...content.querySelectorAll<HTMLElement>(
      'a[href],button,input:not([type="hidden"]),select,textarea'
    )];
    const unnamedInteractiveElements = interactiveElements.filter((element) => {
      const labelledBy = element.getAttribute("aria-labelledby")
        ?.split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
        .join(" ")
        .trim();
      const controlLabels = "labels" in element
        ? [...((element as HTMLInputElement).labels ?? [])]
            .map((label) => label.textContent?.trim() ?? "")
            .join(" ")
            .trim()
        : "";
      const imageAlt = element.querySelector("img")?.getAttribute("alt")?.trim() ?? "";
      const name =
        element.getAttribute("aria-label")?.trim() ||
        labelledBy ||
        controlLabels ||
        element.textContent?.trim() ||
        imageAlt ||
        element.getAttribute("title")?.trim();
      return !name;
    });
    if (unnamedInteractiveElements.length) {
      throw new Error(`${unnamedInteractiveElements.length} interactive elements have no accessible name`);
    }

    const contentStyle = getComputedStyle(content);
    const isJourneyGrid = content.classList.contains("journey-content-stream");
    const directChildren = [...content.children] as HTMLElement[];
    const paragraphGaps = directChildren.flatMap((element, index) => {
      const next = directChildren[index + 1];
      if (!next || !element.matches("p[data-md-copy]") || !next.matches("p[data-md-copy]")) return [];
      return [Math.round(next.getBoundingClientRect().top - element.getBoundingClientRect().bottom)];
    });
    if (isJourneyGrid && paragraphGaps.some((gap) => gap < 26 || gap > 30)) {
      throw new Error(`direct paragraph gap is ${paragraphGaps.join(", ")}px instead of about 28px`);
    }

    const observedWindow = window as typeof window & { __journeyAuditCls?: number };
    const clsBeforeSynthetic = observedWindow.__journeyAuditCls ?? 0;
    if (clsBeforeSynthetic > 0.01) {
      throw new Error(`application CLS reached ${clsBeforeSynthetic.toFixed(4)} before ad simulation`);
    }

    document.querySelector("[data-journey-audit-ad]")?.remove();
    const syntheticAd = document.createElement("div");
    syntheticAd.dataset.journeyAuditAd = "true";
    syntheticAd.style.height = "90px";
    syntheticAd.style.display = "block";
    syntheticAd.textContent = "Journey placement audit";

    const contentRect = content.getBoundingClientRect();
    const columnCount = contentStyle.gridTemplateColumns.split(/\s+/).filter(Boolean).length;
    const incompleteRowAnchor = directItems[Math.min(columnCount, directItems.length - 1)];
    incompleteRowAnchor.after(syntheticAd);
    const adStyle = getComputedStyle(syntheticAd);

    const incompleteRowTop = incompleteRowAnchor.getBoundingClientRect().top;
    const rowFillers = directItems.slice(columnCount + 1, columnCount * 2);
    const incompleteRowGap = rowFillers.find(
      (item) => Math.abs(item.getBoundingClientRect().top - incompleteRowTop) > 2
    );
    if (columnCount > 1 && incompleteRowGap) {
      throw new Error(
        `dense placement left an incomplete ${columnCount}-column row before the synthetic ad`
      );
    }
    if (isJourneyGrid && !contentStyle.gridAutoFlow.includes("dense")) {
      throw new Error(
        `Journey content grid uses ${contentStyle.gridAutoFlow} auto-flow instead of dense placement`
      );
    }

    const finalAdRect = syntheticAd.getBoundingClientRect();
    const widthDelta = Math.abs(contentRect.width - finalAdRect.width);
    if (widthDelta > 2) {
      throw new Error(`synthetic ad is ${widthDelta.toFixed(1)}px narrower than its content lane`);
    }
    if (syntheticAd.parentElement !== content) throw new Error("synthetic ad is not a direct content child");

    return {
      adGridColumn: `${adStyle.gridColumnStart} / ${adStyle.gridColumnEnd}`,
      adWidth: Math.round(finalAdRect.width),
      clsBeforeSynthetic: Number(clsBeforeSynthetic.toFixed(4)),
      columns: columnCount,
      contentDisplay: contentStyle.display,
      contentWidth: Math.round(contentRect.width),
      directChildren: content.children.length,
      directItems: directItems.length,
      gridAutoFlow: contentStyle.gridAutoFlow,
      isJourneyGrid,
      paragraphGap: paragraphGaps[0] ?? null,
      selectorTag: content.tagName.toLowerCase()
    };
  });
}

async function auditDecalClientUpdate(page: Page, baseUrl: string) {
  await page.goto(new URL("catalog/roblox-decal-ids", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#article-body [data-journey-item]");
  await waitForHydration(page);
  await page.selectOption("#decal-sort", "popular");
  const responsePromise = page.waitForResponse((response) =>
    response.url().includes("/api/roblox-decal-ids?") && response.status() === 200
  );
  await page.getByRole("button", { name: "Apply" }).click();
  await responsePromise;
  await page.waitForFunction(() => new URL(window.location.href).searchParams.get("sort") === "popular");
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
      await installClsObserver(context);
      const baseHostname = new URL(baseUrl).hostname;
      await context.route("**/*", async (route) => {
        const requestUrl = new URL(route.request().url());
        if (requestUrl.hostname === baseHostname) await route.continue();
        else await route.abort();
      });
      const page = await context.newPage();

      for (const route of ROUTES) {
        try {
          const snapshot = await auditHydratedPage(page, baseUrl, route);
          results.push({ route, viewport: viewport.name, ...snapshot });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(`${viewport.name} ${route}: ${message}`);
        }
      }

      if (viewport.name === "desktop") {
        const directItems = await auditDecalClientUpdate(page, baseUrl);
        console.log(`Decal client-side sort retained ${directItems} direct Journey items.`);
      }

      await context.close();
    }

    for (const breakpoint of GRID_BREAKPOINTS) {
      const context = await browser.newContext({ viewport: breakpoint });
      await installClsObserver(context);
      const baseHostname = new URL(baseUrl).hostname;
      await context.route("**/*", async (route) => {
        const requestUrl = new URL(route.request().url());
        if (requestUrl.hostname === baseHostname) await route.continue();
        else await route.abort();
      });
      const page = await context.newPage();

      for (const route of breakpoint.routes) {
        try {
          const snapshot = await auditHydratedPage(page, baseUrl, route);
          results.push({ route, viewport: breakpoint.name, ...snapshot });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(`${breakpoint.name} ${route}: ${message}`);
        }
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
