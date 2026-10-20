import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GrowGardenCollectionNav } from "@/app/(site)/wiki/collections/games/grow-a-garden";
import { TheForgeCollectionNav } from "@/app/(site)/wiki/collections/games/the-forge";
import { getGameCollectionConfigByCode, listGameCollectionConfigs, listGameCollectionGroups } from "../game-collection-registry";

const state = vi.hoisted(() => ({ read: vi.fn(), client: {} }));
vi.mock("server-only", () => ({}));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), cache: (loader: unknown) => loader }));
vi.mock("../supabase", () => ({ supabaseAdmin: () => state.client }));
vi.mock("../game-collections/registry", () => ({ readGameCollectionGroups: (...args: unknown[]) => state.read(...args) }));

afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });

describe("public collection registry navigation", () => {
  it("logs registry failures and omits navigation for page and mobile callers", async () => {
    const error = new Error("Registry unavailable");
    state.read.mockRejectedValue(error);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(listGameCollectionGroups()).resolves.toEqual([]);
    await expect(listGameCollectionConfigs()).resolves.toEqual([]);
    await expect(getGameCollectionConfigByCode("grow-a-garden-pets")).resolves.toBeNull();
    expect(renderToStaticMarkup(await GrowGardenCollectionNav({ activeSlug: "pets" }))).toBe("");
    expect(renderToStaticMarkup(await TheForgeCollectionNav({ activeSlug: "ores" }))).toBe("");
    expect(logged).toHaveBeenCalledWith(expect.stringContaining("omitting registry navigation"), error);
  });

  it("keeps healthy registry navigation and mobile code lookup", async () => {
    const config = { code: "example-pets", gameSlug: "example", slug: "pets", label: "Pets" };
    const group = { gameSlug: "example", collectionConfigs: [config] };
    state.read.mockResolvedValue([group]);
    await expect(listGameCollectionGroups()).resolves.toEqual([group]);
    await expect(listGameCollectionConfigs()).resolves.toEqual([config]);
    await expect(getGameCollectionConfigByCode(" EXAMPLE-PETS ")).resolves.toEqual(config);
    expect(state.read).toHaveBeenCalledWith(state.client);
  });
});
