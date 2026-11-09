const DAY_MS = 24 * 60 * 60 * 1000;

export function defaultDecalQuerySeeds(seeds: string[], now = new Date()): string[] {
  // Roblox search can return the same old assets even when CreateTime is requested.
  return [...new Set([String(now.getUTCFullYear()), ...seeds])];
}

export function planMissingDecalBatch<T extends { asset_id: number }>(
  rows: T[], existingIds: Set<number>, remaining: number
) {
  return rows.filter((row) => !existingIds.has(row.asset_id)).slice(0, Math.max(0, remaining));
}

export function decalDiscoveryHealth(latestSeenAt: string | null, now = Date.now()): string | null {
  if (!latestSeenAt) return "No decals have been discovered.";
  const age = now - Date.parse(latestSeenAt);
  if (!Number.isFinite(age)) throw new Error("Invalid latest decal discovery timestamp.");
  return age >= 7 * DAY_MS ? `No new decals for at least 7 days. Latest discovery: ${latestSeenAt}` : null;
}

export function parseDecalStepCounts(output: string): Record<string, number> {
  const counts: Record<string, number> = {};
  const patterns = {
    candidates: /(?:Unique candidates this run|Candidate rows): (\d+)/,
    inserted: /Inserted: (\d+)/,
    already_known: /Already known: (\d+)/,
    verified: /Total verified: (\d+)/,
    reranked: /Reranked (\d+)/,
    configs: /Configs: (\d+)/
  };
  for (const [name, pattern] of Object.entries(patterns)) {
    const match = output.match(pattern);
    if (match) counts[name] = Number(match[1]);
  }
  if (/Stopped early: .*\(429\)/.test(output)) counts.rate_limited = 1;
  return counts;
}
