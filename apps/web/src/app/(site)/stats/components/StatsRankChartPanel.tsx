"use client";

import { useEffect, useMemo, useState } from "react";
import { Line } from "recharts/es6/cartesian/Line";
import { CartesianGrid } from "recharts/es6/cartesian/CartesianGrid";
import { XAxis } from "recharts/es6/cartesian/XAxis";
import { YAxis } from "recharts/es6/cartesian/YAxis";
import { LineChart } from "recharts/es6/chart/LineChart";
import { ReferenceArea, ReferenceLine } from "recharts";
import { Activity, CalendarDays, Maximize2, Minimize2, RefreshCw, RotateCcw, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCompactNumber } from "@/lib/stats-format";

type RankScopeKey = "global" | "genre" | "subgenre";
type RangeKey = "1d" | "7d" | "14d" | "30d" | "90d";
type ResolutionKey = "hourly" | "daily" | "weekly" | "monthly";

type RankPoint = {
  label: string;
  tooltipLabel?: string;
  sampledAt: string;
  globalRank: number | null;
  genreRank: number | null;
  subgenreRank: number | null;
  globalPlayers: number | null;
  genrePlayers: number | null;
  subgenrePlayers: number | null;
  samples: number | null;
};

type RankPointForRender = RankPoint & {
  previousValue?: number | null;
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

type RankSummary = {
  key: RankScopeKey;
  label: string;
  scopeLabel: string | null;
  currentRank: number | null;
  currentAt: string | null;
  bestRank: number | null;
  bestAt: string | null;
  firstTop1At: string | null;
  lastTop1At: string | null;
  lastExitedTop1At: string | null;
  firstTop10At: string | null;
  lastExitedTop10At: string | null;
  sampleCount: number;
};

type RankChartData = {
  range: RangeKey;
  requestedResolution: ResolutionKey;
  resolution: ResolutionKey;
  points: RankPoint[];
  previousPoints?: RankPoint[];
  annotations?: ChartAnnotation[];
  summaries: RankSummary[];
};

const rankLabels: Record<RankScopeKey, string> = {
  global: "Global",
  genre: "Genre",
  subgenre: "Subgenre"
};

const rankConfig: ChartConfig = {
  globalRank: { label: "Global rank", color: "rgb(var(--color-accent))" },
  genreRank: { label: "Genre rank", color: "#38bdf8" },
  subgenreRank: { label: "Subgenre rank", color: "#f59e0b" }
};

const rankDataKeys: Record<RankScopeKey, keyof RankPoint> = {
  global: "globalRank",
  genre: "genreRank",
  subgenre: "subgenreRank"
};

const rankPlayerKeys: Record<RankScopeKey, keyof RankPoint> = {
  global: "globalPlayers",
  genre: "genrePlayers",
  subgenre: "subgenrePlayers"
};

const rankColors: Record<RankScopeKey, string> = {
  global: "var(--color-globalRank)",
  genre: "var(--color-genreRank)",
  subgenre: "var(--color-subgenreRank)"
};

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

function rankCacheKey(range: RangeKey, resolution: ResolutionKey, previous: boolean) {
  return `${range}:${resolution}:${previous ? "previous" : "current"}`;
}

function formatRank(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? `#${value.toLocaleString("en-US")}` : "Not tracked";
}

function isTrackedRank(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value);
}

function scopeTabLabel(scope: RankScopeKey, summaries: RankSummary[]) {
  if (scope === "global") return "Global";
  const scopeName = summaries.find((summary) => summary.key === scope)?.scopeLabel?.trim();
  if (!scopeName) return rankLabels[scope];
  return scope === "genre" ? `${scopeName} [genre]` : `${scopeName} [sub genre]`;
}

function formatDate(value?: string | null) {
  if (!value) return "Not tracked";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not tracked";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", hour12: true, timeZone: "UTC" });
}

function formatAxisTick(sampledAt: string, range: RangeKey) {
  const date = new Date(sampledAt);
  if (!Number.isFinite(date.getTime())) return sampledAt;
  if (range === "1d") {
    return date.toLocaleTimeString("en-US", { hour: "numeric", hour12: true });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function usablePointCount(points: RankPoint[], scope: RankScopeKey) {
  const key = rankDataKeys[scope];
  return points.filter((point) => typeof point[key] === "number").length;
}

function rankDomain(points: RankPointForRender[], scope: RankScopeKey, startsAtOne: boolean): [number, number] {
  const key = rankDataKeys[scope];
  const values = points
    .flatMap((point) => [point[key], point.previousValue])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!values.length) return [1, 10];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max(1, Math.ceil((max - min) * 0.16));
  return [startsAtOne ? 1 : Math.max(1, min - padding), max + padding];
}

function closestSampledAt(points: RankPoint[], value: string) {
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

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function StatsRankTooltip({
  active,
  payload,
  scope
}: {
  active?: boolean;
  payload?: Array<{ color?: string; name?: string; value?: unknown; dataKey?: string | number; payload?: Partial<RankPoint> }>;
  scope: RankScopeKey;
}) {
  if (!active || !payload?.length) return null;
  const visiblePayload = payload.filter((item) => item.value != null && Number.isFinite(Number(item.value)));
  if (!visiblePayload.length) return null;
  const item = visiblePayload[0];
  const point = item.payload;
  const playersValue = point?.[rankPlayerKeys[scope]];
  const players = typeof playersValue === "number" ? playersValue : null;
  return (
    <div className="grid min-w-[11rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{point?.tooltipLabel ?? point?.sampledAt ?? ""}</div>
      {visiblePayload.map((entry) => {
        const rank = typeof entry.value === "number" ? entry.value : Number(entry.value);
        return (
          <div key={String(entry.dataKey ?? entry.name)} className="flex w-full items-center gap-2">
            <span className="h-3 w-1 shrink-0 rounded-[2px]" style={{ backgroundColor: entry.color ?? rankColors[scope] }} />
            <span className="text-muted-foreground">{entry.name ?? `${rankLabels[scope]} rank`}</span>
            <span className="ml-auto font-mono font-medium tabular-nums text-foreground">{formatRank(Number.isFinite(rank) ? rank : null)}</span>
          </div>
        );
      })}
      <div className="flex w-full items-center gap-2 text-muted-foreground">
        <span>Playing</span>
        <span className="ml-auto font-mono tabular-nums text-foreground">{formatCompactNumber(players)}</span>
      </div>
    </div>
  );
}

function RankSummaryCard({ summary }: { summary: RankSummary }) {
  const title = summary.key === "global" ? "Global rank" : summary.scopeLabel ? `${summary.scopeLabel} rank` : `${summary.label} rank`;
  const eyebrow = summary.key === "global" ? "All tracked games" : summary.key === "genre" ? "Genre" : "Subgenre";
  const hasCurrentRank = isTrackedRank(summary.currentRank);
  const hasBestRank = isTrackedRank(summary.bestRank);
  return (
    <div className="min-w-0 rounded-lg border border-border/60 bg-background/45 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{eyebrow}</p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">{title}</p>
        </div>
        <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium text-muted">Current</p>
          <p
            className={
              hasCurrentRank
                ? "mt-0.5 font-mono text-3xl font-semibold leading-none tracking-normal text-foreground"
                : "mt-1 text-sm font-semibold leading-tight text-muted-foreground"
            }
          >
            {formatRank(summary.currentRank)}
          </p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[11px] font-medium text-muted">Best</p>
          <p className={hasBestRank ? "mt-0.5 font-mono text-base font-semibold text-foreground" : "mt-1 text-sm font-semibold leading-tight text-muted-foreground"}>
            {formatRank(summary.bestRank)}
          </p>
          {hasBestRank ? <p className="mt-0.5 truncate text-[11px] text-muted">{formatDate(summary.bestAt)}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function StatsRankChartPanel({
  title,
  universeId,
  initialChart
}: {
  title: string;
  universeId: number;
  initialChart: RankChartData;
}) {
  const [scope, setScope] = useState<RankScopeKey>("global");
  const [range, setRange] = useState<RangeKey>(initialChart.range ?? "1d");
  const [resolution, setResolution] = useState<ResolutionKey>(initialChart.requestedResolution ?? "hourly");
  const [showPrevious, setShowPrevious] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const [showUpdates, setShowUpdates] = useState(false);
  const [chartCache, setChartCache] = useState<Record<string, RankChartData>>(() => ({
    [rankCacheKey(initialChart.range, initialChart.requestedResolution, false)]: initialChart
  }));
  const [lastRenderedChart, setLastRenderedChart] = useState<RankChartData>(initialChart);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [startsAtOne, setStartsAtOne] = useState(false);
  const activeKey = rankCacheKey(range, resolution, showPrevious);
  const loadedChart = chartCache[activeKey];
  const displayChart = loadedChart ?? lastRenderedChart;
  const points = displayChart.points;
  const previousPoints = displayChart.previousPoints ?? [];
  const annotations = displayChart.annotations ?? [];
  const eventAnnotations = annotations.filter((annotation) => annotation.type === "event");
  const updateAnnotations = annotations.filter((annotation) => annotation.type === "update");
  const summaries = displayChart.summaries;
  const activePointCount = usablePointCount(points, scope);
  const hasRenderableData = activePointCount >= 1;
  const dataKey = rankDataKeys[scope];
  const isLoading = loadingKey === activeKey;
  const isShowingPreviousChart = Boolean(isLoading && !loadedChart && hasRenderableData);
  const chartPoints = useMemo<RankPointForRender[]>(
    () =>
      points.map((point, index) => ({
        ...point,
        previousValue: numberValue(previousPoints[index]?.[dataKey])
      })),
    [dataKey, points, previousPoints]
  );
  const yDomain = useMemo(() => rankDomain(chartPoints, scope, startsAtOne), [chartPoints, scope, startsAtOne]);

  useEffect(() => {
    if (loadedChart) setLastRenderedChart(loadedChart);
  }, [loadedChart]);

  useEffect(() => {
    if (chartCache[activeKey]) return;
    let cancelled = false;
    setLoadingKey(activeKey);
    setLoadError(null);
    const params = new URLSearchParams({
      range,
      resolution,
      annotations: "1"
    });
    if (showPrevious) params.set("previous", "1");
    fetch(`/api/stats/games/${universeId}/rank-chart?${params.toString()}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Rank chart request failed (${response.status})`);
        return (await response.json()) as RankChartData;
      })
      .then((data) => {
        if (cancelled) return;
        setChartCache((cache) => ({ ...cache, [activeKey]: data }));
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Rank chart request failed");
      })
      .finally(() => {
        if (!cancelled) setLoadingKey((key) => (key === activeKey ? null : key));
      });
    return () => {
      cancelled = true;
    };
  }, [activeKey, chartCache, range, resolution, showPrevious, universeId]);

  return (
    <Card className="overflow-hidden rounded-lg border-border/70 bg-surface/80 shadow-none">
      <CardHeader className="flex flex-col gap-3 border-b border-border/60 p-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-accent" aria-hidden />
            <CardTitle className="m-0 text-base font-semibold text-foreground">{title}</CardTitle>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <Tabs value={scope} onValueChange={(value) => setScope(value as RankScopeKey)}>
            <TabsList className={chartTabsListClass}>
              {(["global", "genre", "subgenre"] as RankScopeKey[]).map((item) => (
                <TabsTrigger key={item} value={item} className={chartTabsTriggerClass}>
                  {scopeTabLabel(item, summaries)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Tabs value={range} onValueChange={(value) => setRange(value as RangeKey)}>
            <TabsList className={chartTabsListClass}>
              {(["1d", "7d", "14d", "30d", "90d"] as RangeKey[]).map((item) => (
                <TabsTrigger key={item} value={item} className={chartTabsTriggerClass}>
                  {item}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {!hasRenderableData ? (
          <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-border/70 bg-background/35 text-center">
            <div className="max-w-sm px-6">
              <Activity className="mx-auto h-5 w-5 text-muted" aria-hidden />
              <p className="mt-3 text-sm font-semibold text-foreground">{isLoading ? "Loading rank history" : "Not enough rank history yet"}</p>
              <p className="mt-1 text-xs text-muted">{loadError ?? "This chart appears after rank snapshots are collected for this game."}</p>
            </div>
          </div>
        ) : (
          <div className="relative">
            <ChartContainer config={rankConfig} className="h-[280px] w-full min-w-0">
              <LineChart data={chartPoints} margin={{ left: 0, right: 8, top: 10, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="sampledAt"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                  tickMargin={8}
                  tickFormatter={(value: unknown) => formatAxisTick(String(value), range)}
                />
                <YAxis
                  reversed
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={42}
                  domain={yDomain}
                  allowDecimals={false}
                  tickFormatter={(value: unknown) => formatRank(Number(value))}
                />
                <ChartTooltip cursor={false} content={<StatsRankTooltip scope={scope} />} />
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
                      />
                    ))
                  : null}
                <Line
                  type="linear"
                  dataKey={dataKey}
                  stroke={rankColors[scope]}
                  strokeWidth={2.5}
                  dot={activePointCount === 1 ? { r: 4 } : false}
                  name={`${rankLabels[scope]} rank`}
                  activeDot={{ r: 4 }}
                />
                {showPrevious ? (
                  <Line
                    type="linear"
                    dataKey="previousValue"
                    stroke={rankColors[scope]}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    strokeOpacity={0.6}
                    dot={false}
                    name="Previous period"
                    activeDot={{ r: 3 }}
                  />
                ) : null}
              </LineChart>
            </ChartContainer>
            {isShowingPreviousChart ? (
              <div className="pointer-events-none absolute right-2 top-2 rounded-md border border-border/70 bg-background/85 px-2 py-1 text-[11px] font-semibold text-muted shadow-sm">
                Loading
              </div>
            ) : null}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <TooltipProvider delayDuration={120}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-pressed={showPrevious}
                  aria-label={showPrevious ? "Hide previous period" : "Show previous period"}
                  className={`h-8 w-8 rounded-md border-border/70 bg-background/80 text-muted shadow-none ${showPrevious ? "bg-accent text-accent-foreground hover:bg-accent/90 hover:text-accent-foreground" : ""}`}
                  onClick={() => setShowPrevious((value) => !value)}
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{showPrevious ? "Hide previous period" : "Show previous period"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {eventAnnotations.length ? (
            <TooltipProvider delayDuration={120}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-pressed={showEvents}
                    aria-label={showEvents ? "Hide events" : "Show events"}
                    className={`h-8 w-8 rounded-md border-border/70 bg-background/80 text-muted shadow-none ${showEvents ? "bg-accent text-accent-foreground hover:bg-accent/90 hover:text-accent-foreground" : ""}`}
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
            <TooltipProvider delayDuration={120}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-pressed={showUpdates}
                    aria-label={showUpdates ? "Hide updates" : "Show updates"}
                    className={`h-8 w-8 rounded-md border-border/70 bg-background/80 text-muted shadow-none ${showUpdates ? "bg-accent text-accent-foreground hover:bg-accent/90 hover:text-accent-foreground" : ""}`}
                    onClick={() => setShowUpdates((value) => !value)}
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">{showUpdates ? "Hide updates" : "Show updates"}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
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
          <TooltipProvider delayDuration={120}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-md border-border/70 bg-background/80 text-muted shadow-none hover:bg-secondary/70 hover:text-foreground"
                  aria-label={startsAtOne ? "Focus rank range" : "Start rank axis at #1"}
                  onClick={() => setStartsAtOne((value) => !value)}
                >
                  {startsAtOne ? <Minimize2 className="h-3.5 w-3.5" aria-hidden /> : <Maximize2 className="h-3.5 w-3.5" aria-hidden />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{startsAtOne ? "Focus rank range" : "Start rank axis at #1"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {(["global", "genre", "subgenre"] as RankScopeKey[])
            .map((key) => summaries.find((summary) => summary.key === key))
            .filter((summary): summary is RankSummary => Boolean(summary))
            .map((summary) => (
              <RankSummaryCard key={summary.key} summary={summary} />
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
