import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { collectionImageKey, uploadCollectionImages, verifyCollectionImages } from "../franchise-collection-media";

function item(slug: string, text: string, namespace = "minecraft") {
  const bytes = Buffer.from(text);
  const hash = createHash("sha256").update(bytes).digest("hex");
  return {
    image_key: collectionImageKey({ namespace, mediaPrefix: namespace, gameSlug: "minecraft", collectionSlug: "recipes", itemSlug: slug, hash, extension: "webp" }),
    image_mime: "image/webp", image_sha256: hash, image_width: 16, image_height: 16, prepared_image: bytes
  };
}

test("Minecraft rows with identical bytes share one immutable key, PUT and HEAD", async () => {
  const rows = [item("first-recipe", "same icon"), item("second-recipe", "same icon")];
  assert.equal(rows[0].image_key, rows[1].image_key);
  let heads = 0, puts = 0;
  const store = { hasObject: async () => { heads++; return false; }, putObject: async () => { puts++; } };
  const confirmed = new Set<string>();
  await uploadCollectionImages(rows, store, confirmed);
  await verifyCollectionImages(rows, store, "minecraft-recipes", confirmed);
  assert.equal(heads, 1);
  assert.equal(puts, 1);
});

test("Different Minecraft bytes keep distinct keys and objects", async () => {
  const rows = [item("same-row", "first icon"), item("same-row", "second icon")];
  assert.notEqual(rows[0].image_key, rows[1].image_key);
  const puts: string[] = [];
  await uploadCollectionImages(rows, { hasObject: async () => false, putObject: async input => { puts.push(input.key); } }, new Set());
  assert.equal(new Set(puts).size, 2);
});

test("Existing namespaces keep their row-based key and uncached verification behavior", async () => {
  const rows = [item("first-recipe", "same icon", "gta"), item("second-recipe", "same icon", "gta")];
  assert.notEqual(rows[0].image_key, rows[1].image_key);
  assert.match(rows[0].image_key, /^gta\/minecraft\/recipes\/first-recipe-[a-f0-9]{16}\.webp$/);
  const redDead = item("first-recipe", "same icon", "red-dead");
  assert.match(redDead.image_key, /^red-dead\/minecraft\/recipes\/first-recipe-[a-f0-9]{16}\.webp$/);
  let heads = 0;
  await verifyCollectionImages(rows, { hasObject: async () => { heads++; return true; }, putObject: async () => {} }, "gta-recipes");
  assert.equal(heads, 2);
});

test("Missing objects and unsafe Minecraft image identities fail before publication", async () => {
  await assert.rejects(verifyCollectionImages([item("recipe", "icon")], { hasObject: async () => false, putObject: async () => {} }, "minecraft-recipes", new Set()), /Missing R2 image/);
  assert.throws(() => collectionImageKey({ namespace: "minecraft", mediaPrefix: "minecraft", gameSlug: "minecraft", collectionSlug: "recipes", itemSlug: "recipe", hash: "bad", extension: "webp" }), /exact SHA-256/);
});

test("Minecraft uploads are bounded, deduplicate before requests, and propagate failures", async () => {
  const rows = Array.from({ length: 19 }, (_, index) => item(`row-${index}`, `icon-${index}`));
  rows.push(...rows);
  let active = 0, maximum = 0, heads = 0, puts = 0;
  await uploadCollectionImages(rows, {
    hasObject: async () => { heads++; active++; maximum = Math.max(maximum, active); await new Promise(resolve => setTimeout(resolve, 2)); active--; return false; },
    putObject: async () => { puts++; }
  }, new Set());
  assert.equal(heads, 19);
  assert.equal(puts, 19);
  assert.ok(maximum > 1 && maximum <= 8);
  const confirmed = new Set<string>();
  await assert.rejects(uploadCollectionImages([rows[0]!], { hasObject: async () => false, putObject: async () => { throw new Error("write failed"); } }, confirmed), /write failed/);
  assert.equal(confirmed.size, 0);
});

test("A scoped Minecraft retry can lower its request limit without changing the default", async () => {
  const rows = Array.from({ length: 5 }, (_, index) => item(`row-${index}`, `icon-${index}`));
  let active = 0, maximum = 0;
  await uploadCollectionImages(rows, {
    hasObject: async () => { active++; maximum = Math.max(maximum, active); await new Promise(resolve => setTimeout(resolve, 2)); active--; return true; },
    putObject: async () => {}
  }, new Set(), 2);
  assert.equal(maximum, 2);
  await assert.rejects(uploadCollectionImages(rows, { hasObject: async () => true, putObject: async () => {} }, new Set(), 9), /integer from 1 to 8/);
});

test("Minecraft retries a known transport closure and rechecks a possibly completed immutable PUT", async () => {
  const row = item("recipe", "exact immutable bytes");
  let heads = 0, puts = 0, stored = false;
  const confirmed = new Set<string>();
  await uploadCollectionImages([row, row], {
    hasObject: async () => { heads++; return stored; },
    putObject: async input => {
      puts++; assert.deepEqual(input.body, row.prepared_image); stored = true;
      throw new TypeError("fetch failed", { cause: { code: "UND_ERR_SOCKET" } });
    }
  }, confirmed, 1);
  assert.equal(heads, 2);
  assert.equal(puts, 1);
  assert.equal(confirmed.size, 1);
});

test("Transport retries stop after three attempts; HTTP failures and legacy requests do not retry", async () => {
  const rows = [item("recipe", "icon")];
  let heads = 0;
  const transient = { hasObject: async () => { heads++; throw new Error("connect reset", { cause: { code: "ECONNRESET" } }); }, putObject: async () => {} };
  const confirmed = new Set<string>();
  await assert.rejects(verifyCollectionImages(rows, transient, "minecraft-recipes", confirmed, 1), /connect reset/);
  assert.equal(heads, 3);
  assert.equal(confirmed.size, 0);
  heads = 0;
  await assert.rejects(verifyCollectionImages(rows, { hasObject: async () => { heads++; throw new Error("R2 HEAD HTTP403"); }, putObject: async () => {} }, "minecraft-recipes", confirmed, 1), /HTTP403/);
  assert.equal(heads, 1);
  heads = 0;
  await assert.rejects(verifyCollectionImages(rows, transient, "gta-recipes"), /connect reset/);
  assert.equal(heads, 1);
});

test("An explicit HTTP status prevents retries even with a nested transport cause", async () => {
  for (const status of [{ status: 503 }, { statusCode: 401 }, { $metadata: { httpStatusCode: 403 } }]) {
    let heads = 0;
    const failure = Object.assign(new TypeError("fetch failed", { cause: { code: "UND_ERR_SOCKET" } }), status);
    const confirmed = new Set<string>();
    await assert.rejects(verifyCollectionImages([item("recipe", "icon")], {
      hasObject: async () => { heads++; throw failure; }, putObject: async () => {}
    }, "minecraft-recipes", confirmed, 1), /fetch failed/);
    assert.equal(heads, 1);
    assert.equal(confirmed.size, 0);
  }
});
