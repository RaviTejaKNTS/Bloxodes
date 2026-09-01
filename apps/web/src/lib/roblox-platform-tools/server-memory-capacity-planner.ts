export const SERVER_MEMORY_RULES_VERIFIED_DATE = "2026-08-31";
export const SERVER_BASE_MEMORY_GIB = 6.25;
export const SERVER_MEMORY_MIB_PER_LARGEST_PLAYER = 100;
export const ROBLOX_RECOMMENDED_MAX_MEMORY_PERCENT = 50;
export const SERVER_HEARTBEAT_CAP = 60;

export type ServerMemoryCapacityInput = {
  maxPlayers: string;
  targetPlayers: string;
  lowSamplePlayers: string;
  lowSampleMemoryGiB: string;
  highSamplePlayers: string;
  highSampleMemoryGiB: string;
  eventReserveGiB: string;
  growthMiBPerHour: string;
  plannedUptimeHours: string;
  safetyPercent: string;
  measuredHeartbeat: string;
};

export type ServerMemoryCapacityResult = {
  maxPlayers: number;
  targetPlayers: number;
  lowSample: { players: number; memoryGiB: number };
  highSample: { players: number; memoryGiB: number };
  marginalGiBPerPlayer: number;
  baselineGiB: number;
  eventReserveGiB: number;
  longSessionReserveGiB: number;
  projectedUsedGiB: number;
  allocatedTotalGiB: number;
  safetyPercent: number;
  safetyCeilingGiB: number;
  usagePercent: number;
  remainingGiB: number;
  memoryStatus: "pass" | "fail";
  memoryOnlyCapacity: number;
  targetExceedsMemoryCapacity: boolean;
  measuredHeartbeat: number;
  heartbeatStatus: "pass" | "warn";
};

function parseWhole(value: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function parseDecimal(value: string, min: number, max: number): number | null {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export function calculateServerAllocatedMemoryGiB(largestConnectedPlayers: number): number {
  return SERVER_BASE_MEMORY_GIB + largestConnectedPlayers * SERVER_MEMORY_MIB_PER_LARGEST_PLAYER / 1024;
}

export function calculateServerMemoryCapacity(input: ServerMemoryCapacityInput): { result: ServerMemoryCapacityResult | null; errors: string[] } {
  const errors: string[] = [];
  const maxPlayers = parseWhole(input.maxPlayers, 1, 1_000);
  const targetPlayers = parseWhole(input.targetPlayers, 1, 1_000);
  const sampleAPlayers = parseWhole(input.lowSamplePlayers, 0, 1_000);
  const sampleAMemory = parseDecimal(input.lowSampleMemoryGiB, 0, 100);
  const sampleBPlayers = parseWhole(input.highSamplePlayers, 0, 1_000);
  const sampleBMemory = parseDecimal(input.highSampleMemoryGiB, 0, 100);
  const eventReserveGiB = parseDecimal(input.eventReserveGiB || "0", 0, 100);
  const growthMiBPerHour = parseDecimal(input.growthMiBPerHour || "0", 0, 100_000);
  const plannedUptimeHours = parseDecimal(input.plannedUptimeHours || "0", 0, 168);
  const safetyPercent = parseDecimal(input.safetyPercent, 1, ROBLOX_RECOMMENDED_MAX_MEMORY_PERCENT);
  const measuredHeartbeat = parseDecimal(input.measuredHeartbeat, 0, SERVER_HEARTBEAT_CAP);
  if (maxPlayers === null) errors.push("Configured MaxPlayers must be a whole number from 1 through 1,000.");
  if (targetPlayers === null) errors.push("Target players must be a whole number from 1 through 1,000.");
  if (sampleAPlayers === null || sampleBPlayers === null) errors.push("Sample player counts must be whole numbers from 0 through 1,000.");
  if (sampleAMemory === null || sampleBMemory === null) errors.push("Sample memory must be a number from 0 through 100 GiB.");
  if (eventReserveGiB === null) errors.push("Event reserve must be a number from 0 through 100 GiB.");
  if (growthMiBPerHour === null) errors.push("Memory growth must be a number from 0 through 100,000 MiB per hour.");
  if (plannedUptimeHours === null) errors.push("Planned uptime must be a number from 0 through 168 hours.");
  if (safetyPercent === null) errors.push("Safety target must be from 1% through Roblox's 50% recommendation.");
  if (measuredHeartbeat === null) errors.push("Measured heartbeat must be from 0 through 60 steps per second.");
  if (maxPlayers !== null && targetPlayers !== null && targetPlayers > maxPlayers) errors.push("Target players cannot exceed the configured MaxPlayers value.");
  if (sampleAPlayers !== null && sampleBPlayers !== null && sampleAPlayers === sampleBPlayers) errors.push("The two samples need different player counts.");
  if (errors.length || maxPlayers === null || targetPlayers === null || sampleAPlayers === null || sampleBPlayers === null || sampleAMemory === null || sampleBMemory === null || eventReserveGiB === null || growthMiBPerHour === null || plannedUptimeHours === null || safetyPercent === null || measuredHeartbeat === null) return { result: null, errors };

  const lowSample = sampleAPlayers < sampleBPlayers ? { players: sampleAPlayers, memoryGiB: sampleAMemory } : { players: sampleBPlayers, memoryGiB: sampleBMemory };
  const highSample = sampleAPlayers < sampleBPlayers ? { players: sampleBPlayers, memoryGiB: sampleBMemory } : { players: sampleAPlayers, memoryGiB: sampleAMemory };
  if (highSample.memoryGiB < lowSample.memoryGiB) return { result: null, errors: ["The higher-player sample cannot use less memory in this linear planning model. Retake comparable samples."] };
  const marginalGiBPerPlayer = (highSample.memoryGiB - lowSample.memoryGiB) / (highSample.players - lowSample.players);
  const baselineGiB = lowSample.memoryGiB - marginalGiBPerPlayer * lowSample.players;
  if (baselineGiB < -1e-9) return { result: null, errors: ["The samples produce a negative baseline, so they are not stable enough for this linear model."] };

  const normalizedBaseline = Math.max(0, baselineGiB);
  const longSessionReserveGiB = growthMiBPerHour * plannedUptimeHours / 1024;
  const projectedAt = (players: number) => normalizedBaseline + marginalGiBPerPlayer * players + eventReserveGiB + longSessionReserveGiB;
  const safeAt = (players: number) => calculateServerAllocatedMemoryGiB(players) * safetyPercent / 100;
  let memoryOnlyCapacity = 0;
  for (let players = 1; players <= maxPlayers; players += 1) if (projectedAt(players) <= safeAt(players)) memoryOnlyCapacity = players;

  const projectedUsedGiB = projectedAt(targetPlayers);
  const allocatedTotalGiB = calculateServerAllocatedMemoryGiB(targetPlayers);
  const safetyCeilingGiB = allocatedTotalGiB * safetyPercent / 100;
  return { result: {
    maxPlayers,
    targetPlayers,
    lowSample,
    highSample,
    marginalGiBPerPlayer,
    baselineGiB: normalizedBaseline,
    eventReserveGiB,
    longSessionReserveGiB,
    projectedUsedGiB,
    allocatedTotalGiB,
    safetyPercent,
    safetyCeilingGiB,
    usagePercent: projectedUsedGiB / allocatedTotalGiB * 100,
    remainingGiB: safetyCeilingGiB - projectedUsedGiB,
    memoryStatus: projectedUsedGiB <= safetyCeilingGiB ? "pass" : "fail",
    memoryOnlyCapacity,
    targetExceedsMemoryCapacity: targetPlayers > memoryOnlyCapacity,
    measuredHeartbeat,
    heartbeatStatus: measuredHeartbeat >= SERVER_HEARTBEAT_CAP ? "pass" : "warn"
  }, errors: [] };
}
