import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createReaderDiagnosticPlan, extractReaderPeriodBaseline, readerDiagnosticExpected,
  projectReaderDiagnosticPlan, readerCancellationDiagnostic, readerDiagnosticReadback,
  assertReaderDiagnosticResponse, assertReaderDiagnosticRestResponse, READER_DIAGNOSTIC_CASE_IDS, READER_DIAGNOSTIC_MIGRATIONS,
  READER_DIAGNOSTIC_LIMITS } from '../../ci/stats-prepared-reader-diagnostic.mjs';

const schema = 'qa_stats_012345abcdef', privateSchema = `${schema}_p`;
const sources = () => Promise.all(READER_DIAGNOSTIC_MIGRATIONS.map(async ({ path }) => ({
  path, bytes: await readFile(new URL(`../../../${path}`, import.meta.url)),
})));
const plan = async () => createReaderDiagnosticPlan({ schema, privateSchema, migrationSources: await sources() });
const hash = value => createHash('sha256').update(value).digest('hex');

test('baseline derives from both exact frozen migrations; the five parameters retain their original order', async () => {
  const migrations = await sources();
  const baseline = extractReaderPeriodBaseline(migrations);
  const text = migrations[0].bytes.toString('utf8');
  const start = text.indexOf(' with selected as (');
  const exact = text.slice(start, text.indexOf('\n$$;', start));
  assert.equal(baseline.exactQuery, exact);
  assert.equal(baseline.bodySha256, hash(exact));
  assert.equal(baseline.parameterizedQuery.replace(/\$([1-5])\b/g,
    (_, n) => ['p_rows', 'p_start', 'p_end', 'p_hourly', 'p_as_of'][Number(n) - 1]), exact);
  assert.deepEqual(baseline.parameterTypes, ['jsonb', 'timestamptz', 'timestamptz', 'boolean', 'timestamptz']);
  for (const invalid of [[], migrations.slice().reverse(), migrations.slice(0, 1),
    migrations.map((s, i) => i ? { ...s, bytes: Buffer.concat([s.bytes, Buffer.from('\n')]) } : s),
    migrations.map((s, i) => i ? s : { ...s, bytes: s.bytes.toString('utf8') })]) {
    assert.throws(() => extractReaderPeriodBaseline(invalid));
  }
});

test('plan admits only matching owned schemas and frozen bytes, with no custom target or selection knobs', async () => {
  const migrationSources = await sources();
  for (const patch of [{ schema: 'public' }, { privateSchema: 'stats_prepared_private' },
    { privateSchema: 'qa_stats_abcdef012345_p' }, { schema: `${schema};select 1` },
    { selection: '90d' }, { target: 'production' }, { sql: 'select 1' }, { statementMs: 10_000 },
    { capturedPayload: {} }]) {
    assert.throws(() => createReaderDiagnosticPlan({ schema, privateSchema, migrationSources, ...patch }));
  }
  assert.throws(() => readerDiagnosticExpected('SECRET'));
  const p = await plan();
  assert.equal(p.acceptance, false);
  assert.equal(p.originalInput, 'unknown-not-captured');
  assert.equal(p.mode, 'reader-diagnostic');
  assert.deepEqual(p.cases.map(c => c.id), READER_DIAGNOSTIC_CASE_IDS);
  assert.equal(p.cases.length, 8);
  assert.equal(p.cases.filter(c => c.repeat).length, 1);
  assert.equal(p.cases.at(-1).id, 'combined-empty-fixed-repeat');
  assert.equal(p.cases.reduce((n, c) => n + c.profiles.length, 0), 44);
  assert.deepEqual(READER_DIAGNOSTIC_LIMITS, { statementMs: 2000, lockMs: 500, appReadMs: 3000,
    advanceMs: 6000, maxPayloadBytes: 16_777_216, maxPlanNodes: 128, maxPlanDepth: 16, maxProjectionBytes: 32_768 });
});

test('fixed setup touches only prepared clones; every measurement has effective 2s/500ms settings and rollback', async () => {
  const p = await plan();
  assert.match(p.preflightSql, /fresh_owned_fixture/);
  for (const table of ['roblox_universes', 'stats_game_current_index', 'roblox_universe_stats_hourly', 'roblox_universe_stats_daily']) {
    assert.ok(p.preflightSql.includes(`not exists(select 1 from ${schema}.${table})`));
  }
  for (const c of p.cases) {
    assert.equal(c.provenance, 'synthetic-non-equivalent-to-original');
    assert.equal(c.fixtureInput.originalInput, 'unknown-not-captured');
    assert.equal(c.selection.p_include_previous, true);
    const writes = [...c.setupSql.matchAll(/\b(insert into|update|delete from|truncate)\s+([a-z0-9_.]+)/gi)];
    assert.ok(writes.length >= 1 && writes.length <= 2);
    for (const [, , relation] of writes) assert.ok([
      `${schema}.stats_prepared_control`, `${schema}.stats_prepared_generations`,
    ].includes(relation));
    assert.doesNotMatch(c.setupSql, /create |alter |drop |disable |delete |truncate |set_config|statement_timeout='(?:3|6|100)s'/i);
    for (const sql of [c.readbackSql, c.responseSql, ...c.profiles.map(p => p.sql)]) {
      assert.match(sql, /^begin read only;/);
      assert.match(sql, /set local statement_timeout='2s'; set local lock_timeout='500ms'; set local timezone='UTC';/);
      assert.match(sql, /set local role service_role;/);
      assert.match(sql, /rollback;$/);
      assert.doesNotMatch(sql, /\b(?:commit|insert|update|delete|truncate|create|alter|drop)\b/i);
    }
    for (const profile of c.profiles) {
      assert.match(profile.sql, profile.analyze
        ? /explain \(ANALYZE, BUFFERS, TIMING OFF, SUMMARY, FORMAT JSON\)/
        : /explain \(VERBOSE, COSTS, SETTINGS, FORMAT JSON\)/);
      assert.doesNotMatch(profile.sql, /select .*stats_prepared_period_v1\(/i);
      if (profile.scope === 'wrapper') assert.equal(profile.planScope, 'opaque-plpgsql-wrapper');
      else {
        assert.match(profile.sql, /with diagnostic_input as materialized/);
        assert.match(profile.sql, /cross join lateral \( with selected as/);
        assert.ok(profile.sql.includes(`from ${schema}.stats_prepared_generations where id=`));
        assert.match(profile.planScope, /not-cached-rpc/);
      }
    }
    for (const request of c.rest) {
      assert.equal(request.alias, 'qa_012345abcdef_get_sp_platform_chart_v1');
      assert.equal(request.appReadMs, 3000);
    }
  }
  const combined = p.cases.find(c => c.id === 'combined-empty');
  assert.deepEqual(combined.rest.map(r => r.body.p_resolution), ['hourly', 'daily']);
  assert.equal(combined.rest[0].expected.current.coverage.expectedBuckets, 24);
  assert.equal(combined.rest[0].expected.previous.coverage.processedBuckets, 24);
  assert.equal(combined.rest[0].expected.previous.coverage.reason, 'source-gap');
  assert.deepEqual(combined.fixtureInput, p.cases.at(-1).fixtureInput);
});

test('frozen inclusive daily bounds preserve processed-empty versus absent, observed, and removed buckets', async () => {
  const p = await plan();
  const empty = readerDiagnosticExpected('daily-empty-181');
  assert.deepEqual(empty.current.coverage, { expectedBuckets: 2, processedBuckets: 2, observedBuckets: 0,
    missingBuckets: ['2026-10-24T00:00:00.000Z', '2026-10-25T00:00:00.000Z'],
    firstSourceAt: null, lastSourceAt: null, finalizedThrough: null, provisional: true, reason: 'producer-behind' });
  assert.deepEqual(empty.previous.coverage.missingBuckets, ['2026-10-23T00:00:00.000Z', '2026-10-24T00:00:00.000Z']);
  assert.equal(empty.current.rows, 0);
  assert.equal(empty.current.sourceUpdatedAt, '2026-10-25T03:38:00.000Z');
  const observed = readerDiagnosticExpected('daily-one-observed');
  assert.equal(observed.current.rows, 1);
  assert.equal(observed.previous.rows, 1); // Oct 24 is inclusive in BOTH daily windows.
  assert.equal(observed.previous.coverage.reason, 'source-gap');
  assert.equal(observed.current.coverage.finalizedThrough, '2026-10-24');
  assert.deepEqual(readerDiagnosticExpected('daily-observation-removed'), empty);
  const missing = readerDiagnosticExpected('daily-missing-selected-date');
  assert.equal(missing.current.coverage.processedBuckets, 1);
  assert.deepEqual(missing.current.coverage.missingBuckets, empty.current.coverage.missingBuckets);
  assert.deepEqual(missing.previous, empty.previous);
  assert.deepEqual(readerDiagnosticExpected('combined-empty'), empty);
  assert.deepEqual(readerDiagnosticExpected('combined-empty-fixed-repeat'), empty);
  assert.equal(p.cases.find(c => c.id === 'daily-empty-181').fixtureInput.dailyRows, 181);
  assert.equal(p.cases.find(c => c.id === 'daily-missing-selected-date').fixtureInput.dailyRows, 180);
  assert.equal(p.cases.find(c => c.id === 'combined-empty').fixtureInput.hourlyRows, 2164);
  const cold = readerDiagnosticExpected('cold-no-generation');
  assert.equal(cold.current.coverage.expectedBuckets, 0);
  assert.deepEqual(cold.current.coverage.missingBuckets, []);
  assert.equal(cold.current.coverage.reason, 'not-built');
});

test('90d hourly shape has exactly bounded current and previous grids, >1000 visible rows and retention uncertainty', async () => {
  const c = (await plan()).cases.find(c => c.id === 'long-hourly-mixture');
  assert.equal(c.fixtureInput.hourlyRows, 4321);
  assert.equal(c.expected.current.coverage.expectedBuckets, 2160);
  assert.equal(c.expected.previous.coverage.expectedBuckets, 2160);
  assert.equal(c.expected.current.coverage.processedBuckets, 2160);
  assert.equal(c.expected.previous.coverage.processedBuckets, 2160);
  assert.equal(c.expected.current.rows, 1080);
  assert.equal(c.expected.previous.rows, 1080);
  assert.equal(c.expected.previous.coverage.reason, 'retention-gap');
  assert.equal(c.expected.current.coverage.reason, 'source-gap');
  const previous = c.profiles.find(p => p.scope === 'previous');
  assert.match(previous.sql, /as_of-interval '180 days' p_start/);
  assert.match(previous.sql, /as_of-interval '90 days' p_end/);
});

const explain = () => [{ 'Planning Time': 1.5, 'Execution Time': 1800.25,
  'Query Text': 'SECRET', Settings: { search_path: 'SECRET' }, JIT: { Functions: 3, Timing: { Total: 'SECRET' } },
  Plan: { 'Node Type': 'Nested Loop', 'Join Type': 'Left', 'Actual Rows': 2, 'Actual Loops': 1,
    'Rows Removed by Join Filter': 180, 'Shared Hit Blocks': 11, 'Temp Written Blocks': 4,
    'Actual Total Time': 999, Output: ['SECRET'], Filter: 'SECRET',
    Plans: [{ 'Node Type': 'Index Scan', Schema: schema, 'Relation Name': 'stats_prepared_generations',
      'Index Name': 'stats_prepared_generations_pkey', 'Actual Rows': 1, 'Actual Loops': 1, 'Index Cond': 'SECRET' },
    { 'Node Type': 'CTE Scan', 'CTE Name': 'windowed', 'Actual Rows': 181, 'Actual Loops': 2,
      'Temp Read Blocks': 4, 'Actual Startup Time': 123 }] } }];

test('projection retains numeric plan evidence, spills, join type and JIT presence; never SQL, literals or node times', () => {
  const result = projectReaderDiagnosticPlan(explain(), schema);
  assert.equal(result['Planning Time'], 1.5);
  assert.equal(result['Execution Time'], 1800.25);
  assert.equal(result.jitPresent, true); assert.equal(result.jitFunctions, 3);
  assert.equal(result.plan['Join Type'], 'Left');
  assert.equal(result.plan['Rows Removed by Join Filter'], 180);
  assert.equal(result.plan['Shared Hit Blocks'], 11);
  assert.equal(result.plan.plans[0].index, 'stats_prepared_generations_pkey');
  assert.equal(result.plan.plans[0].schema, 'owned');
  assert.equal(result.plan.plans[1]['Temp Read Blocks'], 4);
  assert.equal(result.plan.plans[1]['Actual Loops'], 2);
  assert.doesNotMatch(JSON.stringify(result), /SECRET|Actual Total Time|Actual Startup Time|Output|Filter|Index Cond|Query Text/);
  const hostile = explain();
  Object.assign(hostile[0].Plan, { 'Node Type': 'SECRET', 'Join Type': 'SECRET', 'Actual Rows': 'SECRET',
    'Actual Loops': Infinity, 'Shared Hit Blocks': -1, Schema: 'public', 'Relation Name': 'stats_prepared_control',
    'Index Name': 'SECRET' });
  const safe = projectReaderDiagnosticPlan(hostile, schema);
  assert.equal(safe.plan.relation, undefined);
  assert.doesNotMatch(JSON.stringify(safe), /SECRET|Infinity|public/);
});

test('malformed, wide, deep and oversized projections fail closed with fixed errors', () => {
  for (const value of [null, [], [{}], [{ Plan: [] }], [{ Plan: { Plans: 'SECRET' } }],
    [{ Plan: { Plans: [null] } }], [...explain(), ...explain()]]) {
    assert.throws(() => projectReaderDiagnosticPlan(value, schema));
  }
  const wide = explain(); wide[0].Plan.Plans = Array.from({ length: 128 }, () => ({ 'Node Type': 'Result' }));
  assert.throws(() => projectReaderDiagnosticPlan(wide, schema), /reader-plan-too-large/);
  let deep = { 'Node Type': 'Result' };
  for (let i = 0; i < 17; i++) deep = { 'Node Type': 'Result', Plans: [deep] };
  assert.throws(() => projectReaderDiagnosticPlan([{ Plan: deep }], schema), /reader-plan-too-large/);
  const manyFields = Object.fromEntries(['Startup Cost', 'Total Cost', 'Plan Rows', 'Plan Width', 'Actual Rows',
    'Actual Loops', 'Shared Hit Blocks', 'Shared Read Blocks', 'Temp Read Blocks', 'Temp Written Blocks',
    'Local Hit Blocks', 'Local Read Blocks', 'Hash Buckets', 'Hash Batches', 'Peak Memory Usage'].map(k => [k, 1e14]));
  assert.throws(() => projectReaderDiagnosticPlan([{ Plan: { Plans: Array.from({ length: 100 }, () => ({
    'Node Type': 'Result', ...manyFields })) } }], schema), /reader-projection-too-large/);
  assert.throws(() => projectReaderDiagnosticPlan(explain(), 'public'));
});

test('only exact cancellation primary messages and validated SQLSTATE get a fixed class', () => {
  assert.deepEqual(readerCancellationDiagnostic({ code: '57014', message: 'canceling statement due to statement timeout' }),
    { sqlstate: '57014', errorClass: 'statement-timeout' });
  assert.deepEqual(readerCancellationDiagnostic({ code: '57014', message: 'canceling statement due to user request' }),
    { sqlstate: '57014', errorClass: 'user-cancel' });
  for (const error of [{ code: '57014' }, { code: '57014', message: 'canceling statement due to statement timeout SECRET' },
    { code: '57014', message: 'ERROR: 57014: canceling statement due to statement timeout' },
    { code: '53100', message: 'canceling statement due to statement timeout' }, { code: 'SECRET', message: 'SECRET' }]) {
    const result = readerCancellationDiagnostic(error);
    assert.equal(result.errorClass, 'unknown');
    assert.doesNotMatch(JSON.stringify(result), /SECRET|message|ERROR/);
  }
});

test('owned readback validates digest, byte caps, frozen clock and exact synthetic array sizes without forwarding extras', async () => {
  const c = (await plan()).cases.find(c => c.id === 'combined-empty');
  const row = { generation: c.generation, asOf: c.asOf, payloadStorageBytes: '10000', payloadTextBytes: '1000000',
    payloadSha256: 'a'.repeat(64), readbackSha256: 'a'.repeat(64), hourlyRows: 2164, dailyRows: 181,
    currentSelectedRows: 2, previousSelectedRows: 2, SECRET: 'SECRET' };
  const result = readerDiagnosticReadback(c.id, [row]);
  assert.equal(result.hourlyRows, 2164);
  assert.equal(result.payloadTextBytes, '1000000');
  assert.doesNotMatch(JSON.stringify(result), /SECRET/);
  for (const patch of [{ generation: 'SECRET' }, { asOf: null }, { payloadTextBytes: '16777217' },
    { payloadStorageBytes: 10000 }, { readbackSha256: 'b'.repeat(64) }, { hourlyRows: 2163 }, { dailyRows: '181' },
    { currentSelectedRows: 1 }]) {
    assert.throws(() => readerDiagnosticReadback(c.id, [{ ...row, ...patch }]));
  }
  const cold = Object.fromEntries(['generation', 'asOf', 'payloadStorageBytes', 'payloadTextBytes',
    'payloadSha256', 'readbackSha256', 'hourlyRows', 'dailyRows'].map(k => [k, null]));
  Object.assign(cold, { currentSelectedRows: 0, previousSelectedRows: 0 });
  assert.equal(readerDiagnosticReadback('cold-no-generation', [cold]).generation, null);
  assert.throws(() => readerDiagnosticReadback('cold-no-generation', [{ ...cold, hourlyRows: 0 }]));
});

test('response assertions reject fabricated zero points, missing-date changes and numeric-string conversion', async () => {
  const p = await plan();
  const c = p.cases.find(c => c.id === 'daily-empty-181');
  const response = { contract: 'stats-prepared@1', meta: { generationId: c.generation, state: 'unavailable',
    asOf: c.asOf, windowStart: '2026-10-24T03:38:00Z', windowEnd: c.asOf,
    sourceUpdatedAt: c.asOf, current: structuredClone(c.expected.current.coverage),
    previous: structuredClone(c.expected.previous.coverage) }, currentRows: [], previousRows: [] };
  assert.deepEqual(assertReaderDiagnosticResponse(c.id, response), { currentRows: 0, previousRows: 0, coverageVerified: true });
  assert.throws(() => assertReaderDiagnosticResponse(c.id, { ...response, currentRows: [{ playing: '0' }] }));
  const missing = structuredClone(response); missing.meta.current.missingBuckets.pop();
  assert.throws(() => assertReaderDiagnosticResponse(c.id, missing));
  const observed = p.cases.find(c => c.id === 'daily-one-observed');
  const r = { playing: '24', peak_players: '27', avg_players: '23.5', visits: '9007199254740993',
    favorites: '50', rating_percent: '90.2', tracked_games: '1', samples: '2',
    stat_date: '2026-10-24', recorded_at: '2026-10-24T00:01:00Z' };
  const good = { ...response, meta: { ...response.meta, generationId: observed.generation, state: 'partial',
    current: observed.expected.current.coverage, previous: observed.expected.previous.coverage }, currentRows: [r], previousRows: [r] };
  assert.equal(assertReaderDiagnosticResponse(observed.id, good).coverageVerified, true);
  assert.throws(() => assertReaderDiagnosticResponse(observed.id, { ...good, currentRows: [{ ...r, visits: 9007199254740992 }] }));
  assert.throws(() => assertReaderDiagnosticResponse(observed.id, { ...good, currentRows: [{ ...r, _observed: 1 }] }));
  assert.throws(() => assertReaderDiagnosticResponse(observed.id, { ...good, currentRows: [{ ...r, stat_date: '2026-10-23' }] }));
});

test('module has no clock, environment, filesystem, primary API, network or execution dependencies', async () => {
  const text = await readFile(new URL('../../ci/stats-prepared-reader-diagnostic.mjs', import.meta.url), 'utf8');
  assert.deepEqual([...text.matchAll(/^import .* from '([^']+)'/gm)].map(m => m[1]), ['node:assert/strict', 'node:crypto']);
  assert.doesNotMatch(text, /\b(?:fetch|setTimeout|setInterval|execFile|execSync|readFile|writeFile|process\.env|Date\.now)\s*\(/);
  assert.doesNotMatch(text, /new Date\(\)/);
  assert.doesNotMatch(text, /\b(?:await|main)\s*\(/);
});

test('same-generation combined hourly control validates its own coverage and returns only counts', async () => {
  const c = (await plan()).cases.find(c => c.id === 'combined-empty');
  const request = c.rest[0];
  const value = { contract: 'stats-prepared@1', meta: { generationId: c.generation, state: 'unavailable',
    asOf: c.asOf, windowStart: '2026-10-24T03:38:00Z', windowEnd: c.asOf, sourceUpdatedAt: c.asOf,
    current: structuredClone(request.expected.current.coverage), previous: structuredClone(request.expected.previous.coverage) },
    currentRows: [], previousRows: [], SECRET: 'SECRET' };
  const validate = v => assertReaderDiagnosticRestResponse(c.id, request.assertion, v);
  assert.deepEqual(validate(value), { currentRows: 0, previousRows: 0, coverageVerified: true, sameGenerationVerified: true });
  assert.throws(() => assertReaderDiagnosticResponse(c.id, value)); // daily validator cannot validate this control
  for (const patch of [{ meta: { ...value.meta, generationId: 'SECRET' } },
    { meta: { ...value.meta, current: c.expected.current.coverage } }, { currentRows: [{ playing: '0' }] },
    { previousRows: [{ playing: '0' }] }, { meta: { ...value.meta, state: 'partial' } }]) {
    assert.throws(() => validate({ ...value, ...patch }));
  }
  const reordered = structuredClone(value); reordered.meta.previous.missingBuckets.reverse();
  assert.throws(() => validate(reordered));
  assert.throws(() => assertReaderDiagnosticRestResponse('daily-empty-181', request.assertion, value));
  assert.throws(() => assertReaderDiagnosticRestResponse(c.id, 'SECRET', value));
});
