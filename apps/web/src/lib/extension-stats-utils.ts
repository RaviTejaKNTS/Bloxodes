import type { StatsChartPoint } from "@/lib/stats";

export type ExtensionStatsPoint = {
  sampledAt: string;
  players: number;
};

function finitePlayerValue(point: StatsChartPoint): number | null {
  const candidates = [point.players, point.avgPlayers, point.peakPlayers];
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return Math.max(0, Math.round(candidate));
    }
  }
  return null;
}

export function compactExtensionStatsPoints(points: StatsChartPoint[]): ExtensionStatsPoint[] {
  return points.flatMap((point) => {
    if (!point.sampledAt || Number.isNaN(Date.parse(point.sampledAt))) return [];
    const players = finitePlayerValue(point);
    return players == null ? [] : [{ sampledAt: point.sampledAt, players }];
  });
}

export function hasMeaningfulExtensionHistory(points: ExtensionStatsPoint[]): boolean {
  return new Set(points.map((point) => point.sampledAt)).size >= 2;
}
