import { compact, shortDate, colors, muted, pathFor, type ChartProps } from './shared';
export function LineChart({ chart, markers = [] }: ChartProps & {
  markers?: {
    date: string;
    label: string;
  }[];
}) {
  const rows = chart.data;
  const maximum = Math.max(1, ...rows.flatMap(row => [row.value ?? 0, row.previous ?? 0]));
  const x = (index: number) => 36 + index * 244 / Math.max(1, rows.length - 1);
  const y = (value: number) => 192 - value / maximum * 168;
  const label = (month: string) => new Date(month + '-01T00:00:00Z').toLocaleString('en-US', {
    month: 'short', timeZone: 'UTC'
  });
  const previousMonth = new Date(chart.month + '-01T00:00:00Z');
  previousMonth.setUTCMonth(previousMonth.getUTCMonth() - 1);
  return <svg viewBox="0 0 360 220" className="w-full text-[10px]" role="img" aria-label="Daily average players, with missing days shown as gaps">
    {rows.map((row, index) => row.weekend && <rect key={row.date} x={x(index) - 4} y={20} width={8} height={172} fill="currentColor" opacity={.06} />)}
    {[0, .5, 1].map(part => <g key={part}>
      <line x1={36} x2={280} y1={y(part * maximum)} y2={y(part * maximum)} stroke="var(--border)" />
      <text x={32} y={y(part * maximum) + 3} textAnchor="end" fill={muted}>
        {compact(part * maximum)}
      </text>
    </g>)}
    {(['previous', 'value'] as const).map(key => {
      const values = rows.map(row => row[key]);
      const last = values.findLastIndex(value => value !== null);
      const color = key === 'value' ? colors[0] : muted;
      return last < 0 ? null : <g key={key}>
        <path d={pathFor(values, 244, 168, 0, maximum)} transform="translate(36 24)" fill="none" stroke={color} strokeWidth={2} strokeDasharray={key === 'previous' ? '5 4' : undefined} />
        <circle cx={x(last)} cy={y(values[last]!)} r={3} fill={color} />
        <text x={x(last) + 5} y={y(values[last]!) + (key === 'previous' ? 14 : -3)} fill={color}>
          {key === 'value' ? label(chart.month) : label(previousMonth.toISOString().slice(0, 7))}
        </text>
      </g>;
    })}
    {markers.map(marker => {
      const index = rows.findIndex(row => row.date === marker.date); return index < 0 ? null : <g key={marker.date}>
        <line x1={x(index)} x2={x(index)} y1={10} y2={192} stroke={muted} strokeDasharray="3 3" />
        <text x={x(index)} y={16} textAnchor={index > rows.length / 2 ? 'end' : 'start'} fill={muted}>
          {marker.label}
        </text>
      </g>;
    })}
    {rows.map((row, index) => <g key={row.date} tabIndex={0} aria-label={`${shortDate(row.date)}: ${row.value === null ? 'missing' : compact(row.value)}`}>
      <title>
        {shortDate(row.date)}:
        {row.value === null ? 'missing' : compact(row.value)}; previous:
        {row.previous === null ? 'missing' : compact(row.previous)}
      </title>
      <rect x={x(index) - 4} width={8} y={20} height={172} fill="transparent" />
      {index % 7 === 0 && <text x={x(index)} y={212} fill={muted} textAnchor="middle">
        {shortDate(row.date)}
      </text>}
    </g>)}
  </svg>;
}
