import assert from "node:assert/strict";
import test from "node:test";
import { specialistMapAndToolPaths } from "../specialist-public-paths";

test("ad audits discover all shared canonical maps and tools", async () => {
  const paths = ["/maps/gta5", "/tools/minecraft-xp-calculator", "/maps/new-game", "/wiki/unrelated"];
  const request = (async (url: unknown) => {
    assert.equal(String(url), "https://preview.example/sitemaps/games.xml");
    return new Response(`<urlset>${paths.map(path => `<url><loc>https://bloxodes.com${path}</loc></url>`).join("")}</urlset>`);
  }) as typeof fetch;
  assert.deepEqual(await specialistMapAndToolPaths("https://preview.example", request), paths.slice(0, 3));
});

test("fails on a sitemap outage", async () => {
  const request = (async () => new Response("Unavailable", { status: 503 })) as typeof fetch;
  await assert.rejects(specialistMapAndToolPaths("https://preview.example", request), /canonical route discovery failed: HTTP 503/);
});
