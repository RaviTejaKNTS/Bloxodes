import { expect, test } from "@playwright/test";
import { load } from "cheerio";

for (const path of ["/catalog", "/tools", "/stats", "/checklists", "/authors"]) {
  test(`${path} server HTML has one article body and no aside`, async ({ request }) => {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    const $ = load(await response.text());
    expect($("#article-body")).toHaveLength(1);
    expect($("aside")).toHaveLength(0);
    expect($(".content-sidebar-grid")).toHaveLength(0);
  });
}

test("wiki's inline updates panel never matches the ad rail selector", async ({ request }) => {
  const response = await request.get("/wiki");
  expect(response.status()).toBe(200);
  const $ = load(await response.text());
  expect($("#article-body")).toHaveLength(1);
  expect($("aside.space-y-4, aside#sidebar")).toHaveLength(0);
});
