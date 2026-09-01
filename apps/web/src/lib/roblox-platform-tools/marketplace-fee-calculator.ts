export const MARKETPLACE_MAX_PRICE = 1_000_000_000;
export const MARKETPLACE_MAX_SALES = 1_000_000;
export const MARKETPLACE_UPLOAD_FEE = 80;

export type SaleLocation = "marketplace" | "in-experience";
export type MarketplaceRateKind = "published" | "estimated" | "unsupported";

export const MARKETPLACE_RATE_CHECKPOINTS = [
  { multiple: 1, ratePercent: 30 },
  { multiple: 1.3, ratePercent: 37 },
  { multiple: 1.5, ratePercent: 41 },
  { multiple: 2, ratePercent: 50 },
  { multiple: 2.5, ratePercent: 57 },
  { multiple: 3, ratePercent: 62 },
  { multiple: 3.5, ratePercent: 65 },
  { multiple: 4, ratePercent: 67 },
  { multiple: 5, ratePercent: 69 },
  { multiple: 6, ratePercent: 70 },
  { multiple: 8, ratePercent: 70 },
  { multiple: 10, ratePercent: 70 }
] as const;

export const PUBLISHING_ADVANCES = [
  { value: "classic-t-shirt", label: "Classic T-Shirt", robux: 10 },
  { value: "classic-shirt", label: "Classic Shirt", robux: 10 },
  { value: "classic-pants", label: "Classic Pants", robux: 10 },
  { value: "hat", label: "Hat", robux: 1_500 },
  { value: "face", label: "Face accessory", robux: 1_500 },
  { value: "hair", label: "Hair accessory", robux: 1_000 },
  { value: "neck", label: "Neck accessory", robux: 1_000 },
  { value: "shoulder", label: "Shoulder accessory", robux: 1_000 },
  { value: "front", label: "Front accessory", robux: 1_000 },
  { value: "back", label: "Back accessory", robux: 1_000 },
  { value: "waist", label: "Waist accessory", robux: 1_000 },
  { value: "layered-clothing", label: "Layered clothing", robux: 600 },
  { value: "body", label: "Body", robux: 2_500 },
  { value: "head", label: "Head", robux: 1_500 },
  { value: "shoes", label: "Shoes", robux: 600 },
  { value: "emote", label: "Emote", robux: 1_500 }
] as const;

export type MarketplaceRate = {
  floorMultiple: number;
  ratePercent: number;
  kind: MarketplaceRateKind;
};

export type MarketplaceCommissionResult = {
  listedPrice: number;
  currentFloor: number;
  sales: number;
  location: SaleLocation;
  rate: MarketplaceRate;
  creatorPerSale: number;
  gameOwnerPerSale: number;
  robloxPerSale: number;
  ownerCombinedPerSale: number;
  buyerSpend: number;
  creatorTotal: number;
  gameOwnerTotal: number;
  robloxTotal: number;
  ownerCombinedTotal: number;
};

function isWholeNumberInRange(value: number, min: number, max: number): boolean {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < 1e-10;
}

export function calculateMarketplaceRate(listedPrice: number, currentFloor: number): MarketplaceRate | null {
  if (!isWholeNumberInRange(listedPrice, 1, MARKETPLACE_MAX_PRICE)) return null;
  if (!isWholeNumberInRange(currentFloor, 1, MARKETPLACE_MAX_PRICE)) return null;
  if (listedPrice < currentFloor) return null;

  const floorMultiple = listedPrice / currentFloor;
  if (floorMultiple > 10) {
    return { floorMultiple, ratePercent: 70, kind: "unsupported" };
  }

  const exact = MARKETPLACE_RATE_CHECKPOINTS.find((checkpoint) =>
    nearlyEqual(floorMultiple, checkpoint.multiple)
  );
  if (exact) {
    return { floorMultiple, ratePercent: exact.ratePercent, kind: "published" };
  }

  for (let index = 0; index < MARKETPLACE_RATE_CHECKPOINTS.length - 1; index += 1) {
    const lower = MARKETPLACE_RATE_CHECKPOINTS[index];
    const upper = MARKETPLACE_RATE_CHECKPOINTS[index + 1];
    if (floorMultiple > lower.multiple && floorMultiple < upper.multiple) {
      const progress = (floorMultiple - lower.multiple) / (upper.multiple - lower.multiple);
      const ratePercent = lower.ratePercent + progress * (upper.ratePercent - lower.ratePercent);
      return {
        floorMultiple,
        ratePercent,
        kind: lower.ratePercent === upper.ratePercent ? "published" : "estimated"
      };
    }
  }

  return null;
}

export function calculateMarketplaceCommission({
  listedPrice,
  currentFloor,
  sales = 1,
  location,
  sameOwner = false
}: {
  listedPrice: number;
  currentFloor: number;
  sales?: number;
  location: SaleLocation;
  sameOwner?: boolean;
}): MarketplaceCommissionResult | null {
  if (!isWholeNumberInRange(sales, 1, MARKETPLACE_MAX_SALES)) return null;
  const rate = calculateMarketplaceRate(listedPrice, currentFloor);
  if (!rate || (location === "marketplace" && rate.kind === "unsupported")) return null;

  const creatorRate = location === "marketplace" ? rate.ratePercent / 100 : 0.3;
  const gameOwnerRate = location === "in-experience" ? 0.4 : 0;
  const robloxRate = location === "in-experience" ? 0.3 : (100 - rate.ratePercent) / 100;
  const creatorPerSale = listedPrice * creatorRate;
  const gameOwnerPerSale = listedPrice * gameOwnerRate;
  const robloxPerSale = listedPrice * robloxRate;
  const ownerCombinedPerSale = creatorPerSale + (sameOwner ? gameOwnerPerSale : 0);

  return {
    listedPrice,
    currentFloor,
    sales,
    location,
    rate: location === "marketplace" ? rate : { floorMultiple: rate.floorMultiple, ratePercent: 30, kind: "published" },
    creatorPerSale,
    gameOwnerPerSale,
    robloxPerSale,
    ownerCombinedPerSale,
    buyerSpend: listedPrice * sales,
    creatorTotal: creatorPerSale * sales,
    gameOwnerTotal: gameOwnerPerSale * sales,
    robloxTotal: robloxPerSale * sales,
    ownerCombinedTotal: ownerCombinedPerSale * sales
  };
}

export function calculateCommissionBreakEven(upfrontCost: number, ownerPerSale: number): number | null {
  if (!Number.isSafeInteger(upfrontCost) || upfrontCost < 0) return null;
  if (!Number.isFinite(ownerPerSale) || ownerPerSale <= 0) return null;
  return Math.ceil(upfrontCost / ownerPerSale);
}

export function addCalendarDays(dateValue: string, days: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !Number.isSafeInteger(days)) return null;
  const parsed = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}
