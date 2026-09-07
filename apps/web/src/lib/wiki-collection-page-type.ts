export type CollectionPageType = "database" | "collectible";

/** Accept pre-migration rows/manifests while exposing only the current names. */
export function normalizeCollectionPageType(value: unknown): CollectionPageType {
  return value === "collectible" || value === "checklist" ? "collectible" : "database";
}
