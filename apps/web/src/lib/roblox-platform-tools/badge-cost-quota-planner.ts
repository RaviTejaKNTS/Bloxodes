export const FREE_BADGES_PER_UTC_DAY = 5;
export const PAID_BADGE_CREATION_COST = 100;
export const BADGE_PLANNER_MAX_BADGES = 1_000_000;
export const BADGE_PLANNER_MAX_DAYS = 366;
export const BADGE_PLANNER_MAX_EXPERIENCES = 50;
export const BADGE_RULES_VERIFIED_DATE = "2026-08-31";

export type BadgeExperienceInput = {
  label: string;
  universeId?: string;
  plannedInput: string;
  remainingTodayInput: string;
};

export type BadgeScheduleEntry = { utcDate: string; freeBadges: number };

export type BadgeExperiencePlan = {
  label: string;
  universeId: string | null;
  planned: number;
  remainingToday: number;
  freeToday: number;
  paidToday: number;
  costToday: number;
  freeByDeadline: number;
  paidByDeadline: number;
  costByDeadline: number;
  savingsByWaiting: number;
  futureResetsNeeded: number;
  freeOnlyDaysUsed: number;
  freeOnlyFinishDate: string | null;
  schedule: BadgeScheduleEntry[];
};

export type BadgeCreationPlan = {
  daysAvailable: number;
  rows: BadgeExperiencePlan[];
  totalPlanned: number;
  totalFreeByDeadline: number;
  totalPaidByDeadline: number;
  totalCostByDeadline: number;
  totalCostToday: number;
  totalSavings: number;
};

function parseWhole(value: string, max: number): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed <= max ? parsed : null;
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function addUtcDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildSchedule(startUtcDate: string, planned: number, remainingToday: number): BadgeScheduleEntry[] {
  const schedule: BadgeScheduleEntry[] = [];
  let remaining = planned;
  let dayOffset = 0;
  while (remaining > 0) {
    const capacity = dayOffset === 0 ? remainingToday : FREE_BADGES_PER_UTC_DAY;
    const freeBadges = Math.min(remaining, capacity);
    if (freeBadges > 0) schedule.push({ utcDate: addUtcDays(startUtcDate, dayOffset), freeBadges });
    remaining -= freeBadges;
    dayOffset += 1;
  }
  return schedule;
}

export function planBadgeCreations({
  rows,
  daysAvailableInput,
  startUtcDate
}: {
  rows: BadgeExperienceInput[];
  daysAvailableInput: string;
  startUtcDate: string;
}): { result: BadgeCreationPlan | null; errors: string[] } {
  const errors: string[] = [];
  const daysAvailable = parseWhole(daysAvailableInput, BADGE_PLANNER_MAX_DAYS);
  if (daysAvailable === null || daysAvailable < 1) errors.push(`UTC days available must be a whole number from 1 through ${BADGE_PLANNER_MAX_DAYS}.`);
  if (!isValidIsoDate(startUtcDate)) errors.push("The current UTC date is invalid.");
  if (!rows.length) errors.push("Add at least one experience.");
  if (rows.length > BADGE_PLANNER_MAX_EXPERIENCES) errors.push(`This calculator supports up to ${BADGE_PLANNER_MAX_EXPERIENCES} experiences.`);

  const seenUniverseIds = new Set<string>();
  const parsedRows = rows.map((row, index) => {
    const label = row.label.trim();
    const planned = parseWhole(row.plannedInput, BADGE_PLANNER_MAX_BADGES);
    const remainingToday = parseWhole(row.remainingTodayInput, FREE_BADGES_PER_UTC_DAY);
    const universeId = (row.universeId ?? "").trim();
    if (!label) errors.push(`Experience ${index + 1} needs a label.`);
    if (planned === null) errors.push(`${label || `Experience ${index + 1}`} planned badges must be a whole number from 0 through ${BADGE_PLANNER_MAX_BADGES.toLocaleString("en-US")}.`);
    if (remainingToday === null) errors.push(`${label || `Experience ${index + 1}`} remaining free creations must be a whole number from 0 through ${FREE_BADGES_PER_UTC_DAY}.`);
    if (universeId && !/^[1-9]\d*$/.test(universeId)) errors.push(`${label || `Experience ${index + 1}`} universe ID must be a positive whole number.`);
    if (universeId && Number(universeId) > Number.MAX_SAFE_INTEGER) errors.push(`${label || `Experience ${index + 1}`} universe ID exceeds this calculator's safe input range.`);
    if (universeId && seenUniverseIds.has(universeId)) errors.push(`Universe ID ${universeId} appears more than once. Places in one universe share one quota.`);
    if (universeId) seenUniverseIds.add(universeId);
    return { label, planned, remainingToday, universeId: universeId || null };
  });
  if (errors.length || daysAvailable === null || !isValidIsoDate(startUtcDate)) return { result: null, errors };

  const plans = parsedRows.map((row) => {
    const planned = row.planned!;
    const remainingToday = row.remainingToday!;
    const freeCapacityByDeadline = remainingToday + FREE_BADGES_PER_UTC_DAY * Math.max(0, daysAvailable - 1);
    const freeToday = Math.min(planned, remainingToday);
    const paidToday = Math.max(0, planned - remainingToday);
    const freeByDeadline = Math.min(planned, freeCapacityByDeadline);
    const paidByDeadline = Math.max(0, planned - freeCapacityByDeadline);
    const futureResetsNeeded = planned <= remainingToday ? 0 : Math.ceil((planned - remainingToday) / FREE_BADGES_PER_UTC_DAY);
    const freeOnlyDaysUsed = planned === 0 ? 0 : 1 + futureResetsNeeded;
    const schedule = buildSchedule(startUtcDate, planned, remainingToday);
    return {
      label: row.label,
      universeId: row.universeId,
      planned,
      remainingToday,
      freeToday,
      paidToday,
      costToday: paidToday * PAID_BADGE_CREATION_COST,
      freeByDeadline,
      paidByDeadline,
      costByDeadline: paidByDeadline * PAID_BADGE_CREATION_COST,
      savingsByWaiting: (paidToday - paidByDeadline) * PAID_BADGE_CREATION_COST,
      futureResetsNeeded,
      freeOnlyDaysUsed,
      freeOnlyFinishDate: planned === 0 ? null : schedule[schedule.length - 1]?.utcDate ?? null,
      schedule
    } satisfies BadgeExperiencePlan;
  });

  return {
    result: {
      daysAvailable,
      rows: plans,
      totalPlanned: plans.reduce((sum, row) => sum + row.planned, 0),
      totalFreeByDeadline: plans.reduce((sum, row) => sum + row.freeByDeadline, 0),
      totalPaidByDeadline: plans.reduce((sum, row) => sum + row.paidByDeadline, 0),
      totalCostByDeadline: plans.reduce((sum, row) => sum + row.costByDeadline, 0),
      totalCostToday: plans.reduce((sum, row) => sum + row.costToday, 0),
      totalSavings: plans.reduce((sum, row) => sum + row.savingsByWaiting, 0)
    },
    errors: []
  };
}

export function calculateBadgeAwardBudget(usersInput: string, plannedCallsInput: string): {
  result: { users: number; plannedCalls: number; ceiling: number; headroom: number; overage: number } | null;
  errors: string[];
} {
  const users = parseWhole(usersInput, 1_000_000);
  const plannedCalls = parseWhole(plannedCallsInput, 100_000_000);
  const errors: string[] = [];
  if (users === null) errors.push("Users must be a non-negative whole number within the calculator limit.");
  if (plannedCalls === null) errors.push("Planned calls must be a non-negative whole number within the calculator limit.");
  if (errors.length || users === null || plannedCalls === null) return { result: null, errors };
  const ceiling = 50 + 35 * users;
  return {
    result: {
      users,
      plannedCalls,
      ceiling,
      headroom: Math.max(0, ceiling - plannedCalls),
      overage: Math.max(0, plannedCalls - ceiling)
    },
    errors: []
  };
}
