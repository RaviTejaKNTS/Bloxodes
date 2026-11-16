import { afterEach, expect, it, vi } from "vitest";
import { decoration, isCatalogArtworkUrl, MAX_DECORATION_BYTES } from "../catalog-image-decoration";
afterEach(() => vi.unstubAllGlobals());
it.each(["http://tr.rbxcdn.com/a", "https://127.0.0.1/a", "https://rbxcdn.com.evil.test/a", "file:///etc/passwd", "https://user:pass@tr.rbxcdn.com/a", "https://tr.rbxcdn.com:444/a"])("rejects unsafe artwork %s", async url => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  expect(await decoration(url)).toBeUndefined();
  expect(fetch).not.toHaveBeenCalled();
});
it.each(["https://tr.rbxcdn.com/a", "https://t0.rbxcdn.com/a", "https://rbxcdn.net/a", "https://a.b.rbxcdn.net/a"])("allows Roblox CDN artwork %s", url => expect(isCatalogArtworkUrl(url)).toBe(true));
it("does not follow a redirect to a private address", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { Location: "http://127.0.0.1/secret" } }));
  vi.stubGlobal("fetch", fetch);
  expect(await decoration("https://tr.rbxcdn.com/a")).toBeUndefined();
  expect(fetch).toHaveBeenCalledOnce();
  expect(fetch.mock.calls[0][1].redirect).toBe("manual");
});
it("cancels a streamed body above 5 MB without content-length", async () => {
  const cancel = vi.fn();
  const stream = new ReadableStream({ start(controller) {
    controller.enqueue(new Uint8Array(MAX_DECORATION_BYTES));
    controller.enqueue(new Uint8Array(1));
  }, cancel });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(stream)));
  expect(await decoration("https://tr.rbxcdn.com/a")).toBeUndefined();
  expect(cancel).toHaveBeenCalledOnce();
});
it("rejects an oversized declared body before reading it", async () => {
  const cancel = vi.fn();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new ReadableStream({ cancel }), { headers: { "Content-Length": String(MAX_DECORATION_BYTES + 1) } })));
  expect(await decoration("https://tr.rbxcdn.com/a")).toBeUndefined();
  expect(cancel).toHaveBeenCalledOnce();
});
