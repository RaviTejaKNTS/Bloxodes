import { compact, colors, muted, pathFor, type ChartProps } from './shared';
export function LinesChart({ chart }: ChartProps) {
  const maximum = Math.max(1, ...chart.data.flatMap(row => row.points.map(point => point.value ?? 0)));
  return <svg viewBox="0 0 360 220" className="w-full text-[10px]" role="img" aria-label="Daily players for the selected games">
    {[0, .5, 1].map(part => <g key={part}>
      <line x1={36} x2={270} y1={190 - part * 170} y2={190 - part * 170} stroke="var(--border)" />
      <text x={32} y={194 - part * 170} textAnchor="end" fill={muted}>{compact(part * maximum)}</text>
    </g>)}
    {chart.data.map((row, index) => <g key={row.id ?? row.name} tabIndex={0} aria-label={`${row.name}: ${row.points.map(point => `${point.date}: ${point.value === null ? 'missing' : compact(point.value)}`).join('; ')}`}>
      <path d={pathFor(row.points.map(point => point.value), 234, 170, 0, maximum)} transform="translate(36 20)" fill="none" stroke={colors[index % colors.length]} strokeWidth={2} />
      <text x={280} y={25 + index * 25} fill={colors[index % colors.length]}>{row.name.slice(0, 14)}</text>
    </g>)}
  </svg>;
}
