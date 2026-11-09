import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ unstable_cache: (loader: unknown) => loader }));
vi.mock('react', () => ({ cache: (loader: unknown) => loader }));
const { read } = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('../supabase', () => ({ supabaseAdmin: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: read }) }) }) }) }));
import { getStatsReport } from '../stats-reports';
describe('report detail reads', () => {
  beforeEach(() => read.mockReset());
  it.each(['PGRST205', '42P01', '57014'])('throws database errors instead of returning a cacheable miss: %s', async code => {
    const error = { code, message: 'Database read failed' };
    read.mockResolvedValue({ data: null, error });
    await expect(getStatsReport('roblox-october-2026')).rejects.toEqual(error);
  });
  it('returns null only for a genuinely absent row', async () => {
    read.mockResolvedValue({ data: null, error: null });
    await expect(getStatsReport('roblox-october-2026')).resolves.toBeNull();
  });
  it('returns a hidden report at its exact URL', async () => {
    const row = { slug: 'roblox-october-2026', visibility: 'hidden' };
    read.mockResolvedValue({ data: row, error: null });
    await expect(getStatsReport(row.slug)).resolves.toEqual(row);
  });
});
