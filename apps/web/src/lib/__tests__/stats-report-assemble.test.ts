import { describe, expect, it } from 'vitest';
import { parseReply } from '../../../../../scripts/reports/assemble';
import { numberFindings } from '../../../../../scripts/reports/validate';
import { compact } from '../../../../../scripts/reports/format';
const reply = `Title: Roblox in October 2026: Top 100 Games, Genres and Player Trends
Meta: October games and players.
Dek: Follow the weekly shifts.
Short version:
- Players rose.
- Visits fell.
- Games changed ranks.
- Genres shifted.
Markers:
- 2026-10-25 | Busiest day

## Roblox player numbers in October: the weekend lift
First paragraph.

Second paragraph
continues here.
[[chart:players-daily]]
[[chart:busiest-hours]]
## Top 20 Roblox games in October and how the top 10 moved
[[chart:top-games]]
[[chart:top10-weekly]]
[[chart:concentration]]
## Biggest gainers and losers among Roblox games in October
[[chart:movers]]
[[chart:new-games]]
## Roblox genres in October: the changes
[[chart:genre-share]]
[[chart:genre-trends]]
[[chart:genre-table]]
## Ratings and session length: player choices
[[chart:rating-vs-size]]
[[chart:session-length]]
## Roblox events and game updates in October
[[dates]]
- Oct 4 | A publish.
- Oct 12 | Another publish.
- Oct 25 | The busiest day.

[[chart:update-effect]]
## Top 100 Roblox games in October
[[chart:top100]]`;
describe('writer reply assembler', () => {
  it('keeps paragraphs, stable anchors, dates, markers and silent omissions', () => {
    const report = parseReply(reply, '2026-10', { 'busiest-hours': 'coverage' });
    expect(report.body.filter(block => block.type === 'h2').map(block => block.id)).toEqual(['players', 'top-games', 'gainers-losers', 'genres', 'ratings-session', 'events-updates', 'top-100']);
    expect(report.body.filter(block => block.type === 'p')).toEqual([{ type: 'p', md: 'First paragraph.' }, { type: 'p', md: 'Second paragraph continues here.' }]);
    expect(report.body.find(block => block.type === 'dates')).toMatchObject({ rows: [{ date: '2026-10-04' }, { date: '2026-10-12' }, { date: '2026-10-25' }] });
    expect(report.body.some(block => block.type === 'chart' && block.id === 'busiest-hours')).toBe(false);
    expect(report.markers).toEqual([{ date: '2026-10-25', label: 'Busiest day' }]);
  });
  it('allows extras at their placement', () => {
    expect(parseReply(reply.replace('First paragraph.', '[[chart:extra-1]]\nFirst paragraph.'), '2026-10').body[1]).toEqual({ type: 'chart', id: 'extra-1' });
  });
  it.each([
    ['Oct 4 |', 'Sep 4 |'], ['Oct 4 |', 'Oct 32 |'], ['2026-10-25 |', '2026-10-32 |'],
    ['[[chart:players-daily]]', '[[chart:unknown]]'], ['[[chart:top100]]', '[[chart:top-games]]'],
    ['## Ratings and session length:', '## Wrong section:'], ['Title:', 'Headline:'],
  ])('reports malformed structure with line numbers', (before, after) => {
    expect(() => parseReply(reply.replace(before, after), '2026-10')).toThrow(/Line \d+:/);
  });
});
describe('writer number formats', () => {
  it.each(['1.28M', '1.3M', '423K', '423,219', '34.5%', '35%', '2.1 points', '2.1 pts', '#11', '11th', '14.6 minutes', 'five games', 'Oct 4, 2026', 'October 25', '2026-10-25'])('accepts %s', text => {
    expect(numberFindings(text, [1277917, 423219, 34.55, 2.12, 11, 14.559])).toEqual([]);
  });
  it.each(['1.27M', '1.2M', '424K', '423,218', '34.4%', '34%', '2.2 points', '#12', '12th', '14.5 minutes'])('rejects %s', text => {
    expect(numberFindings(text, [1277917, 423219, 34.55, 2.12, 11, 14.559])).not.toEqual([]);
  });
  it('accepts each display precision only when it rounds to that value', () => {
    expect(numberFindings('1.28M and 1.3M', [1277917])).toEqual([]);
    expect(numberFindings('1.27M', [1277917])).toHaveLength(1);
    expect(compact(1277917)).toBe('1.28M');
  });
});

import { busiestHours } from '../../../../../scripts/reports/model';
import { numericValues } from '../../../../../scripts/reports/validate';
describe('hourly game-cell averaging', () => {
  it('averages each game before summing and scales games missing a cell', () => {
    const rows = Array.from({ length: 168 }, (_, index) => [1, 2, 3, 4].map(id => ({
      universe_id: id,
      hour_start: new Date(Date.parse('2026-10-05') + index * 3600000).toISOString(),
      avg_playing: id === 1 ? 200 : 100,
      playing: 999,
    }))).flat();
    rows.push({ ...rows[0], avg_playing: 400, hour_start: '2026-10-12T00:00:00Z' });
    const result = busiestHours(rows, [1, 2, 3, 4, 5]);
    expect(result.cells[0].value).toBe(750);
    expect(result.cells[1].value).toBe(625);
    expect(result.minCoverage).toBe(.8);
    expect(result.valid).toBe(true);
  });
  it('allows prose to state the magnitude of a negative change', () => {
    expect(numberFindings('lost 501K players', numericValues({ change: -500568 }))).toEqual([]);
  });
});

import { buildModel, dates } from '../../../../../scripts/reports/model';
import { referencedGames, writerNotes } from '../../../../../scripts/reports/writer-notes';
describe('writer bundle', () => {
  it('keeps notes small and retains every named game identity', () => {
    const rows = dates('2026-10').map(date => ({ universe_id: 1, stat_date: date, playing: 100, visit_delta: 1000 }));
    const result = buildModel('2026-10', rows, [{ universe_id: 1, name: 'Test game', slug: 'test-1' }], [], [], new Date('2026-11-01'));
    const games = referencedGames(result.charts, result.insights, result.games);
    const notes = writerNotes('2026-10', { ...result, games });
    expect(notes.length).toBeLessThan(60000);
    expect(notes).toContain('Test game → 1');
    expect(result.insights.length).toBeLessThanOrEqual(40);
    expect(result.insights.every(insight => /\d/.test(insight.summary))).toBe(true);
  });
});
