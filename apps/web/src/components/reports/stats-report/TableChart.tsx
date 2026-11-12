import { useState } from 'react';
import { compact, shortDate, pathFor, direction, type ChartProps, type ChartRow } from './shared';
export function TableChart({ chart }: ChartProps) {
  const [all, setAll] = useState(false);
  const genre = chart.id === 'genre-table';
  const fresh = chart.id === 'new-games';
  const columns = genre ? ['genre', 'players', 'share', 'change', 'top100', 'biggestName'] : fresh ? ['name', 'created', 'genre', 'players', 'rank', 'daily'] : ['rank', 'name', 'genre', 'players', 'peak', 'change', 'visits', 'rating'];
  const labels: Record<string, string> = {
    rank: '#', name: 'Game', genre: 'Genre', players: 'Avg players', peak: 'Peak', change: 'Change', visits: 'Visits', rating: 'Rating', share: 'Share', top100: 'In top 100', biggestName: 'Biggest game', created: 'Released', daily: 'Daily players'
  };
  const visible = columns.filter(key => key !== 'change' || chart.comparison);
  const rows = chart.id === 'top100' && !all ? chart.data.slice(0, 10) : chart.data;
  function cell(row: ChartRow, key: string) {
    if (key === 'name')
      return row.slug ? <a href={`/stats/games/${row.slug}`} className="text-accent">
        {row.name}
      </a> : row.name;
    if (key === 'biggestName')
      return row.biggestSlug ? <a href={`/stats/games/${row.biggestSlug}`} className="text-accent">
        {row.biggestName}
      </a> : row.biggestName;
    if (key === 'genre')
      return row.genre;
    if (key === 'created')
      return shortDate(row.created);
    if (key === 'daily') {
      const count = new Date(Number(chart.month.slice(0, 4)), Number(chart.month.slice(5)), 0).getDate();
      const values = Array.from({
        length: count
      }, (_, index) => row.daily[`${chart.month}-${String(index + 1).padStart(2, '0')}`] ?? null);
      return <svg viewBox="0 0 100 24" width={100} height={24} role="img" aria-label={`${row.name} daily player trend`}>
        <path d={pathFor(values, 100, 24)} fill="none" stroke="var(--chart-1)" />
      </svg>;
    }
    if (key === 'rating')
      return row.rating === null ? '–' : `${row.rating.toFixed(1)}%`;
    if (key === 'share')
      return `${row.share.toFixed(1)}%`;
    if (key === 'change')
      return row.change === null ? 'New' : <span style={{
        color: direction(row.change)
      }}>
        {(genre ? row.change : row.percentChange ?? 0) > 0 ? '+' : ''}
        {genre ? `${row.change.toFixed(1)} pts` : `${row.percentChange?.toFixed(1) ?? '0.0'}%`}
      </span>;
    if (key === 'rank')
      return fresh ? `#${row.rank}` : row.rank;
    if (key === 'top100')
      return row.top100;
    return compact(row[key as 'players' | 'peak' | 'visits']);
  }
  return <div className="max-w-full overflow-x-auto">
    <table className="w-full text-left text-sm">
      <thead>
        <tr>
          {visible.map(key => <th className="whitespace-nowrap border-b border-border px-2 py-2 font-medium text-muted" key={key}>
            {labels[key]}
          </th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => <tr key={row.id ?? index}>
          {visible.map(key => <td key={key} className="whitespace-nowrap border-b border-border px-2 py-2 tabular-nums">
            {cell(row, key)}
          </td>)}
        </tr>)}
      </tbody>
    </table>
    {chart.id === 'top100' && chart.data.length > 10 && <button className="mt-3 text-sm font-semibold text-accent" aria-expanded={all} onClick={() => setAll(!all)}>
      {all ? 'Show 10 games' : `Show all ${chart.data.length} games`}
    </button>}
  </div>;
}
