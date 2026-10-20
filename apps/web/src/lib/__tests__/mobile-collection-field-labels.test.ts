import { describe, expect, it, vi } from "vitest";
import { collectionFieldPresentation, mobileCollectionItem } from "@/lib/mobile-content";
import { getFieldLabel } from "@/lib/game-collections";

vi.mock("server-only", () => ({}));
vi.mock("react", async importOriginal => ({ ...await importOriginal<typeof import("react")>(), cache: <T extends (...args: never[]) => unknown>(loader: T) => loader }));

describe("mobile collection field labels", () => {
  it("uses author labels before presentation labels and preserves field kinds", () => {
    const presentation = collectionFieldPresentation({ meta: { schemaVersion: 2, display: {
      fieldLabels: { price: "Hatch Cost", availability: "Trading Status" },
      fieldPresentation: { price: "chip", availability: { kind: "highlight", label: "Old status", tone: "positive" } }
    } } });
    const item = mobileCollectionItem({ name: "Pet", price: "25 Coins", availability: "Available", customField: "Value" }, ["price", "availability", "customField"], {
      badgeKey: null, descriptionKey: null, subtitleKeys: [], presentation
    });
    expect(item.fields).toEqual([
      { key: "price", label: "Hatch Cost", value: "25 Coins", kind: "chip", tone: null },
      { key: "availability", label: "Trading Status", value: "Available", kind: "chip", tone: "positive" },
      { key: "customField", label: getFieldLabel("customField"), value: "Value", kind: "text", tone: null }
    ]);
  });

  it("supports labels without fieldPresentation and leaves older datasets unchanged", () => {
    expect(collectionFieldPresentation({ meta: { display: { fieldLabels: { price: "Hatch Cost" } } } })).toEqual({ price: { label: "Hatch Cost" } });
    const presentation = collectionFieldPresentation({ meta: { display: { fieldPresentation: { price: { kind: "chip", label: "Price" } } } } });
    const item = mobileCollectionItem({ name: "Pet", price: "25 Coins" }, ["price"], { badgeKey: null, descriptionKey: null, subtitleKeys: [], presentation });
    expect(item.fields?.[0].label).toBe("Price");
    expect(item.fields?.[0].kind).toBe("chip");
  });
});
