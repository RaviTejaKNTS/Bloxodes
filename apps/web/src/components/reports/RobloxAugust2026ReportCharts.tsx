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
} from "@/data/reports/roblox-august-2026";

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

export function AdoptMeChart({
  points,
  markers
}: {
  points: readonly DailyChartPoint[];
  markers: readonly EventMarker[];
}) {
  return (
    <Figure
      title="Adopt Me! built its strongest week at month’s end"
      caption="Daily average players online at once. The line rises in uneven waves, with its strongest seven-day stretch arriving in the final week."
      source="Source: Bloxodes daily player readings, August 1–31, 2026; official Roblox event listings for the markers."
    >
      <ChartSurface
        className="h-[20rem] w-full aspect-auto"
        height={320}
        ariaLabel="Adopt Me! daily average players online during August 2026"
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
        Adopt Me! had its lowest daily average on August 5 at 109,596 players online and its highest on August 29 at
        396,858. Its weakest seven-day average was 146,271 and its strongest was 278,444.
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
                position:
                  marker.date === "2026-08-22"
                    ? "insideTopRight"
                    : marker.date === "2026-08-23"
                      ? "insideTopLeft"
                      : "top",
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

export function EstablishedGamesChart({
  series,
  markers
}: {
  series: readonly IndexedGameSeries[];
  markers: readonly EventMarker[];
}) {
  return (
    <Figure
      title="Four long-running games, four different August paths"
      caption="Each line is indexed to that game’s own August average of 100. The shapes are comparable without pretending the games are the same size."
      source="Source: Bloxodes daily player readings, August 1–31, 2026; official Roblox event listings for the markers."
    >
      <IndexedLineChart
        series={series}
        markers={markers}
        height="h-[22rem]"
        chartHeight={352}
        ariaLabel="Indexed August 2026 player paths for Adopt Me!, DOORS, Tower of Hell, and Blox Fruits"
      />
      <SeriesLegend series={series} />
      <p className="sr-only">
        The index uses 100 for each game’s August average. Adopt Me! rises in several waves, DOORS jumps late in the
        month, Tower of Hell moves up more steadily, and Blox Fruits stays closer to its usual level.
      </p>
    </Figure>
  );
}

export function GenreMovementChart({ data }: { data: readonly GenreMovementRow[] }) {
  const chartData = data.map((row) => ({
    ...row,
    chartLabel: row.genre === "Roleplay & Avatar Sim" ? "Roleplay & Avatar" : row.genre === "Obby & Platformer" ? "Obby" : row.genre
  }));

  return (
    <Figure
      title="The selected game mix tilted cooler in August"
      caption="Typical same-weekday change across 402 stable selected games. This is not a platform-wide Roblox total, and individual games often moved against their genre."
      source="Source: Bloxodes daily player readings for stable selected games, August 1–31, 2026."
    >
      <ChartSurface className="h-[33rem] w-full aspect-auto" height={528} ariaLabel="Typical same-weekday genre movement in August 2026">
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
            tickFormatter={(value: number) => `${value > 0 ? "+" : ""}${Number(value).toFixed(0)}%`}
            tickLine={false}
            axisLine={false}
          />
          <YAxis dataKey="chartLabel" type="category" width={124} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
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
        RPG and Roleplay &amp; Avatar Sim were slightly positive. Simulation and Survival were negative, but individual
        games often moved in the opposite direction.
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
      title="The biggest cool-downs did not follow one curve"
      caption="Each line is indexed to that game’s own August average of 100. The paths show different cool-down shapes across the month, not just two selected dates."
      source="Source: Bloxodes daily player readings, August 1–31, 2026; official Roblox event listings for the markers."
    >
      <IndexedLineChart
        series={series}
        markers={markers}
        height="h-[22rem]"
        chartHeight={352}
        ariaLabel="Indexed August 2026 player paths for Grow a Garden 2, Murder Mystery 2, and Animal Hospital"
      />
      <SeriesLegend series={series} />
      <p className="sr-only">
        Grow a Garden 2 falls steeply from an early high, Murder Mystery 2 crests in mid-month before sliding, and
        Animal Hospital cools more gradually into the final week.
      </p>
    </Figure>
  );
}
