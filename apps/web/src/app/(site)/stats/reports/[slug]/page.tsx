import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { StatsReport } from '../../../../../../../../contracts/stats-report/v1/schema';
import { shortDate } from '../../../../../../../../scripts/reports/format';
import { getStatsReport } from '@/lib/stats-reports';
import { renderMarkdown } from '@/lib/markdown';
import { SITE_URL, buildAlternates } from '@/lib/seo';
import { StatsReportChart } from '@/components/reports/StatsReportChart';
import { StatsContentLayout } from '../../components/StatsContentLayout';

export const revalidate = 3600;
type Props = { params: Promise<{ slug: string; }>; };
const jumpLabels = ['Players', 'Top games', 'Gainers and losers', 'Genres', 'Ratings and session length', 'Events and updates', 'Top 100 table'];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const row = await getStatsReport(slug);
  if (!row) return {};
  return {
    title: row.title,
    description: row.meta_description,
    alternates: buildAlternates(`${SITE_URL}/stats/reports/${slug}`),
    robots: { index: row.visibility === 'public', follow: true },
    openGraph: {
      title: row.title,
      description: row.meta_description,
      images: [row.feature_image_url],
      url: `${SITE_URL}/stats/reports/${slug}`,
      type: 'article',
    },
  };
}

export default async function ReportPage({ params }: Props) {
  const { slug } = await params;
  const row = await getStatsReport(slug);
  if (!row) notFound();
  const { content: report, data } = row;
  const first = new Date(report.month + '-01T00:00:00Z');
  const monthLabel = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const monthName = first.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const updatedLabel = new Date(row.updated_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const previous = new Date(first);
  previous.setUTCMonth(first.getUTCMonth() - 1);
  const previousName = previous.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
  const markdown = async (text: string) => renderMarkdown(text.replace(/\[([^\]]+)\]\(game:(\d+)\)/g,
    (_match: string, name: string, id: string) => `[${name}](/stats/games/${data.games[id].slug})`));

  async function renderBlock(block: StatsReport['body'][number], index: number) {
    switch (block.type) {
      case 'h2':
        return <h2 className="mt-12 mb-3 text-2xl font-bold" id={block.id} key={index}>{block.text}</h2>;
      case 'p':
        return <div className="my-4 text-lg leading-relaxed [&_a]:text-accent" key={index} dangerouslySetInnerHTML={{ __html: await markdown(block.md) }} />;
      case 'chart':
        return <StatsReportChart key={index} chart={data.charts[block.id]} title={report.chart_titles?.[block.id]} markers={block.id === 'players-daily' ? report.markers : []} ratingLabels={report.rating_labels} />;
      case 'dates':
        return <div className="my-8 max-w-full overflow-x-auto" key={index}>
          <table className="w-full text-sm">
            <thead><tr><th className="text-left">Date</th><th className="text-left">What happened</th></tr></thead>
            <tbody>{await Promise.all(block.rows.map(async entry => <tr key={entry.date}>
              <td className="whitespace-nowrap border-b border-border p-2">{shortDate(entry.date)}</td>
              <td className="border-b border-border p-2" dangerouslySetInnerHTML={{ __html: await markdown(entry.md) }} />
            </tr>))}</tbody>
          </table>
        </div>;
    }
  }
  const facts = data.facts;
  const headlineNumber = (value: number) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  const metrics = [
    { value: headlineNumber(facts.avgPlayers), label: 'players online on average', change: facts.playersChange },
    { value: headlineNumber(facts.busiestPlayers), label: `on ${shortDate(facts.busiestDay)}, the busiest day`, change: null },
    { value: headlineNumber(facts.visits), label: 'visits', change: facts.visitsChange },
    { value: `${Math.round(facts.top10Share)}%`, label: 'of players in just 10 games', change: null },
    { value: String(facts.newGames), label: 'new games in the top 100', change: null },
  ];
  const headings = report.body.filter((block): block is Extract<StatsReport['body'][number], { type: 'h2' ;}> => block.type === 'h2');
  const structuredData = {
    '@context': 'https://schema.org', '@type': 'Article', headline: row.title,
    description: row.meta_description, datePublished: row.published_at,
    dateModified: row.updated_at, image: row.feature_image_url,
    mainEntityOfPage: `${SITE_URL}/stats/reports/${slug}`,
  };
  return <StatsContentLayout title={row.title} canonicalPath={`/stats/reports/${slug}`}>
    <article id="article-body" className="min-w-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }} />
      <nav className="mb-4 text-sm text-muted"><a href="/stats">Roblox Stats</a> / <a href="/stats/reports">Reports</a> / {monthLabel}</nav>
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{row.title}</h1>
      <p className="my-4 text-lg leading-relaxed">{row.dek}</p>
      <p className="mb-6 text-sm text-muted">{monthName} 1 to {lastDay}, {first.getUTCFullYear()} · Updated {updatedLabel}</p>
      <div className="flex flex-wrap border-y border-border">{metrics.map(metric => <div className="min-w-28 flex-1 py-4 pr-4" key={metric.label}>
        <b className="block text-2xl">{metric.value}</b>
        <span className="text-sm text-muted">{metric.label}</span>
        {metric.change !== null && <span className="block text-xs" style={{ color: metric.change >= 0 ? 'var(--success)' : 'var(--destructive)' }}>
          {metric.change >= 0 ? '▲' : '▼'} {Math.abs(metric.change).toFixed(1)}% vs {previousName}
        </span>}
      </div>)}</div>
      <h3 className="mt-7 font-bold">The short version</h3>
      <ul className="my-3 list-disc pl-5">{await Promise.all(report.short_version.map(async (text, index) => <li key={index} className="my-2 text-lg" dangerouslySetInnerHTML={{ __html: await markdown(text) }} />))}</ul>
      <nav className="my-6 text-sm text-muted">Jump to: {headings.map((heading, index) => <span key={heading.id}>
        {index > 0 ? ' · ' : ''}<a className="text-accent" href={`#${heading.id}`}>{jumpLabels[index]}</a>
      </span>)}</nav>
      {await Promise.all(report.body.map(renderBlock))}
      <h3 className="mt-10 font-bold">About these numbers</h3>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Players online is the average number of people in a game at the same moment, across the whole month.
        Totals add up more than {Math.floor(facts.trackedGames / 1000) * 1000} Roblox games, so they show the trend, not Roblox&apos;s official count.
        Minutes per visit is an estimate: average players online × 1,440 minutes ÷ visits per day.
        Genres are the ones Roblox lists for each game. Missing days show as gaps.
      </p>
    </article>
  </StatsContentLayout>;
}
