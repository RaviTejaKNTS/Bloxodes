import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyVisitExpected, assertVisitParity, validateQaCheckout } from '../../ci/stats-prepared-db-qa.mjs';

const row = (date, key, visits, denominator, games, rank, universe = null) => ({ stat_date: date,
  bucket_key: key, visit_delta: String(visits), denominator_visit_delta: String(denominator),
  denominator_game_count: games, bucket_rank_start: rank, bucket_rank_end: rank,
  universe_id: universe });

test('CI accepts the real same-repository PR head while GITHUB_SHA is a synthetic merge', () => {
  const head = 'a'.repeat(40), merge = 'b'.repeat(40);
  const repo = { full_name: 'RaviTejaKNTS/Bloxodes' };
  const selection = { expectedSha: head, checkoutSha: head, eventName: 'pull_request', githubSha: merge,
    event: { repository: repo, pull_request: { head: { sha: head, repo }, base: { repo } } } };
  validateQaCheckout(selection);
  assert.throws(() => validateQaCheckout({ ...selection, checkoutSha: merge }));
  assert.throws(() => validateQaCheckout({ ...selection, event: { ...selection.event,
    pull_request: { ...selection.event.pull_request, head: { sha: head, repo: { full_name: 'fork/Bloxodes' } } } } }));
  validateQaCheckout({ ...selection, eventName: 'workflow_dispatch', githubSha: head });
  assert.throws(() => validateQaCheckout({ ...selection, eventName: 'workflow_dispatch' }));
});

test('parity oracle weights period percentages by visits and uses max daily game count', () => {
  const rows = [row('2026-10-21', 'g1', 90, 100, 4, 1, '1'), row('2026-10-21', 'other_tracked', 10, 100, 4, 1001),
    row('2026-10-22', 'g1', 1, 10, 2, 1, '1'), row('2026-10-22', 'other_tracked', 9, 10, 2, 1001)];
  const expected = legacyVisitExpected(rows);
  assert.equal(expected.total, 110n); assert.equal(expected.count, 4); assert.equal(expected.buckets.get('g1').total, 91n);
  const chart = { totalVisits: '110', denominatorGameCount: 4,
    series: [{ key: 'g1', totalVisits: '91', rankStart: 1, rankEnd: 1, universeId: '1', sharePercent: 82.73 },
      { key: 'other_tracked', totalVisits: '19', rankStart: 1001, rankEnd: 1001, universeId: null, sharePercent: 17.27 }],
    points: [{ sampledAt: '2026-10-21T00:00:00Z', totalVisits: '100', visits: { g1: '90', other_tracked: '10' }, shares: { g1: 90, other_tracked: 10 } },
      { sampledAt: '2026-10-22T00:00:00Z', totalVisits: '10', visits: { g1: '1', other_tracked: '9' }, shares: { g1: 10, other_tracked: 90 } }] };
  assertVisitParity(chart, rows);
  assert.throws(() => assertVisitParity({ ...chart, denominatorGameCount: 6 }, rows));
  assert.throws(() => assertVisitParity({ ...chart, totalVisits: '109' }, rows));
});

test('oracle retains large integer counters without Number precision loss', () => {
  const expected = legacyVisitExpected([row('2026-10-22', 'g1', '9007199254740993', '9007199254740993', 1, 1, '1')]);
  assert.equal(expected.total, 9007199254740993n);
});

test('91 dates and eleven buckets retain the 1001st legacy row in parity input', () => {
  const rows = [];
  for (let day = 1; day <= 91; day++) {
    const date = new Date(Date.UTC(2026, 0, day)).toISOString().slice(0, 10);
    for (let bucket = 1; bucket <= 11; bucket++) rows.push(row(date, `bucket${bucket}`, 1, 11, 1005, bucket));
  }
  assert.equal(rows.length, 1001);
  const expected = legacyVisitExpected(rows);
  assert.equal(expected.dates.size, 91); assert.equal(expected.total, 1001n);
  assert.equal(expected.buckets.size, 11);
});
