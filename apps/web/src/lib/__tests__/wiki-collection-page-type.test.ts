import { describe, expect, it } from "vitest";
import { normalizeCollectionPageType } from "../wiki-collection-page-type";

describe("wiki collection type rollout", () => {
  it("keeps legacy checklist rows on the collectible renderer", () => {
    expect(normalizeCollectionPageType("checklist")).toBe("collectible");
    expect(normalizeCollectionPageType("collectible")).toBe("collectible");
  });
  it("preserves reference databases and older rows without a discriminator", () => {
    for (const value of ["database", undefined, null, ""]) {
      expect(normalizeCollectionPageType(value)).toBe("database");
    }
  });
});
