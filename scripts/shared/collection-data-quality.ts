const NON_FACT_FIELDS = new Set([
  "name", "cardSummary", "slug", "image", "collectionSection",
  "sortOrder", "sort_order", "_sortOrder", "__sortOrder"
]);

// The checker flattens system metadata into rows. It must not count as facts.
export function usefulCollectionItemFields(fields: string[]): string[] {
  return [...new Set(fields)].filter((field) => !NON_FACT_FIELDS.has(field));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function exactFields(value: unknown, expected: string[]): boolean {
  return Array.isArray(value) && value.length === expected.length
    && new Set(value).size === expected.length
    && expected.every((field) => value.includes(field));
}

// A complete achievement reference may have only two facts beyond its name.
// This grants only the field-count exception; row, display and image gates
// still run independently. Images are gathered after the data authoring stage.
export function isAchievementReference(document: unknown, collectionCode: string): boolean {
  if (!isRecord(document) || !isRecord(document.meta)) return false;
  const { meta } = document;
  const fields = ["name", "condition", "visibility"];
  if (meta.schemaVersion !== 2 || meta.collection !== "achievements"
    || typeof meta.gameSlug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(meta.gameSlug)
    || collectionCode !== `${meta.gameSlug}-${meta.collection}`
    || !exactFields(meta.itemFields, fields) || !exactFields(meta.columns, fields)
    || !Array.isArray(document.items) || !document.items.length || !isRecord(meta.display)) return false;

  const display = meta.display;
  const cardFields = display.cardFields;
  if (!exactFields(display.tableFields, ["condition", "visibility"])
    || !Array.isArray(cardFields) || !cardFields.length || new Set(cardFields).size !== cardFields.length
    || cardFields.some((field) => !["condition", "visibility"].includes(field))
    || !cardFields.includes("visibility")
    || !(cardFields.includes("condition") || (display.cardDescriptionField ?? display.descriptionField) === "condition")) return false;

  let visible = 0;
  for (const row of document.items) {
    if (!isRecord(row) || !isRecord(row.item) || !exactFields(Object.keys(row.item), fields)) return false;
    const item = row.item;
    if (typeof item.name !== "string" || !item.name.trim()) return false;
    if (item.visibility === "Visible") {
      if (typeof item.condition !== "string" || !/\p{L}/u.test(item.condition)
        || /^(?:none|n\/a|na|null|unknown|hidden|secret|tbd)$/i.test(item.condition.trim())) return false;
      visible += 1;
    } else if (item.visibility !== "Hidden" || item.condition !== null || item.name !== "Hidden achievement") {
      return false;
    }
  }
  return visible > 0;
}
