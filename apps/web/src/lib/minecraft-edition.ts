export type MinecraftEdition = "java" | "bedrock";
export function parseMinecraftEdition(value: unknown): MinecraftEdition | null {
  return value === "java" || value === "bedrock" ? value : null;
}

export function minecraftEditionLabel(edition: MinecraftEdition): string {
  return edition === "java" ? "Java Edition" : "Bedrock Edition";
}

export function minecraftItemSupportsEdition(item: { editions?: unknown }, edition: MinecraftEdition): boolean {
  return !Array.isArray(item.editions) || item.editions.includes(edition);
}

export type MinecraftCollectionEditionSummary = Record<MinecraftEdition, { itemCount: number; imageUrls: string[] }>;

export function summarizeMinecraftCollectionEditions(rows: Array<{ editions?: unknown; image: string | null }>): MinecraftCollectionEditionSummary {
  const summary: MinecraftCollectionEditionSummary = {
    java: { itemCount: 0, imageUrls: [] },
    bedrock: { itemCount: 0, imageUrls: [] }
  };
  for (const row of rows) {
    for (const edition of ["java", "bedrock"] as const) {
      if (!minecraftItemSupportsEdition(row, edition)) continue;
      const selected = summary[edition];
      selected.itemCount += 1;
      if (row.image && selected.imageUrls.length < 6 && !selected.imageUrls.includes(row.image)) selected.imageUrls.push(row.image);
    }
  }
  return summary;
}

export function minecraftCollectionTitleForCount(title: string, publishedCount: number, selectedCount: number): string {
  return title.replace(/^All ([\d,]+)\b/, (prefix, count: string) =>
    Number(count.replace(/,/g, "")) === publishedCount ? `All ${selectedCount.toLocaleString("en-US")}` : prefix);
}

export function minecraftCollectionEdition(items: Array<{ item: Record<string, unknown> }>, requested?: MinecraftEdition): MinecraftEdition {
  if (requested) return requested;
  return items.some(({ item }) => !Array.isArray(item.editions) || item.editions.includes("java")) ? "java" : "bedrock";
}

/** Resolve edition fields before the shared collection renderer receives rows. */
export function selectMinecraftEdition<T extends { meta: Record<string, unknown>; items: Array<{ item: Record<string, unknown>; system: { slug: string; section: string; sortOrder: number; image: string | null } }> }>(document: T, edition: MinecraftEdition): T {
  const items = document.items.flatMap((row) => {
    const { editions, editionOverrides, ...shared } = row.item;
    if (!minecraftItemSupportsEdition({ editions }, edition)) return [];
    const variants = editionOverrides && typeof editionOverrides === "object" && !Array.isArray(editionOverrides)
      ? editionOverrides as Record<string, unknown> : {};
    const override = variants[edition];
    const fields = override && typeof override === "object" && !Array.isArray(override) ? override as Record<string, unknown> : {};
    return [{ ...row, item: { ...shared, ...fields } }];
  });
  return { ...document, items };
}
