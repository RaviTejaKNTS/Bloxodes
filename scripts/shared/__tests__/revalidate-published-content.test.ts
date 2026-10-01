import test from "node:test";
import assert from "node:assert/strict";
import { revalidatePublishedContent } from "../revalidate-published-content";

const env = { SUPABASE_URL: "https://database.bloxodes.com", REVALIDATE_SECRET: "test-publisher-secret" };
test("trusted publication refreshes the exact wiki batch and rejects an unsuccessful purge", async () => {
  const previous = globalThis.fetch;
  let request: Request;
  globalThis.fetch = async (input, init) => {
    request = new Request(input, init);
    return new Response(JSON.stringify({ revalidated: true, cloudflare: { enabled: true, ok: true } }));
  };
  try {
    const events = [{ type: "wiki" as const, slug: "slayers-2" }, { type: "wiki_collection" as const, slug: "slayers-2/weapons" }];
    await revalidatePublishedContent(env, events);
    assert.equal(request!.url, "https://bloxodes.com/api/revalidate");
    assert.deepEqual(await request!.json(), { type: "batch", events });
    assert.equal(request!.headers.get("Authorization"), "Bearer test-publisher-secret");
    globalThis.fetch = async () => new Response(JSON.stringify({ revalidated: true, cloudflare: { enabled: true, ok: false } }));
    await assert.rejects(revalidatePublishedContent(env, events), /did not complete/);
    await assert.rejects(revalidatePublishedContent({ ...env, SUPABASE_URL: "https://test.supabase.co" }, events), /production target/);
    await assert.rejects(revalidatePublishedContent({ ...env, REVALIDATE_SECRET: "" }, events), /requires REVALIDATE_SECRET/);
    await assert.rejects(revalidatePublishedContent(env, [{ type: "article", slug: "../../other" }]), /exact editorial slugs/);
  } finally { globalThis.fetch = previous; }
});
