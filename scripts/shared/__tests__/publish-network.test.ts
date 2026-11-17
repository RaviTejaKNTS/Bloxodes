import assert from "node:assert/strict";
import test from "node:test";
import { selectLiveImages, requireLiveImageResponse, createPublishLimiter, formatPublishError, mapPublishConcurrent, readPublishQuery, requirePublishResponse, retryPublishNetwork } from "../publish-network.mjs";

const tick = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

test("network retries preserve results, stop at three attempts, and back off", async () => {
  for (const error of [new TypeError("fetch failed", { cause: { code: "ECONNRESET" } }), new Error("socket hang up"), new DOMException("request timed out", "TimeoutError"), { code: "ETIMEDOUT" }, { status: 429 }, { status: 503 }]) {
    let attempts = 0;
    const delays: number[] = [];
    const value = await retryPublishNetwork(async () => { if (++attempts < 3) throw error; return "exact result"; }, { sleep: async delay => { delays.push(delay); } });
    assert.equal(value, "exact result");
    assert.equal(attempts, 3);
    assert.deepEqual(delays, [250, 500]);
    attempts = 0;
    await assert.rejects(retryPublishNetwork(async () => { attempts++; throw error; }, { sleep: async () => {} }));
    assert.equal(attempts, 3);
  }
});

test("client statuses and validation errors never retry", async () => {
  for (const error of [new Error("Invalid image dimensions"), new TypeError("Invalid URL"), ...[400, 401, 403, 404, 408, 425].map(status => Object.assign(new TypeError("fetch failed", { cause: { code: "ECONNRESET" } }), { status }))]) {
    let attempts = 0;
    await assert.rejects(retryPublishNetwork(async () => { attempts++; throw error; }, { sleep: async () => { throw new Error("Must not back off"); } }));
    assert.equal(attempts, 1);
  }
});

test("read factories retry Supabase result errors and retain status and causes", async () => {
  let attempts = 0;
  const stored = { id: "row" };
  const result = await readPublishQuery(async () => ++attempts === 1
    ? { data: null, status: 0, error: { message: "TypeError: fetch failed", details: "getaddrinfo ENOTFOUND target.example" } }
    : { data: stored, status: 200, error: null });
  assert.equal(attempts, 2);
  assert.equal(result.data, stored);
  attempts = 0;
  await assert.rejects(readPublishQuery(async () => { attempts++; return { status: 403, error: { message: "Permission denied", details: "fetch failed" } }; }), /Permission denied/);
  assert.equal(attempts, 1);
});

test("HTTP checks cancel failed bodies and attach status for retry classification", async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({ cancel() { cancelled = true; } }), { status: 503 });
  await assert.rejects(requirePublishResponse(response, "image check"), { message: "image check: HTTP 503.", status: 503 });
  assert.equal(cancelled, true);
});

test("workers preserve input order, cap concurrency, and report periodic progress", async () => {
  let active = 0, maximum = 0;
  const log: string[] = [];
  const input = Array.from({ length: 21 }, (_, index) => index);
  const result = await mapPublishConcurrent(input, async index => {
    active++; maximum = Math.max(maximum, active);
    await tick((21 - index) % 4);
    active--; return `row-${index}`;
  }, { label: "images", every: 10, log: message => { log.push(message); } });
  assert.equal(maximum, 8);
  assert.deepEqual(result, input.map(index => `row-${index}`));
  assert.deepEqual(log, ["images 10/21", "images 20/21", "images 21/21"]);
});

test("a failed worker stops scheduling and waits for active work to settle", async () => {
  let active = 0;
  const started: number[] = [];
  await assert.rejects(mapPublishConcurrent([0, 1, 2, 3, 4], async index => {
    started.push(index); active++;
    if (index === 0) { active--; throw new Error("Invalid image"); }
    await tick(5); active--;
  }, { concurrency: 2 }), /Invalid image/);
  assert.equal(active, 0);
  assert.deepEqual(started, [0, 1]);
});

test("nested page image batches share one request limit", async () => {
  const limit = createPublishLimiter(8);
  let active = 0, maximum = 0;
  await mapPublishConcurrent([1, 2, 3, 4], async () => mapPublishConcurrent(Array.from({ length: 20 }), () => limit(async () => {
    active++; maximum = Math.max(maximum, active); await tick(1); active--;
  })));
  assert.equal(maximum, 8);
});

test("error output includes plain-object messages and causes, without secrets or signed URLs", () => {
  const error = { message: "fetch failed", cause: { code: "ENOTFOUND", message: "getaddrinfo ENOTFOUND registry.example" } };
  assert.match(formatPublishError(error), /fetch failed: getaddrinfo ENOTFOUND registry.example: ENOTFOUND/);
  assert.doesNotMatch(formatPublishError(error), /\[object Object\]/);
  assert.equal(formatPublishError({}), "Unknown publication error");
  assert.equal(formatPublishError({ message: "Read https://user:password@media.example/wiki/a.png?X-Amz-Signature=signed-secret#secret" }), "Read https://media.example/wiki/a.png?[redacted]");
});

test("Supabase reads across nested collection batches share one request limit", async () => {
  let active = 0, maximum = 0;
  await mapPublishConcurrent(Array.from({ length: 5 }), async () => mapPublishConcurrent(Array.from({ length: 10 }), () => readPublishQuery(async () => {
    active++; maximum = Math.max(maximum, active); await tick(1); active--;
    return { error: null, data: [], status: 200 };
  })));
  assert.equal(maximum, 8);
});

test("live image modes select uploads and changed hub artwork without discovering old images", () => {
  const old = "https://media.bloxodes.com/wiki/existing.png";
  const fresh = "https://media.bloxodes.com/wiki/upload.png";
  const cover = "https://media.bloxodes.com/wiki/cover.png";
  const hero = "https://media.bloxodes.com/wiki/hero.png";
  const extra = "https://bloxodes.com/extra.png";
  const input = { expectedImages: [old, fresh, cover, hero, fresh], renderedImages: [old, extra], uploadedImages: [fresh, "https://media.bloxodes.com/wiki/other-page.png"], changedImages: [cover, hero] };
  assert.deepEqual(selectLiveImages(input), [fresh, cover, hero]);
  assert.deepEqual(selectLiveImages({ ...input, mode: "new" }), [fresh, cover, hero]);
  assert.deepEqual(selectLiveImages({ ...input, mode: "all" }), [old, fresh, cover, hero, extra]);
  assert.deepEqual(selectLiveImages({ ...input, mode: "none" }), []);
  assert.deepEqual(selectLiveImages({ expectedImages: [old], renderedImages: [old] }), []);
  assert.deepEqual(selectLiveImages({ expectedImages: [] }), []);
});

test("media quota failures name the Worker limit and never retry, including nested retry wrappers", async () => {
  for (const [status, body] of [[429, "error code: 1027"], [500, "error code: 1027"], [503, " \nerror code: 1027\n "]] as const) {
    let attempts = 0;
    await assert.rejects(retryPublishNetwork(() => retryPublishNetwork(async () => {
      attempts++;
      await requireLiveImageResponse(new Response(body, { status }), "https://media.bloxodes.com/wiki/image.png");
    }, { sleep: async () => assert.fail("must not retry") }), { sleep: async () => assert.fail("must not retry") }), /Cloudflare Workers daily request quota.*100,000/);
    assert.equal(attempts, 1);
  }
  await assert.rejects(requireLiveImageResponse(new Response(null, { status: 429 }), "https://elsewhere.example/image.png"), /HTTP 429/);
  const image = new Response("bytes", { headers: { "content-type": "image/png" } });
  assert.equal(await requireLiveImageResponse(image, "https://media.bloxodes.com/wiki/image.png"), image);
  assert.equal(await image.text(), "bytes");
});


test("ordinary rate limits and server errors retry, unrelated 1027 text is not Worker quota", async () => {
  for (const host of ["media.bloxodes.com", "elsewhere.example"]) {
    for (const [status, body] of [[429, "Too many requests"], [500, "item 1027 failed"], [503, "<h1>error code: 1027</h1>"], [429, "error code: 1027 extra"], [404, "error code: 1027"]] as const) {
      let attempts = 0;
      await assert.rejects(retryPublishNetwork(async () => {
        attempts++;
        await requireLiveImageResponse(new Response(body, { status }), `https://${host}/wiki/image.png`);
      }, { sleep: async () => {} }), { status });
      assert.equal(attempts, status === 404 ? 1 : 3);
    }
  }
  await assert.rejects(requireLiveImageResponse(new Response("error code: 1027", { status: 503 }), "https://elsewhere.example/image.png"), { status: 503 });
  const ok = new Response("item 1027", { status: 200 });
  assert.equal(await requireLiveImageResponse(ok, "https://media.bloxodes.com/wiki/image.png"), ok);
});
