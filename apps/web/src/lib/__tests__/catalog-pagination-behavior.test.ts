import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogRows, queryCatalog, type FixtureRow } from "../../../../../scripts/ci/catalog-query-fixture.mjs";
import { loadGameMusicIdsPageData, loadRobloxMusicIdsPageData } from "@/app/(site)/catalog/roblox-music-ids/page-data";
import { loadGameDecalIdsPageData, loadRobloxDecalIdsPageData } from "@/app/(site)/catalog/roblox-decal-ids/page-data";
import { loadRobloxMeshIdsPageData } from "@/lib/roblox-mesh-ids";
import { catalogRangeTotal, isCatalogPageRangeValid } from "@/lib/catalog-pagination";
import { DECAL_IDS_PAGE_SIZE, MESH_IDS_PAGE_SIZE, MUSIC_IDS_PAGE_SIZE } from "@/lib/catalog-page-sizes";
import DecalPage from "@/app/(site)/catalog/roblox-decal-ids/page/[page]/page";
import MusicGamePage from "@/app/(site)/catalog/roblox-music-ids/games/[game]/page/[page]/page";
import DecalGamePage from "@/app/(site)/catalog/roblox-decal-ids/games/[game]/page/[page]/page";
import MeshPage from "@/app/(site)/catalog/roblox-mesh-ids/page/[page]/page";
import { GET as musicApi } from "@/app/api/roblox-music-ids/route";
import { GET as decalApi } from "@/app/api/roblox-decal-ids/route";
import { GET as meshApi } from "@/app/api/roblox-mesh-ids/route";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ admin: vi.fn(), notFound: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: mocks.admin }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/components/comments/CommentsSection", () => ({ CommentsSection: () => null }));
vi.mock("@/components/more-content", () => ({ MoreCatalogs: () => null }));
vi.mock("@/lib/page-content", () => ({ buildPageContentHtml: vi.fn(), renderPageContentNodes: vi.fn() }));
vi.mock("@/app/(site)/catalog/roblox-music-ids/MusicIdsBrowser", () => ({ MusicIdsBrowser: () => null }));
vi.mock("@/app/(site)/catalog/roblox-decal-ids/DecalIdsBrowser", () => ({ DecalIdsBrowser: () => null }));
vi.mock("@/app/(site)/catalog/roblox-mesh-ids/MeshIdsBrowser", () => ({ MeshIdsBrowser: () => null }));

// Chainable client adapter for the semantic PostgREST fixture, including probe
// requests. The same fixture runs through real supabase-js in the Next harness.
function database(tables: Record<string, FixtureRow[]>, failure?: { code: string; details?: string } | Error, failAfterProbe = false) {
  const queries: { table: string; params: URLSearchParams }[] = [];
  mocks.admin.mockReturnValue({ from(table: string) {
    const params = new URLSearchParams();
    const chain: object = new Proxy({}, { get: (_, method) => {
      if (method === "then") return (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => {
        queries.push({ table, params });
        const failed = failure && (!failAfterProbe || params.get("select") !== "asset_id");
        if (failed && failure instanceof Error) return Promise.reject(failure).then(resolve, reject);
        return Promise.resolve(failed ? { data: null, count: null, error: failure } : queryCatalog(tables[table] ?? [], params)).then(resolve, reject);
      };
      return (...args: unknown[]) => {
        const column = String(args[0]);
        const value = args[1];
        const options = args[2];
        if (method === "select") params.set("select", column);
        else if (method === "limit") params.set("limit", String(column));
        else if (method === "range") { params.set("offset", String(column)); params.set("limit", String(Number(value) - Number(column) + 1)); }
        else if (method === "order") {
          const order = value as { ascending: boolean; nullsFirst?: boolean };
          params.set("order", [params.get("order"), `${column}.${order.ascending ? "asc" : "desc"}.${order.nullsFirst ? "nullsfirst" : "nullslast"}`].filter(Boolean).join(","));
        }
        else if (method === "or") params.set("or", `(${column})`);
        else if (method === "not") params.append(column, `not.${value}.${options}`);
        else params.append(column, `${method === "overlaps" ? "ov" : method === "contains" ? "cs" : String(method)}.${Array.isArray(value) ? `{${value.join(",")}}` : value}`);
        return chain;
      };
    }});
    return chain;
  }});
  return queries;
}
const families = [
  { name: "music", key: "songs", table: "roblox_music_ids_ranked_view", mapped: "roblox_music_ids_game_view", game: "driving-empire", preset: "music", size: 24, get: musicApi,
    load: (page: number) => loadRobloxMusicIdsPageData(page),
    gameLoad: (page: number, search = "", sort: "recommended" | "popular" = "recommended") => loadGameMusicIdsPageData(page, "driving-empire", "music", { search, sort }) },
  { name: "decal", key: "decals", table: "roblox_decal_ids", mapped: "roblox_decal_ids_game_view", game: "shindo-life", preset: "faces", size: 24, get: decalApi,
    load: (page: number) => loadRobloxDecalIdsPageData(page),
    gameLoad: (page: number, search = "", sort: "recommended" | "popular" = "recommended") => loadGameDecalIdsPageData(page, "shindo-life", "faces", { search, sort }) }
] as const;

beforeEach(() => { vi.clearAllMocks(); vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe.each([
  { name: "main decals", size: DECAL_IDS_PAGE_SIZE, render: (page: string) => DecalPage({ params: Promise.resolve({ page }) }) },
  { name: "music game", size: MUSIC_IDS_PAGE_SIZE, render: (page: string) => MusicGamePage({ params: Promise.resolve({ game: "jujutsu-shenanigans", page }) }) },
  { name: "decal game", size: DECAL_IDS_PAGE_SIZE, render: (page: string) => DecalGamePage({ params: Promise.resolve({ game: "bloxstrike", page }) }) },
  { name: "meshes", size: MESH_IDS_PAGE_SIZE, render: (page: string) => MeshPage({ params: Promise.resolve({ page }) }) }
])("$name constructed ranges", ({ size, render }) => {
  // BigInt is an independent arithmetic oracle: the next page still has a
  // safe start, but its inclusive end cannot be represented exactly.
  const lastFullPage = Number((BigInt(Number.MAX_SAFE_INTEGER) + 1n) / BigInt(size));
  it("allows the last safe full range without imposing a row-count cap", async () => {
    const offset = (lastFullPage - 1) * size;
    expect(isCatalogPageRangeValid(lastFullPage, size)).toBe(true);
    expect(isCatalogPageRangeValid(Math.ceil(2 ** 31 / size) + 1, size)).toBe(true);
    const queries = database({});
    const missing = new Error("NEXT_NOT_FOUND");
    mocks.notFound.mockImplementation(() => { throw missing; });
    await expect(render(String(lastFullPage))).rejects.toBe(missing);
    expect(queries.some(query => query.params.get("offset") === String(offset))).toBe(true);
  });
  it.each([lastFullPage + 1, lastFullPage + 2, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1])(
    "rejects unsafe constructed range for page %s before any loader read", async page => {
      expect(isCatalogPageRangeValid(page, size)).toBe(false);
      const queries = database({}, new Error("a loader must not be called"));
      const missing = new Error("NEXT_NOT_FOUND");
      mocks.notFound.mockImplementation(() => { throw missing; });
      await expect(render(String(page))).rejects.toBe(missing);
      expect(queries).toEqual([]);
      expect(mocks.admin).not.toHaveBeenCalled();
    }
  );
  it("exercises a safe offset with an unsafe inclusive end", () => {
    const offset = BigInt(lastFullPage) * BigInt(size);
    expect(offset <= BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(offset + BigInt(size) - 1n > BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);
  });
});

it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("rejects invalid page/size %s", value => {
  expect(isCatalogPageRangeValid(value, 24)).toBe(false);
  expect(isCatalogPageRangeValid(2, value)).toBe(false);
});

describe.each(families)("$name dataset and range semantics", family => {
  const request = (query: string) => new Request(`https://bloxodes.com/api/roblox-${family.name}-ids?${query}`);
  it.each([24, 25, 48, 49])("preserves eligible totals and stable membership at boundary %s", async count => {
    // Reverse the source so passing requires applying the unique tie-breaker.
    const rows = catalogRows("music", count).reverse();
    const excluded = family.name === "music"
      ? [{ ...rows[0], asset_id: 9999, duration_seconds: null }, { ...rows[0], asset_id: 9998, duration_seconds: 0 }]
      : [{ ...rows[0], asset_id: 9999, status: "inactive" }, { ...rows[0], asset_id: 9998, thumbnail_url: "https://example.com/UnknownImage/1.png" }];
    database({ [family.table]: [...rows, ...excluded] });
    const seen: number[] = [];
    for (let page = 1; page <= Math.ceil(count / 24); page++) {
      const htmlData = await family.load(page);
      const response = await family.get(request(`page=${page}`));
      const apiData = await response.json();
      expect(response.status).toBe(200);
      expect(apiData).toMatchObject({ ...htmlData, ok: true, total: count });
      seen.push(...apiData[family.key].map((row: FixtureRow) => row.asset_id));
    }
    expect(seen).toEqual(Array.from({ length: count }, (_, index) => 1000 + index));
    const exhausted = await family.get(request(`page=${Math.ceil(count / 24) + 1}`));
    expect(await exhausted.json()).toMatchObject({ [family.key]: [], total: count, totalPages: Math.ceil(count / 24) });
  });

  it("uses the same multi-page fallback before search and offsets, including texture eligibility", async () => {
    const rows = catalogRows("music", 49).reverse();
    const queries = database({ [family.table]: [...rows, { ...rows[0], asset_id: 9999, texture_id: null }], [family.mapped]: [] });
    for (const sort of ["recommended", "popular"] as const) {
      const server = await family.gameLoad(2, "Fixture", sort);
      const response = await family.get(request(`game=${family.game}&page=2&q=Fixture&sort=${sort}`));
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ ...server, ok: true });
      expect(server.total).toBe(family.name === "decal" ? 49 : 50);
      expect("songs" in server ? server.songs : server.decals).toHaveLength(24);
    }
    expect(queries.filter(query => query.params.get("select") === "asset_id").every(query => !query.params.has("or") && !query.params.has("offset"))).toBe(true);
  });

  it("keeps a short mapping authoritative after exhaustion and a zero-hit search", async () => {
    const rows = catalogRows("music", 49);
    const queries = database({ [family.table]: rows, [family.mapped]: [{ ...rows[0], game_slug: family.game }] });
    expect(await family.gameLoad(2)).toMatchObject({ [family.key]: [], total: 1, totalPages: 1 });
    expect(await family.gameLoad(1, "missing")).toMatchObject({ [family.key]: [], total: 0 });
    for (const query of ["page=2", "q=missing"]) {
      const response = await family.get(request(`game=${family.game}&${query}`));
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ [family.key]: [] });
    }
    expect(queries.every(query => query.table === family.mapped)).toBe(true);
  });

  it.each(["recommended", "popular"] as const)("aligns mapped server/API sorting for %s with ties", async sort => {
    const rows = catalogRows("music", 49).reverse().map(row => ({ ...row, game_slug: family.game }));
    database({ [family.mapped]: rows });
    const server = await family.gameLoad(2, "Fixture", sort);
    const response = await family.get(request(`game=${family.game}&page=2&q=Fixture&sort=${sort}`));
    expect(await response.json()).toMatchObject({ ...server, ok: true, total: 49 });
    expect(("songs" in server ? server.songs : server.decals).map(row => row.asset_id)).toEqual(Array.from({ length: 24 }, (_, index) => 1024 + index));
  });

  it("does not broaden a texture-required mapping with no eligible textures", async () => {
    if (family.name !== "decal") return;
    const rows = catalogRows("music", 49);
    database({ [family.table]: rows, [family.mapped]: [{ ...rows[0], game_slug: family.game, texture_id: null }] });
    expect(await family.gameLoad(1)).toMatchObject({ decals: [], total: 0 });
    expect(await (await family.get(request(`game=${family.game}`))).json()).toMatchObject({ decals: [], total: 0 });
  });

  it.each([false, true])("fails closed on source/query failure (after probe: %s)", async afterProbe => {
    const rows = catalogRows("music", 49).map(row => ({ ...row, game_slug: family.game }));
    for (const failure of [{ code: "PGRST003" }, { code: "57014" }, new Error("transport")]) {
      database({ [family.mapped]: rows }, failure, afterProbe);
      await expect(family.gameLoad(2)).rejects.toEqual(failure);
      const response = await family.get(request(`game=${family.game}&page=2`));
      expect(response.status).toBe(503);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
  });
});

describe("mesh failure and pagination behavior", () => {
  it.each([40, 41, 80, 81])("aligns eligible server/API totals and stable ties at %s", async count => {
    const rows = catalogRows("mesh", count).reverse();
    database({ roblox_mesh_ids: [...rows, { ...rows[0], asset_id: 9999, thumbnail_state: "Pending" }] });
    for (let page = 1; page <= Math.ceil(count / 40); page++) {
      const server = await loadRobloxMeshIdsPageData(page);
      expect(server.total).toBe(count);
      const response = await meshApi(new Request(`https://bloxodes.com/api/roblox-mesh-ids?page=${page}`));
      expect(await response.json()).toEqual({ ok: true, ...server });
      expect(server.meshes.map(row => row.asset_id)).toEqual(Array.from({ length: Math.min(40, count - (page - 1) * 40) }, (_, index) => 1000 + (page - 1) * 40 + index));
    }
    expect(await loadRobloxMeshIdsPageData(999)).toEqual({ meshes: [], total: count, totalPages: Math.ceil(count / 40) });
  });
  it.each([new Error("transport"), { code: "PGRST003" }, { code: "57014" }, { code: "PGRST103", details: "Invalid range" }])("never caches a database failure: %s", async failure => {
    database({}, failure);
    await expect(loadRobloxMeshIdsPageData(2)).rejects.toEqual(failure);
    const response = await meshApi(new Request("https://bloxodes.com/api/roblox-mesh-ids?page=2"));
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("rejects an empty main mesh dataset and allows a real empty search", async () => {
    database({ roblox_mesh_ids: [] });
    await expect(loadRobloxMeshIdsPageData(1)).rejects.toThrow("unexpectedly empty");
    expect(await loadRobloxMeshIdsPageData(1, { query: "missing" })).toEqual({ meshes: [], total: 0, totalPages: 1 });
  });
  it("allows an empty mesh catalog only during the production build", async () => {
    database({ roblox_mesh_ids: [] });
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    expect(await loadRobloxMeshIdsPageData(1)).toEqual({ meshes: [], total: 0, totalPages: 1 });
    vi.stubEnv("NEXT_PHASE", "phase-production-server");
    await expect(loadRobloxMeshIdsPageData(1)).rejects.toThrow("unexpectedly empty");
  });
  it("contains mesh database/client failures only during the production build", async () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    database({}, new Error("database unavailable"));
    expect(await loadRobloxMeshIdsPageData(1)).toEqual({ meshes: [], total: 0, totalPages: 1 });
    mocks.admin.mockImplementation(() => { throw new Error("client unavailable"); });
    expect(await loadRobloxMeshIdsPageData(1)).toEqual({ meshes: [], total: 0, totalPages: 1 });
    vi.stubEnv("NEXT_PHASE", "phase-production-server");
    await expect(loadRobloxMeshIdsPageData(1)).rejects.toThrow("client unavailable");
  });
  it("rejects PGRST103 at offset zero and catches client creation failures", async () => {
    const failure = { code: "PGRST103", details: "An offset of 0 was requested, but there are only 0 rows." };
    database({}, failure);
    await expect(loadRobloxMeshIdsPageData(1)).rejects.toEqual(failure);
    expect((await meshApi(new Request("https://bloxodes.com/api/roblox-mesh-ids"))).status).toBe(503);
    mocks.admin.mockImplementation(() => { throw new Error("client unavailable"); });
    const response = await meshApi(new Request("https://bloxodes.com/api/roblox-mesh-ids"));
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});

it("distinguishes an exhausted dataset from invalid ranges and retains exact counts", () => {
  const error = { code: "PGRST103", details: "An offset of 48 was requested, but there are only 25 rows." };
  expect(catalogRangeTotal(error, 48, null)).toBe(25);
  expect(catalogRangeTotal(error, 0, null)).toBeNull();
  expect(catalogRangeTotal(error, 24, null)).toBeNull();
  expect(catalogRangeTotal(error, Number.MAX_SAFE_INTEGER + 1, 25)).toBeNull();
  expect(catalogRangeTotal({ ...error, details: "Invalid range" }, 48, null)).toBeNull();
  expect(catalogRangeTotal({ ...error, code: "PGRST003" }, 48, 25)).toBeNull();
});
