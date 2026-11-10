import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { getExistingMusicAssetIds } from "../../../../../scripts/shared/music-catalog-freshness";
import { preserveCatalogPublicationDates } from "../../../../../scripts/shared/catalog-publication";

const now = new Date("2026-10-22T06:20:00.000Z");
describe("music catalog identity lookup", () => {
  it("checks exact unique asset IDs in batches before writes", async () => {
    const ids = Array.from({ length: 501 }, (_, index) => index + 1);
    const lookup = vi.fn(async (_field: string, values: number[]) => ({
      data: values.filter(id => id % 2 === 0).map(asset_id => ({ asset_id })), error: null
    }));
    const client = { from: vi.fn(() => ({ select: () => ({ in: lookup }) })) } as unknown as SupabaseClient;
    const existing = await getExistingMusicAssetIds(client, [...ids, 2, 4]);
    expect(lookup).toHaveBeenCalledTimes(3);
    expect(lookup.mock.calls.flatMap(call => call[1])).toEqual(ids);
    expect(existing.size).toBe(250);
    expect(existing.has(2)).toBe(true);
    expect(existing.has(1)).toBe(false);
  });

  it("rejects existence lookup failures instead of counting them as new songs", async () => {
    const client = { from: () => ({ select: () => ({ in: async () => ({ data: null, error: { message: "timeout" } }) }) }) } as unknown as SupabaseClient;
    await expect(getExistingMusicAssetIds(client, [123])).rejects.toThrow("timeout");
  });
});

describe("catalog seeder publication dates", () => {
  it("preserves published dates and only dates new or newly published rows", async () => {
    const original = "2024-01-02T03:04:05.000Z";
    const rows = [
      { code: "existing", is_published: true, published_at: null },
      { code: "new", is_published: true, published_at: null },
      { code: "becoming-published", is_published: true, published_at: null },
      { code: "legacy-null", is_published: true, published_at: null },
      { code: "draft", is_published: false, published_at: null }
    ];
    const lookup = vi.fn(async () => ({ data: [
      { code: "existing", is_published: true, published_at: original },
      { code: "becoming-published", is_published: false, published_at: original },
      { code: "legacy-null", is_published: true, published_at: null }
    ], error: null }));
    const client = { from: () => ({ select: () => ({ in: lookup }) }) } as unknown as SupabaseClient;
    const result = await preserveCatalogPublicationDates(client, rows, now);
    expect(result.map(row => row.published_at)).toEqual([original, now.toISOString(), now.toISOString(), null, null]);
    expect(lookup).toHaveBeenCalledWith("code", ["existing", "new", "becoming-published", "legacy-null"]);
  });

  it("keeps draft imports unchanged without a lookup", async () => {
    const from = vi.fn();
    const client = { from } as unknown as SupabaseClient;
    const rows = [{ code: "draft", is_published: false, published_at: null }];
    expect(await preserveCatalogPublicationDates(client, rows, now)).toEqual(rows);
    expect(from).not.toHaveBeenCalled();
  });

  it("fails closed if existing publication dates cannot be loaded", async () => {
    const client = { from: () => ({ select: () => ({ in: async () => ({ error: { message: "timeout" } }) }) }) } as unknown as SupabaseClient;
    await expect(preserveCatalogPublicationDates(client, [{ code: "existing", is_published: true }], now)).rejects.toThrow("timeout");
  });
});
