import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('react', () => ({ cache: (fn: unknown) => fn }));
const rows = [{ slug: 'roblox-october-2026', month: '2026-10-01', title: 'October', dek: 'October report', feature_image_url: 'https://example.com/a.png', published_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z', visibility: 'public' }, { slug: 'roblox-november-2026', month: '2026-11-01', visibility: 'hidden' }];
vi.mock('../supabase', () => ({
  supabaseAdmin: () => ({
    from: () => {
      let filter = '';
      type Query = { select: () => Query; eq: (column: string, value: string) => Query; order: () => Query; range: (start: number) => Promise<{ data: typeof rows; error: null }> };
      const q: Query = {
        select: () => q, eq: (column: string, value: string) => {
          if (column === 'visibility')
            filter = value;
          return q;
        }, order: () => q, range: async (start: number) => ({ data: start ? [] : rows.filter(r => r.visibility === filter), error: null })
      };
      return q;
    }
  })
}));
import { listStatsReports } from '../stats-reports';
describe('report discovery visibility', () => { it('merges public reports, never the unlisted August page, for the archive, rail, home, sitemap and feed', async () => { const reports = await listStatsReports(); expect(reports[0].href).toBe('/stats/reports/roblox-october-2026'); expect(reports.some(r => r.href.endsWith('roblox-august-2026'))).toBe(false); expect(reports.some(r => r.href.endsWith('roblox-november-2026'))).toBe(false); }); });
