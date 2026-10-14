import { describe, expect, it } from "vitest";
import { buildCopyCleanupPlan, type CleanupCodePage, type CleanupCodeRow } from "../../../../../scripts/codes/copy-text-cleanup";

function row(id: string, code: string, patch: Partial<CleanupCodeRow> = {}): CleanupCodeRow {
  return {
    id, code_page_id: "page", code, status: "expired", rewards_text: null,
    level_requirement: null, is_new: false, posted_online: false, provider_priority: 2,
    first_seen_at: "2026-10-01T00:00:00Z", last_seen_at: "2026-10-02T00:00:00Z",
    ...patch,
  };
}

const page: CleanupCodePage = { id: "page", slug: "adopt-me", expired_codes: [] };

describe("copy-text cleanup planning", () => {
  it("merges a dirty row into its clean twin and preserves merged metadata", () => {
    const clean = row("clean", "PROUDFROG", { rewards_text: "Old reward Copy" });
    const dirty = row("dirty", "PROUDFROGCopy", {
      status: "active", rewards_text: "Proud Frog Sticker Copy", provider_priority: 3,
      level_requirement: 10, is_new: true, posted_online: true,
      first_seen_at: "2026-09-01T00:00:00Z", last_seen_at: "2026-10-14T00:00:00Z",
    });
    const plan = buildCopyCleanupPlan([clean, dirty], [page]);

    expect(plan.groups).toEqual([{
      survivor: clean,
      patch: {
        code: "PROUDFROG", status: "active", rewards_text: "Proud Frog Sticker",
        level_requirement: 10, is_new: true, posted_online: true, provider_priority: 3,
        first_seen_at: dirty.first_seen_at, last_seen_at: dirty.last_seen_at,
      },
      deleteIds: ["dirty"],
    }]);
    expect(plan.rewardUpdates).toEqual([]);
    expect(plan.breakdown).toEqual([{
      id: "page", slug: "adopt-me", codesRenamed: 0, codesMerged: 1,
      rewardsCleaned: 2, expiredRemoved: 0, expiredRenamed: 0,
    }]);
  });

  it("keeps a clean survivor's exact spelling", () => {
    const padded = row("padded", " Cannon ", { status: "active", provider_priority: 3 });
    const plain = row("plain", "Cannon");
    const dirty = row("dirty", "CannonCopy");
    const plan = buildCopyCleanupPlan([padded, plain, dirty], [page]);

    expect(plan.groups).toHaveLength(1);
    expect(plan.groups[0].survivor.id).toBe("padded");
    expect(plan.groups[0].patch.code).toBe(" Cannon ");
    expect(plan.groups[0].deleteIds).toEqual(["plain", "dirty"]);
  });

  it("renames a dirty row without a twin and merges dirty variants on the same page", () => {
    const low = row("low", "Cannon Copy");
    const high = row("high", "CannonCopied", { provider_priority: 3 });
    const plan = buildCopyCleanupPlan([low, high], [page]);
    expect(plan.groups).toEqual([expect.objectContaining({
      survivor: high, patch: expect.objectContaining({ code: "Cannon" }), deleteIds: ["low"],
    })]);
    expect(plan.breakdown[0]).toMatchObject({ codesRenamed: 1, codesMerged: 1 });
  });

  it("never renames or deletes standalone Copy codes and leaves NEW endings alone", () => {
    const codes = ["Copy", "copy", "COPY", "xcopy", "NEW", "Visit2MNew", "ENDLESSNEW"];
    const pages = codes.map((code, index) => ({ id: `page-${index}`, slug: `game-${index}`, expired_codes: [code] }));
    const rows = codes.map((code, index) => row(`row-${index}`, code, { code_page_id: pages[index].id }));
    const plan = buildCopyCleanupPlan(rows, pages);
    expect(plan.dirtyCodeRows).toEqual([]);
    expect(plan.groups).toEqual([]);
    expect(plan.expiredUpdates).toEqual([]);
    expect(plan.breakdown).toEqual([]);
  });

  it("keeps games separate when merging codes with the same cleaned key", () => {
    const clean = row("clean", "Cannon", { code_page_id: "other" });
    const dirty = row("dirty", "Cannon Copy");
    const plan = buildCopyCleanupPlan([clean, dirty], [page, { ...page, id: "other", slug: "other" }]);
    expect(plan.groups[0].survivor.id).toBe("dirty");
    expect(plan.groups[0].deleteIds).toEqual([]);
    expect(plan.breakdown).toHaveLength(1);
  });

  it("cleans rewards independently while preserving a standalone Copy code", () => {
    const plan = buildCopyCleanupPlan([
      row("real", "Copy", { rewards_text: "500 Credits Copy" }),
      row("empty-reward", "OTHER", { rewards_text: "Copied" }),
    ], [page]);
    expect(plan.groups).toEqual([]);
    expect(plan.rewardUpdates).toEqual([
      { id: "real", rewards_text: "500 Credits" },
      { id: "empty-reward", rewards_text: null },
    ]);
    expect(plan.breakdown[0].rewardsCleaned).toBe(2);
  });

  it("plans expired-list cleanup for pages without code rows, with first-occurrence order", () => {
    const pages = [
      { ...page, expired_codes: ["2MLIKESCopy", "SECOND", "2MLIKES", "Cannon Copy", "cannon", "Copy"] },
      { id: "empty", slug: "empty-game", expired_codes: null },
    ];
    const plan = buildCopyCleanupPlan([], pages);
    expect(plan.expiredUpdates).toEqual([{
      id: "page", slug: "adopt-me", expired_codes: ["2MLIKES", "SECOND", "Cannon", "Copy"],
      removed: 2, renamed: 2,
    }]);
    expect(plan.breakdown[0]).toMatchObject({ expiredRemoved: 2, expiredRenamed: 2 });
  });

  it("produces an empty plan after applying all three categories in memory", () => {
    const rows = [
      row("dirty", "PROUDFROGCopy", { rewards_text: "Sticker Copy" }),
      row("clean", "PROUDFROG"),
      row("rename", "!code hakotrapCopy"),
      row("reward", "Copy", { rewards_text: "500 Credits Copy" }),
    ];
    const pages = [{ ...page, expired_codes: ["2MLIKESCopy", "2MLIKES", "Copy"] }];
    const plan = buildCopyCleanupPlan(rows, pages);
    const deleted = new Set(plan.groups.flatMap((group) => group.deleteIds));
    const updatedRows = rows.filter((item) => !deleted.has(item.id)).map((item) => ({
      ...item,
      ...plan.groups.find((group) => group.survivor.id === item.id)?.patch,
      ...plan.rewardUpdates.find((update) => update.id === item.id),
    }));
    const updatedPages = pages.map((item) => ({ ...item, ...plan.expiredUpdates.find((update) => update.id === item.id) }));
    const remaining = buildCopyCleanupPlan(updatedRows, updatedPages);
    expect(remaining.dirtyCodeRows).toEqual([]);
    expect(remaining.dirtyRewardRows).toEqual([]);
    expect(remaining.expiredUpdates).toEqual([]);
    expect(remaining.breakdown).toEqual([]);
    expect(updatedRows.find((item) => item.id === "reward")?.code).toBe("Copy");
  });
});
