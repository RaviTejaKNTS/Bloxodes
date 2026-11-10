import { compact, colors, muted, type ChartProps } from './shared';
export function ScatterChart({ chart, ratingLabels = [] }: ChartProps & {
  ratingLabels?: number[];
}) {
  const rows = chart.data.filter(row => row.rating !== null && row.players > 0);
  const rated = [...rows].sort((a, b) => b.rating! - a.rating!);
  const selected = ratingLabels.length ? ratingLabels : [...rows.slice(0, 2), ...rated.slice(0, 2), ...rated.slice(-1)].map(row => row.id);
  const min = Math.log10(Math.min(...rows.map(row => row.players)));
  const max = Math.log10(Math.max(...rows.map(row => row.players)));
  const x = (players: number) => 35 + (Math.log10(players) - min) / Math.max(.01, max - min) * 300;
  const y = (rating: number) => 220 - rating * 2;
  return <svg viewBox="0 0 360 250" className="w-full text-[10px]" role="img" aria-label="Player count on a log scale against like rating">
    {[0, 25, 50, 75, 100].map(rating => <g key={rating}>
      <text x={30} y={y(rating) + 3} fill={muted} textAnchor="end">
        {rating}%
      </text>
      <line x1={35} x2={335} y1={y(rating)} y2={y(rating)} stroke="var(--border)" />
    </g>)}
    {[min, (min + max) / 2, max].map(value => <text key={value} x={x(10 ** value)} y={240} fill={muted} textAnchor="middle">
      {compact(10 ** value)}
    </text>)}
    {rows.map(row => <g key={row.id} tabIndex={0} aria-label={`${row.name}: ${compact(row.players)} players, ${row.rating!.toFixed(1)}% rating`}>
      <title>
        {row.name}:
        {compact(row.players)} players;
        {row.rating!.toFixed(1)}%
      </title>
      <circle cx={x(row.players)} cy={y(row.rating!)} r={selected.includes(row.id) ? 4 : 3} fill={colors[0]} opacity={selected.includes(row.id) ? 1 : .35} />
      {selected.includes(row.id) && <text x={x(row.players)} y={y(row.rating!) - 7} textAnchor={x(row.players) > 180 ? 'end' : 'start'} fill="currentColor">
        {row.name}
      </text>}
    </g>)}
  </svg>;
}
