import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { verifyFranchisePageImage } from "../franchise-page-images";

const image = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: "#446688" } }).png().toBuffer();
const target = { label: "Example hub", url: "https://media.bloxodes.com/cover.png", role: "cover" };

test("publication reads real image bytes and checks cover and thumbnail dimensions", async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  let bytes = await image(160, 90);
  globalThis.fetch = async () => new Response(new Uint8Array(bytes), { headers: { "content-type": "image/png" } });
  await verifyFranchisePageImage(target);
  await assert.rejects(verifyFranchisePageImage({ ...target, role: "thumbnail" }), /square thumbnail/);
  bytes = await image(80, 80);
  await verifyFranchisePageImage({ ...target, role: "thumbnail" });
  await assert.rejects(verifyFranchisePageImage(target), /16:9 landscape/);
});

test("missing, non-image and corrupt media cannot pass with a plausible URL", async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => new Response("missing", { status: 404 });
  await assert.rejects(verifyFranchisePageImage(target), /Example hub.*unavailable/);
  globalThis.fetch = async () => new Response("<html>not an image</html>", { headers: { "content-type": "text/html" } });
  await assert.rejects(verifyFranchisePageImage(target), /unavailable/);
  globalThis.fetch = async () => new Response("corrupt", { headers: { "content-type": "image/png" } });
  await assert.rejects(verifyFranchisePageImage(target), /Example hub.*unreadable/);
});
