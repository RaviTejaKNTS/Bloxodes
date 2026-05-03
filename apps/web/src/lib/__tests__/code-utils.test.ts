import { describe, expect, it } from "vitest";
import { isCodeNew, NEW_CODE_THRESHOLD_MS } from "../code-utils";

describe("code freshness", () => {
  it("marks codes new only inside the three-day first-seen window", () => {
    const nowMs = Date.parse("2026-05-04T12:00:00.000Z");

    expect(isCodeNew({ first_seen_at: new Date(nowMs - NEW_CODE_THRESHOLD_MS + 1000).toISOString() }, nowMs)).toBe(true);
    expect(isCodeNew({ first_seen_at: new Date(nowMs - NEW_CODE_THRESHOLD_MS - 1000).toISOString() }, nowMs)).toBe(false);
    expect(isCodeNew({ first_seen_at: "" }, nowMs)).toBe(false);
  });
});
