import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ admin: vi.fn(), collections: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: mocks.admin }));
vi.mock("@/lib/shared-game-reader", () => ({
  createGameReader: () => ({ listPublishedSharedGameWikiCollectionsByWikiSlug: mocks.collections })
}));

import { loadGameCodeSeoData } from "../game-code-seo";
import { loadGameWikiHubCollections } from "../game-wiki-hub-data";

beforeEach(() => vi.resetAllMocks());

function query(result: unknown): object {
  const chain: object = new Proxy({}, {
    get: (_, key) => key === "then"
      ? (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject)
      : () => chain
  });
  return chain;
}

it.each(["game_codes", "games"])("throws when the %s SEO read fails", async failedTable => {
  mocks.admin.mockReturnValue({ from: (table: string) => query(table === failedTable
    ? { data: null, error: { message: "connection lost" } }
    : { data: table === "games" ? { title: "Example" } : [], error: null }) });
  await expect(loadGameCodeSeoData("page", "example", "game")).rejects.toThrow("connection lost");
});

it("throws when the codes client cannot be created", async () => {
  const failure = new Error("database unavailable");
  mocks.admin.mockImplementation(() => { throw failure; });
  await expect(loadGameCodeSeoData("page", "example", "game")).rejects.toBe(failure);
});

it("keeps a successful empty codes result distinct from a failed read", async () => {
  mocks.admin.mockReturnValue({ from: (table: string) => query({ data: table === "games" ? { title: "Example" } : [], error: null }) });
  await expect(loadGameCodeSeoData("page", "example", "game")).resolves.toEqual({ name: "Example", codes: [] });
});

it("propagates a hub collection read failure", async () => {
  const failure = new Error("collections unavailable");
  mocks.collections.mockRejectedValue(failure);
  await expect(loadGameWikiHubCollections("example", "child", "game")).rejects.toBe(failure);
});

it("does not read collections for a franchise directory", async () => {
  await expect(loadGameWikiHubCollections("example", "root", "franchise")).resolves.toEqual([]);
  expect(mocks.collections).not.toHaveBeenCalled();
});
