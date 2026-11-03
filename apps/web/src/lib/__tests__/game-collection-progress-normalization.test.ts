import { expect, it } from "vitest";
import { normalizeGameCollectionCode, normalizeGameCollectionItemSlugs } from "../game-collection-progress";
it("keeps collection codes and item slugs stable across the shared endpoint", () => {
  expect(normalizeGameCollectionCode(" GTA-5-SPACESHIP-PARTS ")).toBe("gta-5-spaceship-parts");
  expect(normalizeGameCollectionCode("red-dead-redemption-2-dinosaur-bones")).toBe("red-dead-redemption-2-dinosaur-bones");
  expect(normalizeGameCollectionItemSlugs([" PART-1 ", "part-1", "part-2", "../other", null])).toEqual(["part-1", "part-2"]);
  expect(normalizeGameCollectionItemSlugs(Array.from({ length: 2100 }, (_, n) => `item-${n}`))).toHaveLength(2000);
});
