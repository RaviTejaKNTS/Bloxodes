import { describe, expect, it, vi } from 'vitest';
import { buildModel, dates, ranks } from '../../../../../scripts/reports/model';
import { nextVisibility, numberFindings, numericValues, resolveLinks } from '../../../../../scripts/reports/validate';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ unstable_cache: (loader: unknown) => loader }));
vi.mock('react', () => ({ cache: (loader: unknown) => loader }));
const { range } = vi.hoisted(() => ({ range: vi.fn() }));
vi.mock('../supabase', () => ({
  supabaseAdmin: () => ({ from: () => ({ select: () => ({ eq: () => ({ order: () => ({ range }) }) }) }) })
}));
import { listStatsReports, listStatsReportsOrStatic } from '../stats-reports';

describe('genre shares', () => {
  it('count players from games below the ranking threshold, so shares add up to 100', () => {
    const month = dates('2026-10');
    const rows = [
      // Game 1 has every day and ranks.
      ...month.map(d => ({ universe_id: 1, stat_date: d, avg_playing: 100, visit_delta: 1000 })),
      // Game 2 is big but only has 10 days, so it doesn't rank. Its players still count for its genre.
      ...month.slice(0, 10).map(d => ({ universe_id: 2, stat_date: d, avg_playing: 300, visit_delta: 1000 }))
    ];
    const universes = [
      { universe_id: 1, name: 'Ranked', slug: 'ranked-1', genre_l1: 'Simulation' },
      { universe_id: 2, name: 'Partial', slug: 'partial-2', genre_l1: 'Survival' }
    ];
    const model = buildModel('2026-10', rows, universes, [], [], new Date('2026-11-01'));
    const table = model.charts['genre-table'].data as { genre: string; share: number }[];
    const total = table.reduce((sum, row) => sum + row.share, 0);
    expect(total).toBeCloseTo(100, 6);
    expect(table.map(row => row.genre)).toContain('Survival');
  });
});

describe('publication visibility', () => {
  it('keeps a public report public when a rerun omits --visibility', () => {
    expect(nextVisibility(undefined, { visibility: 'public' })).toBe('public');
  });
  it('starts new reports hidden and honours an explicit choice', () => {
    expect(nextVisibility(undefined, null)).toBe('hidden');
    expect(nextVisibility('hidden', { visibility: 'public' })).toBe('hidden');
    expect(nextVisibility('public', null)).toBe('public');
  });
});

describe('report links', () => {
  it('rejects reference-style links and link definitions', () => {
    expect(() => resolveLinks('Read [the news][external] first.', {})).toThrow(/Reference-style/);
    expect(() => resolveLinks('Text\n\n[external]: https://example.org', {})).toThrow(/Reference-style/);
  });
  it('rejects HTML entities that could hide a destination', () => {
    expect(() => resolveLinks('[Visit](&#104;ttps://example.org)', {})).toThrow(/entities/);
  });
  it('allows www.roblox.com event links', () => {
    expect(resolveLinks('[Event](https://www.roblox.com/events/1)', {})).toBe('[Event](https://www.roblox.com/events/1)');
  });
});

describe('report list reads', () => {
  it.each(['PGRST205', '42P01', '57014'])('throw on %s instead of caching a short list', async code => {
    range.mockResolvedValueOnce({ data: null, error: { code, message: 'Database read failed' } });
    await expect(listStatsReports()).rejects.toMatchObject({ code });
  });
});

describe('game averages', () => {
  it('average over the days a game has data, so a missing day is a gap and not zero', () => {
    const month = dates('2026-10');
    const rows = month.slice(0, 30).map(d => ({ universe_id: 1, stat_date: d, avg_playing: 100 }));
    expect(ranks(rows, month)[0].players).toBe(100);
  });
});

describe('loss-vs-gains insight', () => {
  it('is left out when no game lost players', () => {
    const rows = ['2026-09', '2026-10'].flatMap(m => dates(m).flatMap(d => [1, 2, 3].map(id => ({
      universe_id: id,
      stat_date: d,
      avg_playing: (m === '2026-10' ? 2 : 1) * id * 30000,
      visit_delta: 1000
    }))));
    const universes = [1, 2, 3].map(id => ({ universe_id: id, name: `Game ${id}`, slug: `game-${id}`, genre_l1: 'Simulation' }));
    const model = buildModel('2026-10', rows, universes, [], [], new Date('2026-11-01'));
    expect(model.insights.some(i => i.kind === 'loss-vs-gains')).toBe(false);
  });
});

describe('number check', () => {
  it('ignores hours, weekdays and IDs when matching numbers in the copy', () => {
    const values = numericValues([{ hour: 15, weekday: 6, id: 7, players: 1234567 }]);
    expect(numberFindings('About 15 games joined.', values)).toHaveLength(1);
    expect(numberFindings('It averaged 1.2M players.', values)).toEqual([]);
  });
});

describe('report list fallback', () => {
  it('uses the static list when the database read fails', async () => {
    range.mockResolvedValueOnce({ data: null, error: { code: '57014', message: 'timeout' } });
    const reports = await listStatsReportsOrStatic('a test');
    expect(reports.length).toBeGreaterThan(0);
    expect(reports.every(r => r.href.startsWith('/stats/reports/roblox-'))).toBe(true);
  });
});
