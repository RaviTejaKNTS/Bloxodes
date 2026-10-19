import { describe, expect, it } from "vitest";
import { SITE_URL, webPageJsonLd } from "@/lib/seo";

const page = { siteUrl: SITE_URL, slug: "wiki/fisch", title: "Fisch Wiki", description: "Fisch fish and rods.", author: null };

describe("WebPage image schema", () => {
  it.each([undefined, null, "", "   "])("omits missing artwork (%s) without resolving the homepage as an image", image => {
    expect(webPageJsonLd({ ...page, image })).not.toHaveProperty("image");
    expect(JSON.parse(JSON.stringify(webPageJsonLd({ ...page, image })))).not.toHaveProperty("image");
  });

  it("accepts an omitted image argument", () => {
    expect(webPageJsonLd(page)).not.toHaveProperty("image");
  });

  it.each(["https://tr.rbxcdn.com/example/768/432/Image/Webp", "https://media.bloxodes.com/wiki/cover.webp"])("preserves real hosted artwork (%s)", image => {
    expect(webPageJsonLd({ ...page, image }).image).toBe(image);
  });

  it("keeps resolving valid relative artwork", () => {
    expect(webPageJsonLd({ ...page, image: "/images/fisch.webp" }).image).toBe(`${SITE_URL}/images/fisch.webp`);
  });
});
