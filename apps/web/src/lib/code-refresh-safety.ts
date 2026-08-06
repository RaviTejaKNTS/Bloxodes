type EmptyRefreshCheck = {
  existingActiveCount: number;
  scrapedActiveCount: number;
  scrapedExpiredCount: number;
};

export function isSuspiciousEmptyCodeRefresh({
  existingActiveCount,
  scrapedActiveCount,
  scrapedExpiredCount,
}: EmptyRefreshCheck): boolean {
  return (
    existingActiveCount > 0 &&
    scrapedActiveCount === 0 &&
    scrapedExpiredCount === 0
  );
}
