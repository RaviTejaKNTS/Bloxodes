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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  players: "Players",
  visits: "Visits",
  favorites: "Favorites",
  rating: "Rating"
};

const resolutionLabels: Record<ResolutionKey, string> = {
  auto: "Auto",
  hourly: "Hourly",
  daily: "Daily",
  monthly: "Monthly"
};

const metricConfig: ChartConfig = {
  players: { label: "Players", color: "rgb(var(--color-accent))" },
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

function latestValue(points: ChartPoint[], metric: MetricKey) {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const value = points[index]?.[metric];
    if (typeof value === "number") return value;
  }
  return null;
}

function rangeValue(points: ChartPoint[], metric: MetricKey) {
  const values = points.map((point) => point[metric]).filter((value): value is number => typeof value === "number");
  if (!values.length) return { peak: null, average: null };
  return {
    peak: Math.max(...values),
    average: values.reduce((sum, value) => sum + value, 0) / values.length
  };
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

function canUseResolution(range: RangeKey, resolution: ResolutionKey) {
  if (resolution === "auto") return true;
  if (resolution === "hourly") return range === "24h" || range === "7d" || range === "30d";
  if (resolution === "daily") return range !== "24h";
  return range === "90d" || range === "all";
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
  const [resolution, setResolution] = useState<ResolutionKey>(initialChart?.requestedResolution ?? "auto");
  const [chartCache, setChartCache] = useState<Record<string, ChartData>>(() =>
    initialChart ? { [chartCacheKey(initialChart.range, initialChart.requestedResolution)]: initialChart } : {}
  );
  const [lastRenderedChart, setLastRenderedChart] = useState<ChartData | undefined>(initialChart);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const initialChartKey = initialChart ? chartCacheKey(initialChart.range, initialChart.requestedResolution) : null;
  const activeResolution = canUseResolution(range, resolution) ? resolution : "auto";
  const activeKey = chartCacheKey(range, activeResolution);
  const loadedChart = chartCache[activeKey] ?? (initialChartKey === activeKey ? initialChart : undefined);
  const displayChart = loadedChart ?? lastRenderedChart;
  const points = useMemo(() => (initialChart ? displayChart?.points ?? [] : chart ?? []), [chart, displayChart, initialChart]);
  const current = latestValue(points, metric);
  const summary = rangeValue(points, metric);
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
    if (!canUseResolution(range, resolution)) {
      setResolution("auto");
    }
  }, [range, resolution]);

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
    <Card className={cn("overflow-hidden rounded-lg border-border/70 bg-surface/80 shadow-none", compact ? "min-h-[260px]" : "min-h-[420px]")}>
      <CardHeader className="flex flex-col gap-4 border-b border-border/60 p-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-accent" aria-hidden />
            <CardTitle className="m-0 text-base font-semibold text-foreground">{title}</CardTitle>
          </div>
          {subtitle ? <p className="mt-1 text-xs font-medium text-muted">{subtitle}</p> : null}
          <div className="mt-3 flex items-end gap-3">
            <p className="text-2xl font-semibold leading-none text-foreground">{formatMetricValue(metric, current)}</p>
            <p className="text-xs font-medium text-muted">{metricLabels[metric]}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 lg:items-end">
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
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
            {initialChart ? (
              <Select value={activeResolution} onValueChange={(value) => setResolution(value as ResolutionKey)}>
                <SelectTrigger className="h-9 w-full rounded-md border-border/70 bg-background/80 text-xs font-semibold text-muted shadow-none sm:w-[160px]">
                  <span className="mr-1 text-muted">Granularity</span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["auto", "hourly", "daily", "monthly"] as ResolutionKey[]).map((item) => (
                    <SelectItem key={item} value={item} disabled={!canUseResolution(range, item)}>
                      {resolutionLabels[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {!hasRenderableData ? (
          <div className={cn("flex items-center justify-center rounded-lg border border-dashed border-border/70 bg-background/35 text-center", compact ? "h-[190px]" : "h-[300px]")}>
            <div className="max-w-sm px-6">
              <Activity className="mx-auto h-5 w-5 text-muted" aria-hidden />
              <p className="mt-3 text-sm font-semibold text-foreground">{isLoading ? "Loading chart" : "Not enough history yet"}</p>
              <p className="mt-1 text-xs text-muted">{loadError ?? "The latest public stats are available, but this chart needs a few history samples."}</p>
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

        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border/60 pt-3 text-xs">
          <div>
            <p className="font-semibold text-foreground">{formatMetricValue(metric, summary.peak)}</p>
            <p className="text-muted">Peak</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">{formatMetricValue(metric, summary.average)}</p>
            <p className="text-muted">Average</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">{points.length}</p>
            <p className="text-muted">{resolvedResolution === "hourly" ? "Hours" : resolvedResolution === "daily" ? "Days" : "Months"}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
