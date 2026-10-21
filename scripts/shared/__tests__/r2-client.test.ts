import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { loadR2ClientConfig, R2Client, utf8Bytes } from "../r2-client";

test("loads the shared wiki bucket credential set", () => {
  const env = {
    WIKI_R2_ENDPOINT: "https://account.r2.example.com",
    WIKI_R2_ACCESS_KEY_ID: "wiki-key",
    WIKI_R2_SECRET_ACCESS_KEY: "wiki-secret",
    WIKI_R2_BUCKET: "bloxodes-wiki"
  } as unknown as NodeJS.ProcessEnv;

  expectConfig(loadR2ClientConfig(env), "wiki-key", "bloxodes-wiki");
});

function expectConfig(config: ReturnType<typeof loadR2ClientConfig>, accessKeyId: string, bucket: string) {
  assert.equal(config.accessKeyId, accessKeyId);
  assert.equal(config.bucket, bucket);
}

test("signs an R2 object upload without exposing the secret", async () => {
  let captured: { url: string; init: RequestInit } | null = null;
  const client = new R2Client(
    {
      endpoint: "https://account.r2.cloudflarestorage.com",
      accessKeyId: "example-access",
      secretAccessKey: "example-secret",
      bucket: "bloxodes-wiki"
    },
    async (input, init) => {
      captured = { url: String(input), init: init || {} };
      return new Response(null, { status: 200 });
    },
    () => new Date("2026-08-27T12:34:56Z")
  );

  await client.putObject({
    key: "123/bee powers/runner.webp",
    body: utf8Bytes("image"),
    contentType: "image/webp",
    metadata: { sha256: "abc123", width: 512 }
  });

  assert.ok(captured);
  const request = captured as unknown as { url: string; init: RequestInit };
  assert.equal(request.url, "https://account.r2.cloudflarestorage.com/bloxodes-wiki/123/bee%20powers/runner.webp");
  const headers = request.init.headers as Record<string, string>;
  assert.match(headers.authorization, /^AWS4-HMAC-SHA256 Credential=example-access\//);
  assert.equal(headers["content-type"], "image/webp");
  assert.equal(headers["x-amz-meta-width"], "512");
  assert.doesNotMatch(headers.authorization, /example-secret/);
});

test("retries transient R2 failures before succeeding", async () => {
  let attempts = 0;
  const delays: number[] = [];
  const client = new R2Client(
    {
      endpoint: "https://account.r2.cloudflarestorage.com",
      accessKeyId: "example-access",
      secretAccessKey: "example-secret",
      bucket: "bloxodes-wiki"
    },
    async (_input, init) => {
      if (init?.method === "HEAD") return new Response(null, { status: 404 });
      attempts += 1;
      return attempts === 1
        ? new Response("temporary", { status: 500 })
        : new Response(null, { status: 200 });
    },
    () => new Date("2026-08-27T12:34:56Z"),
    async (delayMs) => {
      delays.push(delayMs);
    }
  );

  await client.putObject({
    key: "123/retry.webp",
    body: utf8Bytes("image"),
    contentType: "image/webp"
  });

  assert.equal(attempts, 2);
  assert.deepEqual(delays, [250]);
});

test("R2 transport retries keep identical PUT bytes and use fresh timeout signals", async () => {
  let attempts = 0;
  const bodies: Buffer[] = [];
  const signals: AbortSignal[] = [];
  const client = new R2Client({ endpoint: "https://r2.example.com", accessKeyId: "key", secretAccessKey: "secret", bucket: "bloxodes-wiki" }, async (_input, init) => {
    if (init?.method === "HEAD") return new Response(null, { status: 404 });
    attempts++; bodies.push(Buffer.from(init!.body as Uint8Array)); signals.push(init!.signal!);
    if (attempts < 3) throw new TypeError("fetch failed", { cause: { code: "ECONNRESET" } });
    return new Response(null);
  }, () => new Date(), async () => {});
  await client.putObject({ key: "same.webp", body: utf8Bytes("same bytes"), contentType: "image/webp" });
  assert.equal(attempts, 3);
  assert.ok(bodies.every(body => body.equals(Buffer.from("same bytes"))));
  assert.equal(new Set(signals).size, 3);
});

test("Direct R2 PUT recovers a lost response by checking the stored content", async () => {
  const methods: string[] = [];
  let storedHeaders: Headers;
  const client = new R2Client({ endpoint: "https://r2.example.com", accessKeyId: "key", secretAccessKey: "secret", bucket: "bloxodes-wiki" }, async (_input, init) => {
    methods.push(init!.method!);
    if (init!.method === "HEAD") return new Response(null, { headers: storedHeaders });
    storedHeaders = new Headers(init!.headers);
    storedHeaders.set("content-length", String(Buffer.from(init!.body as Uint8Array).length));
    throw new TypeError("fetch failed", { cause: { code: "ECONNRESET" } });
  }, () => new Date(), async () => {});
  await client.putObject({ key: "stored.webp", body: utf8Bytes("image"), contentType: "image/webp" });
  assert.deepEqual(methods, ["PUT", "HEAD"]);
});

test("R2 recovery only accepts HEAD with the expected hash, length and content type", async () => {
  const body = utf8Bytes("image");
  const matching = {
    "x-amz-meta-sha256": createHash("sha256").update(body).digest("hex"),
    "content-length": String(body.byteLength),
    "content-type": "image/webp"
  };
  const mismatches: Record<string, string>[] = [
    { "x-amz-meta-sha256": "different hash" },
    { "content-length": "999" },
    { "content-type": "image/png" },
    { "x-amz-meta-sha256": "" }
  ];
  for (const mismatch of mismatches) {
    const methods: string[] = [];
    const client = new R2Client({ endpoint: "https://r2.example.com", accessKeyId: "key", secretAccessKey: "secret", bucket: "bloxodes-wiki" }, async (_input, init) => {
      methods.push(init!.method!);
      if (init!.method === "HEAD") return new Response(null, { headers: { ...matching, ...mismatch } });
      if (methods.length === 1) return new Response(null, { status: 503 });
      return new Response(null);
    }, () => new Date(), async () => {});
    await client.putObject({ key: "mismatch.webp", body, contentType: "image/webp" });
    assert.deepEqual(methods, ["PUT", "HEAD", "PUT"]);
  }
});

test("R2 upload accepts an existing object only when its content matches", async () => {
  const body = utf8Bytes("image");
  const methods: string[] = [];
  const client = new R2Client({ endpoint: "https://r2.example.com", accessKeyId: "key", secretAccessKey: "secret", bucket: "bloxodes-wiki" }, async (_input, init) => {
    methods.push(init!.method!);
    return new Response(null, { headers: {
      "x-amz-meta-sha256": createHash("sha256").update(body).digest("hex"),
      "content-length": String(body.byteLength),
      "content-type": "image/webp"
    } });
  }, () => new Date(), async () => {});
  await client.uploadObject({ key: "existing.webp", body, contentType: "image/webp" });
  assert.deepEqual(methods, ["HEAD"]);
});

test("R2 checks accept 404 once, reject 403 once, and cap 503 retries at three", async () => {
  for (const [status, expected] of [[404, 1], [403, 1], [503, 3]]) {
    let attempts = 0;
    const client = new R2Client({ endpoint: "https://r2.example.com", accessKeyId: "key", secretAccessKey: "secret", bucket: "bloxodes-wiki" }, async () => {
      attempts++; return new Response(null, { status });
    }, () => new Date(), async () => {});
    if (status === 404) assert.equal(await client.hasObject("missing.webp"), false);
    else await assert.rejects(client.hasObject("item.webp"), new RegExp(`HTTP ${status}`));
    assert.equal(attempts, expected);
  }
});

test("franchise media does not multiply the R2 client's retry budget", async () => {
  const { verifyCollectionImages } = await import("../franchise-collection-media");
  let attempts = 0;
  const client = new R2Client({ endpoint: "https://r2.example.com", accessKeyId: "key", secretAccessKey: "secret", bucket: "bloxodes-wiki" }, async () => {
    attempts++; return new Response(null, { status: 503 });
  }, () => new Date(), async () => {});
  await assert.rejects(verifyCollectionImages([{ image_key: "example/item.webp", image_mime: "image/webp", image_sha256: "hash", image_width: 16, image_height: 16, prepared_image: null }], client, "example-items"), /HTTP 503/);
  assert.equal(attempts, 3);
});
