import assert from "node:assert/strict";
import test from "node:test";
import { handleWikiMediaRequest, parseWikiMediaKey } from "../src/index";

test("parses only safe wiki object keys", () => {
  assert.equal(parseWikiMediaKey("/wiki/123/items/bee.webp"), "123/items/bee.webp");
  assert.equal(parseWikiMediaKey("/other/123.webp"), null);
  assert.equal(parseWikiMediaKey("/wiki/%2E%2E/secret"), null);
  assert.equal(parseWikiMediaKey("/wiki/a//b"), null);
});

test("serves immutable objects and rejects writes", async () => {
  const cacheEntries = new Map<string, Response>();
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: {
      default: {
        match: async (request: Request) => cacheEntries.get(request.url)?.clone(),
        put: async (request: Request, response: Response) => {
          cacheEntries.set(request.url, response.clone());
        }
      }
    }
  });

  const waits: Promise<unknown>[] = [];
  const object = {
    body: new Blob(["image-bytes"]).stream(),
    etag: '"abc123"',
    size: 11,
    uploaded: new Date("2026-08-27T00:00:00Z"),
    httpMetadata: { contentType: "image/webp" }
  };
  const env = {
    WIKI_MEDIA: {
      get: async (key: string) => (key === "123/bee.webp" ? object : null),
      head: async (key: string) => (key === "123/bee.webp" ? object : null)
    }
  };
  const context = { waitUntil: (promise: Promise<unknown>) => waits.push(promise) };

  const response = await handleWikiMediaRequest(
    new Request("https://media.bloxodes.com/wiki/123/bee.webp"),
    env,
    context
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "image/webp");
  assert.equal(response.headers.get("Cache-Control"), "public, max-age=31536000, immutable");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(await response.text(), "image-bytes");
  await Promise.all(waits);

  const notModified = await handleWikiMediaRequest(
    new Request("https://media.bloxodes.com/wiki/123/bee.webp?ignored=1", {
      headers: { "If-None-Match": '"abc123"' }
    }),
    env,
    context
  );
  assert.equal(notModified.status, 304);

  const denied = await handleWikiMediaRequest(
    new Request("https://media.bloxodes.com/wiki/123/bee.webp", { method: "PUT" }),
    env,
    context
  );
  assert.equal(denied.status, 405);
});
