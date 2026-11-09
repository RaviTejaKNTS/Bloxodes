import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/public-content-cache", () => ({ publicContentCache: (fn: unknown) => fn }));
const mocks = vi.hoisted(() => ({ admin: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: mocks.admin }));

import { getWikiPageBySlug, listPublishedWikiPages } from "@/lib/wiki";
import { getToolContent, listPublishedTools, listPublishedToolsPage } from "@/lib/tools";
import { getQuizPageByCode, listPublishedQuizzes } from "@/lib/quizzes";
import { getCatalogPageContentByCodes, listPublishedTopLevelCatalogPages } from "@/lib/catalog";
import { getPuzzlePageBySlug, getPuzzleAnswers, listPublishedPuzzlePages } from "@/lib/puzzles";
import { getWikiCollectionPageByPath } from "@/lib/wiki-collections";

const details = [
  () => getWikiPageBySlug("test"),
  () => getPuzzlePageBySlug("test"),
  () => getToolContent("test"),
  () => getQuizPageByCode("test"),
  () => getCatalogPageContentByCodes(["test"]),
  () => getWikiCollectionPageByPath("test", "items")
];
const lists = [
  () => listPublishedWikiPages(),
  () => listPublishedPuzzlePages(),
  () => getPuzzleAnswers("test"),
  () => listPublishedTools(),
  () => listPublishedToolsPage(1, 20),
  () => listPublishedQuizzes(),
  () => listPublishedTopLevelCatalogPages()
];

function query(result: { data: unknown; error: unknown }) {
  const chain: object = new Proxy({}, {
    get: (_, key) => key === "then"
      ? (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject)
      : () => chain
  });
  mocks.admin.mockReturnValue({ from: () => chain });
}

beforeEach(() => { vi.clearAllMocks(); });

describe("public content reads", () => {
  it.each([...details, ...lists].map((load, index) => ({ load, index })))("throws a database failure for loader $index", async ({ load }) => {
    const error = { code: "08006", message: "connection lost" };
    query({ data: null, error });
    await expect(load()).rejects.toEqual(error);
  });
  it.each(details.map((load, index) => ({ load, index })))("keeps a missing row null for loader $index", async ({ load }) => {
    query({ data: null, error: null });
    await expect(load()).resolves.toBeNull();
  });
});

it("keeps a successful schema-compatible fallback usable", async () => {
  const chain = (result: unknown): object => {
    const value: object = new Proxy({}, {
      get: (_, key) => key === "then" ? (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) : () => value
    });
    return value;
  };
  mocks.admin.mockReturnValue({ from: (table: string) => chain(table === "tools_view"
    ? { data: null, error: { code: "42703", message: "old view" } }
    : { data: { code: "test", title: "Test" }, error: null }) });
  await expect(getToolContent("test")).resolves.toMatchObject({ code: "test" });
});

it("shared game readers throw on database failures and preserve missing rows", async () => {
  const { createGameReader } = await import("@/lib/shared-game-reader");
  const readers = createGameReader("gta");
  const error = { code: "08006", message: "connection lost" };
  query({ data: null, error });
  await expect(readers.getSharedGameGameBySlug("vice-city")).rejects.toEqual(error);
  await expect(readers.getSharedGameWikiPageBySlug("vice-city")).rejects.toEqual(error);
  await expect(readers.getSharedGameWikiCollectionPageByPath("vice-city", "rampages")).rejects.toEqual(error);
  await expect(readers.listPublishedSharedGameWikiPages()).rejects.toEqual(error);
  query({ data: null, error: null });
  await expect(readers.getSharedGameGameBySlug("missing")).resolves.toBeNull();
  await expect(readers.getSharedGameWikiPageBySlug("missing")).resolves.toBeNull();
  await expect(readers.getSharedGameWikiCollectionPageByPath("missing", "items")).resolves.toBeNull();
});
