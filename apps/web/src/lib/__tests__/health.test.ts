import { describe, expect, it } from "vitest";
import { isStaleTimestamp } from "../health";

describe("isStaleTimestamp", () => {
  const now = Date.parse("2026-07-16T12:00:00.000Z");

  it("accepts a recent valid timestamp", () => {
    expect(isStaleTimestamp("2026-07-16T11:30:00.000Z", now)).toBe(false);
  });

  it.each([null, "not-a-date", "2026-07-16T05:00:00.000Z", "2026-07-16T12:06:00.000Z"])(
    "treats %s as stale or invalid",
    (value) => expect(isStaleTimestamp(value, now)).toBe(true)
  );
});
