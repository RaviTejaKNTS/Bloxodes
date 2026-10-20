// @vitest-environment jsdom
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { prepareGameCollectionDocument } from "@/app/(site)/wiki/collections/games/generic";
import { getCollectionFieldLabels, getFieldLabel } from "@/lib/game-collections";
import { GameCollectionView } from "../GameCollectionView";
import { RobloxCollectionChecklist } from "@/components/wiki/RobloxCollectionChecklist";

vi.mock("server-only", () => ({}));
vi.mock("react", async importOriginal => ({ ...await importOriginal<typeof import("react")>(), cache: <T extends (...args: never[]) => unknown>(loader: T) => loader }));
vi.mock("../CollectionImageLightbox", () => ({ CollectionImageLightbox: () => null }));
vi.mock("@/components/CatalogSelectNav", () => ({ CatalogSelectNav: () => null }));
vi.mock("@/lib/collection-checklist-progress-client", () => ({
  useCollectionChecklistProgress: () => ({ session: { status: "ready", userId: null }, checked: new Set(), toggle: vi.fn(), reset: vi.fn() }),
  dispatchCollectionChecklistProgress: vi.fn(), trackCollectionChecklistEvent: vi.fn()
}));

vi.stubGlobal("ResizeObserver", class {
  observe() {}
  disconnect() {}
});

const display = {
  groupLabel: "Rarity", sectionOrder: ["Rare"],
  tableFields: ["price", "availability"], cardFields: ["price", "availability"], detailFields: ["obtainment"],
  fieldLabels: { price: "Hatch Cost", availability: "Trading Status", obtainment: "How to Get It" },
  fieldPresentation: { availability: { kind: "highlight" as const, label: "Old status" } }
};
const config = { code: "example-pets", gameSlug: "example", gameName: "Example", slug: "pets", label: "Pets", sortOrder: 10 };

async function settle(run: () => void) {
  flushSync(run);
  await new Promise(resolve => setTimeout(resolve, 0));
}

describe("dataset field labels", () => {
  it("passes labels through the generic renderer to cards, details, highlights and list headers", async () => {
    const prepared = prepareGameCollectionDocument(config, {
      meta: { schemaVersion: 2, itemFields: ["name", "price", "availability", "obtainment"], columns: ["name", "price", "availability", "obtainment"], display },
      items: [{ item: { name: "Pet", price: "25 Coins", availability: "Available", obtainment: "Hatches from the Golden Egg." }, system: { slug: "pet", section: "Rare", sortOrder: 10 } }]
    });
    expect(prepared.viewConfig.groupLabel).toBe("Rarity");
    expect(prepared.viewConfig.stats.find(stat => stat.key === "price")?.label).toBe("Hatch Cost");
    expect(prepared.viewConfig.fieldLabels).toEqual(display.fieldLabels);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await settle(() => root.render(<GameCollectionView stream config={prepared.viewConfig} sections={prepared.groupedSections} />));
      expect(container.textContent).toContain("Hatch Cost");
      expect(container.textContent).toContain("Trading Status");
      expect(container.textContent).toContain("How to Get It");
      expect(container.textContent).not.toContain("Old status");
      const button = [...container.querySelectorAll("button")].find(entry => entry.textContent === "List")!;
      await settle(() => button.click());
      expect(container.querySelector("thead")?.textContent).toContain("Hatch Cost");
      expect(container.querySelector("thead")?.textContent).toContain("Trading Status");
      expect(container.textContent).not.toContain("Old status");
    } finally { root.unmount(); container.remove(); }
  });

  it("uses author labels in Roblox collectible cards and list headers", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await settle(() => root.render(<RobloxCollectionChecklist
        code="example-pets" gameName="Example" collectionLabel="Pets" collectionOptions={[]}
        sections={[{ id: "rare", label: "Rare", items: [{ id: "pet", name: "Pet", price: "25 Coins" }] }]}
        cardFields={["price"]} fieldLabels={getCollectionFieldLabels(display)}
      />));
      expect([...container.querySelectorAll("dt")].map(entry => entry.textContent)).toContain("Hatch Cost");
      const button = [...container.querySelectorAll("button")].find(entry => entry.textContent === "List")!;
      await settle(() => button.click());
      expect(container.querySelector("thead")?.textContent).toContain("Hatch Cost");
    } finally { root.unmount(); container.remove(); }
  });

  it("retains presentation labels and the shared fallback when fieldLabels is absent", () => {
    expect(getCollectionFieldLabels({ fieldPresentation: display.fieldPresentation })).toEqual({ availability: "Old status" });
    expect(getFieldLabel("price", {})).toBe(getFieldLabel("price"));
    expect(getFieldLabel("customHatchCost")).toBe("Custom Hatch Cost");
    expect(getCollectionFieldLabels(null)).toEqual({});
    expect(getCollectionFieldLabels({ fieldLabels: { price: "Hatch Cost" } }, ["price", "obtainment"]))
      .toEqual({ price: "Hatch Cost", obtainment: getFieldLabel("obtainment") });
    expect(getCollectionFieldLabels({}, ["price", "obtainment"])).toEqual({});
  });
});
