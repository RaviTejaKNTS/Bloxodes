export type FreeItemClaimability = "direct" | "experience" | "unavailable";

export type FreeItemEligibilityInput = {
  priceRobux: number | null | undefined;
  isForSale: boolean | null | undefined;
  hasResellers: boolean | null | undefined;
  lowestResalePriceRobux: number | null | undefined;
  saleLocationType: string | number | null | undefined;
  isLimited: boolean | null | undefined;
  remaining: number | null | undefined;
  unitsAvailableForConsumption: number | null | undefined;
};

export type FreeItemEligibilityResult = {
  claimability: FreeItemClaimability;
  reason: string | null;
};

function normalizeSaleLocation(value: FreeItemEligibilityInput["saleLocationType"]): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function isExperienceOnlySaleLocation(value: string): boolean {
  return value === "6" || value.includes("experiencesdevapionly") || value.includes("experienceonly");
}

function isDirectShopSaleLocation(value: string): boolean {
  return (
    value === "5" ||
    value.includes("shopand allexperiences".replace(/[^a-z0-9]+/g, "")) ||
    value.includes("shoponly") ||
    value.includes("catalog")
  );
}

export function classifyFreeItemEligibility(input: FreeItemEligibilityInput): FreeItemEligibilityResult {
  if (input.priceRobux !== 0) {
    return { claimability: "unavailable", reason: "not_free" };
  }

  if (input.isForSale !== true) {
    return { claimability: "unavailable", reason: "off_sale" };
  }

  if (input.hasResellers === true || (input.lowestResalePriceRobux ?? 0) > 0) {
    return { claimability: "unavailable", reason: "resale_only" };
  }

  const saleLocation = normalizeSaleLocation(input.saleLocationType);
  if (isExperienceOnlySaleLocation(saleLocation)) {
    return { claimability: "experience", reason: "experience_only" };
  }

  if (!isDirectShopSaleLocation(saleLocation)) {
    return { claimability: "unavailable", reason: "unknown_sale_location" };
  }

  const availableUnits = input.unitsAvailableForConsumption ?? input.remaining;
  if (input.isLimited === true && (availableUnits ?? 0) <= 0) {
    return { claimability: "unavailable", reason: "out_of_stock" };
  }

  return { claimability: "direct", reason: null };
}
