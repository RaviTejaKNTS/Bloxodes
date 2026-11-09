import { compact, direction, muted, Tip, type ChartProps } from './shared';
export function DumbbellChart({ chart }: ChartProps) {
  const values = chart.data.flatMap(row => [row.before, row.after]).filter(value => value > 0);
  const min = Math.log10(Math.min(...values));
  const range = Math.max(.01, Math.log10(Math.max(...values)) - min);
  const x = (value: number) => 8 + (Math.log10(Math.max(value, 1)) - min) / range * 184;
  return <div className="space-y-2">
    {chart.data.map(row => <Tip key={`${row.id}-${row.date}`} label={`${row.name}, ${row.date}: ${compact(row.before)} before; ${compact(row.after)} after; ${row.percent.toFixed(1)}% change`}>
      <div className="grid grid-cols-[minmax(0,1fr)_4rem] text-xs">
        <span>
          {row.name}
        </span>
        <b className="text-right" style={{
          color: direction(row.after - row.before)
        }}>
          {row.percent > 0 ? '+' : ''}
          {row.percent.toFixed(1)}%
        </b>
      </div>
      <svg viewBox="0 0 200 20" className="h-6 w-full" preserveAspectRatio="none" aria-hidden="true">
        <line x1={x(row.before)} x2={x(row.after)} y1={10} y2={10} stroke={direction(row.after - row.before)} />
        <ellipse cx={x(row.before)} cy={10} rx={2} ry={4} fill={muted} />
        <ellipse cx={x(row.after)} cy={10} rx={2} ry={4} fill={direction(row.after - row.before)} />
      </svg>
    </Tip>)}
    <div className="flex justify-between text-xs text-muted">
      <span>
        {compact(Math.min(...values))}
      </span>
      <span>
        {compact(Math.max(...values))} players, log scale
      </span>
    </div>
  </div>;
}
