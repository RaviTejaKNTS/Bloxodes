"use client";

import { useMemo, useState } from "react";
import { Line } from "recharts/es6/cartesian/Line";
import { CartesianGrid } from "recharts/es6/cartesian/CartesianGrid";
import { XAxis } from "recharts/es6/cartesian/XAxis";
import { YAxis } from "recharts/es6/cartesian/YAxis";
import { LineChart } from "recharts/es6/chart/LineChart";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCompactNumber } from "@/lib/stats-format";
import type { StatsItemChartPoint } from "@/lib/stats";

type SeriesKey = "priceRobux" | "lowestResalePriceRobux" | "favoriteCount" | "availableUnits" | "resaleVolume";
type SourceKey = "hourly" | "daily" | "resale";

const seriesLabels: Record<SeriesKey, string> = {
  priceRobux: "Price",
  lowestResalePriceRobux: "Resale",
  favoriteCount: "Favorites",
  availableUnits: "Available",
  resaleVolume: "Volume"
};

const chartConfig: ChartConfig = {
  priceRobux: { label: "Price", color: "rgb(var(--color-accent))" },
  lowestResalePriceRobux: { label: "Resale", color: "#22c55e" },
  favoriteCount: { label: "Favorites", color: "#f59e0b" },
  availableUnits: { label: "Available", color: "#38bdf8" },
  resaleVolume: { label: "Volume", color: "#ec4899" }
};

function valueLabel(value: unknown) {
  return formatCompactNumber(typeof value === "number" ? value : Number(value), 0);
}

function tooltipLabel(value: string) {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", hour12: true, timeZone: "UTC" });
}

function StatsItemTooltip({
  active,
  payload,
  label
}: {
  active?: boolean;
  payload?: Array<{ color?: string; name?: string; value?: unknown; dataKey?: string | number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const visiblePayload = payload.filter((item) => item.value != null && Number.isFinite(Number(item.value)));
  if (!visiblePayload.length) return null;
  return (
    <div className="grid min-w-[10rem] gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{label ? tooltipLabel(label) : ""}</div>
      {visiblePayload.map((entry) => (
        <div key={String(entry.dataKey ?? entry.name)} className="flex items-center gap-2">
          <span className="h-3 w-1 rounded-[2px]" style={{ backgroundColor: entry.color }} />
          <span className="text-muted">{entry.name}</span>
          <span className="ml-auto font-mono font-medium text-foreground">{valueLabel(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function StatsItemChartPanel({
  hourlyPoints,
  dailyPoints,
  resalePoints
}: {
  hourlyPoints: StatsItemChartPoint[];
  dailyPoints: StatsItemChartPoint[];
  resalePoints: StatsItemChartPoint[];
}) {
  const [source, setSource] = useState<SourceKey>(hourlyPoints.length ? "hourly" : resalePoints.length ? "resale" : "daily");
  const points = source === "hourly" ? hourlyPoints : source === "daily" ? dailyPoints : resalePoints;
  const series = useMemo<SeriesKey[]>(() => {
    const keys: SeriesKey[] = source === "resale"
      ? ["lowestResalePriceRobux", "resaleVolume"]
      : ["priceRobux", "lowestResalePriceRobux", "favoriteCount", "availableUnits"];
    return keys.filter((key) => points.some((point) => typeof point[key] === "number"));
  }, [points, source]);

  return (
    <Card className="rounded-lg border-border/70 bg-surface/80 shadow-none">
      <CardHeader className="flex flex-col gap-3 space-y-0 md:flex-row md:items-center md:justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4 text-accent" aria-hidden />
          Item history
        </CardTitle>
        <Tabs value={source} onValueChange={(value) => setSource(value as SourceKey)}>
          <TabsList className="h-auto min-h-9 flex-wrap justify-start gap-1 rounded-md border border-border/70 bg-background/80 p-1 text-muted shadow-none">
            <TabsTrigger value="hourly" className="h-7 rounded-sm px-2.5 text-xs font-semibold">Hourly</TabsTrigger>
            <TabsTrigger value="daily" className="h-7 rounded-sm px-2.5 text-xs font-semibold">Daily</TabsTrigger>
            <TabsTrigger value="resale" className="h-7 rounded-sm px-2.5 text-xs font-semibold">Resale</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {points.length > 0 && series.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-[320px] w-full">
            <LineChart data={points} margin={{ left: 8, right: 16, top: 12, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="sampledAt" tickFormatter={(value: string) => points.find((point) => point.sampledAt === value)?.label ?? value} minTickGap={24} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={valueLabel} tickLine={false} axisLine={false} width={54} />
              <ChartTooltip content={<StatsItemTooltip />} />
              {series.map((key) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={seriesLabels[key]}
                  stroke={`var(--color-${key})`}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-border/70 text-sm text-muted">
            No item history has been captured yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
