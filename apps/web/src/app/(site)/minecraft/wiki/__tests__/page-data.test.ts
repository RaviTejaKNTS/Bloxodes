import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadMinecraftWikiCollectionCards } from "../page-data";
import type { MinecraftWikiCollectionPage } from "@/lib/minecraft";

const { summary } = vi.hoisted(() => ({ summary: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/minecraft", () => ({
  buildMinecraftCollectionPath: (_wiki: string, slug: string) => `/minecraft/wiki/${slug}`,
  getPublishedMinecraftWikiCollectionEditionSummary: summary
}));
vi.mock("@/lib/markdown", () => ({ renderMarkdown: async (value: string) => `<p>${value}</p>` }));
beforeEach(() => summary.mockReset());

describe("edition-specific wiki overview cards", () => {
  it("omits unsupported collections and preserves edition counts, images and links", async () => {
    const collections = ["recipes", "advancements"].map(slug => ({ code: `minecraft-${slug}`, wiki_slug: "minecraft", collection_slug: slug, display_name: slug, title: "Combined dataset title", wiki_md: "Shared introduction" } as MinecraftWikiCollectionPage));
    summary.mockResolvedValueOnce({ java: { itemCount: 2, imageUrls: ["java.png"] }, bedrock: { itemCount: 1, imageUrls: ["bedrock.png"] } });
    summary.mockResolvedValueOnce({ java: { itemCount: 1, imageUrls: [] }, bedrock: { itemCount: 0, imageUrls: [] } });
    const cards = await loadMinecraftWikiCollectionCards(collections, "bedrock");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ itemCount: 1, imageUrls: ["bedrock.png"], href: "/minecraft/wiki/recipes?edition=bedrock", copyHtml: "<p>Shared introduction</p>" });
  });
});
