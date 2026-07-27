import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  MAX_USED_CODES,
  normalizeCodeProgressSlug,
  normalizeCodeProgressValue,
  normalizeUsedCodes
} from "@/lib/code-progress";

describe("code progress normalization", () => {
  it("normalizes game slugs and individual code values", () => {
    expect(normalizeCodeProgressSlug(" pet-simulator-99 ")).toBe("pet-simulator-99");
    expect(normalizeCodeProgressSlug("")).toBe("");
    expect(normalizeCodeProgressValue(" FREE-GEMS ")).toBe("FREE-GEMS");
    expect(normalizeCodeProgressValue("x".repeat(201))).toBe("");
  });

  it("deduplicates, trims, and bounds used codes", () => {
    const values = [" A ", "A", "", null, ...Array.from({ length: 1100 }, (_, index) => `C${index}`)];
    const normalized = normalizeUsedCodes(values);

    expect(normalized[0]).toBe("A");
    expect(normalized).toHaveLength(MAX_USED_CODES);
    expect(new Set(normalized).size).toBe(normalized.length);
  });
});
