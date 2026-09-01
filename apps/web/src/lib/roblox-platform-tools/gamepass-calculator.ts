export const GAMEPASS_CREATOR_SHARE_NUMERATOR = 7n;
export const GAMEPASS_ROBLOX_FEE_NUMERATOR = 3n;
export const GAMEPASS_SHARE_DENOMINATOR = 10n;
export const GAMEPASS_MIN_PRICE = 1;
export const GAMEPASS_MAX_PRICE = 1_000_000_000;
export const GAMEPASS_MAX_CREATOR_TARGET = 700_000_000;
export const GAMEPASS_MAX_EXPECTED_SALES = 1_000_000;

export type GamepassSplitResult = {
  price: number;
  expectedSales: number;
  creatorShareTenths: bigint;
  robloxFeeTenths: bigint;
  buyerSpend: bigint;
  creatorTotalTenths: bigint;
  robloxTotalTenths: bigint;
  hasFractionalSplit: boolean;
};

export type GamepassTargetResult = GamepassSplitResult & {
  desiredCreatorEarnings: number;
  cleanSplitPrice: number;
  formulaExcessTenths: bigint;
};

function isWholeNumberInRange(value: number, min: number, max: number): boolean {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

function ceilDiv(value: bigint, divisor: bigint): bigint {
  return (value + divisor - 1n) / divisor;
}

export function calculateGamepassSplit(price: number, expectedSales = 1): GamepassSplitResult | null {
  if (!isWholeNumberInRange(price, GAMEPASS_MIN_PRICE, GAMEPASS_MAX_PRICE)) return null;
  if (!isWholeNumberInRange(expectedSales, 1, GAMEPASS_MAX_EXPECTED_SALES)) return null;

  const priceBigInt = BigInt(price);
  const salesBigInt = BigInt(expectedSales);
  const creatorShareTenths = priceBigInt * GAMEPASS_CREATOR_SHARE_NUMERATOR;
  const robloxFeeTenths = priceBigInt * GAMEPASS_ROBLOX_FEE_NUMERATOR;

  return {
    price,
    expectedSales,
    creatorShareTenths,
    robloxFeeTenths,
    buyerSpend: priceBigInt * salesBigInt,
    creatorTotalTenths: creatorShareTenths * salesBigInt,
    robloxTotalTenths: robloxFeeTenths * salesBigInt,
    hasFractionalSplit: creatorShareTenths % GAMEPASS_SHARE_DENOMINATOR !== 0n
  };
}

export function calculateGamepassPriceForTarget(
  desiredCreatorEarnings: number,
  expectedSales = 1
): GamepassTargetResult | null {
  if (!isWholeNumberInRange(desiredCreatorEarnings, 1, GAMEPASS_MAX_CREATOR_TARGET)) return null;

  const desiredBigInt = BigInt(desiredCreatorEarnings);
  const priceBigInt = ceilDiv(
    desiredBigInt * GAMEPASS_SHARE_DENOMINATOR,
    GAMEPASS_CREATOR_SHARE_NUMERATOR
  );
  const price = Number(priceBigInt);
  const split = calculateGamepassSplit(price, expectedSales);
  if (!split) return null;

  const cleanSplitPrice = Number(ceilDiv(desiredBigInt, GAMEPASS_CREATOR_SHARE_NUMERATOR) * GAMEPASS_SHARE_DENOMINATOR);

  return {
    ...split,
    desiredCreatorEarnings,
    cleanSplitPrice,
    formulaExcessTenths:
      split.creatorShareTenths - desiredBigInt * GAMEPASS_SHARE_DENOMINATOR
  };
}

export function formatTenths(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  const whole = absolute / GAMEPASS_SHARE_DENOMINATOR;
  const fraction = absolute % GAMEPASS_SHARE_DENOMINATOR;
  return `${sign}${whole.toLocaleString("en-US")}${fraction ? `.${fraction}` : ""}`;
}
