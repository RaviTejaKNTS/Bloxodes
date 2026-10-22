import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as music from "@/app/(site)/catalog/roblox-music-ids/page-data";
import * as decals from "@/app/(site)/catalog/roblox-decal-ids/page-data";
import { GET as musicApi } from "@/app/api/roblox-music-ids/route";
import { GET as decalApi } from "@/app/api/roblox-decal-ids/route";
import MusicIdsPaginatedPage from "@/app/(site)/catalog/roblox-music-ids/page/[page]/page";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ admin: vi.fn(), notFound: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: mocks.admin }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/catalog", () => ({ getCatalogPageContentByCodes: vi.fn().mockResolvedValue(null) }));
vi.mock("@/components/comments/CommentsSection", () => ({ CommentsSection: () => null }));
vi.mock("@/components/more-content", () => ({ MoreCatalogs: () => null }));
vi.mock("@/lib/page-content", () => ({ buildPageContentHtml: vi.fn(), renderPageContentNodes: vi.fn() }));
vi.mock("@/app/(site)/catalog/roblox-music-ids/MusicIdsBrowser", () => ({ MusicIdsBrowser: () => null }));
vi.mock("@/app/(site)/catalog/roblox-decal-ids/DecalIdsBrowser", () => ({ DecalIdsBrowser: () => null }));

function mockQuery(result: { data: unknown; count?: number | null; error: unknown }, reject = false) {
  const query: object = new Proxy({}, {
    get: (_target, key) => key === "then"
      ? (resolve: (value: typeof result) => unknown, onReject: (reason: unknown) => unknown) =>
        (reject ? Promise.reject(result.error) : Promise.resolve(result)).then(resolve, onReject)
      : () => query
  });
  const from = vi.fn(() => query);
  mocks.admin.mockReturnValue({ from });
  return from;
}

const loaders = [
  { name: "music list", load: () => music.loadRobloxMusicIdsPageData(1) },
  { name: "daily top 500", load: () => music.loadTrendingMusicIdsPageData(1) },
  { name: "daily chart", load: () => music.loadMusicChartPageData("trending", 1) },
  { name: "source chart", load: () => music.loadMusicChartPageData("weekly", 1) },
  { name: "genre songs", load: () => music.loadGenreMusicIdsPageData(1, "pop") },
  { name: "artist songs", load: () => music.loadArtistMusicIdsPageData(1, "artist") },
  { name: "genre options", load: () => music.loadPagedGenreOptions(1) },
  { name: "artist options", load: () => music.loadPagedArtistOptions(1) },
  { name: "genre lookup", load: () => music.loadGenreOptionBySlug("pop") },
  { name: "artist lookup", load: () => music.loadArtistOptionBySlug("artist") },
  { name: "mapped music", load: () => music.loadGameMusicIdsPageData(1, "test-game", "music") },
  { name: "decal list", load: () => decals.loadRobloxDecalIdsPageData(1) },
  { name: "mapped decals", load: () => decals.loadGameDecalIdsPageData(1, "test-game", "faces") },
  { name: "decal categories", load: () => decals.loadDecalCategories() },
  { name: "decal category lookup", load: () => decals.loadDecalCategoryBySlug("faces") }
];

const paginatedLoaders = [
  { name: "music list", rows: "songs", load: (page: number) => music.loadRobloxMusicIdsPageData(page) },
  { name: "daily top 500", rows: "songs", load: (page: number) => music.loadTrendingMusicIdsPageData(page) },
  { name: "daily chart", rows: "songs", load: (page: number) => music.loadMusicChartPageData("trending", page) },
  { name: "source chart", rows: "songs", load: (page: number) => music.loadMusicChartPageData("weekly", page) },
  { name: "genre songs", rows: "songs", load: (page: number) => music.loadGenreMusicIdsPageData(page, "pop") },
  { name: "artist songs", rows: "songs", load: (page: number) => music.loadArtistMusicIdsPageData(page, "artist") },
  { name: "genre options", rows: "options", load: (page: number) => music.loadPagedGenreOptions(page) },
  { name: "artist options", rows: "options", load: (page: number) => music.loadPagedArtistOptions(page) },
  { name: "mapped music", rows: "songs", load: (page: number) => music.loadGameMusicIdsPageData(page, "test-game", "music") },
  { name: "decal list", rows: "decals", load: (page: number) => decals.loadRobloxDecalIdsPageData(page) },
  { name: "decal category", rows: "decals", load: (page: number) => decals.loadRobloxDecalIdsPageData(page, undefined, { category: "faces" }) },
  { name: "curated decals", rows: "decals", load: (page: number) => decals.loadRobloxDecalIdsPageData(page, undefined, { curated: true }) },
  { name: "mapped decals", rows: "decals", load: (page: number) => decals.loadGameDecalIdsPageData(page, "test-game", "faces") }
];

const rangeError = {
  code: "PGRST103",
  message: "Requested range not satisfiable",
  details: "An offset of 2399952 was requested, but there are only 1 rows.",
  hint: null
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("catalog loader failure propagation", () => {
  it.each(loaders)("$name rejects query errors", async ({ load }) => {
    const error = new Error("database timeout");
    mockQuery({ data: null, error });
    await expect(load()).rejects.toBe(error);
  });

  it.each(loaders)("$name rejects thrown transport errors", async ({ load }) => {
    const error = new Error("connection reset");
    mockQuery({ data: null, error }, true);
    await expect(load()).rejects.toBe(error);
  });

  it.each([1, 2])("rejects an empty unfiltered dataset on page %s", async page => {
    mockQuery({ data: [], count: 0, error: null });
    await expect(music.loadRobloxMusicIdsPageData(page)).rejects.toThrow("unexpectedly empty");
    await expect(music.loadTrendingMusicIdsPageData(page)).rejects.toThrow("unexpectedly empty");
    await expect(decals.loadRobloxDecalIdsPageData(page)).rejects.toThrow("unexpectedly empty");
  });

  it("rejects missing rows within the reported unfiltered result range", async () => {
    mockQuery({ data: [], count: 100, error: null });
    await expect(music.loadRobloxMusicIdsPageData(1)).rejects.toThrow("unexpectedly empty");
    await expect(decals.loadRobloxDecalIdsPageData(1)).rejects.toThrow("unexpectedly empty");
  });

  it("allows genuinely out-of-range pages so callers can return 404", async () => {
    mockQuery({ data: [], count: 1, error: null });
    await expect(music.loadRobloxMusicIdsPageData(999)).resolves.toMatchObject({ songs: [], totalPages: 1 });
    await expect(music.loadTrendingMusicIdsPageData(999)).resolves.toMatchObject({ songs: [], totalPages: 1 });
    await expect(decals.loadRobloxDecalIdsPageData(999)).resolves.toMatchObject({ decals: [], totalPages: 1 });
  });

  it.each(paginatedLoaders)("$name accepts a high-offset PGRST103 as out of range", async ({ load, rows }) => {
    const from = mockQuery({ data: null, count: null, error: rangeError });
    const result = await load(99999);
    expect(result).toEqual({ [rows]: [], total: 0, totalPages: 1 });
    expect(99999).toBeGreaterThan(result.totalPages);
    expect(from).toHaveBeenCalledTimes(1);
  });

  it.each(paginatedLoaders)("$name still rejects PGRST103 at offset zero", async ({ load }) => {
    const error = { ...rangeError, details: "Invalid range at offset 0." };
    mockQuery({ data: null, count: null, error });
    await expect(load(1)).rejects.toBe(error);
  });

  it.each(paginatedLoaders)("$name still rejects other error codes at high offsets", async ({ load }) => {
    const error = { code: "PGRST003", message: "Database connection pool timed out", details: null, hint: null };
    mockQuery({ data: null, count: null, error });
    await expect(load(99999)).rejects.toBe(error);
  });

  it("reaches the music route's 404 branch for a high-offset PGRST103", async () => {
    mockQuery({ data: null, count: null, error: rangeError });
    const notFound = new Error("NEXT_NOT_FOUND");
    mocks.notFound.mockImplementation(() => { throw notFound; });
    await expect(MusicIdsPaginatedPage({ params: Promise.resolve({ page: "99999" }) })).rejects.toBe(notFound);
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it("allows empty search, genre, artist, preset and curated results", async () => {
    mockQuery({ data: [], count: 0, error: null });
    await expect(music.loadRobloxMusicIdsPageData(1, { search: "missing" })).resolves.toMatchObject({ songs: [], total: 0 });
    await expect(music.loadGenreMusicIdsPageData(1, "missing")).resolves.toMatchObject({ songs: [], total: 0 });
    await expect(music.loadArtistMusicIdsPageData(1, "missing")).resolves.toMatchObject({ songs: [], total: 0 });
    await expect(music.loadGameMusicIdsPageData(1, "test-game", "music")).resolves.toMatchObject({ songs: [], total: 0 });
    await expect(decals.loadRobloxDecalIdsPageData(1, { search: "missing", sort: "recommended" })).resolves.toMatchObject({ decals: [], total: 0 });
    await expect(decals.loadRobloxDecalIdsPageData(1, undefined, { category: "faces" })).resolves.toMatchObject({ decals: [], total: 0 });
    await expect(decals.loadRobloxDecalIdsPageData(1, undefined, { curated: true })).resolves.toMatchObject({ decals: [], total: 0 });
    await expect(decals.loadGameDecalIdsPageData(1, "test-game", "faces")).resolves.toMatchObject({ decals: [], total: 0 });
  });

  it("keeps successful catalog rows and counts", async () => {
    mockQuery({ data: [{ asset_id: 123, thumbnail_state: "Completed", thumbnail_url: "https://example.com/image.png" }], count: 1, error: null });
    await expect(music.loadRobloxMusicIdsPageData(1)).resolves.toMatchObject({ songs: [{ asset_id: 123 }], total: 1, totalPages: 1 });
    await expect(decals.loadRobloxDecalIdsPageData(1)).resolves.toMatchObject({ decals: [{ asset_id: 123, thumbnail_ready: true }], total: 1, totalPages: 1 });
  });

  it.each([
    () => music.loadGameMusicIdsPageData(1, "test-game", "music"),
    () => decals.loadGameDecalIdsPageData(1, "test-game", "faces"),
    () => decals.loadGameDecalIdsPageData(1, "shindo-life", "faces")
  ])("propagates errors from a preset fallback after an empty mapping", async load => {
    const empty = mockQuery({ data: [], count: 0, error: null });
    const error = new Error("fallback timeout");
    const failed = mockQuery({ data: null, error });
    const from = vi.fn().mockImplementationOnce(empty).mockImplementationOnce(failed);
    mocks.admin.mockReturnValue({ from });
    await expect(load()).rejects.toBe(error);
    expect(from).toHaveBeenCalledTimes(2);
  });

  it.each([
    { rows: "songs", load: (page: number) => music.loadGameMusicIdsPageData(page, "test-game", "music") },
    { rows: "decals", load: (page: number) => decals.loadGameDecalIdsPageData(page, "test-game", "faces") },
    { rows: "decals", load: (page: number) => decals.loadGameDecalIdsPageData(page, "shindo-life", "faces") }
  ])("handles range errors from a preset fallback ($rows)", async ({ load, rows }) => {
    const empty = mockQuery({ data: [], count: 0, error: null });
    const failed = mockQuery({ data: null, count: null, error: rangeError });
    const from = vi.fn().mockImplementationOnce(empty).mockImplementationOnce(failed);
    mocks.admin.mockReturnValue({ from });
    await expect(load(99999)).resolves.toEqual({ [rows]: [], total: 0, totalPages: 1 });
    expect(from).toHaveBeenCalledTimes(2);
  });

  it("preserves true not-found option lookups", async () => {
    mockQuery({ data: null, error: null });
    await expect(music.loadGenreOptionBySlug("missing")).resolves.toBeNull();
    await expect(music.loadArtistOptionBySlug("missing")).resolves.toBeNull();
    await expect(decals.loadDecalCategoryBySlug("not-a-real-category")).resolves.toBeNull();
  });

  it.each([
    () => music.loadGameMusicIdsPageData(1, "test-game", "music"),
    () => decals.loadGameDecalIdsPageData(1, "test-game", "faces")
  ])("never runs a preset fallback after a mapped query error", async load => {
    const error = new Error("database timeout");
    const from = mockQuery({ data: null, error });
    await expect(load()).rejects.toBe(error);
    expect(from).toHaveBeenCalledTimes(1);
  });
});

describe.each([
  { name: "music", get: musicApi, game: "murder-mystery-2" },
  { name: "decal", get: decalApi, game: "shindo-life" }
])("$name API failures", ({ name, get, game }) => {
  const request = (query = "") => new Request(`https://bloxodes.com/api/roblox-${name}-ids${query}`);

  it.each([false, true])("returns no-store 503 for database errors (throws: %s)", async reject => {
    mockQuery({ data: null, error: new Error("database timeout") }, reject);
    const response = await get(request());
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ ok: false });
  });

  it("does not mask game query failures with a broader fallback", async () => {
    const from = mockQuery({ data: null, error: new Error("timeout") });
    const response = await get(request(`?game=${game}`));
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(from).toHaveBeenCalledTimes(1);
  });

  it.each(["?page=99999", `?page=99999&game=${game}`])("returns an empty page for PGRST103 (%s)", async query => {
    const from = mockQuery({ data: null, count: null, error: rangeError });
    const response = await get(request(query));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, [name === "music" ? "songs" : "decals"]: [], total: 0, totalPages: 1 });
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("returns an empty page for PGRST103 from a game fallback", async () => {
    const empty = mockQuery({ data: [], count: 0, error: null });
    const failed = mockQuery({ data: null, count: null, error: rangeError });
    const from = vi.fn().mockImplementationOnce(empty).mockImplementationOnce(failed);
    mocks.admin.mockReturnValue({ from });
    const response = await get(request(`?page=99999&game=${game}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, total: 0, totalPages: 1 });
    expect(from).toHaveBeenCalledTimes(2);
  });

  it.each([
    { page: 1, code: "PGRST103" },
    { page: 99999, code: "PGRST003" }
  ])("returns no-store 503 for $code on page $page", async ({ page, code }) => {
    mockQuery({ data: null, count: null, error: { ...rangeError, code } });
    const response = await get(request(`?page=${page}`));
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("also catches client creation failures", async () => {
    mocks.admin.mockImplementation(() => { throw new Error("configuration missing"); });
    const response = await get(request());
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("rejects an empty unfiltered catalog but accepts empty searches", async () => {
    mockQuery({ data: [], count: 0, error: null });
    const failed = await get(request());
    expect(failed.status).toBe(503);
    expect(failed.headers.get("Cache-Control")).toBe("no-store");
    const filtered = await get(request("?q=missing"));
    expect(filtered.status).toBe(200);
    expect(await filtered.json()).toMatchObject({ ok: true, total: 0 });
  });
});
