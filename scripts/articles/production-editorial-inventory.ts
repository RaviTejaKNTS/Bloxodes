import { fetchWithTransientRetries } from "../shared/transient-http";

export type ProductionInventoryItem = {
  family: string;
  title: string;
  key: string;
  universe_id: number | null;
  public_path?: string;
  namespace?: string;
  slug?: string;
  kind?: "game" | "franchise";
};

type ProductionInventoryResponse = {
  version: number;
  generated_at: string;
  items: ProductionInventoryItem[];
};

export const DEFAULT_PRODUCTION_INVENTORY_URL =
  "https://bloxodes.com/api/articles/editorial-inventory";

/** Resolve editorial routes centrally; collection codes are not URL path segments. */
export function inventoryPublicPath(item: ProductionInventoryItem, inventory: ProductionInventoryItem[]): string | null {
  if (item.namespace && item.public_path) return item.public_path;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.key)) return null;
  const roots: Record<string, string> = { article: "articles", codes: "codes", wiki: "wiki", catalog: "catalog", event: "events", checklist: "checklists", quiz: "quizzes", tool: "tools" };
  if (roots[item.family]) return `/${roots[item.family]}/${item.key}`;
  if (item.family !== "collection") return null;
  const hubs = inventory.filter(h => h.family === "wiki" && item.universe_id !== null && h.universe_id === item.universe_id && item.key.startsWith(`${h.key}-`));
  // Ambiguous aliases require a real route lookup, not a guessed game slug.
  if (hubs.length !== 1) return null;
  return `/wiki/${hubs[0].key}/${item.key.slice(hubs[0].key.length + 1)}`;
}

export function inventoryMatchesSearch(item: ProductionInventoryItem, search: string): boolean {
  const needle = search.toLowerCase();
  const identity = item.namespace ? ` ${item.namespace} ${item.slug}`.replaceAll("-", " ") : "";
  return `${item.title} ${item.key}${identity}`.toLowerCase().includes(needle);
}

function isInventoryItem(value: unknown): value is ProductionInventoryItem {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.family === "string" &&
    typeof row.title === "string" &&
    typeof row.key === "string" &&
    (typeof row.universe_id === "number" || row.universe_id === null) &&
    (row.namespace === undefined || (
      typeof row.namespace === "string" && typeof row.slug === "string" &&
      (row.kind === "game" || row.kind === "franchise") &&
      typeof row.public_path === "string" && row.public_path.startsWith("/") && !row.public_path.startsWith("//")
    ))
  );
}

export function productionInventoryUrl(): string {
  const value = process.env.ARTICLE_PRODUCTION_INVENTORY_URL?.trim() || DEFAULT_PRODUCTION_INVENTORY_URL;
  const url = new URL(value);
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    throw new Error("ARTICLE_PRODUCTION_INVENTORY_URL must use HTTPS unless it targets localhost.");
  }
  return url.toString();
}

export async function fetchProductionEditorialInventory(
  { includeGames = false }: { includeGames?: boolean } = {}
): Promise<ProductionInventoryResponse> {
  const url = new URL(productionInventoryUrl());
  if (includeGames) url.searchParams.set("scope", "all");
  const response = await fetchWithTransientRetries(url.toString(), {
    headers: { Accept: "application/json", "User-Agent": "BloxodesArticleAutomation/1.0" },
  });
  if (!response.ok) {
    throw new Error(`Production editorial inventory returned ${response.status} ${response.statusText}.`);
  }
  const payload = await response.json() as Record<string, unknown>;
  if (
    payload.version !== 1 ||
    typeof payload.generated_at !== "string" ||
    !Array.isArray(payload.items) ||
    !payload.items.every(isInventoryItem)
  ) {
    throw new Error("Production editorial inventory returned an unsupported payload.");
  }
  return payload as unknown as ProductionInventoryResponse;
}
