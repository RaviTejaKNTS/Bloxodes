import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DB_SOURCE = new URL("../db.ts", import.meta.url);

describe("code page date read contract", () => {
  it("loads authoritative dates and related detail data in one filtered query", () => {
    const source = readFileSync(DB_SOURCE, "utf8");
    const detailLoader = source.slice(
      source.indexOf("export async function getCodePageBySlug"),
      source.indexOf("const cachedGetRobloxUniverseById")
    );

    expect(detailLoader).toContain('.from("code_pages")');
    expect(detailLoader).toContain("universe:roblox_universes(");
    expect(detailLoader).toContain("codes(*)");
    expect(detailLoader).not.toContain('.from("code_pages_view")');
    expect(detailLoader).not.toContain("Promise.all");
  });
});
