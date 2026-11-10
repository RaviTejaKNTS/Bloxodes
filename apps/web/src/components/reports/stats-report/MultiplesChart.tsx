import { compact, colors, fromEnd, pathFor, Tip, type ChartProps } from './shared';
export function MultiplesChart({ chart }: ChartProps) {
  return <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
    {chart.data.map(row => {
      const values = row.points.map(point => point.value);
      const latest = fromEnd(values) ?? 0;
      const color = latest >= (fromEnd(values, 2) ?? latest) ? colors[0] : colors[3];
      return <Tip key={row.genre} label={`${row.genre}: ${row.points.map(point => `${point.week}: ${compact(point.value ?? 0)}`).join('; ')}`}>
        <b className="block text-xs">
          {row.genre}
        </b>
        <span className="text-xs text-muted">
          {compact(latest)}
        </span>
        <svg viewBox="0 0 156 48" className="w-full" aria-hidden="true">
          <path d={pathFor(values, 150, 38, Math.min(...values.map(v => v ?? 0)))} transform="translate(3 3)" fill="none" stroke={color} strokeWidth={2} />
        </svg>
      </Tip>;
    })}
  </div>;
}
