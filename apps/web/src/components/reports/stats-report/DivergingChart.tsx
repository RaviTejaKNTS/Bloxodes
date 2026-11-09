import { compact, direction, Tip, type ChartProps } from './shared';
export function DivergingChart({ chart }: ChartProps) {
  const maximum = Math.max(1, ...chart.data.map(row => Math.abs(row.change ?? 0)));
  return <div className="space-y-2">
    {chart.data.map(row => {
      const change = row.change ?? 0;
      const label = `${change >= 0 ? '+' : '−'}${compact(Math.abs(change))}`;
      return <Tip key={row.id} label={`${row.name}: ${label} players`}>
        <div className="grid grid-cols-[minmax(0,1fr)_4rem] gap-2 text-xs">
          <span>
            {row.name}
          </span>
          <b className="text-right" style={{
            color: direction(change)
          }}>
            {label}
          </b>
        </div>
        <div className="relative h-4 border-l border-border">
          <span className="absolute left-1/2 h-full border-l border-border" />
          <span className="absolute top-1 h-2" style={{
            left: change < 0 ? `${50 - Math.abs(change) / maximum * 50}%` : '50%', width: `${Math.abs(change) / maximum * 50}%`, background: direction(change)
          }} />
        </div>
      </Tip>;
    })}
  </div>;
}
