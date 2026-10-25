"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, Scatter, ScatterChart, XAxis, YAxis, ZAxis, LabelList } from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCompactNumber, formatFullNumber, formatPercent } from "@/lib/stats-format";
import {
  DAY_MS, dayTime, passPriceAxis, scatterLabels,
  type GenreScatter, type PassInsight, type SessionPoint, type UpdateMarker, type VotePoint
} from "@/lib/stats-insights";
import { chartTabsListClass, chartTabsTriggerClass } from "./stats-chart-styles";

const dateLabel = (date: string) => new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const plotClass = "aspect-auto h-[220px] w-full";
const axis = { tickLine: false, axisLine: false, tick: { fill: "rgb(var(--color-muted))", fontSize: 10 } };

function HoverBox({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-64 rounded-md border border-border bg-surface px-3 py-2 text-xs text-foreground shadow-md">
      {children}
    </div>
  );
}

export function InsightTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent className="max-w-72">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function VotesTooltip({ point }: { point: VotePoint }) {
  return (
    <HoverBox>
      <div>{dateLabel(point.date)}</div>
      <div>Likes: {formatFullNumber(point.likes)}</div>
      <div>Dislikes: {formatFullNumber(point.dislikes)}</div>
    </HoverBox>
  );
}

export function VotesChart({ points, asOf }: { points: VotePoint[]; asOf: string }) {
  const data = points.map(point => ({ ...point, time: dayTime(point.date), down: -point.dislikes }));
  return (
    <ChartContainer config={{ likes: { label: "Likes", color: "#10b981" }, dislikes: { label: "Dislikes", color: "#f43f5e" } }} className={plotClass}>
      <BarChart data={data} stackOffset="sign" margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          {...axis} dataKey="time" type="number"
          domain={[dayTime(asOf) - 21 * DAY_MS, dayTime(asOf) - DAY_MS]}
          tickFormatter={value => dateLabel(new Date(value).toISOString())} minTickGap={32}
        />
        <YAxis {...axis} width={44} tickFormatter={value => formatCompactNumber(Math.abs(value))} />
        <ReferenceLine y={0} stroke="rgb(var(--color-border))" />
        <ChartTooltip content={({ active, payload }) => {
          const point = payload?.[0]?.payload as VotePoint | undefined;
          return active && point ? <VotesTooltip point={point} /> : null;
        }} />
        <Bar dataKey="likes" stackId="votes" fill="var(--color-likes)" isAnimationActive={false} />
        <Bar dataKey="down" stackId="votes" fill="var(--color-dislikes)" isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  );
}

function SessionTooltip({ point }: { point: SessionPoint }) {
  return (
    <HoverBox>
      <div>{dateLabel(point.date)}</div>
      <div>{formatFullNumber(Math.round(point.minutes! * 10) / 10)} minutes per visit</div>
    </HoverBox>
  );
}

function UpdateMarkerLabel({ marker, viewBox }: { marker: UpdateMarker; viewBox?: { x?: number; y?: number } }) {
  const label = `${dateLabel(marker.date)} · ${marker.label}`;
  return (
    <text
      x={viewBox?.x} y={(viewBox?.y ?? 0) + 10} textAnchor="middle"
      fill="rgb(var(--color-muted))" tabIndex={0} aria-label={label}
    >
      <title>{label}</title>↑
    </text>
  );
}

export function SessionChart({ points, markers, asOf }: { points: SessionPoint[]; markers: UpdateMarker[]; asOf: string }) {
  const [days, setDays] = useState("30");
  const today = dayTime(asOf);
  const start = today - Number(days) * DAY_MS;
  const data = points.filter(point => dayTime(point.date) >= start).map(point => ({ ...point, time: dayTime(point.date) }));
  const visibleMarkers = markers.filter(marker => Date.parse(marker.date) >= start && Date.parse(marker.date) < today);
  return (
    <>
      <Tabs value={days} onValueChange={setDays} className="mb-3">
        <TabsList aria-label="Session length period" className={chartTabsListClass}>
          {["7", "30", "90"].map(value => (
            <TabsTrigger key={value} value={value} className={chartTabsTriggerClass}>{value}D</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <ChartContainer config={{ minutes: { label: "Minutes per visit", color: "rgb(var(--color-accent))" } }} className={plotClass}>
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 20, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            {...axis} type="number" dataKey="time" domain={[start, today - DAY_MS]}
            tickFormatter={value => dateLabel(new Date(value).toISOString())} minTickGap={32}
          />
          <YAxis {...axis} width={40} tickFormatter={value => `${value}m`} />
          <ChartTooltip content={({ active, payload }) => {
            const point = payload?.[0]?.payload as SessionPoint | undefined;
            return active && point?.minutes != null ? <SessionTooltip point={point} /> : null;
          }} />
          {visibleMarkers.map(marker => (
            <ReferenceLine
              key={marker.date} x={dayTime(marker.date)} stroke="rgb(var(--color-muted))" strokeDasharray="3 4"
              label={props => <UpdateMarkerLabel marker={marker} viewBox={props.viewBox as { x?: number; y?: number }} />}
            />
          ))}
          <Area type="linear" dataKey="minutes" stroke="var(--color-minutes)" fill="var(--color-minutes)" fillOpacity={.12} connectNulls={false} isAnimationActive={false} />
        </AreaChart>
      </ChartContainer>
    </>
  );
}

function ScatterTooltip({ point }: { point: GenreScatter['current'] }) {
  return (
    <HoverBox>
      <div className="font-semibold">{point.name}</div>
      <div>{formatFullNumber(point.players)} players</div>
      <div>{formatPercent(point.rating)} rating</div>
    </HoverBox>
  );
}

export function GenreScatterChart({ data }: { data: GenreScatter }) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    setWidth(element.clientWidth);
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const peers = data.points.filter(point => point.universeId !== data.current.universeId);
  const all = [...peers, data.current];
  const minX = Math.max(0, Math.min(...all.map(point => point.rating)) - 2);
  const maxX = Math.min(100, Math.max(...all.map(point => point.rating)) + 2);
  const labels = scatterLabels(data, width);
  const withLabels = (point: GenreScatter['current']) => {
    const label = labels.get(point.universeId);
    return {
      ...point,
      leftLabel: label?.position === "left" ? label.text : "",
      rightLabel: label?.position === "right" ? label.text : ""
    };
  };
  return (
    <ChartContainer ref={container} config={{ peers: { color: "rgb(var(--color-accent))" }, current: { color: "#f59e0b" } }} className={plotClass}>
      <ScatterChart margin={{ left: 0, right: 24, top: 24, bottom: 0 }}>
        <CartesianGrid />
        <XAxis {...axis} dataKey="rating" type="number" domain={[minX, maxX]} unit="%" tickCount={4} />
        <YAxis
          {...axis} dataKey="players" type="number" scale="log"
          domain={[Math.min(...all.map(point => point.players)) / 1.5, Math.max(...all.map(point => point.players)) * 1.7]}
          tickFormatter={value => formatCompactNumber(value)} width={48} allowDataOverflow
        />
        <ZAxis range={[35, 35]} />
        <ChartTooltip content={({ active, payload }) => {
          const point = payload?.[0]?.payload as GenreScatter['current'] | undefined;
          return active && point ? <ScatterTooltip point={point} /> : null;
        }} />
        <Scatter data={peers.map(withLabels)} fill="var(--color-peers)" fillOpacity={.5} isAnimationActive={false}>
          <LabelList dataKey="leftLabel" position="left" fontSize={9} fill="rgb(var(--color-muted))" />
          <LabelList dataKey="rightLabel" position="right" fontSize={9} fill="rgb(var(--color-muted))" />
        </Scatter>
        <Scatter data={[withLabels(data.current)]} fill="var(--color-current)" isAnimationActive={false}>
          <LabelList dataKey="leftLabel" position="left" fontSize={10} fill="var(--color-current)" />
          <LabelList dataKey="rightLabel" position="right" fontSize={10} fill="var(--color-current)" />
        </Scatter>
      </ScatterChart>
    </ChartContainer>
  );
}

function PassTooltip({ pass, passes }: { pass: PassInsight; passes: PassInsight[] }) {
  return (
    <HoverBox>
      <div className="max-h-48 overflow-y-auto">
        {passes.filter(item => item.price === pass.price).map(item => (
          <div key={item.pass_id} className="font-semibold">{item.name}</div>
        ))}
      </div>
      <div>{formatFullNumber(pass.price)} Robux</div>
    </HoverBox>
  );
}

export function PassPriceChart({ passes }: { passes: PassInsight[] }) {
  const { domain, ticks } = passPriceAxis(passes.map(pass => pass.price));
  const rowCenter = (Math.min(5, passes.length) - 1) / 2;
  return (
    <ChartContainer config={{ price: { color: "rgb(var(--color-accent))" } }} className="aspect-auto h-[96px] w-full">
      <ScatterChart margin={{ left: 12, right: 20, top: 8, bottom: 0 }}>
        <XAxis
          {...axis} dataKey="price" type="number" scale="log" domain={domain} ticks={ticks}
          tickFormatter={value => formatCompactNumber(value)} minTickGap={8}
        />
        <YAxis hide dataKey="row" type="number" domain={[-2.5, 2.5]} />
        <ZAxis range={[60, 60]} />
        <ChartTooltip content={({ active, payload }) => {
          const point = payload?.[0]?.payload as PassInsight | undefined;
          return active && point ? <PassTooltip pass={point} passes={passes} /> : null;
        }} />
        <Scatter data={passes.map((pass, index) => ({ ...pass, row: index % 5 - rowCenter }))} fill="var(--color-price)" isAnimationActive={false} />
      </ScatterChart>
    </ChartContainer>
  );
}
