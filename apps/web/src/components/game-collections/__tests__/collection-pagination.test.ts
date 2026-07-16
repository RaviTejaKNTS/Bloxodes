import { describe, expect, it } from "vitest";

import { buildCollectionPagination, type CollectionPaginationSection } from "../collection-pagination";

type Item = {
  id: string;
  name: string;
  image?: string | null;
};

function items(prefix: string, count: number): Item[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
    name: `${prefix} item ${index + 1}`
  }));
}

describe("game collection pagination", () => {
  it("starts a new page only after the minimum useful item count", () => {
    const sections: CollectionPaginationSection<Item>[] = [
      { id: "weapons", label: "Weapons", items: items("weapon", 24) },
      { id: "armor", label: "Armor", items: items("armor", 24) }
    ];

    const result = buildCollectionPagination({
      sections,
      currentPage: 2,
      basePath: "/wiki/test/items",
      targetWeight: 20_000,
      maxSectionWeight: 100_000
    });

    expect(result.info).toMatchObject({
      currentPage: 2,
      totalPages: 2,
      totalItems: 48,
      pageItemCount: 24,
      pageStartIndex: 24
    });
    expect(result.sections.map((section) => section.id)).toEqual(["armor"]);
    expect(result.sectionLinks).toEqual([
      { id: "weapons", label: "Weapons", count: 24, page: 1, href: "/wiki/test/items#weapons" },
      { id: "armor", label: "Armor", count: 24, page: 2, href: "/wiki/test/items/page/2#armor" }
    ]);
  });

  it("splits oversized sections and preserves continuation metadata", () => {
    const result = buildCollectionPagination({
      sections: [{ id: "pets", label: "Pets", items: items("pet", 50) }],
      currentPage: 99,
      basePath: "/wiki/test/pets",
      targetWeight: 1,
      maxSectionWeight: 1
    });

    expect(result.info).toMatchObject({
      currentPage: 3,
      totalPages: 3,
      totalItems: 50,
      pageItemCount: 2,
      pageStartIndex: 48
    });
    expect(result.sections[0]).toMatchObject({
      id: "pets",
      isContinuation: true,
      totalItemCount: 50,
      startPage: 1,
      startHref: "/wiki/test/pets#pets"
    });
  });

  it("returns a stable empty first page", () => {
    const result = buildCollectionPagination({ sections: [], currentPage: -2, basePath: "/wiki/test/empty" });

    expect(result.sections).toEqual([]);
    expect(result.sectionLinks).toEqual([]);
    expect(result.info).toEqual({
      currentPage: 1,
      totalPages: 1,
      totalItems: 0,
      pageItemCount: 0,
      pageStartIndex: 0,
      basePath: "/wiki/test/empty"
    });
  });
});
