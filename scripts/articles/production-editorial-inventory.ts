export type ProductionInventoryItem = {
  family: string;
  title: string;
  key: string;
  universe_id: number | null;
};

type ProductionInventoryResponse = {
  version: number;
  generated_at: string;
  items: ProductionInventoryItem[];
};

export const DEFAULT_PRODUCTION_INVENTORY_URL =
  "https://bloxodes.com/api/articles/editorial-inventory";

function isInventoryItem(value: unknown): value is ProductionInventoryItem {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.family === "string" &&
    typeof row.title === "string" &&
    typeof row.key === "string" &&
    (typeof row.universe_id === "number" || row.universe_id === null)
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

export async function fetchProductionEditorialInventory(): Promise<ProductionInventoryResponse> {
  const response = await fetch(productionInventoryUrl(), {
    headers: { Accept: "application/json", "User-Agent": "BloxodesArticleAutomation/1.0" },
    signal: AbortSignal.timeout(30_000)
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
