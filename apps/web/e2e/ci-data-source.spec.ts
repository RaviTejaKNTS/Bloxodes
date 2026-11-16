import { expect, test } from "@playwright/test";
import fs from "node:fs";

test("server-rendered samples and browser data calls use the CI fixture", async ({ page, request }) => {
  test.skip(process.env.BLOXODES_CI_DATA !== "1", "Only isolated code checks use the fixture");
  for (const path of ["/articles/blox-fruits-first-island", "/codes/blox-fruits", "/quizzes/blox-fruits", "/checklists/blox-fruits", "/events/blox-fruits"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(await response.text(), path).toContain("Blox Fruits");
  }
  await page.goto("/", {waitUntil:"domcontentloaded"});
  const rows = await page.evaluate(async () => {
    const response = await fetch("http://127.0.0.1:54321/rest/v1/code_pages?select=slug,name&slug=eq.blox-fruits", {headers:{apikey:"ci-only-anon"}});
    if (!response.ok) throw new Error(`CI browser data request failed: ${response.status}`);
    return response.json();
  });
  expect(rows).toEqual([{slug:"blox-fruits",name:"Blox Fruits"}]);
});


test("puzzle samples are prerendered and show current and archived answers", async ({ page, request }) => {
  test.skip(process.env.BLOXODES_CI_DATA !== "1", "Only isolated code checks use the fixture");
  const manifest = JSON.parse(fs.readFileSync("apps/web/.next/prerender-manifest.json", "utf8"));
  expect(manifest.routes["/puzzles/wordle"], "The build must prerender the seeded puzzle detail").toBeTruthy();
  await page.goto("/puzzles/wordle", { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1")).toHaveText("Wordle answer");
  await expect(page.getByText("No saved answer is available yet.")).toHaveCount(0);
  await page.getByRole("button", { name: "Show answer", exact: true }).click();
  await expect(page.getByLabel("Wordle answer TRAIL", { exact: true })).toBeVisible();
  const archive = page.getByRole("link", { name: "View answer", exact: true }).first();
  const archivePath = await archive.getAttribute("href");
  expect(archivePath).toMatch(/^\/puzzles\/wordle\/\d{4}-\d{2}-\d{2}$/);
  const archived = await request.get(archivePath!);
  expect(archived.status()).toBe(200);
  expect(await archived.text()).toContain("Archived Answer");
  const sitemap = await request.get("/sitemaps/puzzles.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain("https://bloxodes.com/puzzles/wordle");
});

test("fixture discovery routes return populated sitemaps and feeds", async ({ request }) => {
  test.skip(process.env.BLOXODES_CI_DATA !== "1", "Only isolated code checks use the fixture");
  const index = await request.get("/sitemap.xml");
  expect(index.status()).toBe(200);
  const paths = [...(await index.text()).matchAll(/<loc>https:\/\/bloxodes\.com([^<]+)<\/loc>/g)].map(match => match[1]);
  expect(paths.length).toBeGreaterThan(0);
  for (const path of paths) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(await response.text(), path).toContain("<loc>");
  }
  const feed = await request.get("/feed.xml");
  expect(feed.status()).toBe(200);
  expect(await feed.text()).toContain("<item>");
});
