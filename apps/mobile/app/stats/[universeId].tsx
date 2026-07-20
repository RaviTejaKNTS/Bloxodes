import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Linking, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { buildWebUrl, fetchStatsGameChart, fetchStatsGameDetail } from "../../src/api";
import { compactNumber, formatUpdatedLabel, fullNumber, percentLabel } from "../../src/format";
import { radii, spacing } from "../../src/theme";
import { useTheme } from "../../src/theme-context";
import { Badge, Button, Card, ErrorState, LoadingState, MetaText } from "../../src/components/ui";
import type { StatsChartPoint, StatsGame } from "../../src/types";

const CHART_RANGES: Array<{ value: string; label: string }> = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "14d", label: "14d" },
  { value: "30d", label: "30d" }
];

function buildLinePaths(points: StatsChartPoint[], width: number, height: number): { line: string; area: string } | null {
  const values = points.map((point) => point.players).filter((value): value is number => typeof value === "number");
  if (values.length < 2) return null;
  const usable = points.filter((point) => typeof point.players === "number");
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = width / (usable.length - 1);

  let line = "";
  usable.forEach((point, index) => {
    const x = index * stepX;
    const y = height - ((point.players! - min) / span) * (height - 8) - 4;
    line += `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const area = `${line}L${width},${height}L0,${height}Z`;
  return { line, area };
}

function StatCell({ label, value }: { label: string; value: string | null }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexBasis: "47%", flexGrow: 1, gap: 2 }}>
      <MetaText>{label}</MetaText>
      <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "800" }}>{value ?? "—"}</Text>
    </View>
  );
}

export default function StatsGameScreen() {
  const params = useLocalSearchParams<{ universeId: string }>();
  const universeId = Number(params.universeId);
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [game, setGame] = useState<(StatsGame & { rank: number | null }) | null>(null);
  const [points, setPoints] = useState<StatsChartPoint[]>([]);
  const [range, setRange] = useState("14d");
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(universeId) || universeId <= 0) return;
    setLoading(true);
    setError(null);
    try {
      const detail = await fetchStatsGameDetail(universeId);
      if (!detail.game) {
        setError("Game not found");
      } else {
        setGame(detail.game);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load game stats");
    } finally {
      setLoading(false);
    }
  }, [universeId]);

  const loadChart = useCallback(
    async (nextRange: string) => {
      if (!Number.isFinite(universeId) || universeId <= 0) return;
      setChartLoading(true);
      try {
        const chart = await fetchStatsGameChart(universeId, nextRange);
        setPoints(chart.points ?? []);
      } catch {
        setPoints([]);
      } finally {
        setChartLoading(false);
      }
    },
    [universeId]
  );

  useEffect(() => {
    void load();
    void loadChart(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const chartWidth = width - spacing.lg * 4;
  const chartHeight = 140;
  const paths = useMemo(() => buildLinePaths(points, chartWidth, chartHeight), [points, chartWidth]);
  const playersNow = game ? compactNumber(game.playing) : null;

  return (
    <>
      <Stack.Screen options={{ title: game ? game.displayName || game.name : "Game stats" }} />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl }}
      >
        {loading ? <LoadingState label="Loading game stats" /> : null}
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

        {game ? (
          <>
            <Card>
              <View style={{ flexDirection: "row", gap: spacing.md, padding: spacing.lg }}>
                <View style={{ width: 68, height: 68, borderRadius: radii.md, overflow: "hidden", backgroundColor: colors.surfaceMuted }}>
                  {game.iconUrl ? (
                    <Image source={{ uri: game.iconUrl }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                  ) : null}
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Text style={{ color: colors.foreground, fontSize: 19, lineHeight: 24, fontWeight: "800" }} numberOfLines={2}>
                    {game.displayName || game.name}
                  </Text>
                  <MetaText>{[game.creatorName, game.genre].filter(Boolean).join(" · ") || "Roblox"}</MetaText>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                    {game.rank ? <Badge label={`Rank #${game.rank}`} tone="accent" /> : null}
                    {game.statsTier ? <Badge label={game.statsTier} /> : null}
                  </View>
                </View>
              </View>
            </Card>

            <Card>
              <View style={{ gap: spacing.md, padding: spacing.lg }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ gap: 2 }}>
                    <MetaText>Playing now</MetaText>
                    <Text style={{ color: colors.foreground, fontSize: 26, fontWeight: "700" }}>{playersNow ?? "—"}</Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: spacing.xs }}>
                    {CHART_RANGES.map((option) => {
                      const active = option.value === range;
                      return (
                        <TouchableOpacity
                          key={option.value}
                          onPress={() => {
                            setRange(option.value);
                            void loadChart(option.value);
                          }}
                          activeOpacity={0.85}
                          style={{
                            minHeight: 30,
                            borderRadius: radii.sm,
                            borderWidth: 1,
                            borderColor: active ? colors.accentBorder : colors.border,
                            backgroundColor: active ? colors.accentSoft : "transparent",
                            alignItems: "center",
                            justifyContent: "center",
                            paddingHorizontal: spacing.sm
                          }}
                        >
                          <Text style={{ color: active ? colors.accent : colors.muted, fontSize: 11.5, fontWeight: "800" }}>
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {chartLoading ? (
                  <LoadingState label="Loading chart" />
                ) : paths ? (
                  <Svg width={chartWidth} height={chartHeight}>
                    <Defs>
                      <LinearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={colors.accentDark} stopOpacity="0.28" />
                        <Stop offset="1" stopColor={colors.accentDark} stopOpacity="0.02" />
                      </LinearGradient>
                    </Defs>
                    <Path d={paths.area} fill="url(#chartFill)" />
                    <Path d={paths.line} stroke={colors.accentDark} strokeWidth={2.25} fill="none" />
                  </Svg>
                ) : (
                  <MetaText>Not enough chart data yet.</MetaText>
                )}
                {points.length ? (
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <MetaText>{points[0]?.label}</MetaText>
                    <MetaText>{points[points.length - 1]?.label}</MetaText>
                  </View>
                ) : null}
              </View>
            </Card>

            <Card>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.lg, padding: spacing.lg }}>
                <StatCell label="Visits" value={compactNumber(game.visits)} />
                <StatCell label="Favorites" value={compactNumber(game.favorites)} />
                <StatCell label="Rating" value={game.ratingPercent != null ? `${Math.round(game.ratingPercent)}%` : null} />
                <StatCell label="Likes" value={compactNumber(game.likes)} />
                <StatCell label="24h change" value={percentLabel(game.growth24hPercent)} />
                <StatCell label="7d change" value={percentLabel(game.growth7dPercent)} />
                <StatCell label="Created" value={game.createdAtApi ? formatUpdatedLabel(game.createdAtApi) : null} />
                <StatCell label="Updated" value={game.updatedAtApi ? formatUpdatedLabel(game.updatedAtApi) : null} />
              </View>
            </Card>

            {game.description ? (
              <Card>
                <View style={{ gap: spacing.sm, padding: spacing.lg }}>
                  <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "800" }}>About</Text>
                  <Text style={{ color: colors.mutedStrong, fontSize: 14, lineHeight: 21 }} numberOfLines={12}>
                    {game.description}
                  </Text>
                </View>
              </Card>
            ) : null}

            <Button
              icon="external-link"
              label="Full stats on bloxodes.com"
              variant="secondary"
              onPress={() => void Linking.openURL(buildWebUrl(`/stats/games/${game.slug}`))}
            />
          </>
        ) : null}

        {game?.visits != null ? (
          <MetaText style={{ textAlign: "center" }}>Total visits: {fullNumber(game.visits)}</MetaText>
        ) : null}
      </ScrollView>
    </>
  );
}
