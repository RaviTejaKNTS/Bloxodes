import { expect, test } from "@playwright/test";

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
