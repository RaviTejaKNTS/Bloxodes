"use client";

import { CartesianGrid } from "recharts/es6/cartesian/CartesianGrid";
import { Line } from "recharts/es6/cartesian/Line";
import { XAxis } from "recharts/es6/cartesian/XAxis";
import { YAxis } from "recharts/es6/cartesian/YAxis";
import { LineChart } from "recharts/es6/chart/LineChart";
import { Bar, BarChart, Cell, LabelList, ReferenceLine } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import type {
  DailyChartPoint,
  EventMarker,
  GenreMovementRow,
  IndexedGameSeries
} from "@/data/reports/roblox-july-2026";

const accent = "#84a9ff";
const positive = "#0f766e";
const negative = "#c2410c";
const linePatterns = [undefined, "8 4", "3 3", "10 3 2 3", "2 4"] as const;

const wholeNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compactNumber = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

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

const murderMystery2Config = {
  players: { label: "Players online at the same time", color: accent }
} satisfies ChartConfig;

export function MurderMystery2Chart({
  points,
  markers
}: {
  points: readonly DailyChartPoint[];
  markers: readonly EventMarker[];
}) {
  return (
    <Figure
      title="Murder Mystery 2's late-July wave"
      caption="Murder Mystery 2's daily average stayed near 250,000 to 300,000 for most of July, then rose sharply once its Summer 2026 event began. The timing matches the surge; it does not prove the event caused it."
      source="Source: Bloxodes daily player readings, July 2–31, 2026; official Roblox event listing for the marker."
    >
      <ChartContainer config={murderMystery2Config} className="h-[20rem] w-full aspect-auto">
        <LineChart accessibilityLayer data={[...points]} margin={{ left: 4, right: 12, top: 28, bottom: 4 }}>
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
      </ChartContainer>
    </Figure>
  );
}

function IndexedLineChart({
  series,
  markers,
  height
}: {
  series: readonly IndexedGameSeries[];
  markers: readonly EventMarker[];
  height: string;
}) {
  const dates = series[0]?.points.map((point) => point.date) ?? [];
  const chartData = dates.map((date, i) => {
    const row: Record<string, string | number> = { date };
    series.forEach((game) => {
      row[game.slug] = game.points[i]?.index ?? 0;
    });
    return row;
  });

  const config = Object.fromEntries(
    series.map((game) => [game.slug, { label: game.name, color: game.color }])
  ) satisfies ChartConfig;

  return (
    <ChartContainer config={config} className={`${height} w-full aspect-auto`}>
      <LineChart accessibilityLayer data={chartData} margin={{ left: 4, right: 12, top: 8, bottom: 4 }}>
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
            label={{ value: marker.shortLabel, position: "top", fontSize: 10, fill: "rgb(var(--color-muted))" }}
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
                    const game = series.find((g) => g.slug === entry.dataKey);
                    const value = Number(entry.value);
                    if (!game || !Number.isFinite(value)) return null;
                    return (
                      <p key={entry.dataKey} className="flex items-center justify-between gap-4 text-muted">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: game.color }} />
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
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}

function SeriesLegend({ series }: { series: readonly IndexedGameSeries[] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-border/70 pt-3 text-xs">
      {series.map((game, index) => (
        <span key={game.slug} className="inline-flex items-center gap-1.5 text-muted">
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

export function ComebackGamesChart({
  series,
  eventMarker
}: {
  series: readonly IndexedGameSeries[];
  eventMarker: EventMarker;
}) {
  return (
    <Figure
      title="Three older games, three comeback shapes"
      caption="Each line is indexed to its own July average of 100. Shindo Life climbed steadily, Flee the Facility formed an event-timed wave, and Bee Swarm Simulator moved gradually."
      source={`Source: Bloxodes daily player readings, July 2–31, 2026. The vertical line marks July 23, when the ${eventMarker.label} began.`}
    >
      <IndexedLineChart series={series} markers={[eventMarker]} height="h-[22rem]" />
      <SeriesLegend series={series} />
    </Figure>
  );
}

const genreConfig = {
  typicalChangePercent: { label: "Typical same-weekday change", color: positive }
} satisfies ChartConfig;

export function GenreMovementChart({ data }: { data: readonly GenreMovementRow[] }) {
  const chartData = data.map((row) => ({
    ...row,
    chartLabel: row.genre === "Roleplay & Avatar Sim" ? "Roleplay & Avatar" : row.genre === "Obby & Platformer" ? "Obby" : row.genre
  }));

  return (
    <Figure
      title="July was mixed across the sampled genres"
      caption="Typical same-weekday change among 356 stable selected games. This is not a platform-wide growth measure."
      source="Source: Bloxodes daily player readings for stable selected games, July 2–31, 2026."
    >
      <ChartContainer config={genreConfig} className="h-[28rem] w-full aspect-auto">
        <BarChart accessibilityLayer data={chartData} layout="vertical" margin={{ left: 8, right: 28, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis
            type="number"
            tickFormatter={(value: number) => `${value > 0 ? "+" : ""}${Number(value).toFixed(0)}%`}
            tickLine={false}
            axisLine={false}
          />
          <YAxis dataKey="chartLabel" type="category" width={118} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <ReferenceLine x={0} stroke="rgb(var(--color-border) / 0.7)" />
          <ChartTooltip
            cursor={{ fill: "hsl(var(--muted) / 0.18)" }}
            content={({ active, payload }: { active?: boolean; payload?: Array<{ payload?: GenreMovementRow }> }) => {
              const row = payload?.[0]?.payload;
              if (!active || !row) return null;
              return (
                <div className="min-w-[13rem] rounded-lg border border-border/70 bg-background p-3 text-xs shadow-xl">
                  <p className="font-semibold text-foreground">{row.genre}</p>
                  <p className="mt-1 flex justify-between gap-4 text-muted">
                    <span>Typical same-weekday change</span>
                    <span className="font-mono font-semibold text-foreground">
                      {row.typicalChangePercent > 0 ? "+" : ""}
                      {row.typicalChangePercent.toFixed(1)}%
                    </span>
                  </p>
                  <p className="mt-1 flex justify-between gap-4 text-muted">
                    <span>Comparisons that rose</span>
                    <span className="font-mono text-foreground">{row.shareRosePercent}%</span>
                  </p>
                  <p className="mt-1 flex justify-between gap-4 text-muted">
                    <span>Stable games tracked</span>
                    <span className="font-mono text-foreground">{row.stableGames}</span>
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="typicalChangePercent" radius={3} maxBarSize={22}>
            {data.map((row) => (
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
      </ChartContainer>
    </Figure>
  );
}

export function CoolDownGamesChart({ series }: { series: readonly IndexedGameSeries[] }) {
  return (
    <Figure
      title="Three full-period cool-downs"
      caption="Each line is indexed to its own July average of 100. The paths show sustained cool-downs across the month, not just different first and last days."
      source="Source: Bloxodes daily player readings, July 2–31, 2026."
    >
      <IndexedLineChart series={series} markers={[]} height="h-[22rem]" />
      <SeriesLegend series={series} />
    </Figure>
  );
}
