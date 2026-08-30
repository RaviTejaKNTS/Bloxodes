import { chromium, type BrowserContext, type Page } from "playwright";

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";

const ROUTES = [
  "/catalog/roblox-music-ids",
  "/catalog/roblox-music-ids/trending",
  "/catalog/roblox-music-ids/charts?range=weekly",
  "/catalog/roblox-music-ids/genres",
  "/catalog/roblox-music-ids/artists",
  "/catalog/roblox-music-ids/games",
  "/catalog/roblox-music-ids/games/jujutsu-shenanigans",
  "/catalog/roblox-decal-ids",
  "/catalog/roblox-decal-ids/curated",
  "/catalog/roblox-decal-ids/categories",
  "/catalog/roblox-decal-ids/games",
  "/catalog/roblox-decal-ids/games/da-hood",
  "/catalog/roblox-dictionary",
  "/catalog/roblox-font-ids",
  "/catalog/roblox-mesh-ids",
  "/catalog/roblox-color-codes",
  "/catalog/roblox-errors-and-fixes",
  "/catalog/roblox-promo-codes",
  "/catalog/free-roblox-items",
  "/catalog/roblox-items-and-bundles",
  "/catalog/roblox-items-and-bundles/roblox-accessories",
  "/catalog/roblox-items-and-bundles/roblox-clothing",
  "/catalog/roblox-items-and-bundles/roblox-body-parts",
  "/catalog/roblox-items-and-bundles/roblox-emotes",
  "/catalog/roblox-items-and-bundles/roblox-animations",
  "/catalog/roblox-items-and-bundles/roblox-makeup",
  "/catalog/admin-commands",
  "/articles",
  "/codes",
  "/checklists",
  "/quizzes",
  "/tools",
  "/events",
  "/authors",
  "/wiki",
  "/catalog",
  "/puzzles",
  "/stats/reports"
] as const;

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 }
] as const;

const GRID_BREAKPOINTS = [
  { name: "decal-two-column", width: 500, height: 900, routes: ["/catalog/roblox-decal-ids"] },
  { name: "puzzles-four-column", width: 560, height: 900, routes: ["/puzzles"] },
  {
    name: "tablet",
    width: 900,
    height: 1000,
    routes: [
      "/catalog/roblox-music-ids",
      "/catalog/roblox-decal-ids",
      "/catalog/roblox-music-ids/genres",
      "/catalog/roblox-dictionary",
      "/catalog/roblox-font-ids",
      "/catalog/roblox-mesh-ids",
      "/catalog/roblox-errors-and-fixes"
    ]
  },
  {
    name: "music-three-column",
    width: 1024,
    height: 1000,
    routes: ["/catalog/roblox-music-ids", "/catalog/roblox-music-ids/games/jujutsu-shenanigans"]
  },
  {
    name: "catalog-four-column",
    width: 1280,
    height: 1000,
    routes: ["/catalog/free-roblox-items", "/catalog/roblox-items-and-bundles", "/articles"]
  },
  {
    name: "color-six-column",
    width: 1280,
    height: 1000,
    routes: ["/catalog/roblox-color-codes"]
  },
  { name: "decal-five-column", width: 1600, height: 1000, routes: ["/catalog/roblox-decal-ids"] }
] as const;

const DISCOVERY_ROOTS = [
  {
    route: "/articles",
    prefixes: ["/articles/"]
  },
  {
    route: "/wiki",
    prefixes: ["/wiki/"]
  },
  {
    route: "/puzzles",
    prefixes: ["/puzzles/"]
  },
  {
    route: "/tools",
    prefixes: ["/tools/"]
  },
  {
    route: "/authors",
    prefixes: ["/authors/"]
  },
  {
    route: "/stats/reports",
    prefixes: ["/stats/reports/"]
  },
  {
    route: "/codes",
    prefixes: ["/codes/"]
  },
  {
    route: "/checklists",
    prefixes: ["/checklists/"]
  },
  {
    route: "/events",
    prefixes: ["/events/"]
  },
  {
    route: "/quizzes",
    prefixes: ["/quizzes/"]
  },
  {
    route: "/catalog/roblox-music-ids/genres",
    prefixes: ["/catalog/roblox-music-ids/genres/"]
  },
  {
    route: "/catalog/roblox-music-ids/artists",
    prefixes: ["/catalog/roblox-music-ids/artists/"]
  },
  {
    route: "/catalog/roblox-music-ids/games",
    prefixes: ["/catalog/roblox-music-ids/games/"]
  },
  {
    route: "/catalog/roblox-decal-ids/categories",
    prefixes: ["/catalog/roblox-decal-ids/categories/"]
  },
  {
    route: "/catalog/roblox-decal-ids/games",
    prefixes: ["/catalog/roblox-decal-ids/games/"]
  },
  {
    route: "/catalog/free-roblox-items",
    prefixes: ["/catalog/free-roblox-items/"]
  },
  {
    route: "/catalog/roblox-items-and-bundles",
    prefixes: ["/catalog/roblox-items-and-bundles/"]
  }
] as const;

function readArg(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= values.length) return;
      results[index] = await mapper(values[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(Math.max(concurrency, 1), values.length) }, () => worker())
  );
  return results;
}

async function discoverPageTwoRoute(page: Page, baseUrl: string, route: string): Promise<string | null> {
  const currentPath = new URL(route.replace(/^\//, ""), baseUrl).pathname.replace(/\/$/, "");
  if (currentPath.endsWith("/page/2")) return null;

  const href = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLAnchorElement>('a[href]')]
      .map((anchor) => anchor.href)
      .find((candidate) => /\/page\/2(?:\?|$)/.test(new URL(candidate).pathname + new URL(candidate).search)) ?? null
  );
  if (!href) return null;

  const candidate = new URL(href, baseUrl);
  const candidatePath = candidate.pathname.replace(/\/$/, "");
  if (candidate.origin !== new URL(baseUrl).origin || !candidatePath.startsWith(currentPath)) return null;
  return `${candidate.pathname}${candidate.search}`;
}

async function discoverNestedRoutes(page: Page, baseUrl: string): Promise<string[]> {
  const routes = new Set<string>(ROUTES);
  for (const root of DISCOVERY_ROOTS) {
    await page.goto(new URL(root.route.replace(/^\//, ""), baseUrl).href);
    await page.waitForSelector("#article-body");
    await waitForHydration(page);
    const discovered = await page.evaluate((prefixes) => {
      const currentOrigin = window.location.origin;
      return [...new Set(
        [...document.querySelectorAll<HTMLAnchorElement>("#article-body a[href]")]
          .map((anchor) => {
            const candidate = new URL(anchor.href, window.location.href);
            return candidate.origin === currentOrigin ? candidate.pathname : null;
          })
          .filter((pathname): pathname is string => Boolean(pathname && prefixes.some((prefix) => pathname.startsWith(prefix))))
          .filter((pathname) => !pathname.includes("/page/"))
      )];
    }, [...root.prefixes]);
    for (const route of discovered) routes.add(route);
  }

  // Wiki hubs can link to collection pages, and collection pages can expose
  // related collections. Follow two bounded passes so deeper routes receive
  // the same hydrated DOM checks as their hubs.
  for (let pass = 0; pass < 1; pass += 1) {
    const wikiRoutes = [...routes].filter((route) => /^\/wiki\/[^/]+(?:\/[^/]+)?$/.test(route));
    for (const route of wikiRoutes) {
      const response = await page.goto(new URL(route.replace(/^\//, ""), baseUrl).href);
      if (response?.status() === 404) {
        console.warn(`Skipped missing wiki discovery route: ${route}`);
        continue;
      }
      if (response && !response.ok()) {
        throw new Error(`${route} returned ${response.status()} while discovering wiki routes`);
      }
      await page.waitForSelector("#article-body");
      await waitForHydration(page);
      const discovered = await page.evaluate(() => {
        const currentOrigin = window.location.origin;
        return [...new Set(
          [...document.querySelectorAll<HTMLAnchorElement>("#article-body a[href]")]
            .map((anchor) => {
              const candidate = new URL(anchor.href, window.location.href);
              return candidate.origin === currentOrigin ? candidate.pathname : null;
            })
            .filter((pathname): pathname is string => Boolean(pathname?.startsWith("/wiki/")))
            .filter((pathname) => !pathname.includes("/page/"))
        )];
      });
      for (const discoveredRoute of discovered) routes.add(discoveredRoute);
    }
  }
  return [...routes];
}

async function filterExistingRoutes(baseUrl: string, routes: string[]): Promise<string[]> {
  const uniqueRoutes = [...new Set(routes)];
  const availableRoutes = await mapWithConcurrency(
    uniqueRoutes,
    4,
    async (route) => {
      try {
        const response = await fetch(new URL(route.replace(/^\//, ""), baseUrl), {
          headers: { "user-agent": "Bloxodes Journey browser audit" },
          redirect: "follow"
        });
        if (response.ok) return route;
        if (response.status === 404) {
          console.warn(`Skipped missing discovered route: ${route}`);
          return null;
        }
        throw new Error(`${route} returned ${response.status} while validating browser routes`);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith(`${route} returned `)) throw error;
        throw new Error(`${route} could not be fetched while validating browser routes: ${String(error)}`);
      }
    }
  );
  return availableRoutes.filter((route): route is string => Boolean(route));
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
  await page.waitForSelector("#article-body");
  await waitForHydration(page);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);

  return page.evaluate(() => {
    const selectors = document.querySelectorAll<HTMLElement>("#article-body");
    if (selectors.length !== 1) throw new Error(`expected one #article-body, found ${selectors.length}`);

    const content = selectors[0];
    const allItems = [...content.querySelectorAll<HTMLElement>("[data-journey-item]")];
    const directItems = allItems.filter((item) => item.parentElement === content);
    if (allItems.length !== directItems.length) {
      throw new Error(`${allItems.length - directItems.length} Journey items are nested`);
    }

    const contentStyle = getComputedStyle(content);
    const isJourneyGrid = content.classList.contains("journey-content-stream");
    const isStructuredStream =
      content.classList.contains("journey-content-stream--prose") ||
      content.classList.contains("journey-content-stream--interactive");
    const isCollectionStream = content.classList.contains("journey-content-stream--collection");
    const isCardGrid = isJourneyGrid && !isStructuredStream && !isCollectionStream;
    const hasEmptyState = content.matches('[class*="border-dashed"]') || Boolean(content.querySelector('[class*="border-dashed"]'));
    if (!isJourneyGrid) throw new Error("#article-body is missing the Journey content stream contract");

    const isAllowedArticle = isStructuredStream && content.classList.contains("journey-content-stream--prose");
    if (content.tagName !== "SECTION" && !(content.tagName === "ARTICLE" && isAllowedArticle)) {
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
      const details = unnamedInteractiveElements
        .slice(0, 5)
        .map((element) => element.outerHTML.replace(/\s+/g, " ").slice(0, 220))
        .join(" | ");
      throw new Error(`${unnamedInteractiveElements.length} interactive elements have no accessible name: ${details}`);
    }

    const directChildren = [...content.children] as HTMLElement[];
    const columnCount = isCardGrid && contentStyle.display === "grid"
      ? contentStyle.gridTemplateColumns.split(/\s+/).filter(Boolean).length
      : 1;
    const observedWindow = window as typeof window & { __journeyAuditCls?: number };
    const clsBeforeSynthetic = observedWindow.__journeyAuditCls ?? 0;
    if (clsBeforeSynthetic > 0.01) {
      throw new Error(`application CLS reached ${clsBeforeSynthetic.toFixed(4)} before ad simulation`);
    }

    const paragraphGaps = directChildren.flatMap((element, index) => {
      const next = directChildren[index + 1];
      if (!next || !element.matches("p[data-md-copy]") || !next.matches("p[data-md-copy]")) return [];
      return [Math.round(next.getBoundingClientRect().top - element.getBoundingClientRect().bottom)];
    });
    const isProseStream = content.classList.contains("journey-content-stream--prose");
    const proseFlowSelector =
      "p[data-md-copy], h1[data-md-copy], h2[data-md-copy], h3[data-md-copy], h4[data-md-copy], ul[data-md-copy], ol[data-md-copy]";
    const proseFlowNodes = directChildren
      .map((element, index) => ({ element, index }))
      .filter(({ element }) => element.matches(proseFlowSelector));
    const expectedTopMargin = (element: HTMLElement, index: number) => {
      if (element.matches(".md-spacer")) return 0;
      if (element.matches("h1[data-md-copy]")) return 0;
      if (element.matches("h2[data-md-copy]")) return 40;
      if (element.matches("h3[data-md-copy]")) return 32;
      if (element.matches("h4[data-md-copy]")) return 28;
      if (element.matches("ul[data-md-copy], ol[data-md-copy]")) return 24;
      const previous = directChildren[index - 1];
      if (previous?.matches(".md-spacer")) return 0;
      const hasSharedProseMargins = content.classList.contains("prose") || content.classList.contains("game-copy");
      return previous?.matches("[data-md-copy], .md-copy-node") || hasSharedProseMargins ? 28 : 0;
    };
    const expectedBottomMargin = (element: HTMLElement) => {
      if (element.matches("h1[data-md-copy]")) return 24;
      if (element.matches("h2[data-md-copy]")) return 16;
      if (element.matches("h3[data-md-copy]")) return 12;
      if (element.matches("h4[data-md-copy]")) return 8;
      if (element.matches("ul[data-md-copy], ol[data-md-copy]")) return 24;
      return 0;
    };
    const proseSpacingFailures = isProseStream
      ? proseFlowNodes.flatMap(({ element, index }) => {
          const style = getComputedStyle(element);
          const expectedTop = expectedTopMargin(element, index);
          const expectedBottom = expectedBottomMargin(element);
          const failures = [];
          if (Math.abs(Number.parseFloat(style.marginTop) - expectedTop) > 1) {
            failures.push(`${element.tagName.toLowerCase()} margin-top ${style.marginTop} (expected ${expectedTop}px)`);
          }
          if (Math.abs(Number.parseFloat(style.marginBottom) - expectedBottom) > 1) {
            failures.push(`${element.tagName.toLowerCase()} margin-bottom ${style.marginBottom} (expected ${expectedBottom}px)`);
          }
          return failures;
        })
      : [];
    const proseFlowGaps = isProseStream
      ? proseFlowNodes.flatMap(({ element, index }, nodeIndex) => {
          const nextNode = proseFlowNodes[nodeIndex + 1];
          if (!nextNode || nextNode.index !== index + 1) return [];
          const actualGap = Math.round(
            nextNode.element.getBoundingClientRect().top - element.getBoundingClientRect().bottom
          );
          const expectedGap = Math.max(expectedBottomMargin(element), expectedTopMargin(nextNode.element, nextNode.index));
          return Math.abs(actualGap - expectedGap) > 1
            ? [`${element.tagName.toLowerCase()}→${nextNode.element.tagName.toLowerCase()} gap ${actualGap}px (expected ${expectedGap}px)`]
            : [];
        })
      : [];
    if (proseSpacingFailures.length || proseFlowGaps.length) {
      throw new Error(`markdown spacing mismatch: ${[...proseSpacingFailures, ...proseFlowGaps].join(", ")}`);
    }

    if (!directItems.length) {
      if (!isStructuredStream && !hasEmptyState) {
        throw new Error("no direct Journey items or explicit empty state found after hydration");
      }
      return {
        adGridColumn: null,
        adWidth: null,
        clsBeforeSynthetic: Number(clsBeforeSynthetic.toFixed(4)),
        columns: columnCount,
        contentDisplay: contentStyle.display,
        contentWidth: Math.round(content.getBoundingClientRect().width),
        directChildren: content.children.length,
        directItems: 0,
        emptyState: !isStructuredStream,
        gridAutoFlow: contentStyle.gridAutoFlow,
        isJourneyGrid,
        isStructuredStream,
        isCollectionStream,
        paragraphGap: null,
        selectorTag: content.tagName.toLowerCase()
      };
    }

    const flexItems = directItems.filter((item) => {
      const display = getComputedStyle(item).display;
      return display === "flex" || display === "inline-flex";
    });
    if (flexItems.length) throw new Error(`${flexItems.length} direct Journey items render as flex containers`);

    const hasInvalidCardGridParagraphGap = isCardGrid && paragraphGaps.some((gap) => gap < 26 || gap > 30);
    if (hasInvalidCardGridParagraphGap) {
      throw new Error(`direct paragraph gap is ${paragraphGaps.join(", ")}px instead of about 28px`);
    }

    document.querySelector("[data-journey-audit-ad]")?.remove();
    const syntheticAd = document.createElement("div");
    syntheticAd.dataset.journeyAuditAd = "true";
    syntheticAd.style.height = "90px";
    syntheticAd.style.display = "block";
    syntheticAd.textContent = "Journey placement audit";

    const contentRect = content.getBoundingClientRect();
    const incompleteRowAnchor = isCardGrid
      ? directItems[Math.min(columnCount, directItems.length - 1)]
      : directItems[0];
    incompleteRowAnchor.after(syntheticAd);
    const adStyle = getComputedStyle(syntheticAd);

    if (isCardGrid) {
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
    }
    if (isCardGrid && !contentStyle.gridAutoFlow.includes("dense")) {
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
      emptyState: false,
      gridAutoFlow: contentStyle.gridAutoFlow,
      isJourneyGrid,
      isStructuredStream,
      isCollectionStream,
      paragraphGap: paragraphGaps[0] ?? null,
      selectorTag: content.tagName.toLowerCase()
    };
  });
}

async function auditDecalClientUpdate(page: Page, baseUrl: string) {
  await page.goto(new URL("catalog/roblox-decal-ids", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#article-body");
  await waitForHydration(page);
  const initialItems = await page.locator("#article-body > [data-journey-item]").count();
  if (!initialItems) {
    const hasEmptyState = await page.locator("#article-body [class*='border-dashed']").count();
    if (hasEmptyState) return null;
    throw new Error("decal client update started without direct Journey items or an explicit empty state");
  }
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
    const discoveryContext = await browser.newContext({ viewport: VIEWPORTS[0] });
    const baseHostname = new URL(baseUrl).hostname;
    await discoveryContext.route("**/*", async (route) => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.hostname === baseHostname) await route.continue();
      else await route.abort();
    });
    const discoveryPage = await discoveryContext.newPage();
    const discoveredRoutes = await filterExistingRoutes(
      baseUrl,
      await discoverNestedRoutes(discoveryPage, baseUrl)
    );
    await discoveryContext.close();

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

      for (const route of discoveredRoutes) {
        try {
          const snapshot = await auditHydratedPage(page, baseUrl, route);
          results.push({ route, viewport: viewport.name, ...snapshot });
          const pageTwoRoute = await discoverPageTwoRoute(page, baseUrl, route);
          if (pageTwoRoute) {
            const pageTwoSnapshot = await auditHydratedPage(page, baseUrl, pageTwoRoute);
            results.push({ route: pageTwoRoute, viewport: viewport.name, ...pageTwoSnapshot });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(`${viewport.name} ${route}: ${message}`);
        }
      }

      if (viewport.name === "desktop") {
        const directItems = await auditDecalClientUpdate(page, baseUrl);
        if (directItems == null) {
          console.log("Decal client-side sort check skipped because the local dataset is empty.");
        } else {
          console.log(`Decal client-side sort retained ${directItems} direct Journey items.`);
        }
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
          const pageTwoRoute = await discoverPageTwoRoute(page, baseUrl, route);
          if (pageTwoRoute) {
            const pageTwoSnapshot = await auditHydratedPage(page, baseUrl, pageTwoRoute);
            results.push({ route: pageTwoRoute, viewport: breakpoint.name, ...pageTwoSnapshot });
          }
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
