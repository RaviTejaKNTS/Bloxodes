import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { bundleSchema, gameSchema, runtimeManifestSchema, bundleJsonSchema } from "../../../contracts/game-wiki/v1/schema";
import { parseContentOptions } from "../../content/roblox-wiki-cli";
import { assertGameWikiIdentity, assertGameWikiRoutes, assertNoRobloxIdentifiers, gameWikiPath, resolveGameWikiIdentity, selectGameWikiPages } from "../game-wiki-bundle";
import { readWikiContract } from "../wiki-publish-contract";
import { assertCollectionMissingImages } from "../roblox-wiki-bundle";

const game = { slug: "example", name: "Example", kind: "game" as const };
const bundle = () => bundleSchema.parse({ contract: "game-wiki@1", namespace: "example", game, hub: { finalJson: "wiki/final.json" }, collections: [{ manifest: "collections/items/runtime-manifest.json" }] });
const manifest = (slug = "items") => ({ schemaVersion: 1, namespace: "example", game: { slug: game.slug, name: game.name }, collection: { slug, label: "Items", pageType: "database" }, dataset: "dataset.json", finalJson: "final.json", mediaRoot: "media", sourceUrls: ["https://example.com/items"] });

test("game-wiki contract retains franchise authoring shapes and exports JSON Schema", () => {
  assert.equal(bundle().contract, "game-wiki@1");
  assert.equal(bundleJsonSchema.type, "object");
  assert.equal(runtimeManifestSchema.parse(manifest()).collection.pageType, "database");
  assert.equal(gameSchema.parse({ slug: "example", title: "Example", status: "released", cover_image: "media/cover.webp", hero_image: "media/hero.webp" }).title, "Example");
  for (const bad of [{ ...bundle(), contract: "game-wiki@2" }, { ...bundle(), namespace: "../other" }, { ...bundle(), game: { ...game, universeId: 123 } }]) assert.equal(bundleSchema.safeParse(bad).success, false);
  assert.equal(runtimeManifestSchema.safeParse({ ...manifest(), mediaRoot: "../media" }).success, false);
  assert.equal(runtimeManifestSchema.safeParse({ ...manifest(), collection: { ...manifest().collection, pageType: "checklist" } }).success, false);
});

test("status accepts a namespace without changing Roblox defaults or production gates", () => {
  assert.deepEqual(parseContentOptions(["status", "--namespace", "red-dead", "--game", "red-dead-redemption"]), { command: "status", target: "managed-dev", apply: false, allowProd: false, namespace: "red-dead", game: "red-dead-redemption" });
  assert.equal(parseContentOptions(["status", "--game", "example"]).namespace, undefined);
  assert.equal(parseContentOptions(["status", "--namespace", "gta", "--game", "gta", "--kind", "game"]).kind, "game");
  assert.throws(() => parseContentOptions(["status", "--game", "gta", "--kind", "game"]), /requires franchise status/);
  for (const args of [["publish", "/bundle", "--namespace", "example"], ["status", "--game", "example", "--namespace", "../escape"], ["status", "--game", "example", "--namespace", "roblox"], ["publish", "/bundle", "--target", "production", "--apply"], ["publish", "/bundle", "--allow-prod"]]) assert.throws(() => parseContentOptions(args));
});

test("root, child, reserved namespace and Minecraft routes use registry identities", async () => {
  assert.doesNotThrow(() => assertGameWikiIdentity(bundle()));
  const child = { namespace: "series", game: { slug: "sequel", name: "Sequel", kind: "game" as const, parent: "series" } };
  assert.doesNotThrow(() => assertGameWikiIdentity(child));
  for (const invalid of [{ ...child, namespace: "codes" }, { ...child, game: { ...child.game, kind: "franchise" as const } }, { ...child, game: { ...child.game, parent: "other" } }, { ...child, game: { ...child.game, parent: undefined } }]) assert.throws(() => assertGameWikiIdentity(invalid));
  assert.equal(gameWikiPath("example", "example"), "/example/wiki");
  assert.equal(gameWikiPath("series", "sequel", "series"), "/series/wiki/sequel");
  assert.equal(gameWikiPath("minecraft", "minecraft-java", "minecraft"), "/minecraft/java/wiki");
  assert.throws(() => assertGameWikiIdentity({ namespace: "minecraft", game: { ...child.game, slug: "minecraft-console", parent: "minecraft" } }), /route code/);
  const root = path.resolve("tmp", `game-wiki-routes-${randomUUID()}`);
  await fs.mkdir(path.join(root, "dedicated"), { recursive: true });
  try {
    await assertGameWikiRoutes(bundle(), root);
    await assert.rejects(assertGameWikiRoutes({ ...bundle(), namespace: "dedicated", game: { ...game, slug: "dedicated" } }, root), /route code/);
    await assert.rejects(assertGameWikiRoutes({ ...bundle(), namespace: "gta", game: { ...game, slug: "gta", kind: "franchise" } }, root), /root collections need route code/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test("selection leaves unfinished unselected pages alone and rejects duplicates", async () => {
  const input = { ...bundle(), collections: [{ manifest: "collections/items/runtime-manifest.json" }, { manifest: "collections/unfinished/runtime-manifest.json" }] };
  const selected = await selectGameWikiPages(input, ["items"], async file => file.includes("unfinished") ? { collection: { slug: "unfinished" } } : manifest());
  assert.equal(selected.collections.length, 1);
  const hubOnly = await selectGameWikiPages(input, ["hub"], async () => { throw new Error("must not read unselected manifests"); });
  assert.equal(hubOnly.collections.length, 0);
  await assert.rejects(selectGameWikiPages(input, ["absent"], async () => manifest()), /Unknown --only/);
  await assert.rejects(selectGameWikiPages({ ...input, collections: [input.collections[0], input.collections[0]] }, undefined, async () => manifest()), /Duplicate/);
});

test("target UUIDs may differ and existing game/hub ownership stays permanent", () => {
  for (const prefix of ["dev", "prod"]) {
    const rows = [{ id: `${prefix}-root`, slug: "series", kind: "franchise", parent_id: null, is_published: true }, { id: `${prefix}-child`, slug: "sequel", kind: "game", parent_id: `${prefix}-root`, is_published: true }];
    const hub = { id: `${prefix}-hub`, slug: "sequel", game_id: `${prefix}-child` };
    const resolved = resolveGameWikiIdentity(rows, [hub], "series", { slug: "sequel", kind: "game", parent: "series" });
    assert.equal(resolved.game?.id, `${prefix}-child`);
    assert.equal(resolved.hub?.id, `${prefix}-hub`);
    assert.equal(resolved.parentId, `${prefix}-root`);
    assert.throws(() => resolveGameWikiIdentity(rows, [{ ...hub, game_id: "wrong-target" }], "series", { slug: "sequel", kind: "game", parent: "series" }), /belongs to a different game/);
    assert.throws(() => resolveGameWikiIdentity(rows, [hub], "series", { slug: "sequel", kind: "franchise", parent: "series" }), /kind conflicts/);
  }
  // GTA has a franchise root and a child game with the same slug. Kind is part
  // of the natural key; it must not pick the first row with a matching slug.
  const gta = [{ id: "root", slug: "gta", kind: "franchise", parent_id: null, is_published: true }, { id: "original-game", slug: "gta", kind: "game", parent_id: "root", is_published: true }];
  assert.equal(resolveGameWikiIdentity(gta, [], "gta", { slug: "gta", kind: "game", parent: "gta" }).game?.id, "original-game");
  const gtaHubs = [{ id: "root-hub", slug: "gta-hub", game_id: "root" }, { id: "original-hub", slug: "gta", game_id: "original-game" }];
  assert.equal(resolveGameWikiIdentity(gta, gtaHubs, "gta", { slug: "gta", kind: "franchise" }).hub?.id, "root-hub");
  assert.equal(resolveGameWikiIdentity(gta, gtaHubs, "gta", { slug: "gta", kind: "game", parent: "gta" }).hub?.id, "original-hub");
  for (const namespace of ["red-dead", "minecraft"]) {
    const root = { id: "root", slug: namespace, kind: "franchise", parent_id: null, is_published: true };
    const hub = { id: "root-hub", slug: `${namespace}-hub`, game_id: root.id };
    assert.equal(resolveGameWikiIdentity([root], [hub], namespace, { slug: namespace, kind: "franchise" }).hubSlug, hub.slug);
  }
  assert.throws(() => resolveGameWikiIdentity(gta, [...gtaHubs, { ...gtaHubs[0], id: "duplicate" }], "gta", { slug: "gta", kind: "franchise" }), /Multiple hubs/);
  assert.throws(() => resolveGameWikiIdentity([], [{ id: "foreign", slug: "new-game", game_id: "other-game" }], "new-game", { slug: "new-game", kind: "game" }), /belongs to a different game/);
});

test("Minecraft wrappers and direct franchise commands invoke their CLI runners", async () => {
  const scripts = JSON.parse(await fs.readFile("package.json", "utf8")).scripts;
  for (const command of ["publish:minecraft-wiki", "sync:minecraft-collection-runtime", "publish:franchise-wiki-hubs", "sync:franchise-collection-runtime", "sync:shared-game-collection-runtime"]) {
    assert.ok(scripts[command]);
    const output = execFileSync("npm", ["run", "--silent", command, "--", "--help"], { encoding: "utf8", env: testEnvironment(), stdio: "pipe" });
    assert.match(output, /Usage: npm run (publish:franchise-wiki-hubs|sync:franchise-collection-runtime)/, command);
  }
  const run = (command: string, args: string[]) => execFileSync("npm", ["run", "--silent", command, "--", ...args], { encoding: "utf8", env: testEnvironment(), stdio: "pipe" });
  assert.throws(() => run("publish:minecraft-wiki", ["--workspace", "tmp", "--game", "unapproved-edition"]), /Minecraft requires an approved edition identity/);
  assert.throws(() => run("sync:minecraft-collection-runtime", []), /At least one --manifest is required/);
});

test("Roblox identifiers and stale or conflicting item image exceptions fail", () => {
  for (const key of ["universe_id", "universeId", "place_id", "rootPlaceId", "roblox_id"]) assert.throws(() => assertNoRobloxIdentifiers({ meta: { [key]: 123 } }, "dataset.json"), /Roblox identifier/);
  const items = [{ item_slug: "shown", image_key: "key" }, { item_slug: "missing", image_key: null }];
  const decision = { slug: "missing", reason: "No exact artwork exists." };
  assert.doesNotThrow(() => assertCollectionMissingImages(items, [], [decision]));
  assert.throws(() => assertCollectionMissingImages(items), /has no image/);
  assert.throws(() => assertCollectionMissingImages(items, [decision], [{ ...decision, reason: "Different reason" }]), /Conflicting/);
  assert.throws(() => assertCollectionMissingImages(items, [decision, { slug: "shown", reason: "Stale" }]), /stale/);
});

test("contract dispatch supports both versions and rejects symlink escapes", async () => {
  const folder = path.resolve("tmp", `game-wiki-dispatch-${randomUUID()}`);
  await fs.mkdir(path.join(folder, "bundle"), { recursive: true });
  try {
    for (const contract of ["roblox-wiki@1", "game-wiki@1"]) {
      await fs.writeFile(path.join(folder, "bundle/bundle.json"), JSON.stringify({ contract }));
      assert.equal(await readWikiContract(path.join(folder, "bundle")), contract);
    }
    await fs.writeFile(path.join(folder, "bundle/bundle.json"), JSON.stringify({ contract: "game-wiki@2" }));
    await assert.rejects(readWikiContract(path.join(folder, "bundle")), /Supported versions: roblox-wiki@1, game-wiki@1/);
    await fs.writeFile(path.join(folder, "outside.json"), JSON.stringify(bundle()));
    await fs.unlink(path.join(folder, "bundle/bundle.json"));
    await fs.symlink(path.join(folder, "outside.json"), path.join(folder, "bundle/bundle.json"));
    await assert.rejects(readWikiContract(path.join(folder, "bundle")), /escapes/);
  } finally { await fs.rm(folder, { recursive: true, force: true }); }
});

async function fixture() {
  const root = path.resolve("tmp", `game-wiki-command-${randomUUID()}`);
  const collection = path.join(root, "collections/items");
  await fs.mkdir(path.join(collection, "media"), { recursive: true });
  await fs.mkdir(path.join(root, "wiki"));
  const write = (file: string, data: unknown) => fs.writeFile(path.join(root, file), JSON.stringify(data));
  await sharp({ create: { width: 160, height: 90, channels: 3, background: "red" } }).webp().toFile(path.join(root, "wiki/cover.webp"));
  await sharp({ create: { width: 80, height: 80, channels: 3, background: "blue" } }).webp().toFile(path.join(root, "wiki/hero.webp"));
  await sharp({ create: { width: 40, height: 40, channels: 3, background: "green" } }).webp().toFile(path.join(collection, "media/sword.webp"));
  await write("bundle.json", bundle());
  await write("game.json", { slug: "example", title: "Example", status: "released", cover_image: "wiki/cover.webp", hero_image: "wiki/hero.webp" });
  await write("wiki/final.json", { game_slug: "example", slug: "example", title: "Example Wiki", seo_title: "Example Wiki", meta_description: "Craft blades and hunt monsters.", description_md: "Hunt monsters to forge better blades.", tips_md: "Upgrade the iron blade before entering the marsh.", controls_json: [], cover_image: null });
  const final = { wiki_slug: "example", collection_slug: "items", code: "example-items", display_name: "Items", title: "All {count} Items in Example", seo_title: "All {count} Items in Example", meta_description: "Compare blade damage and crafting costs.", intro_md: "Iron blades deal more damage than wooden blades.", description_md: "Upgrade the iron blade at the forge.", description_json: {}, how_it_works_md: "", faq_json: [], wiki_md: "Blades deal physical damage to monsters." };
  await write("collections/items/final.json", final);
  await write("collections/items/runtime-manifest.json", manifest());
  await write("collections/items/dataset.json", { meta: { schemaVersion: 2, gameSlug: "example", collection: "items", itemFields: ["name", "damage", "cost", "obtainment"], columns: ["name", "damage", "cost", "obtainment"], display: { groupLabel: "Type", sectionOrder: ["Blades"], tableFields: ["damage", "cost", "obtainment"], cardFields: ["damage", "cost", "obtainment"] } }, items: [{ item: { name: "Iron Blade", damage: 12, cost: 50, obtainment: "Forge" }, system: { slug: "iron-blade", section: "Blades", sortOrder: 10, image: "sword.webp" } }] });
  return { root, write, final };
}

function testEnvironment() {
  return { ...process.env, BLOXODES_ENV_PROFILE: "process-only", SUPABASE_URL: "https://bbtcaurrtyoukvjbxbbj.supabase.co", SUPABASE_SERVICE_ROLE: "test-only-service-role", WIKI_R2_ENDPOINT: "https://r2.example.com", WIKI_R2_ACCESS_KEY_ID: "test-access", WIKI_R2_SECRET_ACCESS_KEY: "test-secret", WIKI_R2_BUCKET: "bloxodes-wiki", WIKI_MEDIA_PUBLIC_BASE_URL: "https://media.bloxodes.com/wiki" };
}

// Run the actual CLI against an isolated HTTP fake. Simulate the ownership and
// edition-route constraints that previously failed only after writes began.
async function applyFixture(root: string, tables: Record<string, Array<Record<string, any>>>) {
  const report = path.join(root, "apply-report.json");
  const preload = `
    import fs from 'node:fs';
    import { randomUUID } from 'node:crypto';
    const tables = ${JSON.stringify(tables)};
    const calls = [];
    const media = new Set();
    process.on('exit', () => fs.writeFileSync(${JSON.stringify(report)}, JSON.stringify({tables,calls})));
    globalThis.fetch = async (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input.url ?? input.href);
      const method = init?.method ?? input.method ?? 'GET';
      if (url.hostname === 'media.bloxodes.com' && method === 'GET') {
        const file = url.pathname.endsWith('cover.webp') ? 'wiki/cover.webp' : 'wiki/hero.webp';
        return new Response(fs.readFileSync(${JSON.stringify(root)}+'/'+file), {headers:{'content-type':'image/webp'}});
      }
      if (url.hostname === 'r2.example.com') {
        if (!['HEAD','PUT'].includes(method)) throw new Error('Unexpected R2 operation');
        if (method === 'PUT') media.add(url.pathname);
        return new Response(null, {status: method === 'HEAD' && !media.has(url.pathname) ? 404 : 200});
      }
      if (!url.pathname.startsWith('/rest/v1/')) throw new Error('Unexpected external request');
      const table = url.pathname.split('/').pop();
      const source = tables[table] ??= [];
      const matching = source.filter(row => [...url.searchParams].every(([key,value]) => {
        if (value.startsWith('eq.')) return String(row[key]) === value.slice(3);
        if (value.startsWith('in.')) return value.slice(4,-1).split(',').map(x=>x.replaceAll('"','')).includes(String(row[key]));
        return true;
      }));
      const payload = init?.body ? JSON.parse(init.body) : undefined;
      calls.push({table,method,payload,query:Object.fromEntries(url.searchParams)});
      let result = matching;
      if (method === 'PATCH') {
        if (table === 'game_wiki_pages' && payload.canonical_path !== undefined) throw new Error('Existing hub paths must remain untouched');
        for (const row of matching) Object.assign(row,payload);
      } else if (method === 'POST') {
        result = (Array.isArray(payload) ? payload : [payload]).map(row=>({id:randomUUID(),...row}));
        for (const row of result) {
          if (table === 'game_wiki_pages') {
            const game = tables.games.find(game=>game.id === row.game_id);
            row.canonical_path ??= '/'+row.namespace+'/wiki'+(game.parent_id ? '/'+game.slug : '');
            if (row.namespace === 'minecraft' && game.slug === 'minecraft-java' && row.canonical_path !== '/minecraft/java/wiki') throw new Error('Minecraft edition route rejected');
          }
          if (table === 'game_collection_pages') {
            const hub = tables.game_wiki_pages.find(hub=>hub.id === row.wiki_page_id);
            if (row.wiki_slug !== hub.slug || row.game_id !== hub.game_id) throw new Error('Collection wiki ownership mismatch');
            row.canonical_path ??= hub.canonical_path+'/'+row.collection_slug;
          }
        }
        source.push(...result);
      } else if (!['GET','HEAD'].includes(method)) throw new Error('Unexpected mutation '+method);
      const headers = {'content-type':'application/json','content-range':'0-0/'+matching.length};
      if (method === 'HEAD') return new Response(null,{headers});
      const accept = new Headers(init?.headers).get('accept') ?? '';
      return new Response(JSON.stringify(accept.includes('vnd.pgrst.object') ? result[0] : result),{headers});
    };
  `;
  const output = execFileSync(process.execPath, ["--import", "tsx", "--import", `data:text/javascript,${encodeURIComponent(preload)}`, "scripts/content/roblox-wiki-cli.ts", "publish", root, "--target", "managed-dev", "--apply"], { encoding: "utf8", env: testEnvironment(), stdio: "pipe" });
  assert.match(output, /PASS published \d+ page\(s\) to managed-dev/);
  return JSON.parse(await fs.readFile(report, "utf8")) as { tables: Record<string, Array<Record<string, any>>>; calls: Array<{ table: string; method: string; payload?: Record<string, any>; query: Record<string, string> }> };
}

async function retargetFixture(root: string, namespace: string, slug: string, kind: "game" | "franchise", parent?: string) {
  const read = async (file: string) => JSON.parse(await fs.readFile(path.join(root, file), "utf8"));
  const write = (file: string, data: unknown) => fs.writeFile(path.join(root, file), JSON.stringify(data));
  const input = await read("bundle.json");
  input.namespace = namespace;
  input.game = { ...input.game, slug, kind, ...(parent ? { parent } : {}) };
  await write("bundle.json", input);
  await write("game.json", { ...await read("game.json"), slug });
  await write("wiki/final.json", { ...await read("wiki/final.json"), game_slug: slug, slug });
  const collection = await read("collections/items/runtime-manifest.json");
  await write("collections/items/runtime-manifest.json", { ...collection, namespace, game: { ...collection.game, slug } });
  const final = await read("collections/items/final.json");
  await write("collections/items/final.json", { ...final, wiki_slug: slug, code: `${slug}-items` });
  const dataset = await read("collections/items/dataset.json");
  dataset.meta.gameSlug = slug;
  await write("collections/items/dataset.json", dataset);
}

test("CLI apply keeps permanent root hub slugs and UUIDs beside same-slug child games", async () => {
  for (const namespace of ["red-dead", "gta", "minecraft"]) {
    const { root, write } = await fixture();
    try {
      await retargetFixture(root, namespace, namespace, "franchise");
      const input = JSON.parse(await fs.readFile(path.join(root, "bundle.json"), "utf8"));
      if (namespace !== "minecraft") delete input.collections;
      await write("bundle.json", input);
      const hubFinal = JSON.parse(await fs.readFile(path.join(root, "wiki/final.json"), "utf8"));
      await write("wiki/final.json", { ...hubFinal, slug: `${namespace}-hub` });
      const gameId = randomUUID(), hubId = randomUUID(), childId = randomUUID(), childHubId = randomUUID();
      const result = await applyFixture(root, {
        games: [{ id: gameId, namespace, slug: namespace, kind: "franchise", parent_id: null, is_published: true }, { id: childId, namespace, slug: namespace, kind: "game", parent_id: gameId, is_published: true }],
        game_wiki_pages: [{ id: hubId, namespace, game_id: gameId, slug: `${namespace}-hub`, canonical_path: `/${namespace}/wiki`, is_published: true }, { id: childHubId, namespace, game_id: childId, slug: namespace, canonical_path: `/${namespace}/wiki/legacy`, is_published: true }]
      });
      assert.equal(result.tables.games[0].id, gameId);
      assert.equal(result.tables.game_wiki_pages[0].id, hubId);
      assert.equal(result.tables.game_wiki_pages[0].slug, `${namespace}-hub`);
      assert.equal(result.tables.game_wiki_pages[0].canonical_path, `/${namespace}/wiki`);
      assert.equal(result.tables.game_wiki_pages[1].id, childHubId);
      assert.equal(result.calls.filter(call => call.method === "PATCH" && call.table === "game_wiki_pages").length, 1);
      if (namespace === "minecraft") {
        assert.equal(result.tables.game_collection_pages[0].wiki_page_id, hubId);
        assert.equal(result.tables.game_collection_pages[0].wiki_slug, "minecraft-hub");
        assert.equal(result.tables.game_collection_pages[0].code, "minecraft-items");
        assert.equal(result.tables.game_collection_pages[0].canonical_path, "/minecraft/wiki/items");
      }
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  }
});

test("CLI apply inserts a missing Minecraft edition hub with its validated route", async () => {
  const { root } = await fixture();
  try {
    await retargetFixture(root, "minecraft", "minecraft-java", "game", "minecraft");
    const parentId = randomUUID();
    const result = await applyFixture(root, {
      games: [{ id: parentId, namespace: "minecraft", slug: "minecraft", kind: "franchise", parent_id: null, is_published: true, cover_image: "https://media.bloxodes.com/wiki/minecraft/minecraft/cover.webp", hero_image: "https://media.bloxodes.com/wiki/minecraft/minecraft/hero.webp" }]
    });
    const edition = result.tables.games.find(game => game.slug === "minecraft-java")!;
    const hub = result.tables.game_wiki_pages[0];
    assert.equal(edition.parent_id, parentId);
    assert.equal(hub.game_id, edition.id);
    assert.equal(hub.canonical_path, "/minecraft/java/wiki");
    assert.equal(result.calls.find(call => call.table === "game_wiki_pages" && call.method === "POST")?.payload?.canonical_path, "/minecraft/java/wiki");
    assert.equal(result.tables.game_collection_pages[0].canonical_path, "/minecraft/java/wiki/items");
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test("new collection orders append above all stored and planned explicit orders", async () => {
  const { root, write, final } = await fixture();
  try {
    const extra = [
      { slug: "new-first", manifestOrder: undefined, finalOrder: undefined },
      { slug: "explicit-final", manifestOrder: undefined, finalOrder: 250 },
      { slug: "after-final", manifestOrder: undefined, finalOrder: undefined },
      { slug: "explicit-manifest", manifestOrder: 500, finalOrder: 500 },
      { slug: "after-manifest", manifestOrder: undefined, finalOrder: undefined }
    ];
    for (const { slug, manifestOrder, finalOrder } of extra) {
      await fs.cp(path.join(root, "collections/items"), path.join(root, "collections", slug), { recursive: true });
      const next = manifest(slug);
      await write(`collections/${slug}/runtime-manifest.json`, { ...next, collection: { ...next.collection, sortOrder: manifestOrder } });
      await write(`collections/${slug}/final.json`, { ...final, collection_slug: slug, code: `example-${slug}`, wiki_sort_order: finalOrder });
      const dataset = JSON.parse(await fs.readFile(path.join(root, "collections", slug, "dataset.json"), "utf8"));
      dataset.meta.collection = slug;
      await write(`collections/${slug}/dataset.json`, dataset);
    }
    await write("bundle.json", { ...bundle(), collections: ["items", ...extra.map(row => row.slug)].map(slug => ({ manifest: `collections/${slug}/runtime-manifest.json` })) });
    const gameId = randomUUID(), hubId = randomUUID(), pageId = randomUUID();
    const storedPage = { id: pageId, namespace: "example", game_id: gameId, wiki_page_id: hubId, wiki_slug: "example", collection_slug: "items", code: "example-items", canonical_path: "/example/wiki/items", page_type: "database", wiki_sort_order: 10, is_published: true, published_dataset_id: null };
    const result = await applyFixture(root, {
      games: [{ id: gameId, namespace: "example", slug: "example", kind: "game", parent_id: null, is_published: true }],
      game_wiki_pages: [{ id: hubId, namespace: "example", game_id: gameId, slug: "example", canonical_path: "/example/wiki", is_published: true }],
      game_collection_pages: [storedPage, { ...storedPage, id: randomUUID(), collection_slug: "unselected", code: "example-unselected", canonical_path: "/example/wiki/unselected", wiki_sort_order: 100 }, { ...storedPage, id: randomUUID(), game_id: "other-game", wiki_slug: "other-game", collection_slug: "other", code: "other-game-other", canonical_path: "/example/wiki/other/other", wiki_sort_order: 1000 }]
    });
    const orders = Object.fromEntries(result.tables.game_collection_pages.map(row => [row.collection_slug, row.wiki_sort_order]));
    assert.deepEqual(orders, { items: 10, unselected: 100, other: 1000, "new-first": 110, "explicit-final": 250, "after-final": 260, "explicit-manifest": 500, "after-manifest": 510 });
    assert.equal(result.tables.game_collection_pages[0].id, pageId);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test("CLI dry run validates a new root and its collection without any HTTP mutations", async () => {
  const { root, write, final } = await fixture();
  // Every DB read sees an empty target. Any RPC, mutation, R2 or other network
  // call fails, so a successful command proves that preflight writes nothing.
  const preload = `globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url ?? input.href);
    const method = init?.method ?? input.method ?? 'GET';
    if (method !== 'GET' || !url.pathname.startsWith('/rest/v1/')) throw new Error('Unexpected network write or media request: '+method+' '+url.pathname);
    return new Response('[]', {headers:{'content-type':'application/json'}});
  };`;
  const run = () => execFileSync(process.execPath, ["--import", "tsx", "--import", `data:text/javascript,${encodeURIComponent(preload)}`, "scripts/content/roblox-wiki-cli.ts", "publish", root], { encoding: "utf8", env: testEnvironment(), stdio: "pipe" });
  try {
    assert.match(run(), /PASS all checks\. Dry run complete; no database or media writes/);
    await write("collections/items/final.json", { ...final, universe_id: 1 });
    assert.throws(run, /preflight check\(s\) failed/);
    await write("collections/items/final.json", { ...final, intro_md: "This page shows all items." });
    assert.throws(run, /self-referential page/);
    await write("collections/items/final.json", final);
    await sharp({ create: { width: 120, height: 63, channels: 3, background: "red" } }).webp().toFile(path.join(root, "wiki/cover.webp"));
    assert.throws(run, /cover_image must be 16:9/);
    await sharp({ create: { width: 160, height: 90, channels: 3, background: "red" } }).webp().toFile(path.join(root, "wiki/cover.webp"));
    await sharp({ create: { width: 80, height: 60, channels: 3, background: "blue" } }).webp().toFile(path.join(root, "wiki/hero.webp"));
    assert.throws(run, /hero_image must be square/);
    await sharp({ create: { width: 80, height: 80, channels: 3, background: "blue" } }).webp().toFile(path.join(root, "wiki/hero.webp"));
    await fs.unlink(path.join(root, "collections/items/media/sword.webp"));
    await fs.symlink(path.resolve("package.json"), path.join(root, "collections/items/media/sword.webp"));
    assert.throws(run, /escapes/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test("shared hub writer updates the existing target page UUID", async () => {
  process.env.BLOXODES_ENV_PROFILE = "process-only";
  const { saveFranchiseWikiPage } = await import("../../franchise/publish-franchise-wiki-hubs");
  const pageId = randomUUID();
  const gameId = randomUUID();
  const calls: string[] = [];
  const db = createClient("https://target.supabase.co", "test-key", { global: { fetch: async (input, init) => {
    const url = new URL(String(input));
    calls.push(init?.method ?? "GET");
    if (init?.method === "PATCH") {
      assert.equal(url.searchParams.get("id"), `eq.${pageId}`);
      assert.equal(url.searchParams.get("namespace"), "example");
      const payload = JSON.parse(String(init.body));
      assert.equal(payload.game_id, gameId);
      assert.equal(payload.id, undefined);
      assert.equal(payload.canonical_path, undefined, "Updates must preserve the target's canonical path");
      return new Response(JSON.stringify({ ...payload, id: pageId, canonical_path: "/example/wiki" }), { headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ id: pageId }), { headers: { "content-type": "application/json" } });
  } }, auth: { persistSession: false } });
  const saved = await saveFranchiseWikiPage(db, "example", gameId, { id: randomUUID(), slug: "example", title: "Example Wiki", canonical_path: "/example/wiki/changed", is_published: true });
  assert.equal(saved.id, pageId);
  assert.equal(saved.canonical_path, "/example/wiki");
  assert.deepEqual(calls, ["GET", "PATCH"]);
});

test("CLI apply preserves each target's game, hub and collection UUIDs", async () => {
  const { root, write, final } = await fixture();
  const report = path.join(root, "requests.json");
  const sourceId = randomUUID();
  await write("game.json", { id: sourceId, slug: "example", title: "Example", status: "released", cover_image: "wiki/cover.webp", hero_image: "wiki/hero.webp" });
  await write("collections/items/final.json", { ...final, id: sourceId, game_id: sourceId, wiki_page_id: sourceId });
  try {
    for (const target of ["development", "production-export"]) {
      const gameId = randomUUID();
      const hubId = randomUUID();
      const pageId = randomUUID();
      const stored = {
        games: [{ id: gameId, namespace: "example", slug: "example", kind: "game", parent_id: null, is_published: true }],
        game_wiki_pages: [{ id: hubId, namespace: "example", game_id: gameId, slug: "example", canonical_path: "/example/wiki", is_published: true }],
        game_collection_pages: [{ id: pageId, namespace: "example", game_id: gameId, wiki_page_id: hubId, wiki_slug: "example", collection_slug: "items", code: "example-items", canonical_path: "/example/wiki/items", page_type: "database", wiki_sort_order: 10, item_count: 1, is_published: true, published_dataset_id: null }],
        game_collection_datasets: [], game_collection_items: []
      };
      const preload = `
        import fs from 'node:fs';
        import { randomUUID } from 'node:crypto';
        const tables = ${JSON.stringify(stored)};
        const calls = [];
        process.on('exit', () => fs.writeFileSync(${JSON.stringify(report)}, JSON.stringify({tables,calls})));
        globalThis.fetch = async (input, init) => {
          const url = new URL(typeof input === 'string' ? input : input.url ?? input.href);
          const method = init?.method ?? input.method ?? 'GET';
          if (url.hostname === 'r2.example.com') {
            if (!['HEAD','PUT'].includes(method)) throw new Error('Unexpected R2 operation');
            return new Response(null, {status: method === 'HEAD' ? 404 : 200});
          }
          if (!url.pathname.startsWith('/rest/v1/')) throw new Error('Unexpected external request');
          const table = url.pathname.split('/').pop();
          const source = tables[table] ?? [];
          calls.push({table,method,query:Object.fromEntries(url.searchParams)});
          const matching = source.filter(row => [...url.searchParams].every(([key,value]) => {
            if (value.startsWith('eq.')) return String(row[key]) === value.slice(3);
            if (value.startsWith('in.')) return value.slice(4,-1).split(',').map(x=>x.replaceAll('"','')).includes(String(row[key]));
            return true;
          }));
          let result = matching;
          if (method === 'PATCH') {
            const payload = JSON.parse(init.body);
            for (const row of matching) Object.assign(row,payload);
          } else if (method === 'POST') {
            if (['games','game_wiki_pages','game_collection_pages'].includes(table)) throw new Error('Existing target pages must update their UUIDs');
            const payload = JSON.parse(init.body);
            const added = (Array.isArray(payload) ? payload : [payload]).map(row=>({id:randomUUID(),...row}));
            (tables[table] ??= []).push(...added);
            result = added;
          } else if (!['GET','HEAD'].includes(method)) throw new Error('Unexpected mutation '+method);
          const headers = {'content-type':'application/json','content-range':'0-0/'+matching.length};
          if (method === 'HEAD') return new Response(null,{headers});
          const accept = new Headers(init?.headers).get('accept') ?? '';
          return new Response(JSON.stringify(accept.includes('vnd.pgrst.object') ? result[0] : result),{headers});
        };
      `;
      // R2 readback needs to see the objects written by this invocation.
      const withMedia = preload.replace("const calls = [];", "const calls = []; const media = new Set();").replace("return new Response(null, {status: method === 'HEAD' ? 404 : 200});", "if (method === 'PUT') media.add(url.pathname); return new Response(null, {status: method === 'HEAD' && !media.has(url.pathname) ? 404 : 200});");
      const output = execFileSync(process.execPath, ["--import", "tsx", "--import", `data:text/javascript,${encodeURIComponent(withMedia)}`, "scripts/content/roblox-wiki-cli.ts", "publish", root, "--target", "managed-dev", "--apply"], { encoding: "utf8", env: testEnvironment(), stdio: "pipe" });
      assert.match(output, /PASS published 2 page\(s\) to managed-dev/);
      const result = JSON.parse(await fs.readFile(report, "utf8"));
      assert.equal(result.tables.games[0].id, gameId, target);
      assert.equal(result.tables.game_wiki_pages[0].id, hubId, target);
      assert.equal(result.tables.game_collection_pages[0].id, pageId, target);
      assert.equal(result.tables.game_collection_pages[0].game_id, gameId);
      assert.equal(result.tables.game_collection_pages[0].wiki_page_id, hubId);
      assert.ok(result.tables.game_collection_pages[0].published_dataset_id);
      assert.equal(result.tables.game_collection_items.length, 1);
    }
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test("franchise status reports stored counts, target URLs and hidden parent visibility", () => {
  const preload = `
    console.table = rows => console.log(JSON.stringify(rows));
    const tables = {
      games: [{id:'root',slug:'series',kind:'franchise',parent_id:null,is_published:false},{id:'child',slug:'sequel',kind:'game',parent_id:'root',is_published:true}],
      game_wiki_pages: [{id:'hub',game_id:'child',slug:'sequel',canonical_path:'/series/wiki/sequel',is_published:true}],
      game_collection_pages: [{id:'collection',game_id:'child',wiki_slug:'sequel',collection_slug:'items',canonical_path:'/series/wiki/sequel/items',is_published:true,item_count:7,published_dataset_id:'dataset'}]
    };
    globalThis.fetch = async (input, init) => {
      if ((init?.method ?? 'GET') !== 'GET') throw new Error('Status must be read-only');
      const url = new URL(String(input));
      return new Response(JSON.stringify(tables[url.pathname.split('/').pop()] ?? []),{headers:{'content-type':'application/json'}});
    };
  `;
  const output = execFileSync(process.execPath, ["--import", "tsx", "--import", `data:text/javascript,${encodeURIComponent(preload)}`, "scripts/content/roblox-wiki-cli.ts", "status", "--namespace", "series", "--game", "sequel"], { encoding: "utf8", env: testEnvironment(), stdio: "pipe" });
  const result = JSON.parse(output.trim().split("\n").at(-1)!);
  assert.equal(result[0].exists, true);
  assert.equal(result[0].published, true);
  assert.equal(result[0].visible, false);
  assert.equal(result[1].items, 7);
  assert.equal(result[1].url, "https://bloxodes.com/series/wiki/sequel/items");
});

test("status resolves root and original-game hubs by game ID and respects a missing kind", () => {
  const preload = `
    console.table = rows => console.log(JSON.stringify(rows));
    const tables = {
      games: [{id:'root',slug:'gta',kind:'franchise',parent_id:null,is_published:true},{id:'original',slug:'gta',kind:'game',parent_id:'root',is_published:true},{id:'solo',slug:'solo',kind:'franchise',parent_id:null,is_published:true}],
      game_wiki_pages: [{id:'original-hub',game_id:'original',slug:'gta',canonical_path:'/gta/wiki/gta',is_published:true},{id:'root-hub',game_id:'root',slug:'gta-hub',canonical_path:'/gta/wiki',is_published:true},{id:'solo-hub',game_id:'solo',slug:'solo',canonical_path:'/solo/wiki',is_published:true}],
      game_collection_pages: [{id:'root-items',game_id:'root',wiki_slug:'gta-hub',collection_slug:'root-items',canonical_path:'/gta/wiki/root-items',is_published:true,item_count:2,published_dataset_id:'root-dataset'},{id:'original-items',game_id:'original',wiki_slug:'gta',collection_slug:'original-items',canonical_path:'/gta/wiki/gta/original-items',is_published:true,item_count:3,published_dataset_id:'original-dataset'}]
    };
    globalThis.fetch = async (input, init) => {
      if ((init?.method ?? 'GET') !== 'GET') throw new Error('Status must be read-only');
      return new Response(JSON.stringify(tables[new URL(String(input)).pathname.split('/').pop()] ?? []), {headers:{'content-type':'application/json'}});
    };
  `;
  const run = (namespace: string, kind?: string) => {
    const output = execFileSync(process.execPath, ["--import", "tsx", "--import", `data:text/javascript,${encodeURIComponent(preload)}`, "scripts/content/roblox-wiki-cli.ts", "status", "--namespace", namespace, "--game", namespace, ...(kind ? ["--kind", kind] : [])], { encoding: "utf8", env: testEnvironment(), stdio: "pipe" });
    return JSON.parse(output.trim().split("\n").at(-1)!);
  };
  const root = run("gta");
  assert.equal(root[0].url, "https://bloxodes.com/gta/wiki");
  assert.equal(root[1].items, 2);
  const original = run("gta", "game");
  assert.equal(original[0].url, "https://bloxodes.com/gta/wiki/gta");
  assert.equal(original[1].items, 3);
  const missing = run("solo", "game");
  assert.equal(missing[0].exists, false);
  assert.equal(missing.length, 1);
});
