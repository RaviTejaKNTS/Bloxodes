import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPublishedMinecraftWikiCollectionEditionSummary, type MinecraftWikiCollectionPage } from "../minecraft";

const { client, query } = vi.hoisted(() => {
  const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn() };
  return { query, client: { from: vi.fn() } };
});
vi.mock("server-only", () => ({}));
vi.mock("react", async importOriginal => ({ ...await importOriginal<typeof import("react")>(), cache: (loader: unknown) => loader }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => client }));
vi.mock("@/lib/wiki-media", () => ({ resolveWikiMediaUrl: (key: string | null) => key ? `https://media.bloxodes.com/${key}` : null }));

beforeEach(() => {
  vi.resetAllMocks();
  client.from.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
});
const page = { code: "minecraft-recipes", published_dataset_id: "reviewed-revision", item_count: 1001, wiki_slug: "minecraft", collection_slug: "recipes" } as MinecraftWikiCollectionPage;

describe("published Minecraft overview summaries", () => {
  it("reads every page of the published revision and counts entries without pictures", async () => {
    query.range.mockResolvedValueOnce({ data: Array.from({ length: 1000 }, () => ({ editions: ["java"], image_key: null })), error: null });
    query.range.mockResolvedValueOnce({ data: [{ editions: ["bedrock"], image_key: "bedrock.png" }], error: null });
    const result = await getPublishedMinecraftWikiCollectionEditionSummary(page);
    expect(query.eq).toHaveBeenCalledWith("dataset_id", "reviewed-revision");
    expect(query.select).toHaveBeenCalledWith("editions:fields_json->editions, image_key");
    expect(query.range.mock.calls).toEqual([[0, 999], [1000, 1999]]);
    expect(result.java.itemCount).toBe(1000);
    expect(result.bedrock).toEqual({ itemCount: 1, imageUrls: ["https://media.bloxodes.com/bedrock.png"] });
  });
  it("rejects incomplete reads instead of publishing a misleading count", async () => {
    query.range.mockResolvedValueOnce({ data: [], error: null });
    await expect(getPublishedMinecraftWikiCollectionEditionSummary(page)).rejects.toThrow("expected 1001 summary rows and loaded 0");
    query.range.mockResolvedValueOnce({ data: null, error: { message: "Connection failed" } });
    await expect(getPublishedMinecraftWikiCollectionEditionSummary(page)).rejects.toThrow("Connection failed");
  });
});
