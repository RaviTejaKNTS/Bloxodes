import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { parseContentOptions } from "../../content/roblox-wiki-cli";
import { deployedContentSha } from "../local-content-publication-guard";
import { assertEditorialSlug, bundlePath, resolveCollectionOrders, selectBundlePages, assertCollectionFinalOrder, assertCollectionMissingImages } from "../roblox-wiki-bundle";
import { bundleSchema, runtimeManifestSchema, runtimeManifestJsonSchema, hubFinalSchema } from "../../../contracts/roblox-wiki/v1/schema";

const sha = "a".repeat(40);

test("publication defaults to managed-development dry run and gates production apply", () => {
  assert.deepEqual(parseContentOptions(["publish", "/bundle"]), {
    command: "publish", target: "managed-dev", apply: false, allowProd: false, bundle: "/bundle"
  });
  assert.equal(parseContentOptions(["publish", "--bundle=/bundle", "--target=production"]).apply, false);
  assert.equal(parseContentOptions(["publish", "/bundle", "--target", "production", "--apply", "--allow-prod"]).allowProd, true);
  for (const argv of [
    ["publish", "/bundle", "--target", "production", "--apply"],
    ["publish", "/bundle", "--allow-prod"],
    ["publish", "/bundle", "--apply", "--allow-prod"],
    ["publish", "/bundle", "--target", "local"],
    ["publish", "/bundle", "--apply=true"],
    ["publish", "/bundle", "--target", "managed-dev", "--target=production"],
    ["publish", "/bundle", "--normalize-legacy-media"],
    ["status", "--game", "example", "--apply"],
    ["status", "--game", "../example"],
    ["candidates", "--allow-prod"],
    ["publish", "/bundle", "--game", "different-game"]
  ]) assert.throws(() => parseContentOptions(argv), undefined, argv.join(" "));
});

test("deployed SHA lookup needs only healthy public deploy metadata", async () => {
  const fetchHealth = (payload: unknown, status = 200) => (async (url: string | URL | Request) => {
    assert.equal(url, "https://bloxodes.com/api/health?scope=deploy");
    return new Response(JSON.stringify(payload), { status });
  }) as typeof fetch;
  assert.equal(await deployedContentSha(fetchHealth({ ok: true, build: { sha } })), sha);
  for (const payload of [{ ok: false, build: { sha } }, { ok: true }, { ok: true, build: { sha: "short" } }]) {
    await assert.rejects(deployedContentSha(fetchHealth(payload)));
  }
  await assert.rejects(deployedContentSha(fetchHealth({}, 503)), /HTTP 503/);
  assert.equal(parseContentOptions(["deployed-sha"]).command, "deployed-sha");
  assert.throws(() => parseContentOptions(["deployed-sha", "--target", "production"]), /takes no options/);
});

test("--only repeats for dry runs and applies and belongs only to publish", () => {
  for (const flags of [[], ["--apply"], ["--target=production", "--apply", "--allow-prod"]]) {
    assert.deepEqual(parseContentOptions(["publish", "/bundle", "--only", "hub", "--only=pets", ...flags]).only, ["hub", "pets"]);
  }
  for (const argv of [["publish", "/bundle", "--only"], ["publish", "/bundle", "--only=../pets"], ["status", "--game", "example", "--only=hub"], ["candidates", "--only=pets"]]) {
    assert.throws(() => parseContentOptions(argv));
  }
});

test("deployed-sha prints only the SHA without loading any target credentials", () => {
  const preload = `globalThis.fetch = async () => new Response(JSON.stringify({ok:true,build:{sha:"${sha}"}}));`;
  const output = execFileSync(process.execPath, ["--import", "tsx", "--import", `data:text/javascript,${encodeURIComponent(preload)}`, "scripts/content/roblox-wiki-cli.ts", "deployed-sha"], {
    encoding: "utf8", env: { ...process.env, BLOXODES_ENV_PROFILE: "profile-must-not-load", SUPABASE_URL: "", SUPABASE_SERVICE_ROLE: "" }
  });
  assert.equal(output, `${sha}\n`);
  const help = execFileSync(process.execPath, ["--import", "tsx", "scripts/content/roblox-wiki-cli.ts", "publish", "--help"], { encoding: "utf8" });
  assert.match(help, /npm run content:publish -- \/abs\/game-bundle --only pets/);
  assert.match(help, /missingImages .*runtime-manifest\.json or bundle entry/);
  assert.match(help, /conflicting reasons fail/);
  assert.match(help, /normal main checkout/);
  assert.match(help, /both HEAD and the healthy deployed SHA.*origin\/production/);
  assert.match(help, /Untracked files are allowed/);
  assert.match(help, /wait for the deploy.*pull/i);
  assert.match(help, /production migration ledger/);
});

test("editorial slugs reject new stats identities and preserve existing routes", () => {
  assert.doesNotThrow(() => assertEditorialSlug("example-game", 123, "example-game-123"));
  assert.throws(() => assertEditorialSlug("example-game-123", 123, "example-game-123"), /never copy roblox_universes.slug/);
  assert.doesNotThrow(() => assertEditorialSlug("example", 123, "example"));
  assert.throws(() => assertEditorialSlug("example-9876543", 123, "example"), /stats identity/);
  assert.throws(() => assertEditorialSlug("different-123", 123, "example-game-123"));
  assert.doesNotThrow(() => assertEditorialSlug("example", 123, "example", "example"));
});

test("contract and manifest reject old versions, unknown fields and missing renderer metadata", () => {
  const game = { slug: "example", name: "Example", universeId: 123, universeNames: ["Example"] };
  assert.equal(bundleSchema.safeParse({ contract: "roblox-wiki@1", game, hub: { finalJson: "wiki/final.json" } }).success, true);
  for (const contract of [undefined, "roblox-wiki@0", "roblox-wiki@2"]) assert.equal(bundleSchema.safeParse({ contract, game }).success, false);
  assert.equal(bundleSchema.safeParse({ contract: "roblox-wiki@1", game, allowProd: true }).success, false);
  const manifest = {
    schemaVersion: 1,
    game: { slug: "example", name: "Example", universeId: 123 },
    collection: { slug: "pets", label: "Pets", sortOrder: 10, pageType: "database" },
    dataset: "dataset.json", finalJson: "final.json", mediaRoot: "media", sourceUrls: ["https://example.com/pets"]
  };
  assert.equal(runtimeManifestSchema.safeParse(manifest).success, true);
  assert.equal(runtimeManifestSchema.safeParse({ ...manifest, collection: { ...manifest.collection, sortOrder: undefined } }).success, true);
  assert.equal(runtimeManifestSchema.safeParse({ ...manifest, collection: { ...manifest.collection, sortOrder: 1.5 } }).success, false);
  assert.equal(runtimeManifestSchema.safeParse({ ...manifest, collection: { ...manifest.collection, pageType: "checklist" } }).success, false);
  assert.equal(runtimeManifestSchema.safeParse({ ...manifest, sourceUrls: ["http://example.com"] }).success, false);
  assert.equal(runtimeManifestSchema.safeParse({ ...manifest, finalJson: undefined }).success, false);
  assert.equal(hubFinalSchema.safeParse({ slug: "Example", universe_id: 123 }).success, false);
});

const game = { slug: "example", name: "Example", universeId: 123, universeNames: ["Example"] };
function manifest(slug: string, sortOrder?: number) {
  return { schemaVersion: 1, game: { slug: game.slug, name: game.name, universeId: game.universeId }, collection: { slug, label: slug, sortOrder, pageType: "database" }, dataset: "dataset.json", finalJson: "final.json", mediaRoot: "media", sourceUrls: ["https://example.com/items"] };
}

test("manifest and bundle image decisions share the v1 shape and reason validation", () => {
  const decisions = [{ slug: "pet", reason: "  No exact image available.  " }];
  const parsed = runtimeManifestSchema.parse({ ...manifest("pets"), missingImages: decisions });
  assert.deepEqual(parsed.missingImages, [{ slug: "pet", reason: "No exact image available." }]);
  assert.ok(runtimeManifestJsonSchema.properties?.missingImages);
  for (const missingImages of [[], decisions, [{ slug: "pet", reason: "No exact image available." }]]) {
    assert.equal(runtimeManifestSchema.safeParse({ ...manifest("pets"), missingImages }).success, true);
    assert.equal(bundleSchema.safeParse({ contract: "roblox-wiki@1", game, collections: [{ manifest: "pets.json", missingImages }] }).success, true);
  }
  for (const missingImages of [null, {}, [{ slug: "Pet", reason: "No image." }], [{ slug: "pet", reason: " " }], [{ slug: "pet" }], [{ slug: "pet", reason: "No image.", extra: true }]]) {
    assert.equal(runtimeManifestSchema.safeParse({ ...manifest("pets"), missingImages }).success, false);
    assert.equal(bundleSchema.safeParse({ contract: "roblox-wiki@1", game, collections: [{ manifest: "pets.json", missingImages }] }).success, false);
  }
});

test("image decisions support either location, merge disjoint slugs and accept matching reasons", () => {
  const items = [{ item_slug: "pet", image_key: null }, { item_slug: "boat", image_key: null }];
  const pet = { slug: "pet", reason: "No exact pet image." };
  const boat = { slug: "boat", reason: "No exact boat image." };
  assert.doesNotThrow(() => assertCollectionMissingImages(items, [pet, boat]));
  assert.doesNotThrow(() => assertCollectionMissingImages(items, undefined, [pet, boat]));
  assert.doesNotThrow(() => assertCollectionMissingImages(items, [pet], [boat]));
  assert.doesNotThrow(() => assertCollectionMissingImages(items, [pet], [pet, boat]));
  assert.throws(() => assertCollectionMissingImages(items, [pet], [{ ...pet, reason: "Different decision." }, boat]), /Conflicting missingImages reasons for pet/);
});

test("image decisions reject duplicates within each array and missing or stale decisions", () => {
  const pet = { slug: "pet", reason: "No exact pet image." };
  const items = [{ item_slug: "pet", image_key: null }];
  for (const duplicate of [pet, { ...pet, reason: "Different reason." }]) {
    assert.throws(() => assertCollectionMissingImages(items, [pet, duplicate]), /duplicate missingImages.*bundle entry/);
    assert.throws(() => assertCollectionMissingImages(items, undefined, [pet, duplicate]), /duplicate missingImages.*runtime manifest/);
  }
  assert.throws(() => assertCollectionMissingImages(items), /pet has no image.*runtime-manifest\.json/);
  assert.throws(() => assertCollectionMissingImages([], undefined, [pet]), /stale missingImages decisions: pet/);
  assert.throws(() => assertCollectionMissingImages([{ item_slug: "pet", image_key: "pet.png" }], [pet], [pet]), /stale missingImages decisions: pet/);
  assert.doesNotThrow(() => assertCollectionMissingImages([{ item_slug: "pet", image_key: "pet.png" }]));
});

test("page selection ignores unfinished pages and preserves bundle collection order", async () => {
  const bundle = bundleSchema.parse({ contract: "roblox-wiki@1", game, hub: { finalJson: "unfinished-hub.json" }, collections: [{ manifest: "pets" }, { manifest: "missing" }, { manifest: "boats" }, { manifest: "partial" }] });
  const read = async (file: string) => {
    if (file === "missing") throw new Error("manifest is still being written");
    return file === "partial" ? { collection: { slug: "partial" } } : manifest(file);
  };
  const result = await selectBundlePages(bundle, ["boats", "pets", "pets"], read);
  assert.equal(result.hub, undefined);
  assert.deepEqual(result.collections.map(row => row.manifest.collection.slug), ["pets", "boats"]);
  const hubOnly = await selectBundlePages(bundle, ["hub"], async () => { throw new Error("hub-only selection must not read collection manifests"); });
  assert.deepEqual(hubOnly.hub, bundle.hub);
  assert.deepEqual(hubOnly.collections, []);
  await assert.rejects(selectBundlePages(bundle, ["unknown"], read), /Unknown --only page\(s\): unknown/);
  await assert.rejects(selectBundlePages({ ...bundle, hub: undefined }, ["hub"], read), /Unknown --only/);
  await assert.rejects(selectBundlePages(bundle, ["partial"], read));
  await assert.rejects(selectBundlePages(bundle, undefined, read), /still being written/);
  const complete = { ...bundle, collections: [{ manifest: "pets" }, { manifest: "boats" }] };
  assert.equal((await selectBundlePages(complete, undefined, read)).collections.length, 2);
});

test("omitted collection orders retain registrations and append by tens in bundle order", () => {
  const existing = { sortOrder: 76000, collectionConfigs: [{ code: "example-pets", gameSlug: "example", gameName: "Example", slug: "pets", label: "Pets", sortOrder: 76020, universeNames: ["Example"], pageType: "database" as const }] };
  assert.deepEqual([...resolveCollectionOrders([{ slug: "boats" }, { slug: "pets" }, { slug: "tools" }], existing, 76000)], [["boats", 76030], ["pets", 76020], ["tools", 76040]]);
  assert.deepEqual([...resolveCollectionOrders([{ slug: "pets" }, { slug: "boats" }], undefined, 77000)], [["pets", 77010], ["boats", 77020]]);
  assert.equal(resolveCollectionOrders([{ slug: "pets", sortOrder: 5 }], existing, 76000).get("pets"), 5);
  assert.equal(resolveCollectionOrders([{ slug: "pets" }], { sortOrder: 76000, collectionConfigs: [] }, 76000).get("pets"), 76010);
  assert.equal(resolveCollectionOrders([{ slug: "boats" }], { ...existing, collectionConfigs: [{ ...existing.collectionConfigs[0], sortOrder: 0 }] }, 76000).get("boats"), 10);
  assert.deepEqual([...resolveCollectionOrders([{ slug: "boats" }, { slug: "tools", sortOrder: 76030 }, { slug: "fruits" }], existing, 76000)], [["boats", 76040], ["tools", 76030], ["fruits", 76050]]);
  assert.doesNotThrow(() => assertCollectionFinalOrder(undefined, 76010));
  assert.doesNotThrow(() => assertCollectionFinalOrder(76010, 76010));
  assert.throws(() => assertCollectionFinalOrder(0, 76010), /resolved collection sort order, 76010/);
});

test("bundle paths reject traversal and symlink escapes", async () => {
  const scratch = path.resolve("tmp", `content-contract-test-${randomUUID()}`);
  const root = path.join(scratch, "bundle");
  await fs.mkdir(root, { recursive: true });
  try {
    await fs.writeFile(path.join(root, "final.json"), "{}");
    await fs.writeFile(path.join(scratch, "outside.json"), "{}");
    await fs.symlink(path.join(scratch, "outside.json"), path.join(root, "escape.json"));
    assert.equal(await bundlePath(root, "final.json"), path.join(root, "final.json"));
    await assert.rejects(bundlePath(root, "../outside.json"), /escapes/);
    await assert.rejects(bundlePath(root, "escape.json"), /escapes/);
  } finally { await fs.rm(scratch, { recursive: true, force: true }); }
});

test("registry migration retains the complete ordered baseline and empty registrations", async () => {
  const sql = await fs.readFile("supabase/migrations/20261020133300_roblox_wiki_database_registry.sql", "utf8");
  const groups = JSON.parse(sql.split("$registry$")[1]) as Array<{
    gameSlug: string; universeNames: string[]; sortOrder: number;
    collections: Array<{ slug: string; label: string; sortOrder: number }>;
  }>;
  // This digest comes from the original ordered TypeScript registry before removal.
  assert.equal(createHash("sha256").update(JSON.stringify(groups)).digest("hex"), "f883c34dea8f46ac846aa41e25dcaccd89897a852725b5b09e9f04a803aec150");
  assert.equal(groups.length, 75);
  assert.equal(groups.reduce((sum, group) => sum + group.collections.length, 0), 656);
  assert.equal(groups[0].gameSlug, "steal-a-brainrot");
  assert.equal(groups[groups.length - 1]?.gameSlug, "tap-simulator-reborn");
  assert.deepEqual(groups.find(group => group.gameSlug === "merge-a-nuke")?.collections, []);
  assert.deepEqual(groups.find(group => group.gameSlug === "tap-simulator-reborn")?.universeNames, ["Tap Simulator: Reborn", "Tap Simulator REBORN", "[🎃] Tap Simulator REBORN"]);
  assert.deepEqual(groups[0].collections.find(entry => entry.slug === "fuse-machine"), { slug: "fuse-machine", label: "Fuse Machine Results", sortOrder: 1040 });
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all .* from anon, authenticated/);
});

test("live verification retries transport failures, checks every image, and rejects bad titles immediately", async t => {
  const previousFetch = globalThis.fetch;
  const previousProfile = process.env.BLOXODES_ENV_PROFILE;
  process.env.BLOXODES_ENV_PROFILE = "process-only";
  t.after(() => {
    globalThis.fetch = previousFetch;
    if (previousProfile === undefined) delete process.env.BLOXODES_ENV_PROFILE;
    else process.env.BLOXODES_ENV_PROFILE = previousProfile;
  });
  const { verifyLive } = await import("../../content/roblox-wiki-publish");
  const { default: sharp } = await import("sharp");
  const bytes = await sharp({ create: { width: 16, height: 16, channels: 3, background: "red" } }).png().toBuffer();
  const url = "https://bloxodes.com/wiki/example/items";
  let pageCalls = 0, active = 0, maximum = 0;
  const images = new Map<string, number>();
  let html = '<title>Example Items</title><h1>Example Items</h1><img src="/visible.png">';
  globalThis.fetch = async input => {
    const target = String(input);
    if (target === url) {
      pageCalls++;
      if (pageCalls === 1) return new Response(null, { status: 503 });
      const response = new Response(html);
      Object.defineProperty(response, "url", { value: url });
      return response;
    }
    const count = (images.get(target) ?? 0) + 1;
    images.set(target, count);
    if (target.endsWith("/0.png") && count === 1) throw new TypeError("fetch failed", { cause: { code: "ECONNRESET" } });
    active++; maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 2)); active--;
    return new Response(new Uint8Array(bytes), { headers: { "content-type": "image/png" } });
  };
  await verifyLive(url, "Example Items", "Example Items", Array.from({ length: 24 }, (_, index) => `https://media.bloxodes.com/${index}.png`));
  assert.equal(pageCalls, 2);
  assert.equal(images.size, 25);
  assert.equal(images.get("https://media.bloxodes.com/0.png"), 2);
  assert.ok(maximum > 1 && maximum <= 8);
  html = '<title>Wrong</title><h1>Wrong</h1>';
  pageCalls = 1;
  await assert.rejects(verifyLive(url, "Example Items", "Example Items", []), /rendered title/);
  assert.equal(pageCalls, 2);
});

const mediaUniverseId = 4730278139;
const staleIcon = "https://tr.rbxcdn.com/stale/512/512/Image/Png/noFilter";
const staleThumbnail = "https://tr.rbxcdn.com/stale/768/432/Image/Png/noFilter";
const currentIcon = "https://tr.rbxcdn.com/current/512/512/Image/Png/noFilter";
const currentThumbnail = "https://tr.rbxcdn.com/current/768/432/Image/Png/noFilter";

async function collectionMediaFixture() {
  const root = path.resolve("tmp", `roblox-wiki-media-${randomUUID()}`);
  await fs.mkdir(path.join(root, "media"), { recursive: true });
  const write = (file: string, value: unknown) => fs.writeFile(path.join(root, file), JSON.stringify(value));
  await write("bundle.json", {
    contract: "roblox-wiki@1", game: { ...game, universeId: mediaUniverseId },
    collections: [{ manifest: "runtime-manifest.json", missingImages: [{ slug: "iron-blade", reason: "No exact artwork exists." }] }]
  });
  await write("runtime-manifest.json", { ...manifest("items"), game: { slug: game.slug, name: game.name, universeId: mediaUniverseId } });
  await write("final.json", {
    universe_id: mediaUniverseId, wiki_slug: "example", collection_slug: "items", code: "example-items",
    display_name: "items", title: "All {count} items in Example", seo_title: "All {count} items in Example",
    meta_description: "Compare blade damage and crafting costs.", intro_md: "Iron blades deal physical damage.",
    description_md: "Upgrade iron blades at the forge.", description_json: {}, how_it_works_md: "",
    faq_json: [], wiki_md: "Blades deal physical damage to monsters."
  });
  await write("dataset.json", {
    meta: { schemaVersion: 2, gameSlug: "example", collection: "items", itemFields: ["name", "damage", "cost", "obtainment"], columns: ["name", "damage", "cost", "obtainment"], display: { groupLabel: "Type", sectionOrder: ["Blades"], tableFields: ["damage", "cost", "obtainment"], cardFields: ["damage", "cost", "obtainment"] } },
    items: [{ item: { name: "Iron Blade", damage: 12, cost: 50, obtainment: "Forge" }, system: { slug: "iron-blade", section: "Blades", sortOrder: 10, image: null } }]
  });
  const { default: sharp } = await import("sharp");
  const icon = await sharp({ create: { width: 512, height: 512, channels: 3, background: "red" } }).png().toBuffer();
  const thumbnail = await sharp({ create: { width: 768, height: 432, channels: 3, background: "blue" } }).png().toBuffer();
  await fs.writeFile(path.join(root, "icon.png"), icon);
  await fs.writeFile(path.join(root, "thumbnail.png"), thumbnail);
  return root;
}

// Exercise the real publisher and persistence helper through a closed HTTP fake.
// No credentials, DB connection, R2 request or live Roblox request is needed.
async function runCollectionMediaFixture(root: string, apply: boolean, scenario = "ready") {
  const report = path.join(root, "media-report.json");
  const preload = `
    import fs from 'node:fs';
    import { randomUUID } from 'node:crypto';
    const root = ${JSON.stringify(root)}, scenario = ${JSON.stringify(scenario)};
    const universeId = ${mediaUniverseId}, icon = ${JSON.stringify(currentIcon)}, thumbnail = ${JSON.stringify(currentThumbnail)};
    const calls = [];
    const tables = {
      roblox_universes: [{ universe_id: universeId, root_place_id: 123, name: 'Example', slug: 'example-4730278139', icon_url: ${JSON.stringify(staleIcon)}, thumbnail_urls: [{ url: ${JSON.stringify(staleThumbnail)}, state: 'Completed', type: null }] },
        { universe_id: 999, icon_url: 'untouched-icon', thumbnail_urls: [] }],
      wiki_pages: [{ id: 'hub-id', slug: 'example', universe_id: universeId, title: 'Keep hub copy', cover_image: 'https://media.bloxodes.com/wiki/keep-cover.webp' }],
      roblox_universe_media: [{ universe_id: universeId, media_type: 'icon', image_url: ${JSON.stringify(staleIcon)}, is_primary: true },
        { universe_id: 999, media_type: 'icon', image_url: 'untouched-icon', is_primary: true }]
    };
    process.on('exit', () => fs.writeFileSync(${JSON.stringify(report)}, JSON.stringify({ tables, calls })));
    globalThis.fetch = async (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input.url ?? input.href);
      const method = init?.method ?? input.method ?? 'GET';
      const payload = init?.body ? JSON.parse(init.body) : undefined;
      const table = url.pathname.split('/').pop();
      calls.push({ url: url.href, method, table, payload, query: Object.fromEntries(url.searchParams) });
      const json = data => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
      if (url.hostname === 'thumbnails.roblox.com') {
        if (method !== 'GET' || url.searchParams.get('universeIds') !== String(universeId)) throw new Error('Wrong official media identity');
        if (scenario === 'api-failure') return new Response(null, { status: 503 });
        const isIcon = table === 'icons';
        if (url.searchParams.get('size') !== (isIcon ? '512x512' : '768x432')) throw new Error('Wrong official media size');
        const ready = scenario === 'pending' ? 'Pending' : 'Completed';
        return json({ data: isIcon
          ? [{ targetId: 999, state: 'Completed', imageUrl: icon.replace('current', 'wrong-game') }, { targetId: universeId, state: ready, imageUrl: icon }]
          : [{ universeId: 999, thumbnails: [{ state: 'Completed', imageUrl: thumbnail.replace('current', 'wrong-game') }] }, { universeId, thumbnails: [{ state: 'Pending', imageUrl: thumbnail.replace('current', 'pending') }, { state: 'Completed', imageUrl: thumbnail }] }]
        });
      }
      if (url.href === icon || url.href === thumbnail) {
        if (method !== 'GET') throw new Error('Official media must be read-only');
        if (scenario === 'icon-404' && url.href === icon) return new Response(null, { status: 404 });
        if (scenario === 'icon-transient' && url.href === icon && calls.filter(call => call.url === icon).length === 1) return new Response(null, { status: 503 });
        const bytes = fs.readFileSync(root + (url.href === icon && scenario !== 'wrong-dimensions' ? '/icon.png' : '/thumbnail.png'));
        return new Response(scenario === 'corrupt-thumbnail' && url.href === thumbnail ? bytes.subarray(0, Math.floor(bytes.length / 2)) : bytes, { headers: { 'content-type': 'image/png' } });
      }
      if (url.hostname !== 'bbtcaurrtyoukvjbxbbj.supabase.co' || !url.pathname.startsWith('/rest/v1/')) throw new Error('Unexpected network request: ' + method + ' ' + url.href);
      if (!${apply} && method !== 'GET') throw new Error('Dry run attempted a write');
      if (table === 'merge_roblox_wiki_registry') {
        if (method !== 'POST') throw new Error('Unexpected registry request');
        const row = { game_slug: payload.p_game_slug, game_name: payload.p_game_name, universe_id: payload.p_universe_id, universe_names: payload.p_universe_names, collections: payload.p_collections, sort_order: 1000 };
        tables.roblox_wiki_registry = [row];
        return json(row);
      }
      const source = tables[table] ??= [];
      const matching = source.filter(row => [...url.searchParams].every(([key, value]) => {
        if (value.startsWith('eq.')) return String(row[key]) === value.slice(3);
        if (value.startsWith('in.')) return value.slice(4, -1).split(',').includes(String(row[key]));
        return true;
      }));
      let result = matching;
      if (method === 'PATCH') {
        for (const row of matching) Object.assign(row, payload);
      } else if (method === 'POST') {
        result = (Array.isArray(payload) ? payload : [payload]).map(row => ({ id: randomUUID(), ...row }));
        source.push(...result);
      } else if (!['GET', 'HEAD'].includes(method)) throw new Error('Unexpected mutation ' + method);
      const headers = { 'content-type': 'application/json', 'content-range': '0-0/' + matching.length };
      if (method === 'HEAD') return new Response(null, { headers });
      const accept = new Headers(init?.headers).get('accept') ?? '';
      return new Response(JSON.stringify(accept.includes('vnd.pgrst.object') ? result[0] : result), { headers });
    };
  `;
  const result = spawnSync(process.execPath, ["--import", "tsx", "--import", `data:text/javascript,${encodeURIComponent(preload)}`, "scripts/content/roblox-wiki-cli.ts", "publish", root, ...(apply ? ["--apply"] : [])], {
    encoding: "utf8", timeout: 30_000,
    env: { ...process.env, BLOXODES_ENV_PROFILE: "process-only", SUPABASE_URL: "https://bbtcaurrtyoukvjbxbbj.supabase.co", SUPABASE_SERVICE_ROLE: "test-only-service-role", WIKI_R2_ENDPOINT: "https://r2.example.com", WIKI_R2_ACCESS_KEY_ID: "test-access", WIKI_R2_SECRET_ACCESS_KEY: "test-secret", WIKI_R2_BUCKET: "bloxodes-wiki", WIKI_MEDIA_PUBLIC_BASE_URL: "https://media.bloxodes.com/wiki" }
  });
  assert.ifError(result.error);
  const stored = JSON.parse(await fs.readFile(report, "utf8")) as {
    tables: Record<string, Array<Record<string, any>>>;
    calls: Array<{ url: string; method: string; table: string; payload?: Record<string, any>; query: Record<string, string> }>;
  };
  return { ...result, ...stored };
}

test("collection-only apply replaces stale cached official media with the exact preflighted pair", async () => {
  const root = await collectionMediaFixture();
  try {
    const result = await runCollectionMediaFixture(root, true, "icon-transient");
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PASS published 1 page\(s\) to managed-dev/);
    const officialReads = result.calls.filter(call => call.url.startsWith("https://thumbnails.roblox.com/"));
    assert.equal(officialReads.length, 2, "apply must use the pair from preflight without refetching");
    assert.deepEqual(result.calls.filter(call => call.url.startsWith("https://tr.rbxcdn.com/")).map(call => call.url).sort(), [currentIcon, currentIcon, currentThumbnail].sort(), "transient CDN reads retain retries");
    assert.equal(result.tables.roblox_universes[0].icon_url, currentIcon);
    assert.deepEqual(result.tables.roblox_universes[0].thumbnail_urls, [{ url: currentThumbnail, state: "Completed", type: null }]);
    assert.equal(result.tables.roblox_universes[1].icon_url, "untouched-icon");
    assert.equal(result.tables.roblox_universe_media.find(row => row.image_url === staleIcon)?.is_primary, false);
    assert.equal(result.tables.roblox_universe_media.find(row => row.image_url === "untouched-icon")?.is_primary, true);
    assert.deepEqual(result.tables.roblox_universe_media.filter(row => row.universe_id === mediaUniverseId && row.is_primary).map(row => row.image_url).sort(), [currentIcon, currentThumbnail].sort());
    const mediaWrite = result.calls.find(call => call.method === "PATCH" && call.table === "roblox_universes")!;
    assert.equal(mediaWrite.query.universe_id, `eq.${mediaUniverseId}`);
    assert.ok(result.calls.findIndex(call => call === mediaWrite) > result.calls.findIndex(call => call.url === currentThumbnail));
    assert.equal(result.calls.filter(call => call.table === "wiki_pages" && call.method !== "GET").length, 0);
    assert.equal(result.tables.wiki_pages[0].title, "Keep hub copy");
    assert.equal(result.tables.wiki_pages[0].cover_image, "https://media.bloxodes.com/wiki/keep-cover.webp");
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test("collection-only dry run resolves readable current media while preserving all stored rows", async () => {
  const root = await collectionMediaFixture();
  try {
    const result = await runCollectionMediaFixture(root, false);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Dry run complete; no database or media writes/);
    assert.equal(result.calls.filter(call => call.url.startsWith("https://thumbnails.roblox.com/")).length, 2);
    assert.equal(result.calls.filter(call => call.url === currentIcon || call.url === currentThumbnail).length, 2);
    assert.ok(result.calls.every(call => call.method === "GET"));
    assert.equal(result.tables.roblox_universes[0].icon_url, staleIcon);
    assert.deepEqual(result.tables.roblox_universes[0].thumbnail_urls, [{ url: staleThumbnail, state: "Completed", type: null }]);
    assert.equal(result.tables.roblox_universe_media.length, 2);
    assert.equal(result.tables.roblox_universe_media[0].is_primary, true);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test("collection-only apply blocks before writes when current official media fails preflight", async () => {
  const root = await collectionMediaFixture();
  try {
    for (const scenario of ["api-failure", "pending", "icon-404", "corrupt-thumbnail", "wrong-dimensions"]) {
      const result = await runCollectionMediaFixture(root, true, scenario);
      assert.equal(result.status, 1, scenario + ": " + result.stderr);
      assert.match(result.stderr, /official game icon and thumbnails/);
      assert.match(result.stderr, /No database or media writes were made/);
      assert.ok(result.calls.every(call => call.method === "GET"), scenario);
      assert.equal(result.tables.roblox_universes[0].icon_url, staleIcon);
      if (scenario === "icon-404") assert.equal(result.calls.filter(call => call.url === currentIcon).length, 1, "permanent image failures must not retry");
      if (scenario === "api-failure" || scenario === "pending") assert.equal(result.calls.filter(call => call.url.startsWith("https://thumbnails.roblox.com/")).length, 6, "retain the existing three API attempts");
    }
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
