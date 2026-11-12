import { compact, changeLabel, colors, direction, Tip, type ChartProps } from './shared';
export function BarChart({ chart }: ChartProps) {
  const value = (row: typeof chart.data[number]) => chart.id === 'genre-share' ? row.share : chart.id === 'session-length' ? row.session : row.value ?? row.players;
  const maximum = Math.max(1, ...chart.data.map(value));
  return <div className="space-y-2">
    {chart.data.map((row, index) => {
      const amount = value(row);
      const label = row.name ? `${chart.id === 'top-games' ? `${index + 1}. ` : ''}${row.name}` : row.genre;
      const formatted = chart.id === 'genre-share' ? `${amount.toFixed(1)}%` : chart.id === 'session-length' ? `${Number(amount.toFixed(1))} min` : compact(amount);
      const change = chart.id === 'genre-share' ? row.change : row.rankChange;
      return <Tip key={row.id ?? row.genre} label={`${label}: ${formatted}${chart.comparison ? '; ' + changeLabel(change, chart.id === 'genre-share' ? ' pts' : '') : ''}`}>
        <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-x-2 text-xs sm:grid-cols-[10rem_minmax(0,1fr)_5rem]">
          <span className="break-words sm:row-span-2 sm:text-right">
            {label}
          </span>
          <div className="col-start-1 row-start-2 flex min-w-0 items-center gap-1 sm:col-start-2 sm:row-start-1">
            <span className="h-3 rounded-sm" style={{
              width: `${amount / maximum * 70}%`, background: colors[0]
            }} />
            <b className="shrink-0 tabular-nums">
              {formatted}
            </b>
          </div>
          {chart.comparison && chart.id !== 'session-length' && <span className="col-start-2 row-start-1 row-span-2 text-right tabular-nums sm:col-start-3" style={{
            color: change === 0 ? undefined : direction(change ?? 1)
          }}>
            {changeLabel(change, chart.id === 'genre-share' ? ' pts' : '')}
          </span>}
        </div>
      </Tip>;
    })}
  </div>;
}
