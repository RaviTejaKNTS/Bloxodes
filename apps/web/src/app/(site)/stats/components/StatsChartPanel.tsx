"use client";

import { useMemo, useState } from "react";
import { Area } from "recharts/es6/cartesian/Area";
import { CartesianGrid } from "recharts/es6/cartesian/CartesianGrid";
import { Line } from "recharts/es6/cartesian/Line";
import { XAxis } from "recharts/es6/cartesian/XAxis";
import { YAxis } from "recharts/es6/cartesian/YAxis";
import { AreaChart } from "recharts/es6/chart/AreaChart";
import { LineChart } from "recharts/es6/chart/LineChart";
import { Activity, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
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

type MetricKey = "players" | "visits" | "favorites" | "rating";
type RangeKey = "24h" | "7d" | "30d" | "90d" | "all";

const metricLabels: Record<MetricKey, string> = {
  players: "Players",
  visits: "Visits",
  favorites: "Favorites",
  rating: "Rating"
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

export function StatsChartPanel({
  title,
  subtitle,
  chart,
  charts,
  defaultMetric = "players",
  defaultRange = "24h",
  compact = false,
  area = false
}: {
  title: string;
  subtitle?: string | null;
  chart?: ChartPoint[];
  charts?: Record<RangeKey, ChartPoint[]>;
  defaultMetric?: MetricKey;
  defaultRange?: RangeKey;
  compact?: boolean;
  area?: boolean;
}) {
  const [metric, setMetric] = useState<MetricKey>(defaultMetric);
  const [range, setRange] = useState<RangeKey>(defaultRange);
  const points = useMemo(() => (charts ? charts[range] ?? [] : chart ?? []), [chart, charts, range]);
  const current = latestValue(points, metric);
  const summary = rangeValue(points, metric);
  const hasData = points.some((point) => typeof point[metric] === "number");
  const Chart = area ? AreaChart : LineChart;

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

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
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
          {charts ? (
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
        {!hasData ? (
          <div className={cn("flex items-center justify-center rounded-lg border border-dashed border-border/70 bg-background/35 text-center", compact ? "h-[190px]" : "h-[300px]")}>
            <div className="max-w-sm px-6">
              <Activity className="mx-auto h-5 w-5 text-muted" aria-hidden />
              <p className="mt-3 text-sm font-semibold text-foreground">Not enough history yet</p>
              <p className="mt-1 text-xs text-muted">The latest public stats are available, but this chart needs a few hourly samples.</p>
            </div>
          </div>
        ) : (
          <ChartContainer config={metricConfig} className={compact ? "h-[190px] w-full" : "h-[300px] w-full"}>
            <Chart data={points} margin={{ left: 0, right: 8, top: 10, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} width={42} tickFormatter={axisTick} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="line"
                    labelFormatter={(value) => String(value)}
                    valueFormatter={(value) =>
                      metric === "rating" ? formatPercent(typeof value === "number" ? value : Number(value)) : formatCompactNumber(typeof value === "number" ? value : Number(value))
                    }
                  />
                }
              />
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
            <p className="text-muted">Points</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
