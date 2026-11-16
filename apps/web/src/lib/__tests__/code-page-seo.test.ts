import { describe, expect, it } from "vitest";
import { activeCodeLabel, codePageDescription, codePageLastChecked, normalizeActiveCodeTitle, robloxCodePageDescription } from "../code-page-seo";

const checked = "2026-11-15T23:30:00-05:00";
const code = { code: "HELLO", status: "active", first_seen_at: "2026-11-10T00:00:00Z", last_seen_at: checked, rewards_text: "**50 coins**" };

describe("live codes metadata", () => {
  it("uses singular active titles, including saved titles", () => {
    expect(activeCodeLabel(1)).toBe("1 Active Code");
    expect(activeCodeLabel(2)).toBe("2 Active Codes");
    expect(normalizeActiveCodeTitle("Example - 1 Active Codes")).toBe("Example - 1 Active Code");
    expect(normalizeActiveCodeTitle("Example - 11 Active Codes")).toBe("Example - 11 Active Codes");
  });
  it("selects the newest active code by first seen, rather than last verification", () => {
    expect(codePageDescription({ name: "Example", codes: [code, { ...code, code: "NEW", first_seen_at: "2026-11-14", rewards_text: null }, { ...code, code: "EXPIRED", status: "expired", first_seen_at: "2026-11-16" }], lastChecked: checked }))
      .toBe("2 active Example codes, last checked November 16, 2026. Newest code: NEW.");
  });
  it("cleans rewards and uses the stored UTC check date", () => {
    expect(robloxCodePageDescription({ name: "Example", updated_at: "2026-11-01" }, [code]))
      .toBe("1 active Example code, last checked November 16, 2026. Newest code: HELLO. Reward: 50 coins.");
  });
  it("omits long or truncated rewards without truncating the description", () => {
    for (const reward of ["x".repeat(160), "50 coins…", "50 coins..."]) {
      const description = codePageDescription({ name: "Example", codes: [{ ...code, rewards_text: reward }], lastChecked: checked });
      expect(description).toBe("1 active Example code, last checked November 16, 2026. Newest code: HELLO.");
    }
  });
  it("appends rewards through 160 characters", () => {
    const base = codePageDescription({ name: "Example", codes: [{ ...code, rewards_text: null }], lastChecked: checked });
    const rewardLength = 160 - base.length - " Reward: .".length;
    expect(codePageDescription({ name: "Example", codes: [{ ...code, rewards_text: "x".repeat(rewardLength) }], lastChecked: checked })).toHaveLength(160);
    expect(codePageDescription({ name: "Example", codes: [{ ...code, rewards_text: "x".repeat(rewardLength + 1) }], lastChecked: checked })).toBe(base);
  });
  it("counts unique expired codes across current and legacy rows", () => {
    expect(codePageDescription({ name: "Example", codes: [{ ...code, status: "expired" }], lastChecked: checked, legacyExpiredCodes: ["hello", "OLD", "bad code"] }))
      .toBe("No active Example codes right now, last checked November 16, 2026. 2 expired codes listed.");
    expect(codePageDescription({ name: "Example", codes: [{ ...code, status: "expired" }], lastChecked: checked }))
      .toBe("No active Example codes right now, last checked November 16, 2026. 1 expired code listed.");
    expect(codePageDescription({ name: "Example", codes: [], lastChecked: checked }))
      .toBe("No active Example codes right now, last checked November 16, 2026.");
  });
  it("never invents a check date", () => {
    expect(codePageLastChecked([{ ...code, last_seen_at: "bad date" }], null)).toBeNull();
    expect(codePageLastChecked([code], "2026-11-17T00:00:00Z")).toBe(checked);
    expect(codePageDescription({ name: "Example", codes: [], lastChecked: null })).toBe("No active Example codes right now.");
  });
  it("adds closing help only when the sections render and the sentence fits", () => {
    const input = { name: "Example", codes: [code], lastChecked: checked };
    expect(codePageDescription({ ...input, hasRedeemHelp: true }))
      .toBe("1 active Example code, last checked November 16, 2026. Newest code: HELLO. Reward: 50 coins. See how to redeem them and why a code might not work.");
    const long = { ...code, rewards_text: "x".repeat(60) };
    const description = codePageDescription({ ...input, codes: [long], hasRedeemHelp: true });
    expect(description).toContain("Reward:");
    expect(description).not.toContain("See how");
    expect(description.length).toBeLessThanOrEqual(160);
    expect(codePageDescription({ ...input, codes: [], hasExpiryHelp: true }))
      .toBe("No active Example codes right now, last checked November 16, 2026. See why codes expire and where new ones appear.");
  });
  it("omits closing help when either conditional Roblox section is missing", () => {
    expect(robloxCodePageDescription({ name: "Example", updated_at: "2026-11-30", redeem_md: "Redeem here." }, [code]))
      .not.toContain("See how");
    expect(robloxCodePageDescription({ name: "Example", updated_at: "2026-11-30", redeem_md: "Redeem here.", troubleshoot_md: "Check spelling." }, [code]))
      .toContain("See how");
  });
  it("uses verification dates and omits an editorial date when no check exists", () => {
    expect(codePageLastChecked([{ ...code, verified_at: "2026-11-18" }])).toBe("2026-11-18");
    expect(robloxCodePageDescription({ name: "Example", updated_at: "2026-11-30" }, []))
      .toBe("No active Example codes right now.");
  });
  it("never truncates a sentence or exceeds 160 with oversized stored values", () => {
    for (const codes of [[{ ...code, code: "X".repeat(200) }], []]) {
      const description = codePageDescription({ name: "Game ".repeat(50), codes, lastChecked: checked, hasRedeemHelp: true });
      expect(description.length).toBeLessThanOrEqual(160);
      expect(description).not.toMatch(/…|\.\.\./);
      expect(description.endsWith(".")).toBe(true);
    }
  });

});
