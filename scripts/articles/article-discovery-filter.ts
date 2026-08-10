export const DEFAULT_ARTICLE_DISCOVERY_MAX_AGE_HOURS = 18;
export const MAX_ARTICLE_DISCOVERY_MAX_AGE_HOURS = 24;

export type DiscoveryFilterCandidate = {
  sourceUrl: string;
  title: string;
  publishedAt: string | null;
};

export type DiscoveryFunnelStats = {
  raw: number;
  missingTitle: number;
  missingPublishedAt: number;
  invalidPublishedAt: number;
  excluded: number;
  stale: number;
  futureDated: number;
  duplicateUrl: number;
  beyondLimit: number;
  eligible: number;
};

export function validateDiscoveryMaxAgeHours(value: number): number {
  if (!Number.isFinite(value) || value <= 0 || value >= MAX_ARTICLE_DISCOVERY_MAX_AGE_HOURS) {
    throw new Error("--max-age-hours must be greater than 0 and less than 24.");
  }
  return value;
}

export function filterRecentDiscoveryCandidates<T extends DiscoveryFilterCandidate>(
  candidates: T[],
  options: {
    maxAgeHours: number;
    limit: number;
    now?: number;
    exclude: (candidate: T) => boolean;
  }
): { candidates: T[]; stats: DiscoveryFunnelStats } {
  const now = options.now ?? Date.now();
  const cutoff = now - options.maxAgeHours * 60 * 60 * 1000;
  const futureTolerance = now + 6 * 60 * 60 * 1000;
  const seen = new Set<string>();
  const kept: T[] = [];
  const stats: DiscoveryFunnelStats = {
    raw: candidates.length,
    missingTitle: 0,
    missingPublishedAt: 0,
    invalidPublishedAt: 0,
    excluded: 0,
    stale: 0,
    futureDated: 0,
    duplicateUrl: 0,
    beyondLimit: 0,
    eligible: 0
  };

  for (const candidate of candidates) {
    if (options.exclude(candidate)) {
      stats.excluded += 1;
      continue;
    }
    if (!candidate.publishedAt) {
      stats.missingPublishedAt += 1;
      continue;
    }
    const timestamp = Date.parse(candidate.publishedAt);
    if (!Number.isFinite(timestamp)) {
      stats.invalidPublishedAt += 1;
      continue;
    }
    if (timestamp < cutoff) {
      stats.stale += 1;
      continue;
    }
    if (timestamp > futureTolerance) {
      stats.futureDated += 1;
      continue;
    }
    if (!candidate.title.trim()) {
      stats.missingTitle += 1;
      continue;
    }
    if (seen.has(candidate.sourceUrl)) {
      stats.duplicateUrl += 1;
      continue;
    }
    seen.add(candidate.sourceUrl);
    kept.push(candidate);
  }

  kept.sort((left, right) => (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""));
  stats.beyondLimit = Math.max(0, kept.length - options.limit);
  const limited = kept.slice(0, options.limit);
  stats.eligible = limited.length;
  return { candidates: limited, stats };
}
