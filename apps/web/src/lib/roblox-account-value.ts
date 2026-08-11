import type { CollectibleItem, CollectiblesInfo } from "@/lib/roblox-profile-checker";

export const MAX_MANUAL_ROBUX = 10_000_000_000;

export type ManualRobuxResult =
  | { value: null; error: null }
  | { value: number; error: null }
  | { value: null; error: string };

export function parseManualRobux(rawValue: string): ManualRobuxResult {
  const value = rawValue.trim();
  if (!value) return { value: null, error: null };
  if (!/^\d+$/.test(value)) {
    return { value: null, error: "Enter a non-negative whole number without symbols or decimals." };
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > MAX_MANUAL_ROBUX) {
    return {
      value: null,
      error: `Enter ${MAX_MANUAL_ROBUX.toLocaleString("en-US")} Robux or less.`
    };
  }
  return { value: parsed, error: null };
}

export function calculateVisibleRobuxTotal(publicRap: number | null, enteredBalance: number | null): number | null {
  if (publicRap === null || enteredBalance === null) return null;
  return publicRap + enteredBalance;
}

export function calculateRapConcentration(
  items: Pick<CollectibleItem, "recentAveragePrice">[],
  totalRap: number | null,
  topCount = 5
): number | null {
  if (!totalRap || totalRap <= 0 || topCount <= 0) return null;
  const topRap = items
    .slice(0, topCount)
    .reduce((sum, item) => sum + Math.max(0, item.recentAveragePrice ?? 0), 0);
  return Math.min(100, Math.round((topRap / totalRap) * 100));
}

export type InventoryValueState = "complete" | "partial" | "private" | "unavailable" | "empty";

export function getInventoryValueState(collectibles: CollectiblesInfo): InventoryValueState {
  if (collectibles.status === "private") return "private";
  if (collectibles.status === "unavailable") return "unavailable";
  if (collectibles.rapIsPartial || collectibles.hasMore) return "partial";
  if (collectibles.fetchedItemCount === 0) return "empty";
  return "complete";
}
