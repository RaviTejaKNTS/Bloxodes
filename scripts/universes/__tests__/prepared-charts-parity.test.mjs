import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { legacyVisitExpected, assertVisitParity, validateQaCheckout, fixtureMigrationSql,
  qaSqlFailureDiagnostic, qaReceiptWithPhases } from '../../ci/stats-prepared-db-qa.mjs';

test('isolated migration moves schema references while retaining PUBLIC revocations and exact function bodies', async () => {
  const source = await readFile(new URL('../../../supabase/migrations/20261023100441_stats_prepared_charts_v1.sql', import.meta.url), 'utf8');
  const schema = 'qa_stats_012345abcdef', privateSchema = `${schema}_p`;
  const isolated = fixtureMigrationSql(source, schema, privateSchema);
  assert.ok(source.includes('from public,anon,authenticated'));
  assert.equal(isolated.match(/from public,anon,authenticated/g).length,
    source.match(/from public,anon,authenticated/g).length);
  assert.ok(isolated.includes(`create schema ${privateSchema};`));
  assert.ok(isolated.includes(`grant usage on schema ${privateSchema} to service_role;`));
  assert.ok(isolated.includes(`create table ${schema}.stats_prepared_control (`));
  assert.ok(isolated.includes(`after insert on ${schema}.roblox_universe_stats_hourly`));
  assert.ok(isolated.includes(`execute function ${privateSchema}.stats_prepared_capture_v1('h')`));
  assert.ok(isolated.includes(`schemaname='${schema}'`));
  assert.ok(isolated.includes(`n.nspname in ('${schema}','${privateSchema}')`));
  assert.ok(isolated.includes(`format('revoke all on table ${schema}.%I from public,anon,authenticated'`));
  assert.doesNotMatch(isolated, /\bpublic\.|stats_prepared_private|'public'/);
  // Namespace substitution is reversible; settings, algorithms and ACL roles
  // must not acquire any other change in the isolated copy.
  assert.equal(isolated.replaceAll(privateSchema, 'stats_prepared_private')
    .replaceAll(`${schema}.`, 'public.').replaceAll(`'${schema}'`, "'public'"), source);
});

test('migration isolation refuses public, malformed and mismatched fixture namespaces', () => {
  for (const [schema, privateSchema] of [['public', 'public'], ['qa_stats_012345ABCDEf', 'qa_stats_012345ABCDEf_p'],
    ['qa_stats_012345abcdef;drop schema public', 'qa_stats_012345abcdef_p'],
    ['qa_stats_012345abcdef', 'qa_stats_abcdef012345_p']]) {
    assert.throws(() => fixtureMigrationSql('select 1;', schema, privateSchema));
  }
});

test('SQL diagnostics retain only code, fixed phase, status and bounded numeric positions', () => {
  const diagnostic = qaSqlFailureDiagnostic({ phase: 'migration-install', status: 400,
    query: 'select 1;\nselect 2;\nselect 3;',
    result: { code: '42703', position: '12', message: 'SQL with SECRET_VALUE',
      details: 'SECRET_DETAILS', hint: 'SECRET_HINT', context: 'SECRET_CONTEXT', api_key: 'SECRET_KEY' } });
  assert.deepEqual(diagnostic, { phase: 'migration-install', status: 400, sqlstate: '42703', position: 12 });
  assert.doesNotMatch(JSON.stringify(diagnostic), /SECRET|select/);
});

test('Management API message-only and nested errors expose SQLSTATE without SQL or object names', () => {
  const query = 'select 1;\nselect 2;\nselect 3;';
  const message = 'Failed to run sql query: ERROR:  42P07: relation "SECRET_RELATION" already exists\nLINE 2: SECRET_SQL\nDETAIL: SECRET_VALUE';
  for (const result of [{ message }, { message: message.replace('Failed to run sql query: ', '') },
    { error: { message } }, { error: message }, message]) {
    const diagnostic = qaSqlFailureDiagnostic({ phase: 'migration-install', status: 400, result, query });
    assert.deepEqual(diagnostic, { phase: 'migration-install', status: 400, sqlstate: '42P07', reportedLine: 2 });
    assert.doesNotMatch(JSON.stringify(diagnostic), /SECRET|relation|ERROR|select/);
  }
  assert.deepEqual(qaSqlFailureDiagnostic({ phase: 'source-clone', status: 400, query,
    result: { error: { code: '42501', position: 2 } } }),
    { phase: 'source-clone', status: 400, sqlstate: '42501', position: 2 });
});

test('SQL diagnostics discard unrecognized messages, malformed codes and out-of-query positions', () => {
  for (const result of [null, [], { code: 'SECRET_TOKEN', position: '1; SECRET_SQL' },
    { code: 'PGRST202', error: { message: 'SECRET ERROR: 42501: not a known envelope' } },
    { message: 'Failed to run sql query: ERROR:  42601: SECRET_SQL\nLINE 999999: SECRET_SQL', position: '999999999' }]) {
    const diagnostic = qaSqlFailureDiagnostic({ phase: 'migration-install', status: 400, result, query: 'select 1;' });
    assert.deepEqual(diagnostic, { phase: 'migration-install', status: 400,
      sqlstate: result?.message ? '42601' : 'unknown' });
  }
  assert.deepEqual(qaSqlFailureDiagnostic({ phase: 'cleanup', status: 'SECRET_STATUS', query: 'select 1;' }),
    { phase: 'cleanup', status: null, sqlstate: 'unknown' });
  assert.throws(() => qaSqlFailureDiagnostic({ phase: 'SECRET_PHASE', status: 400, query: '' }),
    /unknown QA SQL phase/);
});

test('explicit cleanup retains setup failure and prior phases across repeated receipt writes', () => {
  const clone = { kind: 'sql', phase: 'source-clone', ms: 10, ok: true, status: 200 };
  const failure = { kind: 'sql', phase: 'migration-install', ms: 20, ok: false, status: 400, sqlstate: '42703' };
  const cleanup = { kind: 'sql', phase: 'cleanup', ms: 5, ok: true, status: 200 };
  const first = qaReceiptWithPhases({ completed: false, cleaned: true, sqlFailure: failure }, [clone, failure, cleanup]);
  const explicit = qaReceiptWithPhases(first, [cleanup]);
  const retried = qaReceiptWithPhases(explicit, [cleanup]);
  assert.deepEqual(first.phases, [clone, failure, cleanup]);
  assert.deepEqual(explicit.phases, [clone, failure, cleanup, cleanup]);
  assert.deepEqual(retried.phases, [clone, failure, cleanup, cleanup, cleanup]);
  assert.deepEqual(retried.sqlFailure, failure);
  assert.equal(retried.completed, false); assert.equal(retried.cleaned, true);
  const cleanupFailure = { ...failure, phase: 'cleanup', sqlstate: '55P03' };
  const failedCleanup = qaReceiptWithPhases({ ...explicit, cleaned: false, cleanupSqlFailure: cleanupFailure }, [cleanupFailure]);
  assert.deepEqual(failedCleanup.sqlFailure, failure);
  assert.deepEqual(failedCleanup.cleanupSqlFailure, cleanupFailure);
  assert.deepEqual(failedCleanup.phases, [clone, failure, cleanup, cleanup, cleanupFailure]);
  assert.equal(failedCleanup.cleaned, false);
});

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
