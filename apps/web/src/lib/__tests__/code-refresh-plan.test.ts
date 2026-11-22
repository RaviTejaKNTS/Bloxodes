import { describe, expect, it } from "vitest";
import { planCodeRefresh, type StoredCodeRow } from "../code-refresh-plan";
import { mergeScrapeResults } from "../scraper";
import type { ScrapeResult, ScrapedCode } from "../scraper-types";

const rd = (code: string, status: ScrapedCode["status"] = "active"): ScrapedCode => ({ code, status, provider: "robloxden" });
const bb = (code: string): ScrapedCode => ({ code, status: "active", provider: "beebom" });
const robloxden = (codes: ScrapedCode[], expired: string[] = []): ScrapeResult => ({
  codes,
  expiredCodes: expired.map((code) => ({ code, provider: "robloxden" as const })),
});
const beebom = (codes: ScrapedCode[], expired: string[] = []): ScrapeResult => ({
  codes,
  expiredCodes: expired.map((code) => ({ code, provider: "beebom" as const })),
});
const active = (code: string, providerPriority = 3): StoredCodeRow => ({ code, status: "active", providerPriority });
const expired = (code: string, providerPriority = 3): StoredCodeRow => ({ code, status: "expired", providerPriority });

function plan(
  sources: ScrapeResult[],
  existingRows: StoredCodeRow[],
  options: { hasSourceFailures?: boolean; existingExpiredCodes?: string[] } = {}
) {
  const merged = mergeScrapeResults(sources);
  return planCodeRefresh({
    codes: merged.codes,
    expiredCodes: merged.expiredCodes,
    hasSourceFailures: options.hasSourceFailures ?? false,
    existingRows,
    existingExpiredCodes: options.existingExpiredCodes ?? [],
  });
}

/** Final status per code after the plan runs against the upsert_code RPC rules. */
function applyPlan(rows: StoredCodeRow[], result: ReturnType<typeof planCodeRefresh>) {
  const byKey = new Map(rows.map((row) => [row.code.toUpperCase(), { ...row }]));
  for (const upsert of result.upserts) {
    const key = upsert.code.toUpperCase();
    const row = byKey.get(key);
    if (!row) {
      byKey.set(key, { code: upsert.code, status: upsert.status, providerPriority: upsert.providerPriority });
    } else {
      if (upsert.providerPriority >= row.providerPriority) row.status = upsert.status;
      if (upsert.providerPriority > row.providerPriority) row.code = upsert.code;
      row.providerPriority = Math.max(row.providerPriority, upsert.providerPriority);
    }
  }
  for (const code of result.convertCheck) {
    const row = byKey.get(code.toUpperCase());
    if (row && row.code === code && row.status === "check") row.status = "expired";
  }
  for (const code of result.expire) {
    const row = byKey.get(code.toUpperCase());
    if (row && row.code === code && row.status === "active") row.status = "expired";
  }
  return Object.fromEntries(Array.from(byKey.values()).map((row) => [row.code, row.status]));
}

describe("codes refresh status decision", () => {
  it("expires a code Beebom lists as expired even though RobloxDen lists it as active", () => {
    const rows = [active("FALL")];
    const result = plan([robloxden([rd("FALL")]), beebom([], ["FALL"])], rows);
    expect(result.expire).toEqual(["FALL"]);
    expect(result.expiredByVote).toBe(1);
    expect(applyPlan(rows, result)).toEqual({ FALL: "expired" });
  });

  it("expires a code RobloxDen marks check and Beebom lists as expired", () => {
    const rows = [active("KIRA")];
    const result = plan([robloxden([rd("KIRA", "check")]), beebom([], ["KIRA"])], rows);
    expect(result.upserts).toEqual([expect.objectContaining({ code: "KIRA", status: "expired", isNew: false })]);
    expect(result.expire).toEqual(["KIRA"]);
    expect(applyPlan(rows, result)).toEqual({ KIRA: "expired" });
  });

  it("expires a stored priority-3 active row when the only incoming vote is RobloxDen's check", () => {
    const rows = [active("NINJA", 3)];
    const result = plan([robloxden([rd("NINJA", "check")]), beebom([bb("LUH")])], rows);
    expect(result.touch).toEqual([]);
    expect(result.expire).toEqual(["NINJA"]);
    expect(applyPlan(rows, result)).toMatchObject({ NINJA: "expired" });
  });

  it("stores a new code that only has a check badge as expired", () => {
    const result = plan([robloxden([rd("HALLOWEEN", "check")])], []);
    expect(result.upserts).toEqual([
      { code: "HALLOWEEN", status: "expired", rewardsText: null, levelRequirement: null, isNew: false, providerPriority: 2 },
    ]);
    expect(result.newCodes).toBe(0);
    expect(applyPlan([], result)).toEqual({ HALLOWEEN: "expired" });
  });

  it("keeps a code only one source lists as active when no source says it expired", () => {
    const rows = [active("15VAMPIRERETURN", 3)];
    const result = plan([robloxden([rd("15VAMPIRERETURN")]), beebom([bb("LUH")])], rows);
    expect(result.touch).toEqual(["15VAMPIRERETURN"]);
    expect(result.expire).toEqual([]);
    expect(applyPlan(rows, result)).toMatchObject({ "15VAMPIRERETURN": "active", LUH: "active" });
  });

  it("preserves missing codes when a source failed, but still applies explicit expired votes", () => {
    const rows = [active("MISSING"), active("KIRA")];
    const sources = [robloxden([rd("KIRA", "check"), rd("LUH")])];
    const partial = plan(sources, rows, { hasSourceFailures: true });
    expect(partial.expire).toEqual(["KIRA"]);
    expect(partial.expiredAsMissing).toBe(0);
    expect(applyPlan(rows, partial)).toEqual({ MISSING: "active", KIRA: "expired", LUH: "active" });

    const complete = plan(sources, rows);
    expect(complete.expire).toEqual(["MISSING", "KIRA"]);
    expect(complete.expiredAsMissing).toBe(1);
  });

  it("reactivates a stored expired code when a higher-priority source lists it as active again", () => {
    const rows = [expired("SPOOKY", 2)];
    const result = plan([beebom([bb("SPOOKY")]), robloxden([], ["SPOOKY"])], rows, { existingExpiredCodes: ["SPOOKY"] });
    expect(result.upserts).toEqual([expect.objectContaining({ code: "SPOOKY", status: "active", providerPriority: 3 })]);
    expect(result.expiredCodes).toEqual([]);
    expect(applyPlan(rows, result)).toEqual({ SPOOKY: "active" });
  });

  it("keeps the higher-priority stored spelling when a lower source lists the code", () => {
    const rows = [active("Cannon", 3)];
    const result = plan([robloxden([rd("CANNON")])], rows);
    expect(result.upserts).toEqual([]);
    expect(result.touch).toEqual(["Cannon"]);
    expect(applyPlan(rows, result)).toEqual({ Cannon: "active" });
  });

  it("converts stale check rows unless a source lists them as active again", () => {
    const rows: StoredCodeRow[] = [
      { code: "STALE", status: "check", providerPriority: 2 },
      { code: "BACK", status: "check", providerPriority: 2 },
    ];
    const result = plan([beebom([bb("BACK")])], rows);
    expect(result.convertCheck).toEqual(["STALE", "BACK"]);
    expect(result.expiredCodes).toEqual(["STALE"]);
    expect(applyPlan(rows, result)).toEqual({ STALE: "expired", BACK: "active" });
  });

  it("expires a stale check row whose lower-priority reactivation the RPC rejects", () => {
    const rows: StoredCodeRow[] = [{ code: "BACK", status: "check", providerPriority: 3 }];
    const result = plan([robloxden([rd("BACK")])], rows);
    expect(result.convertCheck).toEqual(["BACK"]);
    expect(result.expiredCodes).toEqual(["BACK"]);
    expect(applyPlan(rows, result)).toEqual({ BACK: "expired" });
  });

  it("keeps a code in expired_codes when the RPC will reject its lower-priority reactivation", () => {
    const rows: StoredCodeRow[] = [{ code: "OLD", status: "expired", providerPriority: 3 }];
    const result = plan([robloxden([rd("OLD")])], rows, { existingExpiredCodes: ["OLD"] });
    expect(result.expiredCodes).toEqual(["OLD"]);
    expect(applyPlan(rows, result)).toEqual({ OLD: "expired" });
  });

  it("leaves only LUH and 15LUH active for Basketball Zero's live data", () => {
    const checkCodes = [
      "HALLOWEEN", "15HALLOWEEN", "NINJA", "15NINJA", "VAMPIRERETURN", "15JOHNNYRETURN",
      "15PERFV2", "CHROLLOBDAY", "KIRA", "15KIRA", "IZURE", "TATLISV2", "GOODLUCKV2",
    ];
    const rdActive = ["LUH", "15LUH", "15FALL", "FALL", "15VAMPIRERETURN"];
    const rows = [...rdActive, ...checkCodes].map((code) => active(code, 3));
    const beebomExpired = ["FALL", "15FALL", "15VAMPIRERETURN", ...checkCodes];
    const result = plan(
      [
        robloxden([...rdActive.map((code) => rd(code)), ...checkCodes.map((code) => rd(code, "check"))]),
        beebom([bb("LUH"), bb("15LUH")], beebomExpired),
      ],
      rows
    );
    const statuses = applyPlan(rows, result);
    expect(Object.entries(statuses).filter(([, status]) => status === "active").map(([code]) => code).sort())
      .toEqual(["15LUH", "LUH"]);
    expect(Object.values(statuses).filter((status) => status === "expired")).toHaveLength(16);
  });
});
