import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { imageLocalPath } from "../local-image-path";

test("prefixed and bare image paths resolve to the existing workspace media file", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "collection-media-path-"));
  try {
    const dataset = path.join(workspace, "dataset.json");
    const media = path.join(workspace, "media");
    await mkdir(media);
    const image = path.join(media, "crop.webp");
    await writeFile(image, "reviewed image bytes");
    for (const value of ["media/crop.webp", "crop.webp", "/media/crop.webp?revision=1"]) {
      const resolved = imageLocalPath(value, dataset);
      assert.equal(resolved, image);
      assert.equal((await stat(resolved!)).isFile(), true);
    }
    const missing = imageLocalPath("media/missing.webp", dataset);
    assert.equal(missing, path.join(media, "missing.webp"));
    await assert.rejects(stat(missing!), { code: "ENOENT" });
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("prefix handling retains traversal and remote URL exclusions", () => {
  const dataset = "/tmp/reviewed-collection/dataset.json";
  for (const value of ["../outside.webp", "media/../outside.webp", "media/%2e%2e/outside.webp", "media/"]) {
    assert.equal(imageLocalPath(value, dataset), null);
  }
  assert.equal(imageLocalPath("https://media.bloxodes.com/item.webp", dataset), null);
});
