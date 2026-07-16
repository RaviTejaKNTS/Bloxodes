import { expect, test, type ConsoleMessage, type Page, type Request, type Response } from "@playwright/test";

import { CRITICAL_SEO_PATHS, SEO_ROUTE_CONTRACTS } from "../src/lib/seo-contracts";

const canonicalOrigin = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://bloxodes.com";

test.beforeEach(async ({ page }) => {
  await page.route(
    /https?:\/\/(?:scripts\.scriptwrapper\.com|www\.googletagmanager\.com|scripts\.grow\.me)\//,
    (route) => route.abort("blockedbyclient")
  );
});

function extractLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) =>
    match[1].replaceAll("&amp;", "&").trim()
  );
}

async function watchPage(page: Page) {
  const failures: string[] = [];
  const onPageError = (error: Error) => failures.push(`pageerror: ${error.message}`);
  const onConsole = (message: ConsoleMessage) => {
    const locationUrl = message.location().url;
    const currentOrigin = page.url().startsWith("http") ? new URL(page.url()).origin : "";
    const externalScriptError = locationUrl.startsWith("http") && currentOrigin && new URL(locationUrl).origin !== currentOrigin;
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:") && !externalScriptError) {
      failures.push(`console: ${message.text()}`);
    }
  };
  const onRequestFailed = (request: Request) => {
    if (request.failure()?.errorText === "net::ERR_ABORTED") return;
    const requestUrl = new URL(request.url());
    const baseUrl = new URL(page.url() || process.env.TEST_BASE_URL || "http://127.0.0.1:3000");
    if (requestUrl.origin === baseUrl.origin) {
      failures.push(`requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`);
    }
  };
  const onResponse = (response: Response) => {
    const status = response.status();
    if (status < 400) return;
    const responseUrl = new URL(response.url());
    if (status === 401 && /^\/api\/(?:codes|checklists|quizzes)\/(?:progress|session)$/.test(responseUrl.pathname)) return;
    const baseUrl = new URL(page.url() || process.env.TEST_BASE_URL || "http://127.0.0.1:3000");
    if (responseUrl.origin === baseUrl.origin && response.request().resourceType() !== "document") {
      failures.push(`response: ${status} ${response.url()}`);
    }
  };
  page.on("pageerror", onPageError);
  page.on("console", onConsole);
  page.on("requestfailed", onRequestFailed);
  page.on("response", onResponse);
  return {
    failures,
    stop: () => {
      page.off("pageerror", onPageError);
      page.off("console", onConsole);
      page.off("requestfailed", onRequestFailed);
      page.off("response", onResponse);
    }
  };
}

async function assertPublicPage(page: Page, pathname: string) {
  const runtime = await watchPage(page);
  const response = await page.goto(pathname, { waitUntil: "domcontentloaded" });

  expect(response, `No document response for ${pathname}`).not.toBeNull();
  expect(response?.status(), `${pathname} must return 200`).toBe(200);
  await expect(page).toHaveTitle(/\S/);
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.locator("main")).not.toBeEmpty();
  await expect(page.locator("h1")).toHaveCount(1);
  const headingBox = await page.locator("h1").boundingBox();
  expect(headingBox, `${pathname} h1 must be visible`).not.toBeNull();
  expect(headingBox!.y, `${pathname} h1 must begin above the fold`).toBeLessThan(page.viewportSize()!.height);
  expect(headingBox!.x + headingBox!.width, `${pathname} h1 exceeds the viewport`).toBeLessThanOrEqual(
    page.viewportSize()!.width + 1
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /\S/);
  const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
  expect(canonical, `${pathname} must have a canonical`).toBeTruthy();
  const canonicalUrl = new URL(canonical!, canonicalOrigin);
  expect(canonicalUrl.origin).toBe(new URL(canonicalOrigin).origin);
  expect(canonicalUrl.pathname.replace(/\/+$/, "") || "/").toBe(pathname.replace(/\/+$/, "") || "/");

  const robots = (await page.locator('meta[name="robots"]').getAttribute("content"))?.toLowerCase() ?? "";
  expect(robots, `${pathname} must not be noindex`).not.toContain("noindex");

  const challengeText = await page.locator("body").innerText();
  expect(challengeText).not.toMatch(/internal server error|application error|checking your browser|cloudflare ray id/i);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${pathname} has horizontal overflow`).toBeLessThanOrEqual(1);

  await page.waitForTimeout(200);
  runtime.stop();
  expect(runtime.failures, `${pathname} emitted runtime failures`).toEqual([]);

}

async function assertSampledInternalLinks(page: Page, pathname: string, limit = 4) {
  const baseOrigin = new URL(page.url()).origin;
  const hrefs = await page.locator('main a[href^="/"]').evaluateAll(
    (links, options) =>
      [...new Set(links.map((link) => (link as HTMLAnchorElement).getAttribute("href")).filter(Boolean))]
        .filter((href) => href !== options.pathname)
        .slice(0, options.limit),
    { limit, pathname }
  );
  for (const href of hrefs) {
    const response = await page.request.get(new URL(href!, baseOrigin).toString(), { maxRedirects: 0 });
    expect(response.status(), `${pathname} links to ${href}`).toBeLessThan(400);
  }
}

test.describe("public rendering contracts", () => {
  for (const pathname of CRITICAL_SEO_PATHS) {
    test(`${pathname} renders as an indexable page`, async ({ page }) => {
      await assertPublicPage(page, pathname);
    });
  }

  test("every sitemap family has a renderable detail sample", async ({ page }) => {
    test.setTimeout(120_000);
    for (const contract of SEO_ROUTE_CONTRACTS) {
      await test.step(contract.family, async () => {
        const response = await page.request.get(contract.sitemapPath);
        expect(response.status(), contract.sitemapPath).toBe(200);
        const locs = extractLocs(await response.text());
        const detail = locs
          .map((loc) => new URL(loc).pathname)
          .find((pathname) => contract.matches(pathname) && !contract.indexPaths.includes(pathname));
        if (!detail) return;
        await assertPublicPage(page, detail);
        await assertSampledInternalLinks(page, detail);
      });
    }
  });

  test("missing public routes return a real 404", async ({ page }) => {
    const response = await page.goto(`/__quality-missing-${Date.now()}`, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(404);
    await expect(page.locator("body")).not.toContainText(/internal server error|application error/i);
  });

  test("homepage internal navigation targets do not fail", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const baseOrigin = new URL(page.url()).origin;
    const hrefs = await page.locator('main a[href^="/"]').evaluateAll((links) =>
      [...new Set(links.map((link) => (link as HTMLAnchorElement).getAttribute("href")).filter(Boolean))].slice(0, 12)
    );
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      const response = await page.request.get(new URL(href!, baseOrigin).toString(), { maxRedirects: 0 });
      expect(response.status(), href!).toBeLessThan(400);
    }
  });

  test("primary navigation exposes working public destinations", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    if (page.viewportSize()!.width < 1280) {
      await page.getByRole("button", { name: "Open menu" }).click();
    }
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav).toBeVisible();
    const destinations = await nav.locator('a[href^="/"]').evaluateAll((links) =>
      [...new Set(links.map((link) => (link as HTMLAnchorElement).getAttribute("href")).filter(Boolean))].slice(0, 8)
    );
    expect(destinations.length).toBeGreaterThan(1);
    for (const destination of destinations) {
      const response = await page.request.get(destination!, { maxRedirects: 0 });
      expect(response.status(), destination!).toBeLessThan(400);
    }
  });

  test("Robux calculator responds to user input and mode controls", async ({ page }) => {
    await page.goto("/tools/robux-to-usd-calculator", { waitUntil: "networkidle" });
    const robuxInput = page.getByPlaceholder("Enter amount (e.g. 4600)");
    await robuxInput.fill("4600");
    await expect(page.getByText("Approx cost for exactly 4,600 Robux")).toBeVisible();
    const robuxResult = page.getByText("Approx cost for exactly 4,600 Robux").locator("..").locator("p").nth(1);
    await expect(robuxResult).not.toHaveText("—");

    await page.getByRole("button", { name: "USD → Robux" }).click();
    await expect(page.getByRole("heading", { name: "USD to Robux" })).toBeVisible();
    await expect(page.getByText(/Approx Robux for exactly/)).toBeVisible();
  });
});
