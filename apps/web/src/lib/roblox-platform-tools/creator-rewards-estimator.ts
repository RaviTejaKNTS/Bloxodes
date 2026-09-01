export const CREATOR_REWARDS_DAILY_RATE = 5;
export const CREATOR_REWARDS_AUDIENCE_SHARE_PERCENT = 35;
export const CREATOR_REWARDS_USER_PURCHASE_CAP_CENTS = 10_000n;
export const CREATOR_REWARDS_HOLD_DAYS = 60;
export const CREATOR_REWARDS_STANDARD_DEVEX_TEN_THOUSANDTHS = 38n;
export const CREATOR_REWARDS_MAX_DAILY_EVENTS = 10_000_000;
export const CREATOR_REWARDS_MAX_AUDIENCE_USERS = 1_000_000;
export const CREATOR_REWARDS_VERIFIED_DATE = "2026-08-31";

export type DailyRewardMode = "single-total" | "daily-average";
export type AudienceUserType = "new" | "reactivated";

export type AudienceCohortInput = {
  type: AudienceUserType;
  usersInput: string;
  eligibleBaseInput: string;
};

export type DailyRewardResult = {
  plannedEventsHundredths: bigint;
  rewardHundredths: bigint;
  isScenario: boolean;
  days: number;
};

export type AudienceRewardResult = {
  totalUsers: bigint;
  newBaseCents: bigint;
  reactivatedBaseCents: bigint;
  totalBaseCents: bigint;
  shareHundredthsOfCent: bigint;
  displayedShareCents: bigint;
  theoreticalRobuxHundredths: bigint;
};

function parseWhole(value: string, max: number): bigint | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = BigInt(trimmed);
  return parsed <= BigInt(max) ? parsed : null;
}

function parseHundredths(value: string): bigint | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  return BigInt(match[1]!) * 100n + BigInt((match[2] ?? "").padEnd(2, "0") || "0");
}

function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / 2n) / denominator;
}

export function calculateDailyCreatorReward({
  mode,
  eventsInput,
  daysInput = "1"
}: {
  mode: DailyRewardMode;
  eventsInput: string;
  daysInput?: string;
}): { result: DailyRewardResult | null; errors: string[] } {
  const errors: string[] = [];
  const daysBigInt = parseWhole(daysInput, 366);
  if (daysBigInt === null || daysBigInt < 1n) errors.push("Days must be a whole number from 1 through 366.");

  let eventsHundredths: bigint | null;
  if (mode === "single-total") {
    const events = parseWhole(eventsInput, CREATOR_REWARDS_MAX_DAILY_EVENTS);
    eventsHundredths = events === null ? null : events * 100n;
    if (events === null) errors.push(`Qualified events must be a whole number no greater than ${CREATOR_REWARDS_MAX_DAILY_EVENTS.toLocaleString("en-US")}.`);
  } else {
    eventsHundredths = parseHundredths(eventsInput);
    if (eventsHundredths === null || eventsHundredths > BigInt(CREATOR_REWARDS_MAX_DAILY_EVENTS) * 100n) {
      errors.push(`Daily average must be non-negative, use at most two decimal places, and not exceed ${CREATOR_REWARDS_MAX_DAILY_EVENTS.toLocaleString("en-US")}.`);
    }
  }

  if (errors.length || eventsHundredths === null || daysBigInt === null) return { result: null, errors };
  const plannedEventsHundredths = mode === "daily-average" ? eventsHundredths * daysBigInt : eventsHundredths;
  return {
    result: {
      plannedEventsHundredths,
      rewardHundredths: plannedEventsHundredths * BigInt(CREATOR_REWARDS_DAILY_RATE),
      isScenario: mode === "daily-average" && eventsHundredths % 100n !== 0n,
      days: mode === "daily-average" ? Number(daysBigInt) : 1
    },
    errors: []
  };
}

export function calculateAudienceExpansionReward(cohorts: AudienceCohortInput[]): {
  result: AudienceRewardResult | null;
  errors: string[];
} {
  const errors: string[] = [];
  if (!cohorts.length) errors.push("Add at least one qualified audience cohort.");
  const parsed = cohorts.map((cohort, index) => {
    const users = parseWhole(cohort.usersInput, CREATOR_REWARDS_MAX_AUDIENCE_USERS);
    const baseCents = parseHundredths(cohort.eligibleBaseInput);
    const label = `Cohort ${index + 1}`;
    if (users === null) errors.push(`${label} users must be a whole number no greater than ${CREATOR_REWARDS_MAX_AUDIENCE_USERS.toLocaleString("en-US")}.`);
    if (baseCents === null) errors.push(`${label} eligible purchase base must be a non-negative USD amount with at most two decimals.`);
    if (users !== null && baseCents !== null && baseCents > users * CREATOR_REWARDS_USER_PURCHASE_CAP_CENTS) {
      errors.push(`${label} exceeds the $100 eligible purchase-base ceiling per qualified user.`);
    }
    return { ...cohort, users, baseCents };
  });
  if (errors.length) return { result: null, errors };

  const valid = parsed as Array<AudienceCohortInput & { users: bigint; baseCents: bigint }>;
  const totalUsers = valid.reduce((total, row) => total + row.users, 0n);
  const newBaseCents = valid.filter((row) => row.type === "new").reduce((total, row) => total + row.baseCents, 0n);
  const reactivatedBaseCents = valid.filter((row) => row.type === "reactivated").reduce((total, row) => total + row.baseCents, 0n);
  const totalBaseCents = newBaseCents + reactivatedBaseCents;
  const shareHundredthsOfCent = totalBaseCents * BigInt(CREATOR_REWARDS_AUDIENCE_SHARE_PERCENT);
  const displayedShareCents = roundHalfUp(shareHundredthsOfCent, 100n);
  const theoreticalRobuxHundredths = roundHalfUp(
    totalBaseCents * BigInt(CREATOR_REWARDS_AUDIENCE_SHARE_PERCENT) * 100n,
    CREATOR_REWARDS_STANDARD_DEVEX_TEN_THOUSANDTHS
  );

  return {
    result: {
      totalUsers,
      newBaseCents,
      reactivatedBaseCents,
      totalBaseCents,
      shareHundredthsOfCent,
      displayedShareCents,
      theoreticalRobuxHundredths
    },
    errors: []
  };
}

export function addCreatorRewardHoldDays(dateValue: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return null;
  const parsed = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateValue) return null;
  parsed.setUTCDate(parsed.getUTCDate() + CREATOR_REWARDS_HOLD_DAYS);
  return parsed.toISOString().slice(0, 10);
}

export function formatHundredths(value: bigint): string {
  const whole = value / 100n;
  const fraction = (value % 100n).toString().padStart(2, "0");
  return fraction === "00" ? whole.toLocaleString("en-US") : `${whole.toLocaleString("en-US")}.${fraction}`;
}

export function formatCents(value: bigint): string {
  const whole = value / 100n;
  const fraction = (value % 100n).toString().padStart(2, "0");
  return `$${whole.toLocaleString("en-US")}.${fraction}`;
}
