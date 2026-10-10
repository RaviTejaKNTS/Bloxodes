import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { decodeBundle, folderInputs, extractBundle } from "../content-bundle.mjs";
function encoded(paths) {
  const buffer = Buffer.from(JSON.stringify({version:1,batch:{},files:paths.map(path => ({path,base64:Buffer.from('content').toString('base64')}))}));
  return [buffer, createHash('sha256').update(buffer).digest('hex')];
}
test("private bundles require the exact approved bytes", () => {
  const [buffer, hash] = encoded(['final.json']);
  assert.equal(decodeBundle(buffer, hash).files.length, 1);
  assert.throws(() => decodeBundle(Buffer.concat([buffer,Buffer.from(' ')]),hash));
});
test("private bundles reject traversal, code, credentials and duplicate files", () => {
  for (const paths of [['../final.json'],['.env.json'],['script.mjs'],['final.json','final.json'],['batch.json']]) assert.throws(() => decodeBundle(...encoded(paths)));
});


async function freeze(folder, batch) {
  const inputs = await folderInputs(folder, "collections/pets");
  const files = await Promise.all(inputs.map(async input => ({ path: input.destination, base64: (await fs.readFile(input.source)).toString("base64") })));
  const buffer = Buffer.from(JSON.stringify({ version: 1, batch, files }));
  return decodeBundle(buffer, createHash("sha256").update(buffer).digest("hex"));
}

test("zero-image collections retain their declared media root through freeze and extraction", async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "wiki-empty-bundle-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const folder = path.join(root, "source");
  await fs.mkdir(path.join(folder, "media"), { recursive: true });
  const dataset = { meta: { schemaVersion: 2 }, items: [{ item: { name: "Cat" }, system: { slug: "cat", image: null } }] };
  await fs.writeFile(path.join(folder, "dataset.json"), JSON.stringify(dataset));
  await fs.writeFile(path.join(folder, "runtime-manifest.json"), JSON.stringify({ schemaVersion: 1, dataset: "dataset.json", mediaRoot: "media" }));
  const bundle = await freeze(folder, { operations: [{ publisher: "roblox-collection", file: "collections/pets/runtime-manifest.json" }] });
  assert.ok(!bundle.files.some(file => file.path.startsWith("collections/pets/media/")));
  const extracted = path.join(root, "extracted");
  await extractBundle(bundle, extracted);
  const mediaRoot = path.join(extracted, "collections/pets/media");
  assert.equal(await fs.realpath(mediaRoot), mediaRoot, "sync's existing realpath requirement still passes");
  assert.deepEqual(await fs.readdir(mediaRoot), []);
  assert.equal(await fs.readFile(path.join(extracted, "collections/pets/dataset.json"), "utf8"), await fs.readFile(path.join(folder, "dataset.json"), "utf8"));
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(extracted, "collections/pets/dataset.json"), "utf8")), dataset);
  await assert.rejects(extractBundle(bundle, extracted), /EEXIST/);
});

test("bundle extraction rejects escaping media roots before writing any files", async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "wiki-unsafe-bundle-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const mediaRoot of ["../outside", "/tmp/outside", ".aws", "media/../../outside", "media//nested"]) {
    const bundle = { batch: { operations: [{ publisher: "roblox-collection", file: "collections/pets/runtime-manifest.json" }] }, files: [{ path: "collections/pets/runtime-manifest.json", base64: Buffer.from(JSON.stringify({ mediaRoot })).toString("base64") }] };
    const destination = path.join(root, "extracted");
    await assert.rejects(extractBundle(bundle, destination), /Unsafe frozen collection media directory/);
    await assert.rejects(fs.stat(destination), { code: "ENOENT" });
  }
});

test("lowercase supported images survive freeze and extraction and unsupported files do not", async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "wiki-media-bundle-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const folder = path.join(root, "source");
  await fs.mkdir(path.join(folder, "media"), { recursive: true });
  const data = { meta: { schemaVersion: 2 }, items: [{ item: { name: "Cat" }, system: { slug: "cat", image: "/cat.png" } }] };
  await fs.writeFile(path.join(folder, "dataset.json"), JSON.stringify(data));
  for (const name of ["cat.png", "cat.GIF", "cat.PNG"]) await fs.writeFile(path.join(folder, "media", name), "bytes");
  const bundle = await freeze(folder, {});
  assert.deepEqual(bundle.files.filter(file => file.path.includes("/media/")).map(file => file.path), ["collections/pets/media/cat.png"]);
  await extractBundle(bundle, path.join(root, "extracted"));
  const extractedData = JSON.parse(await fs.readFile(path.join(root, "extracted/collections/pets/dataset.json"), "utf8"));
  assert.equal(await fs.readFile(path.join(root, "extracted/collections/pets/media", extractedData.items[0].system.image.slice(1)), "utf8"), "bytes");
});
