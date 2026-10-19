import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { MAX_FRANCHISE_IMAGE_BYTES, MAX_FRANCHISE_IMAGE_PIXELS, verifyFranchisePageImage } from "../franchise-page-images";

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
  await assert.rejects(verifyFranchisePageImage(target), /landscape artwork/);
  bytes = await image(1200, 630);
  await verifyFranchisePageImage(target);
  bytes = await image(1000, 900);
  await assert.rejects(verifyFranchisePageImage(target), /landscape artwork/);
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

test("the fetch boundary rejects foreign hosts and non-default ports without requesting them", async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error("must not fetch"); };
  for (const url of ["https://127.0.0.1/a.png", "https://example.com/a.png", "https://media.bloxodes.com.evil.test/a.png", "https://other.supabase.co/a.png", "https://media.bloxodes.com:8443/a.png"]) {
    await assert.rejects(verifyFranchisePageImage({ ...target, url }), /Example hub.*disallowed cover image/);
  }
  assert.equal(requests, 0);
});

test("redirects cannot escape the host allowlist or trigger a second request", async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const requests: string[] = [];
  let cancelled = false;
  globalThis.fetch = async (url, init) => {
    requests.push(String(url));
    assert.equal(init?.redirect, "manual");
    assert.ok(init?.signal);
    return new Response(new ReadableStream({ cancel() { cancelled = true; } }), { status: 302, headers: { location: "https://127.0.0.1/private", "content-type": "image/png" } });
  };
  await assert.rejects(verifyFranchisePageImage(target), /Example hub.*cover.*redirects are not allowed/);
  assert.deepEqual(requests, [target.url]);
  assert.equal(cancelled, true);
});

test("an excessive Content-Length cancels the body before reading it", async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  let reads = 0;
  let cancelled = false;
  globalThis.fetch = async () => new Response(new ReadableStream({ pull() { reads++; }, cancel() { cancelled = true; } }, { highWaterMark: 0 }), { headers: { "content-type": "image/png", "content-length": String(MAX_FRANCHISE_IMAGE_BYTES + 1) } });
  await assert.rejects(verifyFranchisePageImage(target), /Example hub.*unreadable cover image body.*byte limit/);
  assert.equal(reads, 0);
  assert.equal(cancelled, true);
});

test("streamed byte limits cancel bodies with missing or falsely small Content-Length", async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const chunk = new Uint8Array(1024 * 1024);
  for (const length of [undefined, "1"]) {
    let reads = 0;
    let cancelled = false;
    const headers: Record<string, string> = { "content-type": "image/png" };
    if (length) headers["content-length"] = length;
    globalThis.fetch = async () => new Response(new ReadableStream({
      pull(controller) { reads++; controller.enqueue(chunk); },
      cancel() { cancelled = true; }
    }, { highWaterMark: 0 }), { headers });
    await assert.rejects(verifyFranchisePageImage(target), /Example hub.*unreadable cover image body.*byte limit/);
    assert.equal(reads, MAX_FRANCHISE_IMAGE_BYTES / chunk.byteLength + 1);
    assert.equal(cancelled, true);
  }
});

test("body-read errors include the page label and image role", async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => new Response(new ReadableStream({ pull(controller) { controller.error(new Error("connection reset")); } }), { headers: { "content-type": "image/png" } });
  await assert.rejects(verifyFranchisePageImage({ ...target, role: "thumbnail" }), /Example hub.*unreadable thumbnail image body.*connection reset/);
});

test("valid headers with damaged pixel data cannot pass full decoding", async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const bytes = await image(160, 90);
  for (let offset = 8; offset < bytes.length; ) {
    const length = bytes.readUInt32BE(offset);
    if (bytes.toString("ascii", offset + 4, offset + 8) === "IDAT") {
      bytes.fill(0, offset + 8, offset + 8 + length);
      break;
    }
    offset += length + 12;
  }
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.width, 160);
  assert.equal(metadata.height, 90);
  globalThis.fetch = async () => new Response(new Uint8Array(bytes), { headers: { "content-type": "image/png" } });
  await assert.rejects(verifyFranchisePageImage(target), /Example hub.*unreadable cover image/);
});

test("pixel limits reject compressed images that would decode above the cap", async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const bytes = await image(4097, 4096);
  assert.ok(4097 * 4096 > MAX_FRANCHISE_IMAGE_PIXELS);
  assert.ok(bytes.length < MAX_FRANCHISE_IMAGE_BYTES);
  globalThis.fetch = async () => new Response(new Uint8Array(bytes), { headers: { "content-type": "image/png" } });
  await assert.rejects(verifyFranchisePageImage(target), /Example hub.*unreadable cover image.*pixel limit/i);
});
