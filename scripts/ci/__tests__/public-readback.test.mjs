import assert from "node:assert/strict";
import test from "node:test";
import { publicationSitemap, verifyPublicText } from "../public-readback.mjs";

test("publication waits through temporary HTTP and stale-content failures", async () => {
  const responses = [new Response("Temporary failure", {status: 503}), new Response("<body>Old title</body>"), new Response("<body>New &amp; correct title</body>")];
  let requests = 0;
  let waits = 0;
  await verifyPublicText("/wiki/example", "New & correct title", {
    request: async (url, options) => {
      assert.equal(url, "https://bloxodes.com/wiki/example");
      assert.equal(options.headers["cache-control"], "no-cache");
      return responses[requests++];
    },
    wait: async () => { waits++; },
  });
  assert.equal(requests, 3);
  assert.equal(waits, 2);
});

test("publication fails after bounded readback attempts", async () => {
  let requests = 0;
  await assert.rejects(verifyPublicText("/wiki/example", "Required title", {
    attempts: 3,
    request: async () => { requests++; throw new Error("Network timeout"); },
    wait: async () => {},
  }), /Network timeout/);
  assert.equal(requests, 3);
});

test("sitemap checks cover legacy, franchise and shared game routes", () => {
  assert.equal(publicationSitemap("/wiki/example/units"), "/sitemaps/wiki.xml");
  assert.equal(publicationSitemap("/gta"), "/sitemaps/gta.xml");
  assert.equal(publicationSitemap("/gta/wiki/gta-5/vehicles"), "/sitemaps/gta.xml");
  assert.equal(publicationSitemap("/minecraft/tools/crafting"), "/sitemaps/minecraft.xml");
  for (const edition of ["java", "bedrock"]) {
    assert.equal(publicationSitemap(`/minecraft/${edition}/wiki`), "/sitemaps/minecraft.xml");
    assert.equal(publicationSitemap(`/minecraft/${edition}/wiki/blocks`), "/sitemaps/minecraft.xml");
    assert.equal(publicationSitemap(`/minecraft/${edition}/quizzes/blocks`), "/sitemaps/games.xml");
  }
  assert.equal(publicationSitemap("/red-dead/wiki/red-dead-2/weapons"), "/sitemaps/red-dead.xml");
  assert.equal(publicationSitemap("/sandustry/wiki"), "/sitemaps/games.xml");
  assert.equal(publicationSitemap("/minecraft/quizzes/blocks"), "/sitemaps/games.xml");
  assert.equal(publicationSitemap("/games"), "/sitemaps/main.xml");
});
