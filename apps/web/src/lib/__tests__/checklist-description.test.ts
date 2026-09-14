import { describe, expect, it } from "vitest";
import { parseChecklistDescription, checklistDescriptionText } from "@/lib/checklist-description";

describe("shared checklist description links", () => {
  it("preserves plain Roblox descriptions exactly", () => {
    expect(parseChecklistDescription("Collect 10 gems." )).toEqual([{ text: "Collect 10 gems." }]);
  });
  it("links internal references and supplies clean search/structured-data text", () => {
    const description = "Use the [part locations](/gta/wiki/gta-5/spaceship-parts) and [wiki](/gta/wiki/gta-5).";
    expect(parseChecklistDescription(description).filter(part => part.href)).toEqual([
      { text: "part locations", href: "/gta/wiki/gta-5/spaceship-parts" }, { text: "wiki", href: "/gta/wiki/gta-5" }
    ]);
    expect(checklistDescriptionText(description)).toBe("Use the part locations and wiki.");
  });
  it("does not turn arbitrary protocols, external URLs or malformed paths into links", () => {
    for (const url of ["javascript:alert", "https://outside.example", "//outside.example", "/\\outside.example", "/%2foutside.example", "/wiki/../admin"]) {
      const text = `[link](${url})`;
      expect(parseChecklistDescription(text).some(part => part.href)).toBe(false);
      expect(checklistDescriptionText(text)).toBe(text);
    }
  });
});
