import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildUpdatedDisplay,
  formatExactDate,
  formatRelativeDate,
  parseContentDate,
  resolveContentDates,
  resolveModifiedAt,
  resolvePublishedAt,
  toIsoContentDate
} from "@/lib/content-dates";

const now = new Date("2026-07-16T12:00:00.000Z");

afterEach(() => vi.useRealTimers());

describe("content date contracts", () => {
  it("uses publication fields without falling back to updated_at", () => {
    const source = {
      published_at: "2026-01-10T00:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-07-10T00:00:00Z"
    };
    expect(resolvePublishedAt(source)).toBe(source.published_at);
    expect(resolveModifiedAt(source)).toBe(source.updated_at);
  });

  it("uses created_at when published_at is absent", () => {
    const result = resolveContentDates({ created_at: "2026-01-01T00:00:00Z" }, { now });
    expect(result.publishedField).toBe("created_at");
    expect(result.publishedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(result.modifiedAt).toBe(result.publishedAt);
    expect(result.issues).toEqual([]);
  });

  it("prefers content_updated_at for modification", () => {
    const result = resolveContentDates(
      {
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-02-01T00:00:00Z",
        content_updated_at: "2026-03-01T00:00:00Z"
      },
      { now }
    );
    expect(result.modifiedField).toBe("content_updated_at");
    expect(result.modifiedAt).toBe("2026-03-01T00:00:00.000Z");
  });

  it("reports missing and invalid publication dates", () => {
    expect(resolveContentDates({}, { now }).issues.map((issue) => issue.code)).toEqual(["missing-published-date"]);
    expect(resolveContentDates({ published_at: "not-a-date" }, { now }).issues.map((issue) => issue.code)).toContain(
      "invalid-published-date"
    );
  });

  it("reports modification dates earlier than publication dates", () => {
    const result = resolveContentDates(
      {
        published_at: "2026-04-01T00:00:00Z",
        content_updated_at: "2026-03-01T00:00:00Z"
      },
      { now }
    );
    expect(result.issues.map((issue) => issue.code)).toContain("modified-before-published");
  });

  it("reports dates beyond the future tolerance", () => {
    const result = resolveContentDates(
      { published_at: "2026-07-17T00:00:00Z", updated_at: "2026-07-18T00:00:00Z" },
      { now }
    );
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["published-in-future", "modified-in-future"])
    );
  });

  it("normalizes valid values and rejects invalid ones", () => {
    expect(toIsoContentDate("2026-01-01")).toBe("2026-01-01T00:00:00.000Z");
    expect(toIsoContentDate("invalid")).toBeNull();
    expect(parseContentDate(null)).toBeNull();
    const original = new Date("2026-01-02T00:00:00Z");
    expect(parseContentDate(original)).not.toBe(original);
  });

  it("formats exact and relative display dates from the same source", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    expect(formatExactDate("2026-07-15T12:00:00Z")).toBe("July 15, 2026");
    expect(formatRelativeDate("2026-07-15T12:00:00Z")).toBe("1 day ago");
    expect(buildUpdatedDisplay("2026-07-15T12:00:00Z")).toEqual({
      exact: "July 15, 2026",
      relative: "1 day ago"
    });
    expect(buildUpdatedDisplay("invalid")).toEqual({ exact: null, relative: null });
  });

  it("supports optional publication dates and direct fallback helpers", () => {
    expect(resolveContentDates({}, { now, requirePublished: false }).issues).toEqual([]);
    expect(resolvePublishedAt({ created_at: "created" })).toBe("created");
    expect(resolveModifiedAt({ published_at: "published" })).toBe("published");
    expect(formatExactDate(null)).toBeNull();
    expect(formatRelativeDate(null)).toBeNull();
  });
});
