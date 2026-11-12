'use client';
import { ChartTooltip } from './stats-report/ChartTooltip';
import { BarChart } from './stats-report/BarChart';
import { BumpChart } from './stats-report/BumpChart';
import { DivergingChart } from './stats-report/DivergingChart';
import { DumbbellChart } from './stats-report/DumbbellChart';
import { HeatmapChart } from './stats-report/HeatmapChart';
import { LinesChart } from './stats-report/LinesChart';
import { LineChart } from './stats-report/LineChart';
import { MultiplesChart } from './stats-report/MultiplesChart';
import { ScatterChart } from './stats-report/ScatterChart';
import { StackedChart } from './stats-report/StackedChart';
import { TableChart } from './stats-report/TableChart';
import { colors, type Chart } from './stats-report/shared';
const titles: Record<string, string> = {
  'players-daily': 'Players online each day', 'busiest-hours': 'When Roblox is busiest, by hour (UTC)',
  'top-games': 'Top 20 games by average players online', 'top10-weekly': 'The top 10, week by week',
  concentration: 'Share of players in the biggest games', movers: 'Biggest gains and losses in players',
  'new-games': 'New games in the top 100', 'genre-share': 'Share of players by genre',
  'genre-trends': 'Genres week by week', 'genre-table': 'Every genre',
  'rating-vs-size': 'Players vs like rating, top 100 games', 'session-length': 'Average minutes per visit, by genre',
  'update-effect': 'Players the week before and after an update', top100: 'Top 100 games'
};
export function StatsReportChart({ chart, title, markers, ratingLabels }: {
  chart: Chart;
  title?: string;
  markers?: {
    date: string;
    label: string;
  }[];
  ratingLabels?: number[];
}) {
  const name = title ?? titles[chart.id] ?? chart.id;
  let visual;
  switch (chart.kind) {
    case 'line':
      visual = <LineChart chart={chart} markers={markers} />;
      break;
    case 'bump':
      visual = <BumpChart chart={chart} />;
      break;
    case 'table':
      visual = <TableChart chart={chart} />;
      break;
    case 'heatmap':
      visual = <HeatmapChart chart={chart} />;
      break;
    case 'stacked':
      visual = <StackedChart chart={chart} />;
      break;
    case 'diverging':
      visual = <DivergingChart chart={chart} />;
      break;
    case 'lines':
      visual = <LinesChart chart={chart} />;
      break;
    case 'multiples':
      visual = <MultiplesChart chart={{
        ...chart, data: chart.data.map(row => ({
          ...row, genre: row.genre ?? row.name
        }))
      }} />;
      break;
    case 'scatter':
      visual = <ScatterChart chart={chart} ratingLabels={ratingLabels} />;
      break;
    case 'dumbbell':
      visual = <DumbbellChart chart={chart} />;
      break;
    default: visual = <BarChart chart={chart} />;
  }
  return <figure data-report-chart={chart.id} className="my-8 min-w-0 max-w-full">
    <figcaption className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm font-bold">
      {name}
      {chart.kind === 'stacked' && <span className="inline-flex flex-wrap gap-3 text-xs font-normal text-muted">
        {['Top 10', '11 to 100', 'Everything else'].map((label, index) => <span key={label}>
          <i className="mr-1 inline-block h-2 w-2 rounded-sm" style={{
            background: `color-mix(in oklab, ${colors[0]} ${[100, 55, 22][index]}%, transparent)`
          }} />
          {label}
        </span>)}
      </span>}
    </figcaption>
    <ChartTooltip>
      {visual}
    </ChartTooltip>
    <details className="sr-only">
      <summary>
        {name}: data table

      </summary>
      <table>
        <thead>
          <tr>
            {Object.keys(chart.data[0] ?? {}).map(key => <th key={key}>
              {key}
            </th>)}
          </tr>
        </thead>
        <tbody>
          {chart.data.map((row, index) => <tr key={index}>
            {Object.keys(chart.data[0] ?? {}).map(key => <td key={key}>
              {JSON.stringify(row[key as keyof typeof row])}
            </td>)}
          </tr>)}
        </tbody>
      </table>
    </details>
  </figure>;
}
