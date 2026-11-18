import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isWikiMediaUrl,
  LEGACY_WIKI_MEDIA_BASE_URL,
  resolveWikiMediaUrl,
  rewriteLegacyWikiMediaUrls,
  rewriteLegacyWikiMediaUrlsDeep,
  WIKI_MEDIA_BASE_URL,
  wikiMediaKeyFromUrl,
  wikiMediaPublicBaseUrl,
  wikiMediaUrl
} from "@/lib/wiki-media";
import { rewriteLegacyWikiMediaFetch } from "@/lib/wiki-media-fetch";

const originalBaseUrl = process.env.WIKI_MEDIA_PUBLIC_BASE_URL;

afterEach(() => {
  if (originalBaseUrl === undefined) delete process.env.WIKI_MEDIA_PUBLIC_BASE_URL;
  else process.env.WIKI_MEDIA_PUBLIC_BASE_URL = originalBaseUrl;
  vi.unstubAllGlobals();
});

describe("wiki media URLs", () => {
  it("uses the R2 custom domain in every environment", () => {
    delete process.env.WIKI_MEDIA_PUBLIC_BASE_URL;
    expect(WIKI_MEDIA_BASE_URL).toBe("https://wiki-media.bloxodes.com");
    expect(LEGACY_WIKI_MEDIA_BASE_URL).toBe("https://media.bloxodes.com/wiki");
    expect(wikiMediaPublicBaseUrl()).toBe("https://wiki-media.bloxodes.com");
    expect(resolveWikiMediaUrl("372226183/beast-powers/runner.webp")).toBe(
      "https://wiki-media.bloxodes.com/372226183/beast-powers/runner.webp"
    );
    expect(wikiMediaUrl("gta/gta-6/hub-cover-0123456789abcdef.webp")).toBe(
      "https://wiki-media.bloxodes.com/gta/gta-6/hub-cover-0123456789abcdef.webp"
    );
  });

  it("honors a normalized explicit base URL", () => {
    process.env.WIKI_MEDIA_PUBLIC_BASE_URL = "https://media.example.com/wiki/";
    expect(resolveWikiMediaUrl("123/Items/A bee.webp")).toBe(
      "https://media.example.com/wiki/123/Items/A%20bee.webp"
    );
  });

  it("rejects traversal keys", () => {
    expect(() => resolveWikiMediaUrl("123/../secret.webp")).toThrow(/Invalid/);
  });

  it("reads the R2 key from current and legacy URLs only", () => {
    expect(wikiMediaKeyFromUrl("https://wiki-media.bloxodes.com/123/hubs/cover.png")).toBe("123/hubs/cover.png");
    expect(wikiMediaKeyFromUrl("https://media.bloxodes.com/wiki/123/hubs/cover.png")).toBe("123/hubs/cover.png");
    for (const other of [
      "https://media.bloxodes.com/wiki-cover.webp",
      "https://media.bloxodes.com/storage/v1/object/public/a.png",
      "https://wiki-media.bloxodes.com/",
      "https://media.bloxodes.com/wiki/",
      "https://evil.example/https://wiki-media.bloxodes.com/a.png",
      null
    ]) {
      expect(wikiMediaKeyFromUrl(other)).toBeNull();
      expect(isWikiMediaUrl(other)).toBe(false);
    }
  });

  it("rewrites legacy prefixes in URLs, Markdown and JSON values", () => {
    expect(rewriteLegacyWikiMediaUrls("https://media.bloxodes.com/wiki/1/a.webp")).toBe("https://wiki-media.bloxodes.com/1/a.webp");
    expect(rewriteLegacyWikiMediaUrls("![a](https://media.bloxodes.com/wiki/1/a.webp) ![b](https://media.bloxodes.com/wiki/1/b.webp)"))
      .toBe("![a](https://wiki-media.bloxodes.com/1/a.webp) ![b](https://wiki-media.bloxodes.com/1/b.webp)");
    expect(rewriteLegacyWikiMediaUrls("https://media.bloxodes.com/wiki-cover.webp")).toBe("https://media.bloxodes.com/wiki-cover.webp");
    expect(rewriteLegacyWikiMediaUrls(null)).toBeNull();
    const untouched = { image: "https://wiki-media.bloxodes.com/1/a.webp", list: ["x"] };
    expect(rewriteLegacyWikiMediaUrlsDeep(untouched)).toBe(untouched);
    expect(rewriteLegacyWikiMediaUrlsDeep({ a: [{ image: "https://media.bloxodes.com/wiki/1/a.webp" }], n: 1 }))
      .toEqual({ a: [{ image: "https://wiki-media.bloxodes.com/1/a.webp" }], n: 1 });
  });

  it("rewrites legacy prefixes in database JSON responses at render time", async () => {
    const body = JSON.stringify([{ cover_image: "https://media.bloxodes.com/wiki/1/hubs/cover.png", content_md: "![x](https://media.bloxodes.com/wiki/1/x.webp)" }]);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status: 200, headers: { "content-type": "application/json; charset=utf-8", "content-range": "0-0/1" } })));
    const response = await rewriteLegacyWikiMediaFetch("https://database.example/rest/v1/wiki_pages");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-range")).toBe("0-0/1");
    expect(await response.json()).toEqual([{ cover_image: "https://wiki-media.bloxodes.com/1/hubs/cover.png", content_md: "![x](https://wiki-media.bloxodes.com/1/x.webp)" }]);

    const image = new Response("https://media.bloxodes.com/wiki/raw", { headers: { "content-type": "image/png" } });
    vi.stubGlobal("fetch", vi.fn(async () => image));
    expect(await rewriteLegacyWikiMediaFetch("https://database.example/storage/a.png")).toBe(image);
  });

  it("rewrites RPC reads and leaves current-host bodies as they are", async () => {
    const legacy = JSON.stringify({ image: "https://media.bloxodes.com/wiki/1/a.webp" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(legacy, { headers: { "content-type": "application/json" } })));
    const rpc = await rewriteLegacyWikiMediaFetch("https://database.example/rest/v1/rpc/search_pages", { method: "POST", body: "{}" });
    expect(await rpc.json()).toEqual({ image: "https://wiki-media.bloxodes.com/1/a.webp" });

    const current = JSON.stringify([{ image: "https://wiki-media.bloxodes.com/1/a.webp" }]);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(current, { status: 206, headers: { "content-type": "application/vnd.pgrst.object+json", "content-range": "0-0/9" } })));
    const read = await rewriteLegacyWikiMediaFetch(new URL("https://database.example/rest/v1/wiki_pages?select=*"));
    expect(read.status).toBe(206);
    expect(read.headers.get("content-range")).toBe("0-0/9");
    expect(await read.text()).toBe(current);
  });

  it("passes writes, HEAD counts, errors and non-database requests through untouched", async () => {
    const legacy = JSON.stringify([{ image: "https://media.bloxodes.com/wiki/1/a.webp" }]);
    const json = { "content-type": "application/json" };
    const cases: Array<[RequestInfo | URL, RequestInit | undefined, Response]> = [
      ["https://database.example/rest/v1/comments", { method: "POST", body: "{}" }, new Response(legacy, { status: 201, headers: json })],
      ["https://database.example/rest/v1/wiki_pages?id=eq.1", { method: "PATCH", body: "{}" }, new Response(legacy, { headers: json })],
      ["https://database.example/rest/v1/wiki_pages?select=*", { method: "HEAD" }, new Response(null, { headers: json })],
      [new Request("https://database.example/rest/v1/wiki_pages", { method: "DELETE" }), undefined, new Response(legacy, { headers: json })],
      ["https://database.example/rest/v1/wiki_pages", undefined, new Response(legacy, { status: 400, headers: json })],
      ["https://database.example/rest/v1/wiki_pages", undefined, new Response(null, { status: 204 })],
      ["https://database.example/auth/v1/user", undefined, new Response(legacy, { headers: json })],
      ["https://database.example/functions/v1/revalidate", { method: "POST" }, new Response(legacy, { headers: json })]
    ];
    for (const [input, init, original] of cases) {
      vi.stubGlobal("fetch", vi.fn(async () => original));
      expect(await rewriteLegacyWikiMediaFetch(input, init)).toBe(original);
    }
  });
});
