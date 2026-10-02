"use client";

import * as React from "react";
import { CartesianGrid } from "recharts/es6/cartesian/CartesianGrid";
import { Line } from "recharts/es6/cartesian/Line";
import { XAxis } from "recharts/es6/cartesian/XAxis";
import { YAxis } from "recharts/es6/cartesian/YAxis";
import { LineChart } from "recharts/es6/chart/LineChart";
import { Bar, BarChart, Cell, LabelList, ReferenceLine } from "recharts";
import { ChartTooltip } from "@/components/ui/chart";
import type {
  DailyChartPoint,
  EventMarker,
  GenreMovementRow,
  IndexedGameSeries
} from "@/data/reports/roblox-september-2026";

const accent = "#2563eb";
const positive = "#0f766e";
const negative = "#c2410c";
const linePatterns = [undefined, "8 4", "3 3", "10 3 2 3", "2 4"] as const;

const wholeNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compactNumber = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const chartClassName =
  "flex justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-none";

function shortDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function Figure({
  title,
  caption,
  source,
  children
}: {
  title: string;
  caption: string;
  source?: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="my-8 rounded-lg border border-border/70 bg-card p-4 sm:p-6">
      <figcaption className="mb-4 space-y-1.5">
        <h3 className="text-base font-semibold text-foreground sm:text-lg">{title}</h3>
        <p className="text-sm leading-6 text-muted">{caption}</p>
      </figcaption>
      {children}
      {source ? <p className="mt-3 text-xs text-muted">{source}</p> : null}
    </figure>
  );
}

function ChartSurface({
  className,
  height,
  ariaLabel,
  children
}: {
  className: string;
  height: number;
  ariaLabel?: string;
  children: (width: number) => React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    const updateWidth = () => {
      const nextWidth = ref.current?.clientWidth ?? 0;
      if (nextWidth > 0) setWidth(nextWidth);
    };

    updateWidth();
    const frame = typeof window.requestAnimationFrame === "function" ? window.requestAnimationFrame(updateWidth) : null;
    const timeout = window.setTimeout(updateWidth, 50);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateWidth);
    const poll = observer || typeof window.setInterval !== "function" ? null : window.setInterval(updateWidth, 100);
    if (observer && ref.current) observer.observe(ref.current);
    if (typeof window.addEventListener === "function") window.addEventListener("resize", updateWidth);
    return () => {
      if (frame !== null && typeof window.cancelAnimationFrame === "function") window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      observer?.disconnect();
      if (poll) window.clearInterval(poll);
      if (typeof window.removeEventListener === "function") window.removeEventListener("resize", updateWidth);
    };
  }, []);

  return (
    <div ref={ref} className={`${chartClassName} ${className}`} style={{ minHeight: height }} aria-label={ariaLabel}>
      <div className="h-full w-full">{width > 0 ? children(width) : null}</div>
    </div>
  );
}

export function AnimeDiceChart({
  points,
  markers
}: {
  points: readonly DailyChartPoint[];
  markers: readonly EventMarker[];
}) {
  return (
    <Figure
      title="Anime Dice kept its gains"
      caption="Daily average players online at the same time. The strongest seven-day stretch was September 24 through 30; markers show scheduled update event windows."
      source="Source: Bloxodes daily player readings, September 5 through 30, 2026; official Roblox event listings for the markers."
    >
      <ChartSurface
        className="h-[20rem] w-full aspect-auto"
        height={320}
        ariaLabel="Anime Dice daily average players online during September 2026"
      >
        {(width) => (
          <LineChart
            accessibilityLayer
            width={width}
            height={320}
            data={[...points]}
            margin={{ left: 4, right: 12, top: 28, bottom: 4 }}
          >
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} minTickGap={28} />
          <YAxis
            domain={[0, "auto"]}
            tickFormatter={(value: number) => compactNumber.format(Number(value))}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          {markers.map((marker) => (
            <ReferenceLine
              key={marker.date}
              x={marker.date}
              stroke="#7c3aed"
              strokeDasharray="4 4"
              label={{ value: marker.shortLabel, position: "top", fontSize: 10, fill: "rgb(var(--color-muted))" }}
            />
          ))}
          <ChartTooltip
            content={({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: unknown }>; label?: string }) => {
              const value = Number(payload?.[0]?.value);
              if (!active || !Number.isFinite(value)) return null;
              return (
                <div className="rounded-lg border border-border/70 bg-background p-3 text-xs shadow-xl">
                  <p className="font-semibold text-foreground">{label ? shortDate(label) : ""}</p>
                  <p className="mt-1 text-muted">
                    Players online: <span className="font-mono font-semibold text-foreground">{wholeNumber.format(value)}</span>
                  </p>
                </div>
              );
            }}
          />
            <Line type="monotone" dataKey="players" stroke={accent} strokeWidth={2.5} dot={false} activeDot={{ r: 3 }} />
          </LineChart>
        )}
      </ChartSurface>
      <p className="sr-only">
        Anime Dice averaged 4,869 players online on September 5 and 68,076 on September 30.
        All 19 comparisons against the same weekday a week earlier rose. Its best seven-day average was 57,130.
      </p>
    </Figure>
  );
}

function IndexedLineChart({
  series,
  markers,
  height,
  chartHeight,
  ariaLabel
}: {
  series: readonly IndexedGameSeries[];
  markers: readonly EventMarker[];
  height: string;
  chartHeight: number;
  ariaLabel: string;
}) {
  const dates = series[0]?.points.map((point) => point.date) ?? [];
  const chartData = dates.map((date, index) => {
    const row: Record<string, string | number | null> = { date };
    series.forEach((game) => {
      row[game.slug] = game.points[index]?.index ?? null;
    });
    return row;
  });

  return (
    <ChartSurface className={`${height} w-full aspect-auto`} height={chartHeight} ariaLabel={ariaLabel}>
      {(width) => (
        <LineChart
          accessibilityLayer
          width={width}
          height={chartHeight}
          data={chartData}
          margin={{ left: 4, right: 12, top: 8, bottom: 4 }}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} minTickGap={28} />
          <YAxis
            domain={["auto", "auto"]}
            tickFormatter={(value: number) => `${Number(value).toFixed(0)}`}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <ReferenceLine y={100} stroke="rgb(var(--color-border) / 0.7)" strokeDasharray="2 4" />
          {markers.map((marker) => (
            <ReferenceLine
              key={marker.date}
              x={marker.date}
              stroke="rgb(var(--color-muted) / 0.45)"
              strokeDasharray="3 3"
              label={{
                value: marker.shortLabel,
                position: "insideTopRight",
                fontSize: 10,
                fill: "rgb(var(--color-muted))"
              }}
            />
          ))}
          <ChartTooltip
            content={({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: unknown; dataKey?: string }>; label?: string }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="min-w-[12rem] rounded-lg border border-border/70 bg-background p-3 text-xs shadow-xl">
                  <p className="font-semibold text-foreground">{label ? shortDate(label) : ""}</p>
                  <div className="mt-1 space-y-1">
                    {payload.map((entry) => {
                      const game = series.find((candidate) => candidate.slug === entry.dataKey);
                      const value = Number(entry.value);
                      if (!game || !Number.isFinite(value)) return null;
                      return (
                        <p key={entry.dataKey} className="flex items-center justify-between gap-4 text-muted">
                          <span className="flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: game.color }}
                              aria-hidden
                            />
                            {game.name}
                          </span>
                          <span className="font-mono font-semibold text-foreground">{value.toFixed(0)}</span>
                        </p>
                      );
                    })}
                  </div>
                </div>
              );
            }}
          />
          {series.map((game, index) => (
            <Line
              key={game.slug}
              type="monotone"
              dataKey={game.slug}
              name={game.name}
              stroke={game.color}
              strokeDasharray={linePatterns[index % linePatterns.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      )}
    </ChartSurface>
  );
}

function SeriesLegend({ series }: { series: readonly IndexedGameSeries[] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-border/70 pt-3 text-xs" role="list" aria-label="Chart legend">
      {series.map((game, index) => (
        <span key={game.slug} className="inline-flex items-center gap-1.5 text-muted" role="listitem">
          <svg className="h-2 w-5" viewBox="0 0 20 8" aria-hidden>
            <line
              x1="0"
              y1="4"
              x2="20"
              y2="4"
              stroke={game.color}
              strokeWidth="2"
              strokeDasharray={linePatterns[index % linePatterns.length]}
            />
          </svg>
          {game.name}
        </span>
      ))}
    </div>
  );
}

export function AnniversaryGamesChart({
  series,
  markers
}: {
  series: readonly IndexedGameSeries[];
  markers: readonly EventMarker[];
}) {
  return (
    <Figure
      title="Two older games rose in anniversary waves"
      caption="Each game's average from September 5 through 30 equals 100. The lines compare the waves, not the number of players; markers show The Hunt's start and end dates."
      source="Source: Bloxodes daily player readings, September 5 through 30, 2026; Roblox's official The Hunt announcement for the markers."
    >
      <IndexedLineChart
        series={series}
        markers={markers}
        height="h-[22rem]"
        chartHeight={352}
        ariaLabel="Indexed September 2026 player paths for Lumber Tycoon 2 and Jailbreak"
      />
      <SeriesLegend series={series} />
      <p className="sr-only">
        Lumber Tycoon 2 and Jailbreak both have later waves. Lumber Tycoon 2 peaks on September 26,
        while Jailbreak peaks on September 19. These lines compare relative movement, not game size.
      </p>
    </Figure>
  );
}

export function GenreMovementChart({ data }: { data: readonly GenreMovementRow[] }) {
  const chartData = data.map((row) => ({
    ...row,
    chartLabel: row.genre === "Roleplay & Avatar Sim" ? "Roleplay" : row.genre === "Obby & Platformer" ? "Obby" : row.genre
  }));

  return (
    <Figure
      title="Sports rose while several larger genres cooled"
      caption="Each bar shows the typical weekly change in combined player counts for a genre, comparing matching weekdays. The 339 selected games include two groups without a named genre, which are omitted here."
      source="Source: Bloxodes daily player readings for stable selected games, September 5 through 30, 2026."
    >
      <ChartSurface className="h-[33rem] w-full aspect-auto" height={528} ariaLabel="Typical same-weekday genre movement in September 2026">
        {(width) => (
        <BarChart
          accessibilityLayer
          width={width}
          height={528}
          data={chartData}
          layout="vertical"
          margin={{ left: 8, right: 28, top: 4, bottom: 4 }}
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis
            type="number"
            domain={width < 290 ? [-35, 7] : width < 360 ? [-28, 7] : [-22, 6]}
            ticks={width < 360 ? [-20, 0] : [-20, -10, 0, 5]}
            tickFormatter={(value: number) => `${value > 0 ? "+" : ""}${Number(value).toFixed(0)}%`}
            tickLine={false}
            axisLine={false}
          />
          <YAxis dataKey="chartLabel" type="category" width={width < 360 ? 94 : 124} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <ReferenceLine x={0} stroke="rgb(var(--color-border) / 0.7)" />
          <ChartTooltip
            cursor={{ fill: "hsl(var(--muted) / 0.18)" }}
            content={({ active, payload }: { active?: boolean; payload?: Array<{ payload?: GenreMovementRow }> }) => {
              const row = payload?.[0]?.payload;
              if (!active || !row) return null;
              return (
                <div className="w-48 max-w-[calc(100vw-2rem)] rounded-lg border border-border/70 bg-background p-3 text-xs shadow-xl">
                  <p className="font-semibold text-foreground">{row.genre}</p>
                  <p className="mt-1 flex items-start justify-between gap-3 text-muted">
                    <span className="min-w-0 flex-1">Typical same-weekday change</span>
                    <span className="shrink-0 font-mono font-semibold text-foreground">
                      {row.typicalChangePercent > 0 ? "+" : ""}
                      {row.typicalChangePercent.toFixed(1)}%
                    </span>
                  </p>
                  <p className="mt-1 flex items-start justify-between gap-3 text-muted">
                    <span className="min-w-0 flex-1">Comparisons that rose</span>
                    <span className="shrink-0 font-mono text-foreground">{row.shareRosePercent}%</span>
                  </p>
                  <p className="mt-1 flex items-start justify-between gap-3 text-muted">
                    <span className="min-w-0 flex-1">Games tracked</span>
                    <span className="shrink-0 font-mono text-foreground">{row.stableGames}</span>
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="typicalChangePercent" radius={3} maxBarSize={22}>
            {chartData.map((row) => (
              <Cell key={row.genre} fill={row.typicalChangePercent >= 0 ? positive : negative} />
            ))}
            <LabelList
              dataKey="typicalChangePercent"
              position="right"
              fill="rgb(var(--color-foreground))"
              fontSize={10}
              formatter={(value: unknown) => {
                const numericValue = Number(value);
                return `${numericValue > 0 ? "+" : ""}${numericValue.toFixed(1)}%`;
              }}
            />
          </Bar>
        </BarChart>
        )}
      </ChartSurface>
      <p className="sr-only">
        Sports &amp; Racing rose 3.6%. RPG fell 18.3%, Simulation fell 7.3%, and Survival fell 6.7%.
        These are changes for selected games, not all of Roblox.
      </p>
    </Figure>
  );
}

export function CoolDownGamesChart({
  series,
  markers
}: {
  series: readonly IndexedGameSeries[];
  markers: readonly EventMarker[];
}) {
  return (
    <Figure
      title="Recognition and size did not guarantee a climb"
      caption="Each game's average from September 5 through 30 equals 100. Blox Fruits and Animal Hospital cooled, while Steal a Brainrot had a less consistent but positive weekly trend."
      source="Source: Bloxodes daily player readings, September 5 through 30, 2026."
    >
      <IndexedLineChart
        series={series}
        markers={markers}
        height="h-[22rem]"
        chartHeight={352}
        ariaLabel="Indexed September 2026 player paths for Blox Fruits, Animal Hospital, and Steal a Brainrot"
      />
      <SeriesLegend series={series} />
      <p className="sr-only">
        Blox Fruits and Animal Hospital were lower on every comparable weekday. Steal a Brainrot
        rose on 13 of 19 comparable weekdays, with more uneven daily movement.
      </p>
    </Figure>
  );
}
