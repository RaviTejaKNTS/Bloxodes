import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listCodesForCodePage, type Code } from "@/lib/db";
import { getExtensionCodes } from "@/lib/extension-codes";
import { SITE_URL } from "@/lib/site-config";

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn<typeof fetch>() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  return {
    supabaseAdmin: () => createClient("https://code-lookups.invalid", "test-key", {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: fetchMock }
    })
  };
});

const page = {
  id: "page-a",
  name: "Test Game",
  slug: "test-game",
  roblox_link: "https://www.roblox.com/games/123/Test-Game",
  cover_image: "https://media.example.test/cover.png",
  universe_id: 456,
  updated_at: "2026-10-20T12:00:00.000Z"
};

function code(overrides: Partial<Code> = {}): Code {
  return {
    id: "code-a",
    code_page_id: page.id,
    code: "REWARD",
    status: "active",
    rewards_text: "New Code 100 Coins Active",
    level_requirement: null,
    is_new: false,
    posted_online: false,
    first_seen_at: "2026-10-22T12:00:00.000Z",
    last_seen_at: "2026-10-22T18:00:00.000Z",
    ...overrides
  };
}

function reply(data: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  }));
}

function replyCodes(codes: Code[]) {
  reply(codes.map((row) => ({ ...row, code_page: { is_published: true } })));
}

function requests() {
  return fetchMock.mock.calls.map(([input]) => new URL(String(input)));
}

function expectCodesQuery(url: URL, offset = 0) {
  expect(url.pathname).toBe("/rest/v1/codes");
  expect(url.searchParams.get("select")).toBe("*,code_page:code_pages!inner(is_published)");
  expect(url.searchParams.get("code_page_id")).toBe(`eq.${page.id}`);
  expect(url.searchParams.get("code_page.is_published")).toBe("eq.true");
  expect(url.searchParams.get("order")).toBe("status.asc,last_seen_at.desc,id.asc");
  expect(url.searchParams.get("offset")).toBe(String(offset));
  expect(url.searchParams.get("limit")).toBe("1000");
  expect(url.searchParams.has("status")).toBe(false);
}

function expectMetadataQueries() {
  for (const url of requests().filter((request) => request.pathname === "/rest/v1/code_pages")) {
    expect(url.searchParams.get("is_published")).toBe("eq.true");
    expect(url.searchParams.get("select")).toBe("id,name,slug,roblox_link,cover_image,universe_id,updated_at");
  }
  expect(requests().some((url) => url.pathname.includes("code_pages_view"))).toBe(false);
}

const rangeError = { code: "PGRST103", message: "Requested range not satisfiable", details: null, hint: null };
const poolError = { code: "PGRST003", message: "Database connection pool timed out", details: null, hint: null };

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ message: "Unexpected test request" }), { status: 400 }));
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-23T12:00:00.000Z"));
});

afterEach(() => vi.restoreAllMocks());

describe("selected-page code reads", () => {
  it("returns all statuses and complete code fields without leaking joined metadata", async () => {
    const rows = [code(), code({ id: "check", status: "check" }), code({ id: "expired", status: "expired" })];
    replyCodes(rows);
    expect(await listCodesForCodePage(page.id)).toEqual(rows);
    expect(fetchMock).toHaveBeenCalledOnce();
    expectCodesQuery(requests()[0]);
  });

  it("returns an empty list for missing pages, unpublished pages or pages with no codes", async () => {
    reply([]);
    expect(await listCodesForCodePage(page.id)).toEqual([]);
    expectCodesQuery(requests()[0]);
  });

  it("reads beyond the 1,000-row API cap while scoping every batch to the same published page", async () => {
    const first = Array.from({ length: 1000 }, (_, index) => code({ id: `code-${index}` }));
    const last = code({ id: "code-1000", status: "expired" });
    replyCodes(first);
    replyCodes([last]);
    expect(await listCodesForCodePage(page.id)).toEqual([...first, last]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expectCodesQuery(requests()[0]);
    expectCodesQuery(requests()[1], 1000);
  });

  it.each([200, 416])("accepts an exhausted final batch after exactly 1,000 codes (HTTP %s)", async (status) => {
    const rows = Array.from({ length: 1000 }, (_, index) => code({ id: `code-${index}` }));
    replyCodes(rows);
    reply(status === 416 ? rangeError : [], status);
    expect(await listCodesForCodePage(page.id)).toEqual(rows);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects a range failure on the first batch", async () => {
    reply(rangeError, 416);
    await expect(listCodesForCodePage(page.id)).rejects.toMatchObject(rangeError);
  });

  it("rejects later database failures instead of returning partial codes", async () => {
    replyCodes(Array.from({ length: 1000 }, (_, index) => code({ id: `code-${index}` })));
    reply(poolError, 504);
    await expect(listCodesForCodePage(page.id)).rejects.toMatchObject(poolError);
  });
});

describe("extension selected-page resolution", () => {
  it("returns missing-input without reading the database", async () => {
    expect(await getExtensionCodes({})).toMatchObject({ matched: false, reason: "missing-input", codes: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the full universe-match response, active-code ordering, cleanup, freshness and preview cap", async () => {
    reply([{ universe_id: 456 }]);
    reply([page]);
    replyCodes([
      code({ id: "old", code: "OLD", first_seen_at: "2026-10-10T12:00:00.000Z", is_new: true }),
      code({ id: "new", code: "NEW", level_requirement: 5 }),
      code({ id: "expired", code: "EXPIRED", status: "expired", last_seen_at: "2026-10-23T10:00:00.000Z" }),
      code({ id: "check", code: "CHECK", status: "check" })
    ]);
    const result = await getExtensionCodes({ placeId: 123, gameName: "Wrong Game", limit: 1 });
    const hub = `${SITE_URL.replace(/\/$/, "")}/codes`;
    expect(result).toEqual({
      ok: true,
      matched: true,
      source: "place-id",
      game: { name: page.name, slug: page.slug, url: `${hub}/test-game`, robloxUrl: page.roblox_link, coverImage: page.cover_image },
      codes: [{ code: "NEW", rewardText: "100 Coins", isNew: true, levelRequirement: 5, addedAt: "2026-10-22T12:00:00.000Z" }],
      totalActive: 2,
      shown: 1,
      hasMore: true,
      lastCheckedAt: "2026-10-22T18:00:00.000Z",
      fullListUrl: `${hub}/test-game`,
      codesHubUrl: hub
    });
    expect(requests().map((url) => url.pathname)).toEqual(["/rest/v1/roblox_universes", "/rest/v1/code_pages", "/rest/v1/codes"]);
    expect(requests()[0].searchParams.get("root_place_id")).toBe("eq.123");
    expect(requests()[1].searchParams.get("universe_id")).toBe("eq.456");
    expectCodesQuery(requests()[2]);
    expectMetadataQueries();
  });

  it("falls back from an unmatched universe to the Roblox link, including URL-derived place IDs", async () => {
    reply([{ universe_id: 456 }]);
    reply([]);
    reply([page]);
    replyCodes([]);
    expect(await getExtensionCodes({ robloxUrl: page.roblox_link })).toMatchObject({ matched: true, source: "roblox-link", totalActive: 0, shown: 0, hasMore: false });
    expect(requests()[2].searchParams.get("roblox_link")).toBe("ilike.%123%");
    expect(requests()[2].searchParams.get("limit")).toBe("1");
    expectMetadataQueries();
  });

  it("falls back through missing root place and link to the game name", async () => {
    reply([]);
    reply([]);
    reply([page]);
    replyCodes([]);
    expect(await getExtensionCodes({ placeId: 123, gameName: " Test   Game " })).toMatchObject({ matched: true, source: "game-name" });
    expect(requests()[2].searchParams.get("name")).toBe("ilike.Test Game");
    expectMetadataQueries();
  });

  it.each([
    { name: "normalized name", candidates: [{ ...page, id: "other", name: "Other" }, page] },
    { name: "legacy codes slug", candidates: [{ ...page, id: "other", name: "Other", slug: "other" }, { ...page, name: "Other", slug: "test-game-codes" }] },
    { name: "first returned candidate", candidates: [{ ...page, name: "Other", slug: "other" }] }
  ])("keeps the $name name-selection fallback and hydrates only the chosen candidate", async ({ candidates }) => {
    reply(candidates);
    replyCodes([]);
    const result = await getExtensionCodes({ gameName: "Test Game" });
    expect(result).toMatchObject({ matched: true, source: "game-name", game: { slug: candidates.find((candidate) => candidate.id === page.id)!.slug } });
    expect(requests()[0].searchParams.get("limit")).toBe("5");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expectCodesQuery(requests()[1]);
    expectMetadataQueries();
  });

  it("returns not-found without any code read when no published candidate matches", async () => {
    reply([]);
    reply([]);
    reply([]);
    expect(await getExtensionCodes({ placeId: 123, gameName: "Test Game" })).toMatchObject({
      ok: true, matched: false, reason: "not-found", codes: [], totalActive: 0, shown: 0, hasMore: false
    });
    expect(requests().map((url) => url.pathname)).toEqual(["/rest/v1/roblox_universes", "/rest/v1/code_pages", "/rest/v1/code_pages"]);
    expectMetadataQueries();
  });

  it.each(["root", "universe", "link", "name", "codes"])("propagates a %s read failure instead of reporting no codes or trying a weaker match", async (stage) => {
    if (stage === "universe") reply([{ universe_id: 456 }]);
    if (stage === "link") reply([]);
    if (stage === "name" || stage === "codes") {
      reply([]);
      reply([]);
    }
    if (stage === "codes") reply([page]);
    reply(poolError, 504);
    await expect(getExtensionCodes({ placeId: 123, gameName: "Test Game" })).rejects.toMatchObject(poolError);
  });

  it("preserves duplicate-universe-match errors without falling through to another page", async () => {
    const duplicate = { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: "The result contains 2 rows", hint: null };
    reply([{ universe_id: 456 }]);
    reply(duplicate, 406);
    await expect(getExtensionCodes({ placeId: 123 })).rejects.toMatchObject(duplicate);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps an empty matched page distinct from not-found and ignores expired/check timestamps", async () => {
    reply([page]);
    replyCodes([
      code({ status: "expired", first_seen_at: "2026-10-23T11:00:00.000Z", last_seen_at: "2026-10-23T11:00:00.000Z" }),
      code({ id: "check", status: "check" })
    ]);
    expect(await getExtensionCodes({ gameName: "Test Game" })).toMatchObject({
      matched: true, codes: [], totalActive: 0, shown: 0, hasMore: false, lastCheckedAt: page.updated_at
    });
  });

  it("preserves last-seen tie ordering, three-day newness and a missing page Roblox-link fallback", async () => {
    reply([]);
    reply([]);
    reply([{ ...page, roblox_link: null }]);
    replyCodes([
      code({ id: "tie-first", code: "FIRST", last_seen_at: "2026-10-23T10:00:00.000Z" }),
      code({ id: "tie-second", code: "SECOND", last_seen_at: "2026-10-23T09:00:00.000Z" }),
      code({ id: "old", code: "OLD", first_seen_at: "2026-10-10T12:00:00.000Z", is_new: true })
    ]);
    const result = await getExtensionCodes({ gameName: "Test Game", robloxUrl: page.roblox_link });
    expect(result).toMatchObject({
      matched: true, game: { robloxUrl: page.roblox_link }, shown: 3, totalActive: 3, hasMore: false,
      codes: [
        expect.objectContaining({ code: "FIRST", isNew: true }),
        expect.objectContaining({ code: "SECOND", isNew: true }),
        expect.objectContaining({ code: "OLD", isNew: false })
      ]
    });
  });

  it.each([
    { updatedAt: "2026-10-23T01:00:00.000Z", firstSeen: "2026-10-22T12:00:00.000Z", lastSeen: "2026-10-22T18:00:00.000Z", expected: "2026-10-23T01:00:00.000Z" },
    { updatedAt: page.updated_at, firstSeen: "2026-10-22T12:00:00.000Z", lastSeen: "2026-10-21T18:00:00.000Z", expected: "2026-10-22T12:00:00.000Z" }
  ])("derives lastCheckedAt from page, active first-seen and active last-seen dates: $expected", async ({ updatedAt, firstSeen, lastSeen, expected }) => {
    reply([{ ...page, updated_at: updatedAt }]);
    replyCodes([code({ first_seen_at: firstSeen, last_seen_at: lastSeen })]);
    expect(await getExtensionCodes({ gameName: "Test Game" })).toMatchObject({ lastCheckedAt: expected });
  });

  it("counts active codes beyond 1,000 rows and limits only the displayed preview", async () => {
    reply([page]);
    replyCodes(Array.from({ length: 1000 }, (_, index) => code({ id: `code-${index}` })));
    replyCodes([code({ id: "last", code: "LATEST", first_seen_at: "2026-10-23T10:00:00.000Z" })]);
    expect(await getExtensionCodes({ gameName: "Test Game", limit: 99 })).toMatchObject({
      matched: true, totalActive: 1001, shown: 3, hasMore: true, codes: [expect.objectContaining({ code: "LATEST" }), expect.any(Object), expect.any(Object)]
    });
    expectCodesQuery(requests()[2], 1000);
  });

  it("reads fresh values for repeated requests", async () => {
    reply([page]);
    replyCodes([code()]);
    reply([page]);
    replyCodes([]);
    expect(await getExtensionCodes({ gameName: "Test Game" })).toMatchObject({ totalActive: 1 });
    expect(await getExtensionCodes({ gameName: "Test Game" })).toMatchObject({ totalActive: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
