// playing must already be normalized through stats-freshness, so an old
// positive player count cannot qualify a tiny abandoned game.
export function isUsefulRelatedRobloxGame(playing: number | null | undefined, visits: number | null | undefined) {
  return (playing ?? 0) >= 1 || (visits ?? 0) >= 100_000;
}
