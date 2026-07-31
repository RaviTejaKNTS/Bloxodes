"use client";

import { Area } from "recharts/es6/cartesian/Area";
import { CartesianGrid } from "recharts/es6/cartesian/CartesianGrid";
import { Line } from "recharts/es6/cartesian/Line";
import { XAxis } from "recharts/es6/cartesian/XAxis";
import { YAxis } from "recharts/es6/cartesian/YAxis";
import { AreaChart } from "recharts/es6/chart/AreaChart";
import { LineChart } from "recharts/es6/chart/LineChart";
import { Bar, BarChart, Cell, ReferenceLine } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import type { BreakoutChartPoint, BreakoutMarker, GenreRow, IndexedGameSeries } from "@/data/reports/roblox-june-2026";

const accent = "#2563eb";
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

const animalHospitalConfig = {
  players: { label: "Players online at the same time", color: accent }
} satisfies ChartConfig;

export function AnimalHospitalChart({
  points,
  markers
}: {
  points: readonly BreakoutChartPoint[];
  markers: readonly BreakoutMarker[];
}) {
  return (
    <Figure
      title="Animal Hospital went from hundreds of players to hundreds of thousands"
      caption="884 average players on June 9 to 429,721 on June 30. The dashed lines mark two recorded in-game updates; the climb was already underway before both of them."
      source="Source: Bloxodes daily player readings, June 6–30, 2026."
    >
      <ChartContainer config={animalHospitalConfig} className="h-[20rem] w-full aspect-auto">
        <AreaChart accessibilityLayer data={[...points]} margin={{ left: 4, right: 12, top: 28, bottom: 4 }}>
          <defs>
            <linearGradient id="animalHospitalFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={accent} stopOpacity={0.28} />
              <stop offset="95%" stopColor={accent} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} minTickGap={28} />
          <YAxis
            domain={[0, "auto"]}
            tickFormatter={(value: number) => compactNumber.format(Number(value))}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          {markers.map((marker, index) => (
            <ReferenceLine
              key={marker.date}
              x={marker.date}
              stroke={index % 2 === 0 ? "#7c3aed" : "#a16207"}
              strokeDasharray="4 4"
              label={{ value: marker.shortLabel, position: "top", fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
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
          <Area
            type="monotone"
            dataKey="players"
            stroke={accent}
            strokeWidth={2.5}
            fill="url(#animalHospitalFill)"
            connectNulls={false}
          />
        </AreaChart>
      </ChartContainer>
    </Figure>
  );
}

const genreConfig = {
  weeklyChangePercent: { label: "Typical weekly change", color: positive }
} satisfies ChartConfig;

export function GenreMomentumChart({ data }: { data: readonly GenreRow[] }) {
  const chartData = data.map((row) => ({
    ...row,
    chartLabel: row.genre === "Roleplay & Avatar Sim" ? "Roleplay & Avatar" : row.genre === "Obby & Platformer" ? "Obby" : row.genre
  }));

  return (
    <Figure
      title="Survival kept winning the week"
      caption="Each bar compares a day’s average with the same weekday one week earlier, then takes the middle result for the month. That avoids treating an ordinary weekend jump as a trend."
      source="Source: Bloxodes daily player readings for games with a steady June presence, June 6–30, 2026."
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
          <ReferenceLine x={0} stroke="hsl(var(--border))" />
          <ChartTooltip
            cursor={{ fill: "hsl(var(--muted) / 0.18)" }}
            content={({ active, payload }: { active?: boolean; payload?: Array<{ payload?: GenreRow }> }) => {
              const row = payload?.[0]?.payload;
              if (!active || !row) return null;
              return (
                <div className="min-w-[13rem] rounded-lg border border-border/70 bg-background p-3 text-xs shadow-xl">
                  <p className="font-semibold text-foreground">{row.genre}</p>
                  <p className="mt-1 flex justify-between gap-4 text-muted">
                    <span>Typical weekly change</span>
                    <span className="font-mono font-semibold text-foreground">
                      {row.weeklyChangePercent > 0 ? "+" : ""}
                      {row.weeklyChangePercent.toFixed(1)}%
                    </span>
                  </p>
                  <p className="mt-1 flex justify-between gap-4 text-muted">
                    <span>Days that rose week over week</span>
                    <span className="font-mono text-foreground">{row.shareRosePercent}%</span>
                  </p>
                  <p className="mt-1 flex justify-between gap-4 text-muted">
                    <span>Games tracked</span>
                    <span className="font-mono text-foreground">{row.games}</span>
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="weeklyChangePercent" radius={3} maxBarSize={22}>
            {data.map((row) => (
              <Cell key={row.genre} fill={row.weeklyChangePercent >= 0 ? positive : negative} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </Figure>
  );
}

function IndexedLineChart({
  series,
  saturdays,
  height
}: {
  series: readonly IndexedGameSeries[];
  saturdays: readonly string[];
  height: string;
}) {
  const dates = series[0]?.points.map((point) => point.date) ?? [];
  const chartData = dates.map((date, i) => {
    const row: Record<string, string | number | null> = { date };
    series.forEach((game) => {
      row[game.slug] = game.points[i]?.index ?? null;
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
        <ReferenceLine y={100} stroke="hsl(var(--border))" strokeDasharray="2 4" />
        {saturdays.map((date) => (
          <ReferenceLine key={date} x={date} stroke="hsl(var(--muted-foreground) / 0.35)" strokeDasharray="3 3" />
        ))}
        <ChartTooltip
          content={({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: unknown; dataKey?: string; color?: string }>; label?: string }) => {
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
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}

export function EventRhythmChart({
  series,
  saturdays
}: {
  series: readonly IndexedGameSeries[];
  saturdays: readonly string[];
}) {
  return (
    <Figure
      title="Saturday updates lined up with recurring player spikes"
      caption="100 is each game’s own June average; 150 means that day was 50% above its usual June level. The vertical lines mark Saturdays, when most of these games ran a new event."
      source="Source: Bloxodes daily player readings, June 6–30, 2026. Timing shown here does not prove the events caused the swings."
    >
      <IndexedLineChart series={series} saturdays={saturdays} height="h-[22rem]" />
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-border/70 pt-3 text-xs">
        {series.map((game, index) => (
          <span key={game.slug} className="inline-flex items-center gap-1.5 text-muted">
            <span
              className="inline-block w-5 border-t-2"
              style={{
                borderTopColor: game.color,
                borderTopStyle: index === 0 ? "solid" : index === 1 || index === 2 ? "dashed" : "dotted"
              }}
            />
            {game.name}
          </span>
        ))}
      </div>
    </Figure>
  );
}

export function CoolingGamesChart({ series }: { series: readonly IndexedGameSeries[] }) {
  return (
    <Figure
      title="Several fast-moving hits cooled for most of June"
      caption="100 is each game’s own June average. The full paths show these games losing ground across repeated weeks, not just on two selected dates."
      source="Source: Bloxodes daily player readings, June 6–30, 2026."
    >
      <IndexedLineChart series={series} saturdays={[]} height="h-[22rem]" />
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-border/70 pt-3 text-xs">
        {series.map((game, index) => (
          <span key={game.slug} className="inline-flex items-center gap-1.5 text-muted">
            <span
              className="inline-block w-5 border-t-2"
              style={{
                borderTopColor: game.color,
                borderTopStyle: index === 0 ? "solid" : index === 1 || index === 2 ? "dashed" : "dotted"
              }}
            />
            {game.name}
          </span>
        ))}
      </div>
    </Figure>
  );
}
