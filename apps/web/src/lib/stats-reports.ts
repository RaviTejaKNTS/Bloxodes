import 'server-only';
import { unstable_cache } from 'next/cache';
import type { StatsReport } from '../../../../contracts/stats-report/v1/schema';
import type { Chart } from '@/components/reports/stats-report/shared';
import { supabaseAdmin } from './supabase';
import { PUBLISHED_STATS_REPORTS } from '@/data/reports/published';
export type ReportListing = {
  href: string;
  month: string;
  title: string;
  description: string;
  image: {
    src: string;
    alt: string;
  };
  updatedAt: string;
  publishedAt: string;
};
async function fetchStatsReport(slug: string) {
  if (!/^roblox-[a-z]+-\d{4}$/.test(slug))
    return null;
  const { data, error } = await supabaseAdmin().from('stats_reports').select('*').eq('slug', slug).maybeSingle();
  if (error) {
    throw error;
  }
  return data as StatsReportRow | null;
}
export interface StatsReportRow {
  title: string;
  slug: string;
  meta_description: string;
  dek: string;
  visibility: 'public' | 'hidden';
  feature_image_url: string;
  updated_at: string;
  published_at: string;
  content: StatsReport;
  data: {
    facts: {
      avgPlayers: number;
      busiestPlayers: number;
      busiestDay: string;
      visits: number;
      playersChange: number | null;
      visitsChange: number | null;
      top10Share: number;
      newGames: number;
      trackedGames: number;
    };
    charts: Record<string, Chart>;
    games: Record<string, {
      slug: string;
    }>;
  };
}
export const getStatsReport = (slug: string) => unstable_cache(() => fetchStatsReport(slug), ['stats-report-v1', slug], {
  revalidate: 3600,
  tags: ['stats', 'stats-reports', `stats-report:${slug}`]
})();
function staticReportListings(): ReportListing[] {
  return PUBLISHED_STATS_REPORTS.map(r => ({
    ...r,
    updatedAt: r.updatedAt,
    publishedAt: r.publishedAt
  }));
}
async function fetchStatsReports(): Promise<ReportListing[]> {
  const fixed = staticReportListings();
  const db = supabaseAdmin();
  const dynamic: ReportListing[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from('stats_reports').select('slug,month,title,dek,feature_image_url,published_at,updated_at').eq('visibility', 'public').order('month', {
      ascending: false
    }).range(offset, offset + 999);
    // Throw every error, including a missing table, so a failed read is never cached as a short list.
    if (error)
      throw error;
    if (!data?.length)
      break;
    dynamic.push(...data.filter(r => !fixed.some(f => f.href === `/stats/reports/${r.slug}`)).map(r => ({
      href: `/stats/reports/${r.slug}`,
      month: new Date(r.month + 'T00:00:00Z').toLocaleString('en-US', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
      }),
      title: r.title,
      description: r.dek,
      image: {
        src: r.feature_image_url,
        alt: r.title
      },
      publishedAt: r.published_at,
      updatedAt: r.updated_at
    })));
  }
  return [...fixed, ...dynamic].sort((a, b) => Date.parse(b.month) - Date.parse(a.month));
}
export const listStatsReports = unstable_cache(fetchStatsReports, ['stats-reports-v1'], {
  revalidate: 3600,
  tags: ['stats', 'stats-reports']
});

/**
 * The report list for pages that must still render when the database read fails (archive, stats
 * rail, home). The sitemap and feed use listStatsReports and return a 503 instead. It falls back to the static published reports and logs the error. The
 * failure is never stored in the report-list cache, so the next request reads the database again.
 */
export async function listStatsReportsOrStatic(context: string): Promise<ReportListing[]> {
  try {
    return await listStatsReports();
  } catch (error) {
    console.error(`Stats report list failed for ${context}; using the static list`, error);
    return staticReportListings();
  }
}
