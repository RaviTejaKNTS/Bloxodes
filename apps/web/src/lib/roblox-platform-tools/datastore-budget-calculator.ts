export const DATASTORE_LIMITS_VERIFIED_DATE = "2026-08-31";
export const DEFAULT_SAFETY_PERCENT = 80;

export type DataStoreBucket =
  | "standardRead" | "standardWrite" | "standardList" | "standardRemove"
  | "orderedRead" | "orderedWrite" | "orderedList" | "orderedRemove";

export type DataStoreOperationInputs = {
  standardGets: string;
  standardWrites: string;
  standardUpdates: string;
  standardLists: string;
  standardRemoves: string;
  orderedReads: string;
  orderedWrites: string;
  orderedUpdates: string;
  orderedLists: string;
  orderedRemoves: string;
};

export type DataStoreBudgetInput = {
  players: string;
  concurrentUsers: string;
  serverCount: string;
  safetyPercent: string;
  averageReadBytes: string;
  averageWriteBytes: string;
  operations: DataStoreOperationInputs;
};

export type DataStoreBudgetRow = {
  bucket: DataStoreBucket;
  label: string;
  serverDemand: number;
  serverLimit: number;
  experienceDemand: number;
  experienceLimit: number;
  serverSafetyLimit: number;
  experienceSafetyLimit: number;
  serverUtilization: number;
  experienceUtilization: number;
  limitingLayer: "server" | "experience";
  status: "pass" | "warn" | "fail";
};

export type DataStoreBudgetResult = {
  players: number;
  enteredConcurrentUsers: number;
  effectiveConcurrentUsers: number;
  concurrentUsersCorrected: boolean;
  serverCount: number;
  safetyPercent: number;
  rows: DataStoreBudgetRow[];
  hasUpdates: boolean;
  perKeyRead: PerKeyThroughput | null;
  perKeyWrite: PerKeyThroughput | null;
};

export type PerKeyThroughput = {
  bytes: number;
  roundedKilobytes: number;
  limitKilobytes: number;
  estimatedRequestsPerMinute: number;
};

const LABELS: Record<DataStoreBucket, string> = {
  standardRead: "Standard read",
  standardWrite: "Standard write",
  standardList: "Standard list",
  standardRemove: "Standard remove",
  orderedRead: "Ordered read",
  orderedWrite: "Ordered write",
  orderedList: "Ordered list",
  orderedRemove: "Ordered remove"
};

function parseWhole(value: string, min: number, max: number): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export function getDefaultServerLimit(bucket: DataStoreBucket, players: number): number {
  if (bucket === "standardList" || bucket === "orderedList") return 5 + players * 2;
  if (bucket === "orderedWrite" || bucket === "orderedRemove") return 30 + players * 5;
  return 60 + players * 40;
}

export function getExperienceLimit(bucket: DataStoreBucket, concurrentUsers: number): number {
  if (bucket === "standardWrite" || bucket === "orderedWrite") return 300 + concurrentUsers * 20;
  if (bucket === "standardList" || bucket === "orderedList") return 300 + concurrentUsers * 2;
  return 300 + concurrentUsers * 40;
}

function statusFor(demand: number, safetyLimit: number, documentedLimit: number): "pass" | "warn" | "fail" {
  if (demand > documentedLimit) return "fail";
  if (demand > safetyLimit) return "warn";
  return "pass";
}

function combineStatus(left: "pass" | "warn" | "fail", right: "pass" | "warn" | "fail"): "pass" | "warn" | "fail" {
  if (left === "fail" || right === "fail") return "fail";
  if (left === "warn" || right === "warn") return "warn";
  return "pass";
}

export function calculatePerKeyThroughput(bytes: number, kind: "read" | "write"): PerKeyThroughput | null {
  if (bytes <= 0) return null;
  const roundedKilobytes = Math.ceil(bytes / 1000);
  const limitKilobytes = kind === "read" ? 25_000 : 4_000;
  return { bytes, roundedKilobytes, limitKilobytes, estimatedRequestsPerMinute: Math.floor(limitKilobytes / roundedKilobytes) };
}

export function calculateDataStoreBudget(input: DataStoreBudgetInput): { result: DataStoreBudgetResult | null; errors: string[] } {
  const errors: string[] = [];
  const players = parseWhole(input.players, 0, 1_000);
  const concurrentUsers = parseWhole(input.concurrentUsers, 0, 10_000_000);
  const serverCount = parseWhole(input.serverCount, 1, 100_000);
  const safetyPercent = parseWhole(input.safetyPercent, 1, 100);
  const readBytes = parseWhole(input.averageReadBytes || "0", 0, 4_194_304);
  const writeBytes = parseWhole(input.averageWriteBytes || "0", 0, 4_194_304);
  if (players === null) errors.push("Players in this server must be a whole number from 0 through 1,000.");
  if (concurrentUsers === null) errors.push("Experience concurrent users must be a whole number from 0 through 10,000,000.");
  if (serverCount === null) errors.push("Similar servers must be a whole number from 1 through 100,000.");
  if (safetyPercent === null) errors.push("Safety target must be a whole percentage from 1 through 100.");
  if (readBytes === null || writeBytes === null) errors.push("Average key bytes must be whole numbers from 0 through 4,194,304.");

  const operationEntries = Object.entries(input.operations) as [keyof DataStoreOperationInputs, string][];
  const operations = {} as Record<keyof DataStoreOperationInputs, number>;
  for (const [key, value] of operationEntries) {
    const parsed = parseWhole(value || "0", 0, 1_000_000);
    if (parsed === null) errors.push(`${key} must be a whole number from 0 through 1,000,000.`);
    else operations[key] = parsed;
  }
  if (errors.length || players === null || concurrentUsers === null || serverCount === null || safetyPercent === null || readBytes === null || writeBytes === null) return { result: null, errors };

  const effectiveConcurrentUsers = Math.max(players, concurrentUsers);
  const demand: Record<DataStoreBucket, number> = {
    standardRead: operations.standardGets + operations.standardUpdates,
    standardWrite: operations.standardWrites + operations.standardUpdates,
    standardList: operations.standardLists,
    standardRemove: operations.standardRemoves,
    orderedRead: operations.orderedReads + operations.orderedUpdates,
    orderedWrite: operations.orderedWrites + operations.orderedUpdates,
    orderedList: operations.orderedLists,
    orderedRemove: operations.orderedRemoves
  };

  const rows = (Object.keys(LABELS) as DataStoreBucket[]).map((bucket) => {
    const serverDemand = demand[bucket];
    const experienceDemand = serverDemand * serverCount;
    const serverLimit = getDefaultServerLimit(bucket, players);
    const experienceLimit = getExperienceLimit(bucket, effectiveConcurrentUsers);
    const serverSafetyLimit = Math.floor(serverLimit * safetyPercent / 100);
    const experienceSafetyLimit = Math.floor(experienceLimit * safetyPercent / 100);
    const serverUtilization = serverDemand / serverLimit;
    const experienceUtilization = experienceDemand / experienceLimit;
    return {
      bucket,
      label: LABELS[bucket],
      serverDemand,
      serverLimit,
      experienceDemand,
      experienceLimit,
      serverSafetyLimit,
      experienceSafetyLimit,
      serverUtilization,
      experienceUtilization,
      limitingLayer: serverUtilization >= experienceUtilization ? "server" : "experience",
      status: combineStatus(statusFor(serverDemand, serverSafetyLimit, serverLimit), statusFor(experienceDemand, experienceSafetyLimit, experienceLimit))
    } satisfies DataStoreBudgetRow;
  });

  return { result: {
    players,
    enteredConcurrentUsers: concurrentUsers,
    effectiveConcurrentUsers,
    concurrentUsersCorrected: concurrentUsers < players,
    serverCount,
    safetyPercent,
    rows,
    hasUpdates: operations.standardUpdates > 0 || operations.orderedUpdates > 0,
    perKeyRead: calculatePerKeyThroughput(readBytes, "read"),
    perKeyWrite: calculatePerKeyThroughput(writeBytes, "write")
  }, errors: [] };
}
