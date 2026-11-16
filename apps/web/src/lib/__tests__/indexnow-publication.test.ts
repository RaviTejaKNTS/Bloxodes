import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = { path: string; state: string; created_at: string; last_checked_at: string | null; check_count: number; detail: string | null };
const mocks = vi.hoisted(() => ({ rows: [] as Row[], fetch: vi.fn(), rpc: vi.fn(), purge: vi.fn(), after: [] as Array<() => Promise<void>> }));
vi.mock("server-only", () => ({}));
vi.mock("next/server", async importOriginal => ({ ...await importOriginal<typeof import("next/server")>(), after: (work: () => Promise<void>) => { mocks.after.push(work); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/seo", () => ({ SITE_URL: "https://bloxodes.com" }));
vi.mock("@/lib/cloudflare-cache", () => ({ purgeCloudflarePublicCache: mocks.purge, warmCloudflarePaths: vi.fn() }));
vi.mock("@/lib/game-content-revalidation", () => ({ gameContentRevalidationTargets: async (slug: string) => ({ paths: [`/${slug}`], tags: [], collectionPaths: [] }) }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => ({
  from: () => {
    const filters: Record<string, unknown> = {};
    let update: Record<string, unknown> | undefined;
    let paths: string[] | undefined;
    const query = {
      eq: (key: string, value: unknown) => { filters[key] = value; return query; },
      in: (_key: string, values: string[]) => { paths = values; return query; },
      update: (value: Record<string, unknown>) => { update = value; return query; },
      abortSignal: async () => {
        const selected = mocks.rows.filter(row => Object.entries(filters).every(([key, value]) => row[key as keyof Row] === value) && (!paths || paths.includes(row.path)));
        if (update) selected.forEach(row => Object.assign(row, update));
        return { data: selected, error: null };
      }
    };
    return query;
  },
  rpc: (name: string, args?: { paths: string[] }) => ({ abortSignal: async () => {
    mocks.rpc(name, args);
    if (name === "take_indexnow_pending_checks") {
      for (const row of mocks.rows) if (row.state === "pending" && Date.parse(row.created_at) <= Date.now() - 30 * 86400_000) {
        row.state = "expired"; row.detail = "No passing public-page check within 30 days";
      }
      const eligible = mocks.rows.filter(row => row.state === "pending" && (!row.last_checked_at || Date.parse(row.last_checked_at) < Date.now() - 60_000))
        .sort((a, b) => (a.last_checked_at === b.last_checked_at ? 0 : a.last_checked_at === null ? -1 : b.last_checked_at === null ? 1 : a.last_checked_at.localeCompare(b.last_checked_at)) || a.created_at.localeCompare(b.created_at) || a.path.localeCompare(b.path));
      const picked = eligible.slice(0, 100);
      return { data: picked.map(row => {
        row.last_checked_at = new Date().toISOString(); row.check_count++;
        return { path: row.path, checked_at: row.last_checked_at, capped: eligible.length > 100 };
      }), error: null };
    }
    const claimed = mocks.rows.filter(row => args!.paths.includes(row.path) && row.state === "pending");
    claimed.forEach(row => { row.state = "attempted"; });
    return { data: claimed.map(row => row.path), error: null };
  } })
}) }));

import { POST } from "@/app/api/revalidate/route";
import { INDEXNOW_PUBLICATION_CAP, checkPublicIndexNowPage, drainIndexNowPublications } from "../indexnow-publication";
import { submitIndexNowPaths } from "../indexnow";
const event = { type: "game_content", slug: "wiki/unrelated" };
function row(state = "pending", path = "/wiki/new-game"): Row {
  return { path, state, created_at: new Date(Date.now() - 1000).toISOString(), last_checked_at: null, check_count: 0, detail: null };
}
function submissions() { return mocks.fetch.mock.calls.filter(([url]) => String(url).includes("api.indexnow.org")); }
function request() { return new Request("https://bloxodes.com/api/revalidate", { method: "POST", headers: { authorization: "Bearer test-secret" }, body: JSON.stringify(event) }); }
function page(url: string) { return new Response(`<link rel="canonical" href="${url}">`, { headers: { "content-type": "text/html" } }); }
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("SITE_URL", "https://bloxodes.com");
  vi.stubEnv("INDEXNOW_ENABLED", "true");
  vi.stubEnv("INDEXNOW_ENDPOINT", "https://api.indexnow.org/indexnow");
  vi.stubEnv("INDEXNOW_KEY", "test-public-key");
  vi.stubEnv("INDEXNOW_KEY_LOCATION", "https://bloxodes.com/test-public-key.txt");
  vi.stubEnv("REVALIDATE_SECRET", "test-secret");
  mocks.rows = []; mocks.after = [];
  mocks.purge.mockResolvedValue({ enabled: false, ok: true });
  mocks.fetch.mockImplementation(async (url: string) => url.includes("api.indexnow.org") ? new Response(null, { status: 200 }) : page(url));
  vi.stubGlobal("fetch", mocks.fetch);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("pending-publication IndexNow drain", () => {
  it("drains independently of request events, only after purge and response completion", async () => {
    mocks.rows = [row()];
    let finishPurge!: (value: unknown) => void;
    mocks.purge.mockImplementationOnce(() => new Promise(resolve => { finishPurge = resolve; }));
    const responsePromise = POST(request());
    await vi.waitFor(() => expect(mocks.purge).toHaveBeenCalled());
    expect(mocks.after).toHaveLength(0);
    expect(mocks.rpc).not.toHaveBeenCalled();
    finishPurge({ enabled: false, ok: true });
    const response = await responsePromise;
    expect(response.status).toBe(200);
    expect((await response.json()).indexNow).toEqual({ scheduled: true, reason: "scheduled" });
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    await mocks.after[0]();
    expect(mocks.rows[0].state).toBe("submitted");
    await drainIndexNowPublications();
    expect(submissions()).toHaveLength(1);
  });
  it.each([{ rows: [] }, { rows: [row("known")] }])("makes no HTTP calls when there are no pending pages: $rows", async ({ rows }) => {
    mocks.rows = rows;
    expect((await drainIndexNowPublications()).attempted).toBe(0);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("reserves disjoint checks across concurrent drains", async () => {
    mocks.rows = [row()];
    const results = await Promise.all([drainIndexNowPublications(), drainIndexNowPublications()]);
    expect(results.reduce((sum, result) => sum + result.submitted, 0)).toBe(1);
    expect(mocks.rows[0].check_count).toBe(1);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
  it("caps at 100, checks least recently checked first and drains overflow later", async () => {
    const checked = row("pending", "/wiki/checked");
    checked.last_checked_at = new Date(Date.now() - 120_000).toISOString();
    mocks.rows = [checked, ...Array.from({ length: 100 }, (_, i) => ({ ...row("pending", `/wiki/game-${i}`), created_at: new Date(Date.now() - (i + 1) * 1000).toISOString() }))];
    expect((await drainIndexNowPublications()).submitted).toBe(INDEXNOW_PUBLICATION_CAP);
    expect(mocks.fetch.mock.calls[0][0]).toBe("https://bloxodes.com/wiki/game-99");
    expect(checked.state).toBe("pending");
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("publication cap"));
    expect(JSON.parse(submissions()[0][1].body).urlList).toHaveLength(100);
    expect((await drainIndexNowPublications()).submitted).toBe(1);
  });
  it("keeps a stale 404 pending with a reason, respects cooldown and retries later", async () => {
    mocks.rows = [row()];
    mocks.fetch.mockResolvedValueOnce(new Response(null, { status: 404 }));
    await drainIndexNowPublications();
    expect(mocks.rows[0]).toMatchObject({ state: "pending", check_count: 1, detail: "http-404" });
    await drainIndexNowPublications();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    mocks.rows[0].last_checked_at = new Date(Date.now() - 61_000).toISOString();
    expect((await drainIndexNowPublications()).submitted).toBe(1);
    expect(mocks.rows[0]).toMatchObject({ check_count: 2, detail: null });
  });
  it("expires pending rows after 30 days without fetching them", async () => {
    mocks.rows = [{ ...row(), created_at: new Date(Date.now() - 31 * 86400_000).toISOString() }];
    await drainIndexNowPublications();
    expect(mocks.rows[0].state).toBe("expired");
    expect(mocks.rows[0].detail).toContain("30 days");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each(["false", "0", "off"])("honors disabled flag %s without DB or HTTP work", async flag => {
    vi.stubEnv("INDEXNOW_ENABLED", flag);
    mocks.rows = [row()];
    expect((await drainIndexNowPublications()).enabled).toBe(false);
    expect((await (await POST(request())).json()).indexNow.scheduled).toBe(false);
    expect(mocks.after).toHaveLength(0);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each(["test", "development"])("cannot submit outside production: %s", async environment => {
    vi.stubEnv("NODE_ENV", environment);
    expect((await submitIndexNowPaths(["/wiki/new-game"])).enabled).toBe(false);
    expect((await drainIndexNowPublications()).enabled).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("cannot submit from a preview host in a production build", async () => {
    vi.stubEnv("SITE_URL", "https://preview.bloxodes.com");
    expect((await drainIndexNowPublications()).enabled).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([
    ['<meta name="robots" content="noindex"><link rel="canonical" href="https://bloxodes.com/wiki/new-game">', "meta-noindex"],
    ['<meta name="bingbot" content="none"><link rel="canonical" href="https://bloxodes.com/wiki/new-game">', "meta-noindex"],
    ['<link rel="canonical" href="https://bloxodes.com/wiki/other">', "not-self-canonical"],
    ["<html>missing canonical</html>", "not-self-canonical"]
  ])("rejects nonindexable HTML: %s", async (html, reason) => {
    mocks.fetch.mockResolvedValueOnce(new Response(html, { headers: { "content-type": "text/html" } }));
    expect(await checkPublicIndexNowPage("/wiki/new-game")).toEqual({ ok: false, reason });
  });
  it("requires 200 HTML without redirects and supports namespace roots", async () => {
    mocks.fetch.mockResolvedValueOnce(new Response(null, { status: 301 }));
    expect((await checkPublicIndexNowPage("/wiki/new-game")).reason).toBe("http-301");
    expect(mocks.fetch.mock.calls[0][1].redirect).toBe("manual");
    mocks.fetch.mockResolvedValueOnce(new Response("{}", { headers: { "content-type": "application/json" } }));
    expect((await checkPublicIndexNowPage("/wiki/new-game")).reason).toBe("not-html");
    expect((await checkPublicIndexNowPage("/wiki/new-game/page/2")).ok).toBe(false);
    expect((await checkPublicIndexNowPage("/new-namespace")).ok).toBe(true);
  });
  it.each([
    ["googlebot: noindex, follow", true], ["bingbot: noindex, follow", false],
    ["noindex, follow", false], ["googlebot: noindex, bingbot: none", false]
  ])("handles bot-scoped robots headers: %s", async (header, ok) => {
    mocks.fetch.mockResolvedValueOnce(new Response('<link rel="canonical" href="https://bloxodes.com/wiki/new-game">', { headers: { "content-type": "text/html", "x-robots-tag": header } }));
    expect((await checkPublicIndexNowPage("/wiki/new-game")).ok).toBe(ok);
  });
  it.each(["fetch", "overall"])("applies both deadlines when the %s deadline aborts", async deadline => {
    const overall = new AbortController();
    const local = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(local.signal);
    mocks.fetch.mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
      expect(init.signal).not.toBe(overall.signal);
      expect(init.signal).not.toBe(local.signal);
      init.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }));
    const checked = checkPublicIndexNowPage("/wiki/new-game", overall.signal);
    (deadline === "fetch" ? local : overall).abort();
    expect(await checked).toEqual({ ok: false, reason: "fetch-failed-or-timeout" });
    expect(AbortSignal.timeout).toHaveBeenCalledWith(500);
  });
  it("bounds simultaneous gate fetches to five", async () => {
    mocks.rows = Array.from({ length: 12 }, (_, i) => row("pending", `/wiki/game-${i}`));
    let active = 0; let peak = 0;
    mocks.fetch.mockImplementation(async (url: string) => {
      if (url.includes("api.indexnow.org")) return new Response(null);
      active++; peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 0));
      active--; return page(url);
    });
    await drainIndexNowPublications();
    expect(peak).toBe(5);
  });
  it("persists the HTTP send failure reason", async () => {
    mocks.rows = [row()];
    mocks.fetch.mockImplementation(async (url: string) => url.includes("api.indexnow.org") ? new Response(null, { status: 429 }) : page(url));
    await drainIndexNowPublications();
    expect(mocks.rows[0]).toMatchObject({ state: "failed", detail: "indexnow-http-429; automatic retry prohibited" });
  });
  it("records IndexNow failures once without affecting the response", async () => {
    mocks.rows = [row()];
    mocks.fetch.mockImplementation(async (url: string) => {
      if (url.includes("api.indexnow.org")) throw new Error("timeout");
      return page(url);
    });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).indexNow).toEqual({ scheduled: true, reason: "scheduled" });
    expect(mocks.fetch).not.toHaveBeenCalled();
    await mocks.after[0]();
    expect(mocks.rows[0]).toMatchObject({ state: "failed", detail: expect.stringContaining("automatic retry prohibited") });
    await drainIndexNowPublications();
    expect(submissions()).toHaveLength(1);
  });
});
