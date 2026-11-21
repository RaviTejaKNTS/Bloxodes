import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// The older publication paths (publish-content.ts -> sync:game-wiki-runtime,
// sync:game-collection-runtime, sync:franchise-collection-runtime) must store
// the R2 custom domain even when a bundle still carries the retired Worker route,
// because selected Roblox and franchise QA expect the new host on readback.
process.env.BLOXODES_ENV_PROFILE = "process-only";

const LEGACY = "https://media.bloxodes.com/wiki/";
const CURRENT = "https://wiki-media.bloxodes.com/";

function assertCanonical(value: unknown, label: string) {
  const text = JSON.stringify(value);
  assert.ok(!text.includes(LEGACY), `${label} still stores the retired wiki media route`);
}

async function workspace(t: TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "wiki-media-sync-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const write = async (file: string, data: unknown) => {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), JSON.stringify(data));
  };
  return { root, write };
}

const collectionCopy = (wikiSlug: string, collectionSlug: string) => ({
  wiki_slug: wikiSlug,
  collection_slug: collectionSlug,
  code: `${wikiSlug}-${collectionSlug}`,
  display_name: "Items",
  title: "All {count} Items in Example",
  seo_title: "All {count} Items in Example",
  meta_description: "Compare blade damage and crafting costs.",
  intro_md: `Iron blades hit hardest. ![Iron Blade](${LEGACY}items/iron-blade.webp)`,
  how_it_works_md: "",
  description_md: `Upgrade the iron blade at the forge. [Full art](${LEGACY}items/forge.webp)`,
  description_json: { hero: `${LEGACY}items/hero.webp` },
  faq_json: [{ q: "Where is the forge?", a: `In town. ![Forge](${LEGACY}items/forge.webp)` }],
  schema_ld_json: { image: `${LEGACY}items/iron-blade.webp` },
  thumb_url: `${LEGACY}items/iron-blade.webp`,
  wiki_md: "Blades deal physical damage to monsters."
});

test("sync:game-wiki-runtime readFinal stores the R2 custom domain for retired hub media URLs", async t => {
  const { root, write } = await workspace(t);
  const { readFinal } = await import("../../collections/sync-game-wiki-runtime");
  const legacyImage = `${LEGACY}123/example/hub-cover.webp`;
  await write("final.json", {
    universe_id: 123,
    slug: "example",
    title: "Example Wiki",
    seo_title: "Example Wiki",
    meta_description: "Craft blades, hunt monsters and upgrade your forge in Example.",
    description_md: `Hunt monsters to forge better blades. ![Forge](${legacyImage}) `.padEnd(220, "Upgrade blades at the forge. "),
    tips_md: `Upgrade the iron blade before entering the marsh. ![Marsh](${legacyImage}) `.padEnd(100, "Bring potions. "),
    controls_json: [],
    cover_image: null
  });
  const final = await readFinal(path.join(root, "final.json"));
  assertCanonical(final, "wiki final");
  assert.ok(final.description_md.includes(`${CURRENT}123/example/hub-cover.webp`));
  assert.ok(final.tips_md.includes(`${CURRENT}123/example/hub-cover.webp`));
});

test("sync:game-collection-runtime page copy stores the R2 custom domain for retired media URLs", async t => {
  const { root, write } = await workspace(t);
  const { targetSources, planCollection, pageCopyFromFinal } = await import("../../collections/sync-game-collection-runtime");
  await fs.mkdir(path.join(root, "collection/media"), { recursive: true });
  await write("collection/runtime-manifest.json", {
    schemaVersion: 1,
    game: { slug: "example", name: "Example", universeId: 123 },
    collection: { slug: "items", label: "Items" },
    dataset: "dataset.json",
    finalJson: "final.json",
    mediaRoot: "media",
    sourceUrls: ["https://example.com/items"]
  });
  await write("collection/dataset.json", {
    meta: { schemaVersion: 2, gameSlug: "example", collection: "items" },
    items: [{ item: { name: "Iron Blade", damage: 12 }, system: { slug: "iron-blade", section: "Blades", sortOrder: 10 } }]
  });
  await write("collection/final.json", collectionCopy("example", "items"));

  const [source] = await targetSources([path.join(root, "collection/runtime-manifest.json")]);
  const plan = await planCollection(source);
  assertCanonical(plan.finalJson, "planned final.json");
  const copy = pageCopyFromFinal(plan)!;
  assertCanonical(copy, "wiki_collection_pages copy");
  assert.equal(copy.thumb_url, `${CURRENT}items/iron-blade.webp`);
  assert.ok(String(copy.description_md).includes(`${CURRENT}items/forge.webp`));
  assert.equal(copy.title, "All 1 Items in Example");

  // A caller that assigns plan.finalJson directly is canonicalized at write time too.
  plan.finalJson = collectionCopy("example", "items");
  assertCanonical(pageCopyFromFinal(plan), "directly assigned final.json copy");
});

test("sync:franchise-collection-runtime page copy stores the R2 custom domain for retired media URLs", async t => {
  const { root, write } = await workspace(t);
  const { planManifest, pageCopy } = await import("../../franchise/sync-franchise-collection-runtime");
  await fs.mkdir(path.join(root, "collection/media"), { recursive: true });
  await write("collection/runtime-manifest.json", {
    schemaVersion: 1,
    namespace: "example",
    game: { slug: "example", name: "Example" },
    collection: { slug: "items", label: "Items", pageType: "database" },
    dataset: "dataset.json",
    finalJson: "final.json",
    mediaRoot: "media",
    sourceUrls: ["https://example.com/items"]
  });
  await write("collection/dataset.json", {
    meta: { schemaVersion: 2, gameSlug: "example", collection: "items" },
    items: [{ item: { name: "Iron Blade", damage: 12 }, system: { slug: "iron-blade", section: "Blades", sortOrder: 1 } }]
  });
  await write("collection/final.json", collectionCopy("example", "items"));

  const db = createClient("https://target.supabase.co", "test-key", { global: { fetch: async () => new Response("[]", { headers: { "content-type": "application/json" } }) } });
  const plan = await planManifest("example", path.join(root, "collection/runtime-manifest.json"), { wikiCanonicalPath: "/wiki/example", db });
  assertCanonical(plan.finalJson, "planned final.json");
  const copy = pageCopy(plan)!;
  assertCanonical(copy, "game_collection_pages copy");
  assert.equal(copy.thumb_url, `${CURRENT}items/iron-blade.webp`);
  assert.ok(String(copy.description_md).includes(`${CURRENT}items/forge.webp`));

  plan.finalJson = collectionCopy("example", "items");
  assertCanonical(pageCopy(plan), "directly assigned final.json copy");
});
