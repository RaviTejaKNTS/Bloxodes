import { expect, test } from "@playwright/test";

const paths = process.env.RELEASE_SMOKE_PATHS?.split(",").filter(Boolean) ?? ["/", "/games", "/wiki", "/tools"];
for (const pathname of paths.slice(0, 8)) {
  test(`${pathname} renders and fits the screen`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const response = await page.goto(pathname, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.locator("main")).toBeVisible();
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
