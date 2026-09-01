import { describe, expect, it } from "vitest";

import { createLaunchChecklistExport, DEFAULT_LAUNCH_PROFILE, getActiveLaunchItems, LAUNCH_ITEMS, summarizeLaunchReadiness } from "../roblox-platform-tools/experience-launch-readiness-planner";

describe("Roblox experience launch readiness planner", () => {
  it("has unique, sourced checklist items", () => {
    expect(new Set(LAUNCH_ITEMS.map((item) => item.id)).size).toBe(LAUNCH_ITEMS.length);
    expect(LAUNCH_ITEMS.every((item) => item.rationale.length > 0 && item.sourceUrl.startsWith("https://"))).toBe(true);
  });

  it("uses five baseline blockers and adds conditional blockers", () => {
    const base = getActiveLaunchItems(DEFAULT_LAUNCH_PROFILE).filter((item) => item.severity === "blocker");
    const text = getActiveLaunchItems({ ...DEFAULT_LAUNCH_PROFILE, visiblePlayerText: true }).filter((item) => item.severity === "blocker");
    const allAges = getActiveLaunchItems({ ...DEFAULT_LAUNCH_PROFILE, reach: "allAges" }).filter((item) => item.severity === "blocker");
    expect(base).toHaveLength(5);
    expect(text).toHaveLength(6);
    expect(allAges).toHaveLength(9);
  });

  it("adds feature recommendations only when applicable", () => {
    const minimal = getActiveLaunchItems({ ...DEFAULT_LAUNCH_PROFILE, mobile: false });
    expect(minimal.some((item) => item.id === "mobile-test")).toBe(false);
    expect(minimal.some((item) => item.id === "gamepad-test")).toBe(false);
    expect(minimal.some((item) => item.id === "purchase-receipts")).toBe(false);
    const full = getActiveLaunchItems({ ...DEFAULT_LAUNCH_PROFILE, mobile: true, console: true, purchases: true });
    expect(["mobile-test", "gamepad-test", "purchase-receipts"].every((id) => full.some((item) => item.id === id))).toBe(true);
  });

  it("moves from blocked to blockers-clear to complete without a score", () => {
    const profile = { ...DEFAULT_LAUNCH_PROFILE, mobile: false };
    const empty = summarizeLaunchReadiness(profile, {});
    expect(empty.status).toBe("blocked");
    const blockersDone = Object.fromEntries(empty.blockers.map((item) => [item.id, true]));
    expect(summarizeLaunchReadiness(profile, blockersDone).status).toBe("blockers-clear");
    const allDone = Object.fromEntries(empty.active.map((item) => [item.id, true]));
    expect(summarizeLaunchReadiness(profile, allDone).status).toBe("complete");
  });

  it("ignores inactive and unknown completion IDs in counts and export", () => {
    const profile = { ...DEFAULT_LAUNCH_PROFILE, mobile: false, console: false, purchases: false };
    const completed = { "mobile-test": true, unknown: true };
    expect(summarizeLaunchReadiness(profile, completed).completedRecommended).toBe(0);
    const exported = createLaunchChecklistExport(profile, completed, "2026-08-31T00:00:00.000Z");
    expect(exported.schemaVersion).toBe(1);
    expect(exported.activeItemIds).not.toContain("mobile-test");
    expect(exported.completed).not.toHaveProperty("unknown");
  });
});
