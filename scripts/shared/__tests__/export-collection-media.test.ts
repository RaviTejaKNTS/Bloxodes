import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { exportCollectionMedia, imageFilename } from "../export-collection-media";

const env = {
  WIKI_R2_ENDPOINT: "https://account.r2.cloudflarestorage.com",
  WIKI_R2_ACCESS_KEY_ID: "example-access",
  WIKI_R2_SECRET_ACCESS_KEY: "example-secret",
  WIKI_R2_BUCKET: "wiki-bucket"
};

test("maps stored Roblox and franchise keys to the existing workspace filenames", () => {
  for (const [key, filename] of [
    ["123/items/icon-0123456789abcdef.webp", "icon-0123456789abcdef.webp"],
    ["minecraft/minecraft/blocks/stone.png", "stone.png"],
    ["legacy/bee powers/ icon.jpg ", "icon.jpg"],
    ["standalone.gif", "standalone.gif"]
  ]) assert.equal(imageFilename(key), filename);
  for (const key of ["", "prefix/", "prefix/.", "prefix/..", "prefix/   "]) {
    assert.throws(() => imageFilename(key), /Invalid database image key/);
  }
});

test("exports exact bytes with signed R2 GETs and at most eight concurrent downloads", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "collection-export-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const mediaRoot = path.join(root, "media");
  const keys = Array.from({ length: 19 }, (_, index) => `123/bee powers/icon-${index}.webp`);
  const bytes = Buffer.from([0, 255, 128, 42, 13, 10]);
  const requested: string[] = [];
  let active = 0, maximum = 0;
  await exportCollectionMedia(keys, mediaRoot, env, async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, env.WIKI_R2_ENDPOINT);
    assert.equal(init?.method, "GET");
    assert.equal(init?.body, undefined);
    assert.match(new Headers(init?.headers).get("authorization")!, /^AWS4-HMAC-SHA256 Credential=example-access\//);
    requested.push(decodeURIComponent(url.pathname));
    active++;
    maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 2));
    active--;
    return new Response(bytes);
  });
  assert.ok(maximum > 1 && maximum <= 8);
  assert.deepEqual(requested.sort(), keys.map(key => `/wiki-bucket/${key}`).sort());
  assert.deepEqual((await fs.readdir(mediaRoot)).sort(), keys.map(imageFilename).sort());
  for (const key of keys) assert.deepEqual(await fs.readFile(path.join(mediaRoot, imageFilename(key))), bytes);
});

test("missing or blank R2 settings fail before any request or file write", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "collection-export-missing-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const mediaRoot = path.join(root, "media");
  let requests = 0;
  const fetchImpl: typeof fetch = async () => { requests++; throw new Error("Unexpected request"); };
  for (const name of Object.keys(env)) {
    await assert.rejects(
      exportCollectionMedia(["123/icon.webp"], mediaRoot, { ...env, [name]: "  " }, fetchImpl),
      new RegExp(`Missing R2 configuration: ${name}`)
    );
  }
  await assert.rejects(exportCollectionMedia(["123/icon.webp"], mediaRoot, {}, fetchImpl),
    /Missing R2 configuration: WIKI_R2_ENDPOINT, WIKI_R2_ACCESS_KEY_ID, WIKI_R2_SECRET_ACCESS_KEY, WIKI_R2_BUCKET/);
  assert.equal(requests, 0);
  await assert.rejects(fs.stat(mediaRoot), { code: "ENOENT" });
});

test("an R2 authorization failure stops export without a public HTTP fallback", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "collection-export-denied-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const requests: string[] = [];
  await assert.rejects(exportCollectionMedia(["123/icon.webp"], root, env, async (input) => {
    requests.push(String(input));
    return new Response(null, { status: 403 });
  }), /R2 GET 123\/icon.webp: HTTP 403/);
  assert.deepEqual(requests, [`${env.WIKI_R2_ENDPOINT}/wiki-bucket/123/icon.webp`]);
  assert.deepEqual(await fs.readdir(root), []);
});
