import { compact, colors, Tip, type ChartProps } from './shared';
export function HeatmapChart({ chart }: ChartProps) {
  const maximum = Math.max(1, ...chart.data.map(row => row.value ?? 0));
  return <div className="grid grid-cols-[2rem_repeat(24,minmax(0,1fr))] gap-px">
    {Array.from({
      length: 7
    }, (_, weekday) => <div className="contents" key={weekday}>
      <span className="text-xs">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][weekday]}
      </span>
      {chart.data.filter(row => row.weekday === weekday).map(row => <Tip key={row.hour} label={`${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][weekday]} ${row.hour}:00 UTC: ${compact(row.value ?? 0)}`}>
        <div className="h-6" style={{
          background: colors[0], opacity: .15 + .85 * (row.value ?? 0) / maximum
        }} />
      </Tip>)}
    </div>)}
    <span />
    {Array.from({
      length: 24
    }, (_, hour) => <span key={hour} className="text-[9px]">
      {hour % 3 === 0 ? hour : ''}
    </span>)}
  </div>;
}
