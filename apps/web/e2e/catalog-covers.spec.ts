import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

for (const [name, code] of [
  ["game", "roblox-music-ids/games/driving-empire"],
  ["items", "roblox-items-and-bundles"],
  ["title", "admin-commands"]
]) {
  test(`catalog cover: ${name}`, async ({ request }, info) => {
    test.setTimeout(120_000);
    const response = await request.get(`/catalog-image/${code}.png`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
    const png = await response.body();
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    const imagePath = info.outputPath(`catalog-${name}.png`);
    await writeFile(imagePath, png);
    await info.attach(`catalog-${name}`, { path: imagePath, contentType: "image/png" });
  });
}

test("unknown catalog cover is an uncached 404", async ({ request }) => {
  const response = await request.get("/catalog-image/unknown-catalog-cover-review.png");
  expect(response.status()).toBe(404);
  expect(response.headers()["cache-control"]).toBe("no-store");
});
