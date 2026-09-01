import { afterEach, describe, expect, it } from "vitest";
import { resolveWikiMediaUrl, wikiMediaPublicBaseUrl } from "@/lib/wiki-media";

const originalBaseUrl = process.env.WIKI_MEDIA_PUBLIC_BASE_URL;

afterEach(() => {
  if (originalBaseUrl === undefined) delete process.env.WIKI_MEDIA_PUBLIC_BASE_URL;
  else process.env.WIKI_MEDIA_PUBLIC_BASE_URL = originalBaseUrl;
});

describe("wiki media URLs", () => {
  it("uses the canonical shared media host in every environment", () => {
    delete process.env.WIKI_MEDIA_PUBLIC_BASE_URL;
    expect(wikiMediaPublicBaseUrl()).toBe("https://media.bloxodes.com/wiki");
    expect(resolveWikiMediaUrl("372226183/beast-powers/runner.webp")).toBe(
      "https://media.bloxodes.com/wiki/372226183/beast-powers/runner.webp"
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
});
