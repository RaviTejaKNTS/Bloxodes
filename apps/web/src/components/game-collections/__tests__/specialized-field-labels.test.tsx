import { isValidElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { GameCollectionView, type GameCollectionViewConfig } from "../GameCollectionView";
import { getGrowGardenCollectionConfig, renderGrowGardenCollectionPage } from "@/app/(site)/wiki/collections/games/grow-a-garden";
import { getTheForgeCollectionConfig, renderTheForgeCollectionPage } from "@/app/(site)/wiki/collections/games/the-forge";

vi.mock("server-only", () => ({}));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <T extends (...args: never[]) => unknown>(loader: T) => loader };
});

function renderedViewConfig(node: ReactNode): GameCollectionViewConfig | undefined {
  if (Array.isArray(node)) return node.map(renderedViewConfig).find(Boolean);
  if (!isValidElement<{ config?: GameCollectionViewConfig; children?: ReactNode }>(node)) return undefined;
  return node.type === GameCollectionView ? node.props.config : renderedViewConfig(node.props.children);
}

describe("specialized collection dataset labels", () => {
  it.each(["grow-a-garden", "the-forge"])("passes author labels to the %s view without changing static configs", game => {
    const isGarden = game === "grow-a-garden";
    const original = isGarden ? getGrowGardenCollectionConfig("crops")! : getTheForgeCollectionConfig("ores")!;
    const key = isGarden ? "purchasePrice" : "sellPrice";
    const config = { ...original, fieldLabels: { [key]: "Old price", unchanged: "Keep this label" } };
    const dataset = {
      meta: { display: { fieldLabels: { [key]: "Trading value" } } },
      items: [{ id: "example", name: "Example", [key]: "25 Coins", collectionGroup: "Rare", region: "Stonewake" }]
    };
    const page = isGarden ? renderGrowGardenCollectionPage({ config, dataset }) : renderTheForgeCollectionPage({ config, dataset });
    expect(renderedViewConfig(page)?.fieldLabels).toEqual({ [key]: "Trading value", unchanged: "Keep this label" });
    expect(config.fieldLabels[key]).toBe("Old price");
    expect(original.fieldLabels).toBeUndefined();

    const legacy = { ...dataset, meta: null };
    const legacyPage = isGarden ? renderGrowGardenCollectionPage({ config: original, dataset: legacy }) : renderTheForgeCollectionPage({ config: original, dataset: legacy });
    expect(renderedViewConfig(legacyPage)).toBe(original);
  });
});
