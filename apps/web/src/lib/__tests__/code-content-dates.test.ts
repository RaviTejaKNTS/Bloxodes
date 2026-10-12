import { describe, expect, it } from "vitest";
import { resolveCodePageModifiedAt, resolveCodesLastCheckedAt } from "@/lib/code-content-dates";

const page = {
  created_at: "2026-01-01T00:00:00Z",
  published_at: "2026-01-10T00:00:00Z",
  re_rewritten_at: "2026-03-01T00:00:00Z",
  updated_at: "2026-10-12T12:00:00Z",
  content_updated_at: "2026-10-12T12:00:00Z"
};

describe("codes content dates", () => {
  it("ignores routine page touches and active-code checks", () => {
    const codes = [{ status: "active" as const, first_seen_at: "2026-09-01T00:00:00Z", last_seen_at: "2026-10-12T12:00:00Z" }];
    expect(resolveCodePageModifiedAt(page, codes)).toBe("2026-09-01T00:00:00.000Z");
    expect(resolveCodePageModifiedAt({ ...page, updated_at: "2026-10-13T12:00:00Z" }, [
      { ...codes[0], last_seen_at: "2026-10-13T12:00:00Z" }
    ])).toBe("2026-09-01T00:00:00.000Z");
    expect(resolveCodesLastCheckedAt(codes)).toBe("2026-10-12T12:00:00.000Z");
  });

  it("advances for an addition, reactivation or recorded rewrite", () => {
    const active = { status: "active" as const, first_seen_at: "2026-10-01T00:00:00Z", last_seen_at: "2026-10-12T00:00:00Z" };
    expect(resolveCodePageModifiedAt(page, [active])).toBe("2026-10-01T00:00:00.000Z");
    expect(resolveCodePageModifiedAt(page, [{ ...active, first_seen_at: "2026-10-11T00:00:00Z" }])).toBe("2026-10-11T00:00:00.000Z");
    expect(resolveCodePageModifiedAt(page, [{ ...active, status: "expired" }])).toBe("2026-10-01T00:00:00.000Z");
    expect(resolveCodePageModifiedAt({ ...page, re_rewritten_at: "2026-10-13T00:00:00Z" }, [active])).toBe("2026-10-13T00:00:00.000Z");
  });

  it("does not treat a later observation of an expired code as a content change", () => {
    const expired = { status: "expired" as const, first_seen_at: "2026-09-01T00:00:00Z", last_seen_at: "2026-10-12T00:00:00Z" };
    const before = resolveCodePageModifiedAt(page, [expired]);
    expect(resolveCodePageModifiedAt(page, [{ ...expired, last_seen_at: "2026-10-13T00:00:00Z" }])).toBe(before);
    expect(resolveCodesLastCheckedAt([expired])).toBe("2026-10-12T00:00:00.000Z");
  });

  it("uses publication or creation when there is no code or rewrite history", () => {
    expect(resolveCodePageModifiedAt({ ...page, re_rewritten_at: null }, [])).toBe("2026-01-10T00:00:00.000Z");
    expect(resolveCodePageModifiedAt({ created_at: page.created_at, updated_at: page.updated_at }, [])).toBe("2026-01-01T00:00:00.000Z");
    expect(resolveCodesLastCheckedAt([])).toBeNull();
    expect(resolveCodePageModifiedAt({ updated_at: page.updated_at }, [])).toBeNull();
  });

  it("ignores invalid dates and compares instants across offsets", () => {
    const codes = [
      { status: "expired" as const, first_seen_at: "invalid", last_seen_at: "2026-10-12T01:00:00+02:00" },
      { status: "active" as const, first_seen_at: "2026-10-12T00:00:00Z", last_seen_at: "2026-10-12T02:00:00Z" }
    ];
    expect(resolveCodePageModifiedAt({}, codes)).toBe("2026-10-12T00:00:00.000Z");
    expect(resolveCodesLastCheckedAt(codes)).toBe("2026-10-12T02:00:00.000Z");
  });
});
