import type { ReactNode } from 'react';
export { compact, shortDate } from '../../../../../../scripts/reports/format';
export interface Point {
  date: string;
  week: string;
  value: number | null;
  rank: number | null;
}
export interface ChartRow {
  id: number;
  name: string;
  genre: string;
  slug: string;
  rank: number;
  players: number;
  peak: number;
  visits: number;
  rating: number | null;
  change: number | null;
  rankChange: number | null;
  percentChange: number | null;
  share: number;
  session: number;
  top100: number;
  top10: number;
  rest: number;
  biggestName: string;
  biggestSlug: string;
  created: string;
  daily: Record<string, number>;
  points: Point[];
  date: string;
  week: string;
  value: number | null;
  previous: number | null;
  weekend: boolean;
  weekday: number;
  hour: number;
  before: number;
  after: number;
  percent: number;
}
export interface Chart {
  id: string;
  kind: string;
  month: string;
  comparison: boolean;
  data: ChartRow[];
}
export interface ChartProps {
  chart: Chart;
}
export const colors = [1, 2, 3, 4, 5].map(index => `var(--chart-${index})`);
export const muted = 'var(--muted-foreground)';
export const direction = (value: number) => value >= 0 ? 'var(--success)' : 'var(--destructive)';
export const changeLabel = (value: number | null, suffix = '') => value === null ? 'New' : value === 0 ? '–' : `${value > 0 ? '▲' : '▼'} ${Math.abs(value).toFixed(suffix ? 1 : 0)}${suffix}`;
export function Tip({ label, children }: {
  label: string;
  children: ReactNode;
}) {
  return <div tabIndex={0} aria-label={label} className="group relative min-w-0 outline-offset-2">
    {children}
    <span role="tooltip" className="pointer-events-none absolute bottom-full left-0 z-10 hidden max-w-full rounded border border-border bg-surface p-2 text-xs text-foreground shadow group-hover:block group-focus:block">
      {label}
    </span>
  </div>;
}
export function pathFor(values: (number | null)[], width: number, height: number, min = 0, max = Math.max(1, ...values.map(value => value ?? 0))) {
  let active = false;
  return values.map((value, index) => {
    if (value === null) {
      active = false;
      return '';
    }
    const command = `${active ? 'L' : 'M'}${index * width / Math.max(1, values.length - 1)},${height - (value - min) / Math.max(1, max - min) * height}`;
    active = true;
    return command;
  }).join(' ');
}
