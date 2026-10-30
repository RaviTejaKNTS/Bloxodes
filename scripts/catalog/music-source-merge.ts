type MusicSourceKey = { game_slug: string; asset_id: number; use_type: string };

// Live sources take precedence without changing a static source's checked date.
export function mergeMusicSources<T extends MusicSourceKey>(liveRows: T[], staticRows: T[]): T[] {
  const key = (row: T) => `${row.game_slug}:${row.asset_id}:${row.use_type}`;
  const liveKeys = new Set(liveRows.map(key));
  const additions = new Map(staticRows.filter((row) => !liveKeys.has(key(row))).map((row) => [key(row), row]));
  return [...liveRows, ...additions.values()];
}
