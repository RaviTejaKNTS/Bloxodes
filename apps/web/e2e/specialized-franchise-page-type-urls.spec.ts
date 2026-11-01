import { expect, test } from "@playwright/test";

// The PR workflow runs this after the specialized namespace moves are applied
// in managed development; missing fixtures must fail this suite.
const cases = [
  { old: "/gta/maps/gta5", path: "/maps/gta5", engine: ".leaflet-container" },
  { old: "/gta/wiki/gta-5/spaceship-parts", path: "/wiki/gta-5/spaceship-parts" },
  { old: "/gta/checklists/gta-5", path: "/checklists/gta-5" },
  { old: "/red-dead/wiki/red-dead-redemption-2/cigarette-cards", path: "/wiki/red-dead-redemption-2/cigarette-cards" },
  { old: "/minecraft/java/wiki/enchantments", path: "/wiki/minecraft-java/enchantments" },
  { old: "/minecraft/tools/nether-coordinate-converter", path: "/tools/minecraft-nether-coordinate-converter" },
  { old: "/minecraft/wiki/achievements", path: "/wiki/minecraft-bedrock/achievements" },
  { old: "/minecraft/wiki/enchantments?edition=java&ref=guide", path: "/wiki/minecraft-java/enchantments?ref=guide" }
];

for (const fixture of cases) {
  test(`specialized franchise move: ${fixture.old}`, async ({ page, request }, info) => {
    test.skip(process.env.GITHUB_ACTIONS !== "true", "GitHub managed-development verification only");
    const coverage = { ...fixture, result: "STARTED" };
    try {
      const redirect = await request.get(fixture.old, { maxRedirects: 0 });
      expect([301, 308]).toContain(redirect.status());
      expect(redirect.headers().location).toBeTruthy();
      expect(new URL(redirect.headers().location, redirect.url()).href)
        .toBe(new URL(fixture.path, redirect.url()).href);
      const response = await page.goto(fixture.path, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBe(200);
      expect(response?.request().redirectedFrom()).toBeNull();
      const expected = new URL(fixture.path, "https://bloxodes.com");
      expect(new URL(page.url()).pathname).toBe(expected.pathname);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://bloxodes.com${expected.pathname}`);
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", `https://bloxodes.com${expected.pathname}`);
      await expect(page).toHaveTitle(/\S/);
      await expect(page.locator("h1").first()).toContainText(/\S/);
      if (fixture.engine) await expect(page.locator(fixture.engine)).toBeVisible();
      coverage.result = "PASSED";
    } finally {
      console.log(JSON.stringify(coverage));
      await info.attach("specialized-url-coverage.json", { body: JSON.stringify(coverage), contentType: "application/json" });
    }
  });
}
