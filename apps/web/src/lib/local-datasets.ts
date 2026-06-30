type DatasetEnvelope<T> =
  | T[]
  | {
      meta?: unknown;
      items?: Array<T | { item?: T; system?: Record<string, unknown> }> | null;
      data?: Array<T | { item?: T; system?: Record<string, unknown> }> | null;
      rows?: Array<T | { item?: T; system?: Record<string, unknown> }> | null;
    };

export function unwrapDatasetItems<T extends Record<string, unknown>>(dataset: DatasetEnvelope<T>): T[] {
  if (Array.isArray(dataset)) return dataset;
  const rows = dataset.items ?? dataset.data ?? dataset.rows ?? [];
  const schemaVersion =
    dataset.meta && typeof dataset.meta === "object" && "schemaVersion" in dataset.meta
      ? (dataset.meta as { schemaVersion?: unknown }).schemaVersion
      : null;
  if (schemaVersion !== 2) return rows as T[];

  return rows.map((row) => {
    if (!row || typeof row !== "object" || !("item" in row)) return row as T;
    const item = ((row as { item?: T }).item ?? {}) as T;
    const system = (row as { system?: Record<string, unknown> }).system ?? {};
    return {
      ...item,
      slug: typeof system.slug === "string" ? system.slug : item.slug,
      image: typeof system.image === "string" ? system.image : item.image,
      collectionSection: typeof system.section === "string" ? system.section : item.collectionSection,
      sortOrder: typeof system.sortOrder === "number" ? system.sortOrder : item.sortOrder
    };
  });
}
