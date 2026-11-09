import { shortDate, colors, Tip, type ChartProps } from './shared';
export function StackedChart({ chart }: ChartProps) {
  return <div className="space-y-2">
    {chart.data.map(row => <Tip key={row.week} label={`${shortDate(row.week)}: Top 10 ${row.top10.toFixed(1)}%; 11 to 100 ${row.top100.toFixed(1)}%; rest ${row.rest.toFixed(1)}%`}>
      <div className="flex items-center gap-2 text-xs">
        <span className="w-12 shrink-0">
          {shortDate(row.week)}
        </span>
        <div className="flex h-6 min-w-0 flex-1">
          {[row.top10, row.top100, row.rest].map((value, index) => <span key={index} className="flex items-center justify-center overflow-hidden text-[10px]" style={{
            width: `${value}%`, background: `color-mix(in oklab, ${colors[0]} ${[100, 55, 22][index]}%, transparent)`
          }}>
            {value >= 10 ? `${Math.round(value)}%` : ''}
          </span>)}
        </div>
      </div>
    </Tip>)}
  </div>;
}
