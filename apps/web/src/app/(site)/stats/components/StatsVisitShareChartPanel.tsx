"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Area } from "recharts/es6/cartesian/Area";
import { CartesianGrid } from "recharts/es6/cartesian/CartesianGrid";
import { XAxis } from "recharts/es6/cartesian/XAxis";
import { YAxis } from "recharts/es6/cartesian/YAxis";
import { AreaChart } from "recharts/es6/chart/AreaChart";
import { Activity, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCompactNumber, formatFullNumber, formatPercent } from "@/lib/stats-format";
import type { StatsVisitShareChartData, StatsVisitShareRange, StatsVisitShareSeries } from "@/lib/stats-visit-share";
import { cn } from "@/lib/utils";

type VisitShareRange = Extract<StatsVisitShareRange, "7d" | "14d" | "30d" | "90d">;

type VisitShareChartPoint = {
  sampledAt: string;
  tooltipLabel: string;
  totalVisits: number;
} & Record<string, number | string>;

type TooltipPayloadItem = {
  color?: string;
  dataKey?: string | number;
  name?: string | number;
  value?: unknown;
  payload?: VisitShareChartPoint;
};

const rangeOptions: Array<{ value: VisitShareRange; label: string }> = [
  { value: "7d", label: "7D" },
  { value: "14d", label: "14D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" }
];

const chartTabsListClass =
  "h-auto min-h-9 flex-wrap justify-start gap-1 rounded-md border border-border/70 bg-background/80 p-1 text-muted shadow-none";
const chartTabsTriggerClass =
  "h-7 rounded-sm px-2.5 text-xs font-semibold text-muted transition-colors hover:bg-secondary/70 hover:text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-none";

function formatAxisDate(value: string, range: VisitShareRange) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: range === "90d" ? undefined : "numeric",
    timeZone: "UTC"
  });
}

function visitShareCacheKey(range: VisitShareRange) {
  return range;
}

function toChartPoints(chart: StatsVisitShareChartData): VisitShareChartPoint[] {
  return chart.points.map((point) => {
    const row: VisitShareChartPoint = {
      sampledAt: point.sampledAt,
      tooltipLabel: point.tooltipLabel,
      totalVisits: point.totalVisits
    };

    for (const series of chart.series) {
      row[series.key] = point.shares[series.key] ?? 0;
      row[`${series.key}Visits`] = point.visits[series.key] ?? 0;
    }

    return row;
  });
}

function chartConfig(series: StatsVisitShareSeries[]): ChartConfig {
  return series.reduce<ChartConfig>((config, item) => {
    config[item.key] = {
      label: item.name,
      color: item.color
    };
    return config;
  }, {});
}

function axisPercent(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return "";
  return number === 0 ? "0" : `${number}%`;
}

function StatsVisitShareTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;
  const rows = payload
    .filter((item) => Number(item.value) > 0)
    .sort((a, b) => Number(b.value) - Number(a.value))
    .slice(0, 10);

  if (!point || !rows.length) return null;

  return (
    <div className="grid min-w-[14rem] max-w-[18rem] items-start gap-2 rounded-lg border border-border/50 bg-background px-2.5 py-2 text-xs shadow-xl">
      <div>
        <div className="font-medium text-foreground">{point.tooltipLabel}</div>
        <div className="mt-0.5 text-[11px] text-muted">{formatCompactNumber(point.totalVisits)} tracked visits</div>
      </div>
      <div className="grid gap-1.5">
        {rows.map((item) => {
          const key = String(item.dataKey ?? item.name ?? "");
          const visits = typeof point[`${key}Visits`] === "number" ? (point[`${key}Visits`] as number) : 0;
          return (
            <div key={key} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
              <span className="h-3 w-1 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
              <span className="truncate text-muted">{item.name}</span>
              <span className="text-right font-mono font-medium tabular-nums text-foreground">
                {formatPercent(Number(item.value))}
                <span className="ml-1 text-muted">({formatCompactNumber(visits, 1)})</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SeriesLegendItem({ series }: { series: StatsVisitShareSeries }) {
  const content = (
    <>
      <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: series.color }} />
      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">{series.name}</span>
      <span className="font-mono text-[11px] tabular-nums text-muted">{formatPercent(series.sharePercent)}</span>
    </>
  );

  if (series.slug && !series.isGroup) {
    return (
      <Link
        href={`/stats/games/${series.slug}`}
        className="flex min-w-0 items-center gap-2 rounded-md border border-border/60 bg-background/35 px-2.5 py-2 transition hover:border-accent/60 hover:bg-background/70"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md border border-border/60 bg-background/35 px-2.5 py-2">
      {content}
    </div>
  );
}

export function StatsVisitShareChartPanel({ initialChart }: { initialChart: StatsVisitShareChartData }) {
  const initialRange = rangeOptions.some((option) => option.value === initialChart.range) ? (initialChart.range as VisitShareRange) : "30d";
  const [range, setRange] = useState<VisitShareRange>(initialRange);
  const [chartCache, setChartCache] = useState<Record<string, StatsVisitShareChartData>>({ [visitShareCacheKey(initialRange)]: initialChart });
  const [lastRenderedChart, setLastRenderedChart] = useState<StatsVisitShareChartData>(initialChart);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const activeKey = visitShareCacheKey(range);
  const loadedChart = chartCache[activeKey];
  const displayChart = loadedChart ?? lastRenderedChart;
  const points = useMemo(() => toChartPoints(displayChart), [displayChart]);
  const config = useMemo(() => chartConfig(displayChart.series), [displayChart.series]);
  const hasRenderableData = displayChart.series.length > 0 && points.length > 1;
  const isShowingPreviousChart = Boolean(isLoading && !loadedChart && hasRenderableData);

  useEffect(() => {
    if (loadedChart) setLastRenderedChart(loadedChart);
  }, [loadedChart]);

  useEffect(() => {
    if (chartCache[activeKey]) return;
    const controller = new AbortController();
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    fetch(`/api/stats/visit-share?range=${encodeURIComponent(range)}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Chart request failed (${response.status})`);
        return response.json() as Promise<StatsVisitShareChartData>;
      })
      .then((payload) => {
        setChartCache((cache) => ({ ...cache, [activeKey]: payload }));
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(error instanceof Error ? error.message : "Chart request failed");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeKey, chartCache, range]);

  return (
    <Card className="rounded-lg border-border/70 bg-surface/80 shadow-none" data-stats-visit-share-panel data-stats-visit-share-range={range} data-stats-visit-share-loaded-range={displayChart.range}>
      <CardHeader className="flex flex-col gap-3 border-b border-border/60 p-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-accent" aria-hidden />
            <CardTitle className="m-0 text-base font-semibold text-foreground">Top games visit share</CardTitle>
          </div>
          <p className="mt-1 text-xs font-medium text-muted">
            Daily new visits split across {formatFullNumber(displayChart.denominatorGameCount)} tracked games.
          </p>
        </div>
        <Tabs value={range} onValueChange={(value) => setRange(value as VisitShareRange)}>
          <TabsList className={chartTabsListClass}>
            {rangeOptions.map((item) => (
              <TabsTrigger key={item.value} value={item.value} className={chartTabsTriggerClass}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="p-4">
        {!hasRenderableData ? (
          <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-border/70 bg-background/35 text-center">
            <div className="max-w-sm px-6">
              <Activity className="mx-auto h-5 w-5 text-muted" aria-hidden />
              <p className="mt-3 text-sm font-semibold text-foreground">{isLoading ? "Loading chart" : "Not enough visit history yet"}</p>
              <p className="mt-1 text-xs text-muted">{loadError ?? "This chart needs daily visit-delta rows before it can compare game share."}</p>
            </div>
          </div>
        ) : (
          <div className="relative space-y-4">
            <div className={cn("relative", isLoading && "opacity-75")}>
              <ChartContainer config={config} className="h-[300px] w-full min-w-0">
                <AreaChart data={points} margin={{ left: 0, right: 8, top: 10, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="sampledAt"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={28}
                    tickMargin={8}
                    tickFormatter={(value: unknown) => formatAxisDate(String(value), range)}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    width={42}
                    domain={[0, 100]}
                    ticks={[0, 20, 40, 60, 80, 100]}
                    tickFormatter={axisPercent}
                  />
                  <ChartTooltip cursor={false} content={<StatsVisitShareTooltip />} />
                  {displayChart.series.map((series) => (
                    <Area
                      key={series.key}
                      type="monotone"
                      dataKey={series.key}
                      stackId="visit-share"
                      stroke={series.color}
                      fill={series.color}
                      fillOpacity={0.72}
                      strokeOpacity={0.82}
                      strokeWidth={1.4}
                      dot={false}
                      activeDot={{ r: 3 }}
                      name={series.name}
                      isAnimationActive={false}
                    />
                  ))}
                </AreaChart>
              </ChartContainer>
              {isShowingPreviousChart ? (
                <div className="pointer-events-none absolute right-2 top-2 rounded-md border border-border/70 bg-background/85 px-2 py-1 text-[11px] font-semibold text-muted shadow-sm">
                  Loading {range.toUpperCase()}
                </div>
              ) : null}
            </div>
            {loadError ? <p className="text-xs font-medium text-red-500">{loadError}</p> : null}
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" data-stats-visit-share-legend>
              {displayChart.series.map((series) => (
                <SeriesLegendItem key={series.key} series={series} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
