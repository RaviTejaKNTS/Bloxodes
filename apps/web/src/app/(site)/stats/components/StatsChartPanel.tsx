"use client";

import { useEffect, useMemo, useState } from "react";
import { Area } from "recharts/es6/cartesian/Area";
import { CartesianGrid } from "recharts/es6/cartesian/CartesianGrid";
import { Line } from "recharts/es6/cartesian/Line";
import { XAxis } from "recharts/es6/cartesian/XAxis";
import { YAxis } from "recharts/es6/cartesian/YAxis";
import { AreaChart } from "recharts/es6/chart/AreaChart";
import { LineChart } from "recharts/es6/chart/LineChart";
import { Activity, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCompactNumber, formatPercent } from "@/lib/stats-format";
import { cn } from "@/lib/utils";

type ChartPoint = {
  label: string;
  sampledAt: string;
  players: number | null;
  peakPlayers: number | null;
  avgPlayers: number | null;
  visits: number | null;
  favorites: number | null;
  rating: number | null;
  samples: number | null;
};

type ChartPointForRender = ChartPoint & {
  axisLabel: string;
  chartResolution: EffectiveResolutionKey;
  tooltipLabel: string;
};

type MetricKey = "players" | "visits" | "favorites" | "rating";
type RangeKey = "24h" | "7d" | "30d" | "90d" | "all";
type ResolutionKey = "auto" | "hourly" | "daily" | "monthly";
type EffectiveResolutionKey = Exclude<ResolutionKey, "auto">;

type ChartData = {
  range: RangeKey;
  requestedResolution: ResolutionKey;
  resolution: EffectiveResolutionKey;
  points: ChartPoint[];
};

const metricLabels: Record<MetricKey, string> = {
  players: "Playing",
  visits: "Visits",
  favorites: "Favorites",
  rating: "Rating"
};

const metricConfig: ChartConfig = {
  players: { label: "Playing", color: "rgb(var(--color-accent))" },
  visits: { label: "Visits", color: "#22c55e" },
  favorites: { label: "Favorites", color: "#f59e0b" },
  rating: { label: "Rating", color: "#38bdf8" }
};

const chartTabsListClass =
  "h-auto min-h-9 flex-wrap justify-start gap-1 rounded-md border border-border/70 bg-background/80 p-1 text-muted shadow-none";
const chartTabsTriggerClass =
  "h-7 rounded-sm px-2.5 text-xs font-semibold text-muted transition-colors hover:bg-secondary/70 hover:text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-none";

function formatMetricValue(metric: MetricKey, value?: number | null) {
  if (metric === "rating") return formatPercent(value);
  return formatCompactNumber(value);
}

function axisTick(value: unknown) {
  return formatCompactNumber(typeof value === "number" ? value : Number(value), 0);
}

function formatTooltipTimestamp(sampledAt: string, resolution: EffectiveResolutionKey) {
  const date = new Date(resolution === "daily" && /^\d{4}-\d{2}-\d{2}$/.test(sampledAt) ? `${sampledAt}T00:00:00.000Z` : sampledAt);
  if (!Number.isFinite(date.getTime())) return sampledAt;
  if (resolution === "hourly") {
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short"
    });
  }
  if (resolution === "monthly") {
    return date.toLocaleDateString(undefined, { month: "short", year: "numeric", timeZone: "UTC" });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function StatsTooltip({
  active,
  payload,
  metric
}: {
  active?: boolean;
  payload?: Array<{ color?: string; value?: unknown; payload?: Partial<ChartPointForRender> }>;
  metric: MetricKey;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const point = item.payload;
  const label = point?.tooltipLabel ?? point?.sampledAt ?? "";
  const value = typeof item.value === "number" ? item.value : Number(item.value);
  return (
    <div className="grid min-w-[10rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{label}</div>
      <div className="flex w-full items-center gap-2">
        <span className="h-3 w-1 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color ?? `var(--color-${metric})` }} />
        <span className="text-muted-foreground">{metricLabels[metric]}</span>
        <span className="ml-auto font-mono font-medium tabular-nums text-foreground">{formatMetricValue(metric, Number.isFinite(value) ? value : null)}</span>
      </div>
    </div>
  );
}

function chartCacheKey(range: RangeKey, resolution: ResolutionKey) {
  return `${range}:${resolution}`;
}

function usablePointCount(points: ChartPoint[], metric: MetricKey) {
  return points.filter((point) => typeof point[metric] === "number").length;
}

function autoResolution(range: RangeKey): EffectiveResolutionKey {
  if (range === "24h" || range === "7d") return "hourly";
  if (range === "all") return "monthly";
  return "daily";
}

export function StatsChartPanel({
  title,
  subtitle,
  chart,
  initialChart,
  universeId,
  defaultMetric = "players",
  defaultRange = "24h",
  compact = false,
  area = false
}: {
  title: string;
  subtitle?: string | null;
  chart?: ChartPoint[];
  initialChart?: ChartData;
  universeId?: number;
  defaultMetric?: MetricKey;
  defaultRange?: RangeKey;
  compact?: boolean;
  area?: boolean;
}) {
  const [metric, setMetric] = useState<MetricKey>(defaultMetric);
  const [range, setRange] = useState<RangeKey>(defaultRange);
  const [chartCache, setChartCache] = useState<Record<string, ChartData>>(() =>
    initialChart ? { [chartCacheKey(initialChart.range, initialChart.requestedResolution)]: initialChart } : {}
  );
  const [lastRenderedChart, setLastRenderedChart] = useState<ChartData | undefined>(initialChart);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const initialChartKey = initialChart ? chartCacheKey(initialChart.range, initialChart.requestedResolution) : null;
  const activeResolution: ResolutionKey = "auto";
  const activeKey = chartCacheKey(range, activeResolution);
  const loadedChart = chartCache[activeKey] ?? (initialChartKey === activeKey ? initialChart : undefined);
  const displayChart = loadedChart ?? lastRenderedChart;
  const points = useMemo(() => (initialChart ? displayChart?.points ?? [] : chart ?? []), [chart, displayChart, initialChart]);
  const hasRenderableData = usablePointCount(points, metric) >= 2;
  const Chart = area ? AreaChart : LineChart;
  const resolvedResolution = displayChart?.resolution ?? (activeResolution === "auto" ? autoResolution(range) : activeResolution);
  const chartPoints = useMemo<ChartPointForRender[]>(
    () =>
      points.map((point) => ({
        ...point,
        axisLabel: point.label,
        chartResolution: resolvedResolution,
        tooltipLabel: formatTooltipTimestamp(point.sampledAt, resolvedResolution)
      })),
    [points, resolvedResolution]
  );
  const isLoading = loadingKey === activeKey;
  const isShowingPreviousChart = Boolean(isLoading && !loadedChart && hasRenderableData);

  useEffect(() => {
    if (loadedChart) {
      setLastRenderedChart(loadedChart);
    }
  }, [loadedChart]);

  useEffect(() => {
    if (!initialChart || !universeId || chartCache[activeKey]) return;
    let cancelled = false;
    setLoadingKey(activeKey);
    setLoadError(null);
    fetch(`/api/stats/games/${universeId}/chart?range=${encodeURIComponent(range)}&resolution=${encodeURIComponent(activeResolution)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Chart request failed (${response.status})`);
        return (await response.json()) as ChartData;
      })
      .then((data) => {
        if (cancelled) return;
        setChartCache((cache) => ({ ...cache, [activeKey]: data }));
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Chart request failed");
      })
      .finally(() => {
        if (!cancelled) setLoadingKey((key) => (key === activeKey ? null : key));
      });
    return () => {
      cancelled = true;
    };
  }, [activeKey, activeResolution, chartCache, initialChart, range, universeId]);

  return (
    <Card className={cn("overflow-hidden rounded-lg border-border/70 bg-surface/80 shadow-none", compact ? "min-h-[230px]" : "min-h-[360px]")}>
      <CardHeader className="flex flex-col gap-3 border-b border-border/60 p-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-accent" aria-hidden />
            <CardTitle className="m-0 text-base font-semibold text-foreground">{title}</CardTitle>
          </div>
          {subtitle ? <p className="mt-1 text-xs font-medium text-muted">{subtitle}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          {!compact ? (
            <Tabs value={metric} onValueChange={(value) => setMetric(value as MetricKey)}>
              <TabsList className={chartTabsListClass}>
                {(["players", "visits", "favorites", "rating"] as MetricKey[]).map((item) => (
                  <TabsTrigger key={item} value={item} className={chartTabsTriggerClass}>
                    {metricLabels[item]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : null}
          {initialChart ? (
            <Tabs value={range} onValueChange={(value) => setRange(value as RangeKey)}>
              <TabsList className={chartTabsListClass}>
                {(["24h", "7d", "30d", "90d", "all"] as RangeKey[]).map((item) => (
                  <TabsTrigger key={item} value={item} className={chartTabsTriggerClass}>
                    {item === "all" ? "All" : item}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {!hasRenderableData ? (
          <div className={cn("flex items-center justify-center rounded-lg border border-dashed border-border/70 bg-background/35 text-center", compact ? "h-[190px]" : "h-[300px]")}>
            <div className="max-w-sm px-6">
              <Activity className="mx-auto h-5 w-5 text-muted" aria-hidden />
              <p className="mt-3 text-sm font-semibold text-foreground">{isLoading ? "Loading chart" : "Not enough history yet"}</p>
              <p className="mt-1 text-xs text-muted">{loadError ?? "This chart needs a few history samples before it can render cleanly."}</p>
            </div>
          </div>
        ) : (
          <div className="relative">
            <ChartContainer config={metricConfig} className={compact ? "h-[190px] w-full min-w-0" : "h-[300px] w-full min-w-0"}>
              <Chart data={chartPoints} margin={{ left: 0, right: 8, top: 10, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="axisLabel" tickLine={false} axisLine={false} minTickGap={24} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} width={42} tickFormatter={axisTick} />
                <ChartTooltip cursor={false} content={<StatsTooltip metric={metric} />} />
                {area ? (
                  <Area
                    type="monotone"
                    dataKey={metric}
                    stroke={`var(--color-${metric})`}
                    fill={`var(--color-${metric})`}
                    fillOpacity={0.12}
                    strokeWidth={2.5}
                    dot={false}
                    name={metric}
                  />
                ) : (
                  <Line
                    type="monotone"
                    dataKey={metric}
                    stroke={`var(--color-${metric})`}
                    strokeWidth={2.5}
                    dot={false}
                    name={metric}
                    activeDot={{ r: 4 }}
                  />
                )}
              </Chart>
            </ChartContainer>
            {isShowingPreviousChart ? (
              <div className="pointer-events-none absolute right-2 top-2 rounded-md border border-border/70 bg-background/85 px-2 py-1 text-[11px] font-semibold text-muted shadow-sm">
                Loading
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
