import { expect, test, type Response } from "@playwright/test";
import { writeFileSync } from "node:fs";

const selection = process.env.WIKI_COLLECTION_AUDIT_PATHS;
const selected = selection === undefined ? [] : selection.split(",");
const collectionPath = /^\/wiki\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
if (selection !== undefined && (!selected.length || selected.length > 10 || selected.some(path => !collectionPath.test(path)) || new Set(selected).size !== selected.length)) {
  throw new Error("WIKI_COLLECTION_AUDIT_PATHS must contain 1-10 wiki collection paths");
}

test.setTimeout(180_000);

for (const basePath of selected) {
  test(`${basePath} database collection`, async ({ page }, info) => {
    const origin = "https://bloxodes.com";
    const pagePaths: string[] = [];
    const sectionIds = new Set<string>();
    const cardIds = new Set<string>();
    let imageCount = 0;
    const errors: string[] = [];
    const indexability: Array<{
      path: string;
      canonical: string | null;
      documentRobots: string | null;
      documentGooglebotRobots: string | null;
      xRobotsTag: string | null;
      effectiveGoogleNoindex: boolean;
    }> = [];
    page.on("pageerror", error => errors.push(error.message));

    async function recordIndexability(path: string, response: Response, requireGoogleHeader = false) {
      const xRobotsTag = await response.headerValue("x-robots-tag");
      if (requireGoogleHeader) expect(xRobotsTag, `${path} Google query restriction`).toBe("googlebot: noindex, follow");
      else expect(xRobotsTag === null || xRobotsTag === "googlebot: noindex, follow", `${path} X-Robots-Tag: ${xRobotsTag}`).toBe(true);
      const canonicalTag = page.locator('link[rel="canonical"]');
      const canonical = await canonicalTag.count() ? await canonicalTag.first().getAttribute("href") : null;
      const robotsTag = page.locator('meta[name="robots"]');
      const documentRobots = await robotsTag.count() ? (await robotsTag.evaluateAll(nodes => nodes.map(node => node.getAttribute("content") ?? ""))).join(", ") : null;
      const googlebotTag = page.locator('meta[name="googlebot"]');
      const documentGooglebotRobots = await googlebotTag.count() ? (await googlebotTag.evaluateAll(nodes => nodes.map(node => node.getAttribute("content") ?? ""))).join(", ") : null;
      const noindex = (value: string | null) => /(?:^|[,\s])(?:noindex|none)(?:[,\s]|$)/i.test(value ?? "");
      indexability.push({
        path, canonical, documentRobots, documentGooglebotRobots, xRobotsTag,
        effectiveGoogleNoindex: noindex(documentRobots) || noindex(documentGooglebotRobots) || noindex(xRobotsTag)
      });
    }

    async function assertMetadata(path: string, noindex: boolean) {
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${origin}${path}`);
      const robotsTag = page.locator('meta[name="robots"]');
      const robots = (await robotsTag.evaluateAll(nodes => nodes.map(node => node.getAttribute("content") ?? ""))).join(", ");
      expect(robots.includes("noindex"), `${path} robots: ${robots}`).toBe(noindex);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator('[data-game-collection-view="cards"]')).toHaveCount(1);
    }

    async function inspectPage(path: string, noindex: boolean) {
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${path} status`).toBe(200);
      await assertMetadata(path, noindex);
      await recordIndexability(path, response!);
      const sections = page.locator('#article-body [id^="section-"]');
      expect(await sections.count(), `${path} section count`).toBeGreaterThan(0);
      for (const id of await sections.evaluateAll(nodes => nodes.map(node => node.id))) sectionIds.add(id);

      const cards = page.locator('#article-body article[id^="item-"]');
      expect(await cards.count(), `${path} card count`).toBeGreaterThan(0);
      for (const card of await cards.all()) {
        const id = await card.getAttribute("id");
        expect(id).toBeTruthy();
        expect(cardIds.has(id!), `${path} repeats ${id}`).toBe(false);
        cardIds.add(id!);
        await expect(card.locator("h3")).toContainText(/\S/);
        const fields = await card.locator("dl dt").count();
        const description = await card.locator("h3 + p").filter({ hasText: /\S/ }).count();
        expect(fields + description, `${path} ${id} lacks useful fields`).toBeGreaterThan(0);
      }

      const images = page.locator('#article-body article[id^="item-"] [data-collection-image-preview] img');
      imageCount += await images.count();
      for (const image of await images.all()) {
        await image.scrollIntoViewIfNeeded();
        await expect.poll(() => image.evaluate(node => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0)).toBe(true);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      pagePaths.push(path);
      await page.screenshot({ path: info.outputPath(`page-${pagePaths.length}.png`), fullPage: true });
    }

    await inspectPage(basePath, false);
    const sectionOptions = await page.locator('select[aria-label="Jump to section"] option').evaluateAll(nodes =>
      nodes.filter(node => (node as HTMLOptionElement).value).map(node => ({
        id: (node as HTMLOptionElement).value,
        label: node.textContent?.trim() ?? ""
      }))
    );
    const pagination = page.locator('nav[aria-label="Pagination"]');
    const hasPagination = await pagination.count() > 0;
    const pageNumbers = hasPagination
      ? await pagination.first().locator("a").evaluateAll(nodes => nodes.map(node => Number(node.textContent?.trim())).filter(Number.isInteger).filter(value => value > 0))
      : [];
    const totalPages = Math.max(1, ...pageNumbers);
    expect(totalPages, "selected audit must stay bounded").toBeLessThanOrEqual(30);
    for (let number = 2; number <= totalPages; number += 1) {
      await inspectPage(`${basePath}/page/${number}`, true);
    }
    expect(await page.locator('nav[aria-label="Pagination"]').count()).toBe(hasPagination ? 2 : 0);
    if (!hasPagination) expect(totalPages).toBe(1);
    for (const option of sectionOptions) {
      expect(sectionIds.has(option.id), `section option ${option.label} has no rendered section`).toBe(true);
      await page.goto(basePath, { waitUntil: "domcontentloaded" });
      await page.locator('select[aria-label="Jump to section"]').selectOption(option.id);
      await page.waitForURL(url => url.hash === `#${option.id}`);
      await expect(page.locator(`[id="${option.id}"]`)).toBeVisible();
    }
    if (sectionOptions.length === 0) expect(sectionIds.size).toBe(1);
    else expect(sectionOptions.length).toBe(sectionIds.size);
    expect(imageCount, `${basePath} has no image-backed cards`).toBeGreaterThan(0);

    const queryResponse = await page.goto(`${basePath}?page=2&section=invalid`, { waitUntil: "domcontentloaded" });
    expect(queryResponse?.status()).toBe(200);
    await assertMetadata(basePath, false); // Query parameters are ignored by this route.
    await recordIndexability(`${basePath}?page=2&section=invalid`, queryResponse!, true);
    await expect(page.locator("h1")).not.toContainText("Page 2");
    const invalidPath = `${basePath}/page/${totalPages + 1}`;
    const invalidResponse = await page.goto(invalidPath, { waitUntil: "domcontentloaded" });
    expect(invalidResponse?.status()).toBe(404);
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toHaveAttribute("content", /noindex/);
    await recordIndexability(invalidPath, invalidResponse!);
    expect(errors).toEqual([]);

    const report = {
      basePath,
      viewport: info.project.name,
      pagePaths,
      pagination: hasPagination ? { pages: totalPages, checked: pagePaths.length } : "not applicable: one page",
      sections: sectionOptions.length ? sectionOptions : [...sectionIds].map(id => ({ id, label: "single section" })),
      sectionNavigation: sectionOptions.length ? `${sectionOptions.length} options followed` : "not applicable: one section",
      uniqueCards: cardIds.size,
      loadedImages: imageCount,
      indexability,
      queryBehavior: "page and section query ignored for content and canonical; Googlebot noindex response header",
      invalidPage: `${totalPages + 1} returned 404 and noindex`
    };
    writeFileSync(info.outputPath("collection-report.json"), `${JSON.stringify(report, null, 2)}\n`);
    await info.attach("collection-report", { body: JSON.stringify(report, null, 2), contentType: "application/json" });
  });
}
