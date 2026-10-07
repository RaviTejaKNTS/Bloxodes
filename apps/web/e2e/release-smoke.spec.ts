import { expect, test } from "@playwright/test";
import fs from "node:fs";

const selected: Array<{path: string; contains?: string}> = process.env.RELEASE_SMOKE_BATCH
  ? JSON.parse(fs.readFileSync(process.env.RELEASE_SMOKE_BATCH, "utf8")).urls
  : (process.env.RELEASE_SMOKE_PATHS?.split(",").filter(Boolean) ?? ["/", "/games", "/wiki", "/tools"]).map(path => ({path}));
for (const {path: pathname, contains} of selected.slice(0, 20)) {
  test(`${pathname} renders and fits the screen`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const response = await page.goto(pathname, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.locator("main")).toBeVisible();
    if (contains) await expect(page.locator("main")).toContainText(contains, { ignoreCase: true });
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page).toHaveTitle(/\S/);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical).toBeTruthy();
    const canonicalUrl = new URL(canonical!);
    expect(canonicalUrl.origin).toBe("https://bloxodes.com");
    expect(canonicalUrl.pathname.replace(/\/+$/, "") || "/").toBe(pathname);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /\S/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
    await page.screenshot({ path: info.outputPath("page.png"), fullPage: true });
  });
}
