import { describe, expect, it, vi } from 'vitest';
import { buildModel, dates } from '../../../../../scripts/reports/model';
import { nextVisibility, resolveLinks } from '../../../../../scripts/reports/validate';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ unstable_cache: (loader: unknown) => loader }));
vi.mock('react', () => ({ cache: (loader: unknown) => loader }));
const { range } = vi.hoisted(() => ({ range: vi.fn() }));
vi.mock('../supabase', () => ({
  supabaseAdmin: () => ({ from: () => ({ select: () => ({ eq: () => ({ order: () => ({ range }) }) }) }) })
}));
import { listStatsReports } from '../stats-reports';

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
