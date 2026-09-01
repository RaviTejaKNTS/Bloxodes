export type GroupPayoutMode = "percentage" | "weight" | "fixed";

export const GROUP_PAYOUT_MAX_RECIPIENTS = 100;
export const GROUP_PAYOUT_MAX_POOL_DIGITS = 18;
export const GROUP_PAYOUT_MAX_DECIMALS = 6;

export type GroupPayoutRecipientInput = {
  name: string;
  userId?: string;
  value: string;
};

export type GroupPayoutAllocation = {
  name: string;
  userId: string | null;
  enteredValue: string;
  exactQuota: string;
  allocation: bigint;
  receivedRoundingRobux: boolean;
};

export type GroupPayoutResult = {
  mode: GroupPayoutMode;
  pool: bigint;
  allocations: GroupPayoutAllocation[];
  totalAllocated: bigint;
  leftInGroup: bigint;
  percentageTotal?: string;
  warnings: string[];
  csvDraft: string | null;
};

type ParsedDecimal = { digits: bigint; decimals: number; original: string };

function parsePool(value: string): bigint | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed) || trimmed.length > GROUP_PAYOUT_MAX_POOL_DIGITS) return null;
  return BigInt(trimmed);
}

function parseDecimal(value: string): ParsedDecimal | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d+)(?:\.(\d{1,6}))?$/);
  if (!match) return null;
  const fraction = match[2] ?? "";
  return {
    digits: BigInt(`${match[1]}${fraction}`),
    decimals: fraction.length,
    original: trimmed
  };
}

function pow10(value: number): bigint {
  return 10n ** BigInt(value);
}

function scaleDecimals(values: ParsedDecimal[]): { scaled: bigint[]; scale: bigint; decimals: number } {
  const decimals = Math.max(0, ...values.map((value) => value.decimals));
  const scale = pow10(decimals);
  return {
    scaled: values.map((value) => value.digits * pow10(decimals - value.decimals)),
    scale,
    decimals
  };
}

function formatScaled(value: bigint, scale: bigint): string {
  if (scale === 1n) return value.toString();
  const decimals = scale.toString().length - 1;
  const whole = value / scale;
  const fraction = (value % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function formatQuota(numerator: bigint, denominator: bigint): string {
  if (denominator <= 0n) return "0";
  const whole = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder === 0n) return whole.toString();
  const precision = 1_000_000n;
  const fraction = ((remainder * precision) / denominator)
    .toString()
    .padStart(6, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function validateRecipients(recipients: GroupPayoutRecipientInput[]): string[] {
  const errors: string[] = [];
  if (recipients.length < 1) errors.push("Add at least one recipient.");
  if (recipients.length > GROUP_PAYOUT_MAX_RECIPIENTS) errors.push(`This calculator supports up to ${GROUP_PAYOUT_MAX_RECIPIENTS} recipients.`);

  const names = new Set<string>();
  const userIds = new Set<string>();
  recipients.forEach((recipient, index) => {
    const name = recipient.name.trim();
    const normalizedName = name.toLocaleLowerCase("en-US");
    if (!name) errors.push(`Recipient ${index + 1} needs a name.`);
    else if (names.has(normalizedName)) errors.push(`Recipient names must be unique: ${name}.`);
    else names.add(normalizedName);

    const userId = (recipient.userId ?? "").trim();
    if (userId) {
      if (!/^[1-9]\d*$/.test(userId)) errors.push(`${name || `Recipient ${index + 1}`} needs a positive whole-number user ID.`);
      else if (userIds.has(userId)) errors.push(`Roblox user IDs must be unique: ${userId}.`);
      else userIds.add(userId);
    }
  });
  return errors;
}

function buildCsv(allocations: GroupPayoutAllocation[]): string | null {
  const positive = allocations.filter((row) => row.allocation > 0n);
  if (!positive.length || positive.some((row) => !row.userId)) return null;
  return ["userId,payoutInRobux", ...positive.map((row) => `${row.userId},${row.allocation}`)].join("\n");
}

export function allocateGroupPayout({
  poolInput,
  mode,
  recipients
}: {
  poolInput: string;
  mode: GroupPayoutMode;
  recipients: GroupPayoutRecipientInput[];
}): { result: GroupPayoutResult | null; errors: string[] } {
  const errors = validateRecipients(recipients);
  const pool = parsePool(poolInput);
  if (pool === null) errors.push(`Available group funds must be a non-negative whole number with at most ${GROUP_PAYOUT_MAX_POOL_DIGITS} digits.`);

  if (mode === "fixed") {
    const values = recipients.map((recipient) => parsePool(recipient.value));
    values.forEach((value, index) => {
      if (value === null) errors.push(`${recipients[index]?.name.trim() || `Recipient ${index + 1}`} needs a non-negative whole-Robux amount.`);
    });
    if (errors.length || pool === null || values.some((value) => value === null)) return { result: null, errors };
    const fixedValues = values as bigint[];
    const totalAllocated = fixedValues.reduce((sum, value) => sum + value, 0n);
    if (totalAllocated > pool) return { result: null, errors: ["Fixed payouts cannot exceed the available group funds."] };
    const allocations = recipients.map((recipient, index) => ({
      name: recipient.name.trim(),
      userId: recipient.userId?.trim() || null,
      enteredValue: recipient.value.trim(),
      exactQuota: fixedValues[index]!.toString(),
      allocation: fixedValues[index]!,
      receivedRoundingRobux: false
    }));
    return {
      result: {
        mode,
        pool,
        allocations,
        totalAllocated,
        leftInGroup: pool - totalAllocated,
        warnings: [],
        csvDraft: buildCsv(allocations)
      },
      errors: []
    };
  }

  const parsed = recipients.map((recipient) => parseDecimal(recipient.value));
  parsed.forEach((value, index) => {
    if (!value) errors.push(`${recipients[index]?.name.trim() || `Recipient ${index + 1}`} needs a non-negative decimal with at most six places.`);
  });
  if (errors.length || pool === null || parsed.some((value) => value === null)) return { result: null, errors };

  const decimalValues = parsed as ParsedDecimal[];
  const { scaled, scale } = scaleDecimals(decimalValues);
  const sum = scaled.reduce((total, value) => total + value, 0n);
  const denominator = mode === "percentage" ? 100n * scale : sum;
  if (mode === "percentage" && sum > denominator) return { result: null, errors: ["Percentage shares cannot total more than 100%."] };
  if (mode === "weight" && sum === 0n) return { result: null, errors: ["At least one weight must be greater than zero."] };

  const numerators = scaled.map((value) => pool * value);
  const floors = numerators.map((value) => denominator === 0n ? 0n : value / denominator);
  const remainders = numerators.map((value) => denominator === 0n ? 0n : value % denominator);
  const floorTotal = floors.reduce((total, value) => total + value, 0n);
  const target = mode === "percentage"
    ? (denominator === 0n ? 0n : (pool * sum) / denominator)
    : pool;
  let extras = target - floorTotal;
  const order = recipients.map((_, index) => index).sort((left, right) => {
    if (remainders[left]! === remainders[right]!) return left - right;
    return remainders[left]! > remainders[right]! ? -1 : 1;
  });
  const received = new Set<number>();
  for (const index of order) {
    if (extras <= 0n) break;
    if (remainders[index]! > 0n) {
      floors[index] = floors[index]! + 1n;
      received.add(index);
      extras -= 1n;
    }
  }

  const allocations = recipients.map((recipient, index) => ({
    name: recipient.name.trim(),
    userId: recipient.userId?.trim() || null,
    enteredValue: decimalValues[index]!.original,
    exactQuota: formatQuota(numerators[index]!, denominator),
    allocation: floors[index]!,
    receivedRoundingRobux: received.has(index)
  }));
  const totalAllocated = allocations.reduce((total, row) => total + row.allocation, 0n);
  const percentageTotal = mode === "percentage" ? formatScaled(sum, scale) : undefined;
  const warnings = mode === "percentage" && sum < denominator
    ? [`${percentageTotal}% is assigned. The unassigned share stays in the group.`]
    : [];

  return {
    result: {
      mode,
      pool,
      allocations,
      totalAllocated,
      leftInGroup: pool - totalAllocated,
      percentageTotal,
      warnings,
      csvDraft: buildCsv(allocations)
    },
    errors: []
  };
}
