import assert from "node:assert/strict";
import test from "node:test";
import { specialistMapAndToolPaths } from "../specialist-public-paths";

for (const moved of [false, true]) {
  test(`ad audits seed stored specialist URLs, moved=${moved}`, async () => {
    const map = moved ? "/maps/gta5" : "/gta/maps/gta5";
    const tool = moved ? "/tools/minecraft-xp-calculator" : "/minecraft/tools/xp-calculator";
    const requested: string[] = [];
    const request = (async (url: unknown) => {
      requested.push(String(url));
      return new Response(`<urlset>${[
        String(url).includes("gta.xml") ? map : tool,
        "/wiki/unrelated", // other sitemap page families do not seed the map/tool audit
      ].map(path => `<url><loc>https://bloxodes.com${path}</loc></url>`).join("")}</urlset>`);
    }) as typeof fetch;
    assert.deepEqual(await specialistMapAndToolPaths("https://preview.example", request), [map, tool]);
    assert.equal(requested.length, 2);
  });
}

test("fails rather than silently dropping specialist coverage on a sitemap outage", async () => {
  const request = (async () => new Response("Unavailable", { status: 503 })) as typeof fetch;
  await assert.rejects(specialistMapAndToolPaths("https://preview.example", request), /canonical route discovery failed: HTTP 503/);
});
