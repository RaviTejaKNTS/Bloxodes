import { colors, muted, shortDate, type ChartProps, type ChartRow } from './shared';
export function BumpChart({ chart }: ChartProps) {
  const ranks = (row: ChartRow) => row.points.flatMap(point => point.rank === null ? [] : [point.rank]);
  const movement = (row: ChartRow) => {
    const values = ranks(row);
    return Math.abs((values[0] ?? 0) - (values.at(-1) ?? 0));
  };
  const highlights = [...chart.data].sort((a, b) => movement(b) - movement(a)).slice(0, 4).map(row => row.id);
  const maximum = Math.max(10, ...chart.data.flatMap(ranks));
  const y = (rank: number) => 18 + (rank - 1) / Math.max(1, maximum - 1) * 300;
  function labelPositions(last: boolean) {
    const sorted = [...chart.data].sort((a, b) => {
      const ar = ranks(a), br = ranks(b);
      return (last ? ar.at(-1)! - br.at(-1)! : ar[0] - br[0]);
    });
    let previous = 4;
    return new Map(sorted.map(row => {
      const values = ranks(row);
      const position = Math.max(previous + 14, y((last ? values.at(-1) : values[0]) ?? 1));
      previous = position;
      return [row.id, position];
    }));
  }
  const left = labelPositions(false), right = labelPositions(true);
  const height = Math.max(350, ...left.values(), ...right.values()) + 20;
  return <svg viewBox={`0 0 360 ${height}`} className="w-full text-[10px]" role="img" aria-label="Weekly ranks, four biggest movers highlighted">
    {chart.data.map(row => {
      const color = highlights.includes(row.id) ? colors[highlights.indexOf(row.id)] : muted;
      const values = ranks(row);
      let drawing = false;
      const path = row.points.map((point, index) => {
        if (point.rank === null) { drawing = false; return ''; }
        const command = `${drawing ? 'L' : 'M'}${95 + index * 155 / Math.max(1, row.points.length - 1)},${y(point.rank)}`;
        drawing = true;
        return command;
      }).join(' ');
      return <g key={row.id} tabIndex={0} aria-label={`${row.name}: ${row.points.map(point => `${point.week} rank ${point.rank ?? 'missing'}`).join('; ')}`}>
        <path d={path} fill="none" stroke={color} strokeWidth={highlights.includes(row.id) ? 2 : 1} opacity={highlights.includes(row.id) ? 1 : .4} />
        <text x={90} y={left.get(row.id)} textAnchor="end" fill={color}>{row.name.slice(0, 17)}</text>
        <text x={255} y={right.get(row.id)} fill={color}>#{values.at(-1)} {row.name.slice(0, 15)}</text>
      </g>;
    })}
    <text x={95} y={height - 3} fill={muted}>{chart.data[0]?.points[0]?.week ? shortDate(chart.data[0].points[0].week) : ''}</text>
    <text x={250} y={height - 3} textAnchor="end" fill={muted}>{chart.data[0]?.points.at(-1)?.week ? shortDate(chart.data[0].points.at(-1)!.week) : ''}</text>
  </svg>;
}
