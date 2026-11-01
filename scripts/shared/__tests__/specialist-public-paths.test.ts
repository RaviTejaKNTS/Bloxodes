import { expect, it, vi } from "vitest";
import { specialistMapAndToolPaths } from "../specialist-public-paths";

it.each([false, true])("ad audits seed stored specialist URLs, moved=%s", async moved => {
  const map = moved ? "/maps/gta5" : "/gta/maps/gta5";
  const tool = moved ? "/tools/minecraft-xp-calculator" : "/minecraft/tools/xp-calculator";
  const request = vi.fn(async (url: unknown) => new Response(`<urlset>${[
    String(url).includes("gta.xml") ? map : tool,
    "/wiki/unrelated", // other sitemap page families do not seed the map/tool audit
  ].map(path => `<url><loc>https://bloxodes.com${path}</loc></url>`).join("")}</urlset>`));
  expect(await specialistMapAndToolPaths("https://preview.example", request as typeof fetch)).toEqual([map, tool]);
  expect(request).toHaveBeenCalledTimes(2);
});

it("fails rather than silently dropping specialist coverage on a sitemap outage", async () => {
  const request = vi.fn(async () => new Response("Unavailable", { status: 503 }));
  await expect(specialistMapAndToolPaths("https://preview.example", request as typeof fetch)).rejects.toThrow("canonical route discovery failed: HTTP 503");
});
