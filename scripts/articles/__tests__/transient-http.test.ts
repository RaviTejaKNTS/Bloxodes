import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchWithTransientRetries,
  isTransientHttpStatus,
  TransientHttpError,
} from "../../shared/transient-http";

const noWait = async () => {};

test("retries transient CDN responses and returns the recovered response", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response(calls < 3 ? "temporary" : "image", {
      status: calls < 3 ? 522 : 200,
      headers: { "content-type": "image/webp" },
    });
  };

  const response = await fetchWithTransientRetries("https://media.bloxodes.com/cover.webp", {}, {
    attempts: 4,
    fetchImpl: fetchImpl as typeof fetch,
    sleep: noWait,
  });
  assert.equal(response.status, 200);
  assert.equal(calls, 3);
});

test("classifies exhausted CDN failures as transient", async () => {
  const fetchImpl = async () => new Response("temporary", { status: 522 });
  await assert.rejects(
    fetchWithTransientRetries("https://media.bloxodes.com/cover.webp", {}, {
      attempts: 2,
      fetchImpl: fetchImpl as typeof fetch,
      sleep: noWait,
    }),
    TransientHttpError,
  );
  assert.equal(isTransientHttpStatus(522), true);
  assert.equal(isTransientHttpStatus(429), true);
});

test("does not retry permanent missing-media responses", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response("missing", { status: 404 });
  };
  await assert.rejects(
    fetchWithTransientRetries("https://media.bloxodes.com/missing.webp", {}, {
      attempts: 4,
      fetchImpl: fetchImpl as typeof fetch,
      sleep: noWait,
    }),
    /returned HTTP 404/,
  );
  assert.equal(calls, 1);
});
