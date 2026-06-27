"use client";

import { useEffect, useMemo, useState } from "react";
import { Area } from "recharts/es6/cartesian/Area";
import { CartesianGrid } from "recharts/es6/cartesian/CartesianGrid";
import { Line } from "recharts/es6/cartesian/Line";
import { XAxis } from "recharts/es6/cartesian/XAxis";
import { YAxis } from "recharts/es6/cartesian/YAxis";
import { AreaChart } from "recharts/es6/chart/AreaChart";
import { LineChart } from "recharts/es6/chart/LineChart";
import { ReferenceArea, ReferenceLine } from "recharts";
import { Activity, BarChart3, CalendarDays, GitCompare, Maximize2, Minimize2, Plus, RefreshCw, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCompactNumber, formatPercent } from "@/lib/stats-format";
import { cn } from "@/lib/utils";

type ChartPoint = {
  label: string;
  tooltipLabel?: string;
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
  chartResolution: ResolutionKey;
  tooltipLabel: string;
  previousValue?: number | null;
  comparison0Value?: number | null;
  comparison1Value?: number | null;
};

type MetricKey = "players" | "visits" | "favorites" | "rating";
type RangeKey = "1d" | "7d" | "14d" | "30d" | "90d";
type ResolutionKey = "hourly" | "daily" | "weekly" | "monthly";
const defaultChartRange: RangeKey = "14d";
const defaultChartResolution: ResolutionKey = "hourly";

type ChartData = {
  range: RangeKey;
  requestedResolution: ResolutionKey;
  resolution: ResolutionKey;
  points: ChartPoint[];
  previousPoints?: ChartPoint[];
  comparisons?: ChartComparison[];
  annotations?: ChartAnnotation[];
};

type ChartAnnotation = {
  type: "event" | "update";
  id: string;
  label: string;
  startAt: string;
  endAt: string | null;
  status: string | null;
  href: string | null;
  source: string | null;
};

type ChartComparison = {
  universeId: number;
  name: string;
  slug: string;
  iconUrl: string | null;
  points: ChartPoint[];
};

type SearchResult = {
  universeId: number;
  name: string;
  slug: string;
  iconUrl: string | null;
  playing: number | null;
  visits: number | null;
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

const metricKeys: MetricKey[] = ["players", "visits", "favorites", "rating"];
const comparisonColors = ["#ec4899", "#14b8a6"] as const;

const resolutionLabels: Record<ResolutionKey, string> = {
  hourly: "Hourly",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly"
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

function formatAxisTick(sampledAt: string, range: RangeKey) {
  const date = new Date(sampledAt);
  if (!Number.isFinite(date.getTime())) return sampledAt;
  if (range === "1d") {
    return date.toLocaleTimeString("en-US", { hour: "numeric", hour12: true });
  }
  if (range === "90d") {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTooltipTimestamp(sampledAt: string, resolution: ResolutionKey) {
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
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function StatsTooltip({
  active,
  payload,
  metric
}: {
  active?: boolean;
  payload?: Array<{ color?: string; name?: string; value?: unknown; dataKey?: string | number; payload?: Partial<ChartPointForRender> }>;
  metric: MetricKey;
}) {
  if (!active || !payload?.length) return null;
  const visiblePayload = payload.filter((item) => item.value != null && Number.isFinite(Number(item.value)));
  if (!visiblePayload.length) return null;
  const item = visiblePayload[0];
  const point = item.payload;
  const label = point?.tooltipLabel ?? point?.sampledAt ?? "";
  return (
    <div className="grid min-w-[10rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{label}</div>
      {visiblePayload.map((entry) => {
        const value = typeof entry.value === "number" ? entry.value : Number(entry.value);
        return (
          <div key={String(entry.dataKey ?? entry.name)} className="flex w-full items-center gap-2">
            <span className="h-3 w-1 shrink-0 rounded-[2px]" style={{ backgroundColor: entry.color ?? `var(--color-${metric})` }} />
            <span className="text-muted-foreground">{entry.name ?? metricLabels[metric]}</span>
            <span className="ml-auto font-mono font-medium tabular-nums text-foreground">{formatMetricValue(metric, Number.isFinite(value) ? value : null)}</span>
          </div>
        );
      })}
    </div>
  );
}

function chartCacheKey(range: RangeKey, resolution: ResolutionKey, previous: boolean, compareIds: number[]) {
  return `${range}:${resolution}:${previous ? "previous" : "current"}:${compareIds.join(",")}`;
}

function usablePointCount(points: ChartPoint[], metric: MetricKey) {
  return points.filter((point) => typeof point[metric] === "number").length;
}

function chartDomain(points: ChartPointForRender[], metric: MetricKey, startsAtZero: boolean): [number | "auto", number | "auto"] {
  if (startsAtZero) return metric === "rating" ? [0, 100] : [0, "auto"];

  const values = points
    .flatMap((point) => [point[metric], point.previousValue, point.comparison0Value, point.comparison1Value])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (!values.length) return ["auto", "auto"];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min;
  const padding = spread > 0 ? spread * 0.12 : metric === "rating" ? 1 : Math.max(Math.abs(max) * 0.02, 1);
  const lower = metric === "rating" ? Math.max(0, min - padding) : Math.max(0, min - padding);
  const upper = metric === "rating" ? Math.min(100, max + padding) : max + padding;

  return [lower, upper];
}

function closestSampledAt(points: ChartPointForRender[], value: string) {
  const target = Date.parse(value);
  if (!Number.isFinite(target) || !points.length) return value;
  let closest = points[0]?.sampledAt ?? value;
  let closestDiff = Math.abs(Date.parse(closest) - target);
  for (const point of points) {
    const diff = Math.abs(Date.parse(point.sampledAt) - target);
    if (Number.isFinite(diff) && diff < closestDiff) {
      closest = point.sampledAt;
      closestDiff = diff;
    }
  }
  return closest;
}

function compactAnnotationLabel(annotation: ChartAnnotation) {
  return annotation.type === "update" ? "Update" : annotation.label;
}

export function StatsChartPanel({
  title,
  subtitle,
  chart,
  initialChart,
  universeId,
  chartEndpoint,
  defaultMetric = "players",
  defaultRange,
  compact = false,
  area = false
}: {
  title: string;
  subtitle?: string | null;
  chart?: ChartPoint[];
  initialChart?: ChartData;
  universeId?: number;
  chartEndpoint?: string;
  defaultMetric?: MetricKey;
  defaultRange?: RangeKey;
  compact?: boolean;
  area?: boolean;
}) {
  const initialRange = defaultRange ?? initialChart?.range ?? defaultChartRange;
  const [metric, setMetric] = useState<MetricKey>(defaultMetric);
  const [range, setRange] = useState<RangeKey>(initialRange);
  const [resolution, setResolution] = useState<ResolutionKey>(initialChart?.requestedResolution ?? defaultChartResolution);
  const [showPrevious, setShowPrevious] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const [showUpdates, setShowUpdates] = useState(false);
  const [selectedComparisons, setSelectedComparisons] = useState<ChartComparison[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareQuery, setCompareQuery] = useState("");
  const [compareResults, setCompareResults] = useState<SearchResult[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [chartCache, setChartCache] = useState<Record<string, ChartData>>(() =>
    initialChart ? { [chartCacheKey(initialChart.range, initialChart.requestedResolution, false, [])]: initialChart } : {}
  );
  const [lastRenderedChart, setLastRenderedChart] = useState<ChartData | undefined>(initialChart);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [startsAtZero, setStartsAtZero] = useState(false);
  const compareIds = useMemo(() => selectedComparisons.map((item) => item.universeId).sort((a, b) => a - b), [selectedComparisons]);
  const resolvedChartEndpoint = chartEndpoint ?? (universeId ? `/api/stats/games/${universeId}/chart` : null);
  const initialChartKey = initialChart ? chartCacheKey(initialChart.range, initialChart.requestedResolution, false, []) : null;
  const activeKey = chartCacheKey(range, resolution, showPrevious, compareIds);
  const loadedChart = chartCache[activeKey] ?? (initialChartKey === activeKey ? initialChart : undefined);
  const displayChart = loadedChart ?? lastRenderedChart;
  const points = useMemo(() => (initialChart ? displayChart?.points ?? [] : chart ?? []), [chart, displayChart, initialChart]);
  const previousPoints = displayChart?.previousPoints ?? [];
  const comparisons = displayChart?.comparisons ?? [];
  const annotations = displayChart?.annotations ?? [];
  const eventAnnotations = annotations.filter((annotation) => annotation.type === "event");
  const updateAnnotations = annotations.filter((annotation) => annotation.type === "update");
  const usableMetrics = useMemo(
    () => new Set(metricKeys.filter((item) => usablePointCount(points, item) >= 1)),
    [points]
  );
  const hasRenderableData = usablePointCount(points, metric) >= 1;
  const Chart = area ? AreaChart : LineChart;
  const resolvedResolution = displayChart?.resolution ?? resolution;
  const activePointCount = usablePointCount(points, metric);
  const chartPoints = useMemo<ChartPointForRender[]>(
    () =>
      points.map((point, index) => ({
        ...point,
        chartResolution: resolvedResolution,
        tooltipLabel: formatTooltipTimestamp(point.sampledAt, resolvedResolution),
        previousValue: previousPoints[index]?.[metric] ?? null,
        comparison0Value: comparisons[0]?.points[index]?.[metric] ?? null,
        comparison1Value: comparisons[1]?.points[index]?.[metric] ?? null
      })),
    [comparisons, metric, points, previousPoints, resolvedResolution]
  );
  const isLoading = loadingKey === activeKey;
  const isShowingPreviousChart = Boolean(isLoading && !loadedChart && hasRenderableData);
  const yDomain = useMemo(() => chartDomain(chartPoints, metric, startsAtZero), [chartPoints, metric, startsAtZero]);

  useEffect(() => {
    if (loadedChart) {
      setLastRenderedChart(loadedChart);
    }
  }, [loadedChart]);

  useEffect(() => {
    if (usableMetrics.has(metric)) return;
    const fallbackMetric = metricKeys.find((item) => usableMetrics.has(item));
    if (fallbackMetric) {
      setMetric(fallbackMetric);
    }
  }, [metric, usableMetrics]);

  useEffect(() => {
    if (!initialChart || !resolvedChartEndpoint || chartCache[activeKey]) return;
    let cancelled = false;
    setLoadingKey(activeKey);
    setLoadError(null);
    const params = new URLSearchParams({
      range,
      resolution,
      annotations: "1"
    });
    if (showPrevious) params.set("previous", "1");
    if (compareIds.length) params.set("compare", compareIds.join(","));
    fetch(`${resolvedChartEndpoint}?${params.toString()}`)
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
  }, [activeKey, chartCache, compareIds, initialChart, range, resolution, resolvedChartEndpoint, showPrevious]);

  useEffect(() => {
    if (!compareOpen || !universeId || compareQuery.trim().length < 2) {
      setCompareResults([]);
      return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setCompareLoading(true);
      const exclude = [universeId, ...selectedComparisons.map((item) => item.universeId)].join(",");
      const params = new URLSearchParams({ q: compareQuery.trim(), exclude });
      fetch(`/api/stats/games/search?${params.toString()}`)
        .then(async (response) => {
          if (!response.ok) throw new Error(`Search failed (${response.status})`);
          return (await response.json()) as { games?: SearchResult[] };
        })
        .then((data) => {
          if (!cancelled) setCompareResults(data.games ?? []);
        })
        .catch(() => {
          if (!cancelled) setCompareResults([]);
        })
        .finally(() => {
          if (!cancelled) setCompareLoading(false);
        });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [compareOpen, compareQuery, selectedComparisons, universeId]);

  function addComparison(game: SearchResult) {
    if (selectedComparisons.some((item) => item.universeId === game.universeId) || selectedComparisons.length >= 2) return;
    setSelectedComparisons((items) => [
      ...items,
      {
        universeId: game.universeId,
        name: game.name,
        slug: game.slug,
        iconUrl: game.iconUrl,
        points: []
      }
    ]);
    setCompareQuery("");
    setCompareOpen(false);
  }

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
                {metricKeys.map((item) => (
                  <TabsTrigger key={item} value={item} disabled={!usableMetrics.has(item)} className={chartTabsTriggerClass}>
                    {metricLabels[item]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : null}
          {initialChart ? (
            <Tabs value={range} onValueChange={(value) => setRange(value as RangeKey)}>
              <TabsList className={chartTabsListClass}>
                {(["1d", "7d", "14d", "30d", "90d"] as RangeKey[]).map((item) => (
                  <TabsTrigger key={item} value={item} className={chartTabsTriggerClass}>
                    {item}
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
                <XAxis
                  dataKey="sampledAt"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                  tickMargin={8}
                  tickFormatter={(value: unknown) => formatAxisTick(String(value), range)}
                />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} width={42} domain={yDomain} tickFormatter={axisTick} />
                <ChartTooltip cursor={false} content={<StatsTooltip metric={metric} />} />
                {showEvents
                  ? eventAnnotations.map((annotation) => {
                      const startAt = closestSampledAt(chartPoints, annotation.startAt);
                      const endAt = annotation.endAt ? closestSampledAt(chartPoints, annotation.endAt) : null;
                      if (endAt && endAt !== startAt) {
                        return (
                          <ReferenceArea
                            key={annotation.id}
                            x1={startAt}
                            x2={endAt}
                            fill="rgb(var(--color-accent))"
                            fillOpacity={0.08}
                            strokeOpacity={0}
                          />
                        );
                      }
                      return (
                        <ReferenceLine
                          key={annotation.id}
                          x={startAt}
                          stroke="rgb(var(--color-accent))"
                          strokeDasharray="3 3"
                          strokeOpacity={0.45}
                        />
                      );
                    })
                  : null}
                {showUpdates
                  ? updateAnnotations.map((annotation) => (
                      <ReferenceLine
                        key={annotation.id}
                        x={closestSampledAt(chartPoints, annotation.startAt)}
                        stroke="#f59e0b"
                        strokeDasharray="2 4"
                        strokeOpacity={0.6}
                        label={{ value: compactAnnotationLabel(annotation), position: "top", fill: "#f59e0b", fontSize: 10 }}
                      />
                    ))
                  : null}
                {area ? (
                  <Area
                    type="monotone"
                    dataKey={metric}
                    stroke={`var(--color-${metric})`}
                    fill={`var(--color-${metric})`}
                    fillOpacity={0.12}
                    strokeWidth={2.5}
                    dot={activePointCount === 1 ? { r: 4 } : false}
                    name={metric}
                  />
                ) : (
                  <>
                    <Line
                      type="monotone"
                      dataKey={metric}
                      stroke={`var(--color-${metric})`}
                      strokeWidth={2.5}
                      dot={activePointCount === 1 ? { r: 4 } : false}
                      name={metricLabels[metric]}
                      activeDot={{ r: 4 }}
                    />
                    {showPrevious ? (
                      <Line
                        type="monotone"
                        dataKey="previousValue"
                        stroke={`var(--color-${metric})`}
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        strokeOpacity={0.6}
                        dot={false}
                        name="Previous period"
                        activeDot={{ r: 3 }}
                      />
                    ) : null}
                    {comparisons[0] ? (
                      <Line
                        type="monotone"
                        dataKey="comparison0Value"
                        stroke={comparisonColors[0]}
                        strokeWidth={2}
                        dot={false}
                        name={comparisons[0].name}
                        activeDot={{ r: 3 }}
                      />
                    ) : null}
                    {comparisons[1] ? (
                      <Line
                        type="monotone"
                        dataKey="comparison1Value"
                        stroke={comparisonColors[1]}
                        strokeWidth={2}
                        dot={false}
                        name={comparisons[1].name}
                        activeDot={{ r: 3 }}
                      />
                    ) : null}
                  </>
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
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          {initialChart && universeId ? (
            <Popover open={compareOpen} onOpenChange={setCompareOpen}>
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={selectedComparisons.length >= 2}
                        aria-label="Compare games"
                        className="h-8 rounded-md border-border/70 bg-background/80 px-2.5 text-xs font-semibold text-muted shadow-none"
                      >
                        <span>Compare games</span>
                        <GitCompare className="ml-1.5 h-3.5 w-3.5" aria-hidden />
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top">Compare games</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <PopoverContent align="end" className="w-[300px] p-2">
                <Input
                  value={compareQuery}
                  onChange={(event) => setCompareQuery(event.target.value)}
                  placeholder="Search games"
                  className="h-9 rounded-md border-border/70 bg-background text-sm shadow-none"
                />
                <div className="mt-2 max-h-[260px] overflow-y-auto">
                  {compareQuery.trim().length < 2 ? (
                    <p className="px-2 py-4 text-center text-xs text-muted">Type at least 2 characters</p>
                  ) : compareLoading ? (
                    <p className="px-2 py-4 text-center text-xs text-muted">Searching...</p>
                  ) : compareResults.length ? (
                    <div className="space-y-1">
                      {compareResults.map((game) => (
                      <button
                        key={game.universeId}
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-foreground hover:bg-secondary/70"
                        onClick={() => addComparison(game)}
                      >
                        <Plus className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                        {game.iconUrl ? (
                          <img
                            src={game.iconUrl}
                            alt=""
                            loading="lazy"
                            className="h-8 w-8 shrink-0 rounded-md border border-border/60 bg-surface object-cover"
                          />
                        ) : (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-secondary/60 text-xs font-semibold text-muted">
                            {game.name.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0 flex-1 truncate">{game.name}</span>
                        <span className="font-mono text-[11px] text-muted">{formatCompactNumber(game.playing)}</span>
                      </button>
                      ))}
                    </div>
                  ) : (
                    <p className="px-2 py-4 text-center text-xs text-muted">No games found</p>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          ) : null}
          {selectedComparisons.map((item, index) => (
            <span key={item.universeId} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/70 bg-background/80 px-2 text-xs font-semibold text-muted">
              <span className="h-4 w-1.5 shrink-0 rounded-[2px]" style={{ backgroundColor: comparisonColors[index] ?? comparisonColors[0] }} aria-hidden />
              {item.name}
              <button
                type="button"
                className="rounded-sm text-muted hover:text-foreground"
                aria-label={`Remove ${item.name} comparison`}
                onClick={() => setSelectedComparisons((items) => items.filter((candidate) => candidate.universeId !== item.universeId))}
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ))}
          {initialChart ? (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    aria-pressed={showPrevious}
                    aria-label={showPrevious ? "Hide previous period" : "Show previous period"}
                    className={cn(
                      "h-8 rounded-md border-border/70 bg-background/80 px-2.5 text-xs font-semibold text-muted shadow-none",
                      showPrevious && "bg-accent text-accent-foreground hover:bg-accent/90 hover:text-accent-foreground"
                    )}
                    onClick={() => setShowPrevious((value) => !value)}
                  >
                    <span>Compare previous</span>
                    <RotateCcw className="ml-1.5 h-3.5 w-3.5" aria-hidden />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">{showPrevious ? "Hide previous period" : "Show previous period"}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
          {eventAnnotations.length ? (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-pressed={showEvents}
                    aria-label={showEvents ? "Hide events" : "Show events"}
                    className={cn(
                      "h-8 w-8 rounded-md border-border/70 bg-background/80 text-muted shadow-none",
                      showEvents && "bg-accent text-accent-foreground hover:bg-accent/90 hover:text-accent-foreground"
                    )}
                    onClick={() => setShowEvents((value) => !value)}
                  >
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">{showEvents ? "Hide events" : "Show events"}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
          {updateAnnotations.length ? (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-pressed={showUpdates}
                    aria-label={showUpdates ? "Hide updates" : "Show updates"}
                    className={cn(
                      "h-8 w-8 rounded-md border-border/70 bg-background/80 text-muted shadow-none",
                      showUpdates && "bg-accent text-accent-foreground hover:bg-accent/90 hover:text-accent-foreground"
                    )}
                    onClick={() => setShowUpdates((value) => !value)}
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">{showUpdates ? "Hide updates" : "Show updates"}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
          {initialChart ? (
            <Select value={resolution} onValueChange={(value) => setResolution(value as ResolutionKey)}>
              <SelectTrigger className="h-8 w-[110px] rounded-md border-border/70 bg-background/80 text-xs font-semibold text-muted shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["hourly", "daily", "weekly", "monthly"] as ResolutionKey[]).map((item) => (
                  <SelectItem key={item} value={item}>
                    {resolutionLabels[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-pressed={startsAtZero}
                  aria-label={startsAtZero ? "Use zoomed y-axis" : "Start y-axis at zero"}
                  className="h-8 w-8 rounded-md border-border/70 bg-background/80 text-muted shadow-none"
                  onClick={() => setStartsAtZero((value) => !value)}
                >
                  {startsAtZero ? <Minimize2 className="h-3.5 w-3.5" aria-hidden /> : <Maximize2 className="h-3.5 w-3.5" aria-hidden />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{startsAtZero ? "Use zoomed y-axis" : "Start y-axis at zero"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}
