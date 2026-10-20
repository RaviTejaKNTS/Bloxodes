import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
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
