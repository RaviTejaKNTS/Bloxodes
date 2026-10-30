// @vitest-environment jsdom
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { DAY_MS, playersCalendar, type StatsGameInsights } from "@/lib/stats-insights";

// Keep real tabs, cards and tooltips. Only replace chart drawing, which jsdom
// cannot measure, so the test can inspect period data and numeric axis bounds.
vi.mock("recharts", () => {
  const Chart = ({ children, data }: { children?: ReactNode; data?: unknown }) => (
    <div data-chart-points={JSON.stringify(data)}>{children}</div>
  );
  const Empty = () => null;
  return {
    AreaChart: Chart, BarChart: Chart, ScatterChart: Chart,
    Area: Empty, Bar: Empty, CartesianGrid: Empty,
    Scatter: ({ children, data }: { children?: ReactNode; data?: unknown }) => (
      <div data-scatter-points={JSON.stringify(data)}>{children}</div>
    ),
    ReferenceLine: Empty, YAxis: Empty, ZAxis: Empty, LabelList: Empty,
    XAxis: ({ domain, ticks }: { domain?: unknown; ticks?: unknown }) => (
      <span data-axis-domain={JSON.stringify(domain)} data-axis-ticks={JSON.stringify(ticks)} />
    )
  };
});
vi.mock("@/components/ui/chart", async () => {
  const { forwardRef } = await import("react");
  return {
    ChartContainer: forwardRef<HTMLDivElement, { children?: ReactNode; className?: string }>(function TestChart({ children, className }, ref) {
      return <div ref={ref} className={className}>{children}</div>;
    }),
    ChartTooltip: () => null
  };
});

import { BadgesCard, PlayersCalendarCard } from "./StatsInsightCards";
import { PassPriceChart, SessionChart } from "./StatsInsightCharts";
import { chartTabsListClass, chartTabsTriggerClass } from "./stats-chart-styles";

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it("shows all three session tabs with shared chart styling and switches the displayed window", async () => {
  const asOf = "2026-10-25T12:00:00Z";
  const today = Date.parse("2026-10-25T00:00:00Z");
  const points = Array.from({ length: 90 }, (_, index) => ({
    date: new Date(today - (index + 1) * DAY_MS).toISOString().slice(0, 10), minutes: 10
  }));
  await act(async () => root.render(<SessionChart points={points} markers={[]} asOf={asOf} />));
  const tabs = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  expect(tabs.map(tab => tab.textContent)).toEqual(["7D", "30D", "90D"]);
  expect(tabs.map(tab => tab.getAttribute("data-state"))).toEqual(["inactive", "active", "inactive"]);
  for (const tab of tabs) for (const token of chartTabsTriggerClass.split(" ")) expect(tab.classList.contains(token)).toBe(true);
  const list = container.querySelector('[role="tablist"]')!;
  for (const token of chartTabsListClass.split(" ")) expect(list.classList.contains(token)).toBe(true);
  const displayed = () => JSON.parse(container.querySelector('[data-chart-points]')!.getAttribute("data-chart-points")!);
  expect(displayed()).toHaveLength(30);
  for (const [index, days] of [[0, 7], [2, 90]]) {
    await act(async () => { tabs[index].dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); });
    expect(tabs[index].getAttribute("data-state")).toBe("active");
    expect(displayed()).toHaveLength(days);
  }
});

it("keeps the pass strip compact and places a 3399 Robux pass below the last labelled tick", async () => {
  await act(async () => root.render(<PassPriceChart passes={[{ pass_id: 1, name: "VIP", price: 99 }, { pass_id: 2, name: "Rare", price: 3399 }]} />));
  expect(container.firstElementChild?.classList.contains("h-[96px]")).toBe(true);
  const axis = container.querySelector('[data-axis-ticks]')!;
  expect(JSON.parse(axis.getAttribute("data-axis-domain")!)).toEqual([50, 5000]);
  expect(JSON.parse(axis.getAttribute("data-axis-ticks")!)).toContain(5000);
  const scatter = () => JSON.parse(container.querySelector('[data-scatter-points]')!.getAttribute("data-scatter-points")!);
  expect(scatter().map((point: { row: number }) => point.row)).toEqual([-.5, .5]);
  await act(async () => root.render(<PassPriceChart passes={[{ pass_id: 1, name: "VIP", price: 99 }]} />));
  expect(scatter()[0].row).toBe(0);
});

it("renders average-player calendar copy and puts weekday labels in matching fixed rows", async () => {
  const weeks = playersCalendar([{ stat_date: "2026-10-24", playing: 16000000 }], Date.parse("2026-10-25T12:00:00Z"));
  await act(async () => root.render(<PlayersCalendarCard weeks={weeks} />));
  expect(container.textContent).toContain("Players by day");
  expect(container.textContent).toContain("Average players across tracked games, last 13 weeks. Darker = busier day.");
  expect(container.textContent).toContain("Busiest day: 16M on Saturday, Oct 24");
  expect(container.textContent).not.toContain("peak players");
  const grids = [...container.querySelectorAll<HTMLElement>('[style*="grid-template-rows"]')];
  expect(grids).toHaveLength(14); // Labels plus 13 Sunday-first weeks.
  expect(grids.every(grid => grid.style.gridTemplateRows === "repeat(7, 1rem)")).toBe(true);
  expect([...grids[0].children].map(row => row.textContent)).toEqual(["Sun", "Mon", "", "Wed", "", "Fri", ""]);
  const lastWeek = grids[grids.length - 2];
  expect(lastWeek.children[6].getAttribute("aria-label")).toBe("2026-10-24: 16,000,000 players");
  await act(async () => { (lastWeek.children[6] as HTMLElement).focus(); });
  expect(document.body.textContent).toContain("Sat, Oct 24, 2026 · 16,000,000 players");
});

it("preserves the badge rarity wording", async () => {
  const data = {
    badges: [{ badge_id: 1, name: "Winner", enabled: true, rarity_percent: .1, stats_updated_at: "2026-10-24T00:00:00Z" }]
  } as StatsGameInsights;
  await act(async () => root.render(<BadgesCard data={data} />));
  for (const text of ["Badge rarity", "Most common to rarest. A lower % is a rarer badge."]) {
    expect(container.textContent).toContain(text);
  }
  await act(async () => { container.querySelector<HTMLElement>('[tabindex="0"]')!.focus(); });
  expect(document.body.textContent).toContain("Winner · 10% rarity");
});
