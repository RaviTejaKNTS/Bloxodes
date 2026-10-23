import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runReaderDiagnostic, createReaderDiagnosticRest, READER_DIAGNOSTIC_PHASES } from '../../ci/stats-prepared-reader-runner.mjs';
import { createReaderDiagnosticPlan, READER_DIAGNOSTIC_MIGRATIONS } from '../../ci/stats-prepared-reader-diagnostic.mjs';

const schema = 'qa_stats_012345abcdef', privateSchema = `${schema}_p`;
const migrationSources = () => Promise.all(READER_DIAGNOSTIC_MIGRATIONS.map(async ({ path }) => ({
  path, bytes: await readFile(new URL(`../../../${path}`, import.meta.url)),
})));
const HOUR = 3_600_000, DAY = 24 * HOUR;
const AS_OF = '2026-10-25T03:38:00.000Z', AS_OF_MS = Date.parse(AS_OF);
const publicRow = (ms, hourly) => ({ playing: '24', peak_players: '27', avg_players: '23.5',
  visits: '9007199254740993', favorites: '50', rating_percent: '90.2', tracked_games: '1', samples: '2',
  [hourly ? 'hour_start' : 'stat_date']: hourly ? new Date(ms).toISOString() : new Date(ms).toISOString().slice(0, 10),
  recorded_at: new Date(ms + 60_000).toISOString() });

function responseFor(c, request = c.rest.at(-1)) {
  const days = c.id === 'long-hourly-mixture' ? 90 : 1;
  const value = { contract: 'stats-prepared@1', meta: { generationId: c.generation,
    state: request.expected.current.rows ? 'partial' : 'unavailable', asOf: c.asOf,
    windowStart: c.generation ? new Date(AS_OF_MS - days * DAY).toISOString() : null, windowEnd: c.asOf,
    sourceUpdatedAt: request.expected.current.sourceUpdatedAt,
    current: structuredClone(request.expected.current.coverage), previous: structuredClone(request.expected.previous.coverage) },
    currentRows: [], previousRows: [], SECRET: 'RAW_PAYLOAD_SECRET' };
  if (c.id === 'daily-one-observed') {
    value.currentRows = [publicRow(Date.parse('2026-10-24T00:00:00Z'), false)];
    value.previousRows = structuredClone(value.currentRows);
  }
  if (c.id === 'long-hourly-mixture') {
    for (const [previous, field] of [[false, 'currentRows'], [true, 'previousRows']]) {
      const end = AS_OF_MS - (previous ? 90 * DAY : 0), start = end - 90 * DAY;
      for (let i = 0; i <= 4320; i += 2) {
        const ms = Math.floor(AS_OF_MS / HOUR) * HOUR - 180 * DAY + i * HOUR;
        if (ms >= start && ms <= end) value[field].push(publicRow(ms, true));
      }
    }
  }
  return value;
}

function readback(c) {
  if (!c.generation) return [{ generation: null, asOf: null, payloadStorageBytes: null, payloadTextBytes: null,
    payloadSha256: null, readbackSha256: null, hourlyRows: null, dailyRows: null,
    currentSelectedRows: 0, previousSelectedRows: 0 }];
  return [{ generation: c.generation, asOf: c.asOf, payloadStorageBytes: '1000', payloadTextBytes: '10000',
    payloadSha256: 'a'.repeat(64), readbackSha256: 'a'.repeat(64), hourlyRows: c.fixtureInput.hourlyRows,
    dailyRows: c.fixtureInput.dailyRows, currentSelectedRows: c.expected.current.coverage.processedBuckets,
    previousSelectedRows: c.expected.previous.coverage.processedBuckets, SECRET: 'RAW_READBACK_SECRET' }];
}
const planValue = () => [{ Plan: { 'Node Type': 'Result', 'Actual Rows': 1, 'Actual Loops': 1,
  Filter: 'RAW_PLAN_SECRET', 'Total Cost': 1 }, 'Planning Time': 0.5, 'Execution Time': 1.5 }];
const ok = rows => ({ ok: true, status: 200, requestComplete: true, rows });
const probeOk = value => ok([{ probe: { outcome: 'ok', settingsVerified: true, value } }]);

async function harness(overrides = {}) {
  const sources = await migrationSources();
  const plan = createReaderDiagnosticPlan({ schema, privateSchema, migrationSources: sources });
  const saved = [], calls = [];
  let durable, ticks = 1_000_000;
  const persist = async receipt => {
    await overrides.persist?.(receipt);
    durable = structuredClone(receipt); saved.push(durable);
  };
  const pending = (query, phase) => {
    const a = durable.attempts.at(-1);
    assert.equal(a.status, 'pending', 'durable pending must precede every call');
    assert.equal(a.phase, phase);
    assert.ok(a.startedAtMs >= 1_000_000);
    assert.match(a.definitionHashes.periodBodySha256, /^[a-f0-9]{64}$/);
    assert.match(a.definitionHashes.profilerDefinitionSha256, /^[a-f0-9]{64}$/);
    if (a.caseId) {
      const c = plan.cases.find(c => c.id === a.caseId);
      assert.equal(a.generation, c.generation); assert.equal(a.asOf, c.asOf);
      assert.deepEqual(a.selection, phase === 'reader-diagnostic-rest'
        ? c.rest.find(r => r.assertion === a.assertion).body : c.selection);
    }
    calls.push({ query, phase, attempt: structuredClone(a) });
    return a;
  };
  const sql = async (query, phase) => {
    const a = pending(query, phase), c = plan.cases.find(c => c.id === a.caseId);
    const custom = await overrides.sql?.({ query, phase, a, c });
    if (custom !== undefined) return custom;
    if (phase === 'reader-diagnostic-preflight') return ok([{ fresh_owned_fixture: true }]);
    if (phase === 'reader-diagnostic-install') return ok([{ installed: true, proofSettingsVerified: true }]);
    if (phase === 'reader-diagnostic-setup') return ok([]);
    if (phase === 'reader-diagnostic-readback') return ok(readback(c));
    if (phase === 'reader-diagnostic-profile') return probeOk(planValue());
    if (phase === 'reader-diagnostic-response') return probeOk(responseFor(c));
    throw new Error('unrecognized test phase');
  };
  const rest = async request => {
    const a = pending(null, 'reader-diagnostic-rest'), c = plan.cases.find(c => c.id === a.caseId);
    assert.equal(request.alias, 'qa_012345abcdef_get_sp_platform_chart_v1');
    assert.equal(request.appReadMs, 3000);
    const custom = await overrides.rest?.({ request, a, c });
    if (custom !== undefined) return custom;
    return { ok: true, status: 200, requestComplete: true, bodyComplete: true,
      appReadMs: 3000, elapsedMs: 10, value: responseFor(c, c.rest.find(r => r.assertion === request.assertion)) };
  };
  return { plan, saved, calls, run: () => runReaderDiagnostic({ schema, privateSchema,
    migrationSources: sources, sql, rest, persist, now: () => ++ticks }) };
}

test('serial fixed run persists pending before all 79 calls, projects safely, and never becomes acceptance', async () => {
  const h = await harness(); const result = await h.run();
  assert.deepEqual(result.diagnostic, { status: 'profiled', preflightVerified: true,
    casesValidated: 8, sqlDeadline: 'passed', restDeadline: 'passed' });
  assert.equal(result.completed, false); assert.equal(result.acceptance, false);
  assert.equal(h.calls.length, 79);
  assert.deepEqual(h.calls.map(c => c.attempt.attempt), Array.from({ length: 79 }, (_, i) => i + 1));
  assert.equal(h.calls.filter(c => c.phase === 'reader-diagnostic-profile').length, 44);
  assert.equal(h.calls.filter(c => c.phase === 'reader-diagnostic-rest').length, 9);
  assert.deepEqual(result.cases.map(c => c.caseId), h.plan.cases.map(c => c.id));
  const long = result.attempts.find(a => a.caseId === 'long-hourly-mixture' && a.phase === 'reader-diagnostic-rest');
  assert.equal(long.summary.currentRows, 1080); assert.equal(long.summary.previousRows, 1080);
  const control = result.attempts.find(a => a.assertion === 'same-generation-adjacent-hourly-control');
  assert.equal(control.selection.p_resolution, 'hourly'); assert.equal(control.summary.sameGenerationVerified, true);
  const exported = JSON.stringify(h.saved);
  assert.doesNotMatch(exported, /RAW_|exactQuery|parameterizedQuery|setupSql|responseSql|payload\":|QUERY PLAN|Filter|select /i);
  assert.equal(result.originalInput, 'unknown-not-captured');
});

test('false/malformed preflight rejects before writes; install/readback gates stop before profiling', async () => {
  for (const rows of [[{ fresh_owned_fixture: false }], [], [{ fresh_owned_fixture: 'true' }]]) {
    const h = await harness({ sql: ({ phase }) => phase.endsWith('preflight') ? ok(rows) : undefined });
    const result = await h.run();
    assert.equal(h.calls.length, 1); assert.equal(result.diagnostic.preflightVerified, false);
    assert.equal(result.attempts[0].failure.kind, 'preflight-rejected');
  }
  const install = await harness({ sql: ({ phase }) => phase.endsWith('install') ? ok([{ installed: false }]) : undefined });
  await install.run(); assert.equal(install.calls.length, 2);
  for (const rows of [[{ installed: true }], [{ installed: true, proofSettingsVerified: false }],
    [{ installed: true, proofSettingsVerified: 'true' }], [], [{ installed: true, proofSettingsVerified: true }, {}]]) {
    const h = await harness({ sql: ({ phase }) => phase.endsWith('install') ? ok(rows) : undefined });
    const result = await h.run();
    assert.equal(h.calls.length, 2);
    assert.equal(result.attempts.at(-1).failure.kind, 'profiler-install-rejected');
    assert.equal(result.diagnostic.sqlDeadline, 'incomplete');
  }
  const incomplete = await harness({ sql: ({ phase }) => phase.endsWith('install')
    ? { ...ok([{ installed: true, proofSettingsVerified: true }]), requestComplete: false } : undefined });
  const incompleteResult = await incomplete.run();
  assert.equal(incomplete.calls.length, 2);
  assert.equal(incompleteResult.attempts.at(-1).failure.kind, 'request-unknown');
  const h = await harness({ sql: ({ phase, c }) => phase.endsWith('readback') && c.generation
    ? ok([{ ...readback(c)[0], readbackSha256: 'b'.repeat(64) }]) : undefined });
  const result = await h.run();
  assert.equal(result.attempts.at(-1).failure.kind, 'readback-invalid');
  assert.equal(result.cases.at(-1).caseId, 'daily-empty-181');
  assert.equal(h.calls.at(-1).phase, 'reader-diagnostic-readback');
});

test('caught analyzed timeout keeps the saved estimate, completes only fixed remaining work and stays incomplete', async () => {
  const h = await harness({ sql: ({ a }) => a.caseId === 'daily-empty-181' && a.scope === 'current' && a.analyze
    ? ok([{ probe: { outcome: 'cancelled', settingsVerified: true, sqlstate: '57014',
      errorClass: 'statement-timeout', message: 'RAW_ERROR_SECRET' } }]) : undefined });
  const result = await h.run();
  assert.equal(h.calls.length, 79);
  const failed = result.attempts.find(a => a.status === 'incomplete');
  assert.equal(failed.failure.kind, 'sql-cancelled'); assert.equal(failed.failure.sqlstate, '57014');
  assert.equal(failed.isolation, 'caught-wrapper-request-complete-rollback');
  const before = result.attempts[failed.attempt - 2];
  assert.equal(before.analyze, false); assert.equal(before.status, 'validated');
  assert.equal(before.summary['Planning Time'], 0.5);
  assert.ok(h.saved.some(s => s.attempts.at(-1).attempt === before.attempt && s.attempts.at(-1).summary));
  assert.equal(result.diagnostic.status, 'incomplete'); assert.equal(result.diagnostic.casesValidated, 7);
  assert.equal(result.diagnostic.sqlDeadline, 'incomplete'); assert.equal(result.diagnostic.restDeadline, 'passed');
  assert.doesNotMatch(JSON.stringify(h.saved), /RAW_/);
});

test('malformed plan never exports assertion actual or raw plan; unknown SQL interruption stops with no retry', async () => {
  const bad = await harness({ sql: ({ phase }) => phase.endsWith('profile')
    ? probeOk([{ Plan: { Plans: 'RAW_ASSERT_ACTUAL_SECRET' } }]) : undefined });
  const result = await bad.run();
  assert.equal(result.diagnostic.status, 'incomplete');
  assert.equal(bad.calls.length, 79); // complete wrapper requests prove rollback despite projection failure
  assert.equal(result.attempts.find(a => a.failure).failure.kind, 'plan-projection-failed');
  assert.doesNotMatch(JSON.stringify(bad.saved), /RAW_|actual|expected|stack/);
  for (const transport of [() => { throw Object.assign(new Error('RAW_SECRET'), { actual: 'RAW_SECRET' }); },
    () => ({ ok: false, status: 500, failure: { sqlstate: '57014', errorClass: 'statement-timeout', message: 'RAW_SECRET' } }),
    () => ok([{ probe: { outcome: 'cancelled', settingsVerified: true, sqlstate: 'RAW_SECRET', errorClass: 'unknown' } }]),
    () => ok([{ probe: { outcome: 'ok', settingsVerified: false, value: planValue() } }]),
    () => ({ ...probeOk(planValue()), requestComplete: false })]) {
    const h = await harness({ sql: ({ phase }) => phase.endsWith('profile') ? transport() : undefined });
    const failed = await h.run();
    assert.equal(h.calls.length, 5); assert.equal(h.calls.at(-1).phase, 'reader-diagnostic-profile');
    assert.equal(failed.attempts.at(-1).isolation, 'unknown');
    assert.equal(h.saved.at(-1).attempts.at(-1).status, 'incomplete');
    assert.doesNotMatch(JSON.stringify(h.saved), /RAW_/);
  }
});

test('missing analyzed evidence and observed over-budget totals stay incomplete without a longer retry', async () => {
  for (const broken of [() => [{ Plan: { 'Node Type': 'Result' }, 'Planning Time': 1, 'Execution Time': 1 }],
    () => [{ ...planValue()[0], 'Execution Time': 2000 }],
    () => [{ Plan: planValue()[0].Plan, 'Planning Time': 1 }]]) {
    const h = await harness({ sql: ({ a }) => a.phase === 'reader-diagnostic-profile' && a.analyze
      ? probeOk(broken()) : undefined });
    const result = await h.run();
    assert.equal(h.calls.length, 79); assert.equal(result.diagnostic.sqlDeadline, 'incomplete');
    assert.equal(result.diagnostic.status, 'incomplete');
    assert.equal(result.attempts.filter(a => a.phase === 'reader-diagnostic-profile').length, 44);
    assert.ok(result.attempts.filter(a => a.analyze).every(a => a.status === 'incomplete'));
  }
});

test('coverage failures remain incomplete and REST failure is durable before caller cleanup', async () => {
  const sqlBad = await harness({ sql: ({ phase, c }) => phase.endsWith('response')
    ? probeOk({ ...responseFor(c), currentRows: [{ playing: '0', SECRET: 'RAW_SECRET' }] }) : undefined });
  const result = await sqlBad.run();
  assert.equal(sqlBad.calls.length, 79); assert.equal(result.diagnostic.status, 'incomplete');
  assert.equal(result.attempts.find(a => a.failure).failure.kind, 'response-invalid');
  const restBad = await harness({ rest: ({ request, c }) => {
    const value = responseFor(c, c.rest.find(r => r.assertion === request.assertion));
    value.meta.current.missingBuckets.push('RAW_COVERAGE_SECRET');
    return { ok: true, status: 200, requestComplete: true, bodyComplete: true, elapsedMs: 2, appReadMs: 3000, value };
  } });
  const failed = await restBad.run();
  assert.equal(restBad.calls.length, 8); assert.equal(failed.attempts.at(-1).failure.kind, 'rest-response-invalid');
  assert.equal(restBad.saved.at(-1).attempts.at(-1).status, 'incomplete');
  assert.equal(failed.diagnostic.restDeadline, 'incomplete'); assert.doesNotMatch(JSON.stringify(restBad.saved), /RAW_/);
  const restTimeout = await harness({ rest: () => ({ ok: false, status: 200, requestComplete: false,
    failure: { kind: 'rest-deadline', sqlstate: 'unknown', errorClass: 'unknown' } }) });
  const timed = await restTimeout.run();
  assert.equal(restTimeout.calls.length, 8); assert.equal(timed.attempts.at(-1).failure.kind, 'rest-deadline');
  assert.equal(restTimeout.saved.at(-1).attempts.at(-1).status, 'incomplete');
});

test('persistence rejection prevents the next mutation/request and throws only a fixed error', async () => {
  for (const phase of ['reader-diagnostic-preflight', 'reader-diagnostic-install', 'reader-diagnostic-setup']) {
    const h = await harness({ persist: receipt => {
      const a = receipt.attempts.at(-1);
      if (a.phase === phase && a.status === 'pending') throw new Error('RAW_PERSIST_SECRET');
    } });
    await assert.rejects(h.run, { message: 'reader-diagnostic-persistence-failed' });
    assert.ok(!h.calls.some(c => c.phase === phase));
  }
  const h = await harness({ persist: receipt => {
    if (receipt.attempts.at(-1).phase === 'reader-diagnostic-preflight'
      && receipt.attempts.at(-1).status === 'validated') throw new Error('RAW_SECRET');
  } });
  await assert.rejects(h.run, { message: 'reader-diagnostic-persistence-failed' });
  assert.equal(h.calls.length, 1);
});

test('private finite profiler preserves original descriptors, owner/ACL and top-level deadlines without a SQL argument', async () => {
  const h = await harness(); await h.run();
  const install = h.calls.find(c => c.phase.endsWith('install')).query;
  assert.match(install, /create function qa_stats_012345abcdef_p\.reader_diagnostic_probe_v1\(p_probe integer\)/);
  assert.match(install, /language plpgsql volatile security invoker/);
  assert.match(install, /owner to postgres/);
  assert.match(install, /revoke all on function .* from public,anon,authenticated/);
  assert.match(install, /grant execute on function .* to service_role/);
  assert.match(install, /exception when query_canceled then/);
  assert.match(install, /current_setting\('statement_timeout'\) <> '2s'/);
  assert.doesNotMatch(install, /security definer|create or replace|p_sql|set global|alter role|public\.qa_/i);
  // Inspect only the CREATE body: the proof repeats it as a quoted prosrc literal.
  const body = install.match(/as \$reader_profiler\$([\s\S]*?)\$reader_profiler\$;/)?.[1];
  assert.equal(typeof body, 'string');
  const branches = [...body.matchAll(/^      when ([1-9][0-9]*) then execute '((?:[^']|'')*)' into v;$/gm)]
    .map(m => ({ number: Number(m[1]), query: m[2].replaceAll("''", "'") }));
  const prefix = "begin read only;\nset local statement_timeout='2s'; set local lock_timeout='500ms'; set local timezone='UTC';\nset local role service_role;\n";
  const suffix = '\nrollback;';
  const descriptors = h.plan.cases.flatMap(c => [
    ...c.profiles.map(p => ({ caseId: c.id, phase: 'reader-diagnostic-profile', ...p })),
    { caseId: c.id, phase: 'reader-diagnostic-response', sql: c.responseSql },
  ]);
  const numbers = Array.from({ length: 52 }, (_, i) => i + 1);
  assert.deepEqual(branches.map(b => b.number), numbers);
  assert.deepEqual(branches.map(b => b.query), descriptors.map(d => {
    assert.ok(d.sql.startsWith(prefix) && d.sql.endsWith(suffix));
    return d.sql.slice(prefix.length, -suffix.length); // Strip ONLY the known transaction wrapper.
  }));
  const measured = h.calls.filter(c => ['reader-diagnostic-profile', 'reader-diagnostic-response'].includes(c.phase));
  assert.equal(measured.length, 52);
  assert.deepEqual(measured.map(c => {
    const match = c.query.match(/^begin read only;\nset local statement_timeout='2s'; set local lock_timeout='500ms'; set local timezone='UTC';\nset local role service_role;\nselect qa_stats_012345abcdef_p\.reader_diagnostic_probe_v1\(([1-9][0-9]*)\) as probe;\nrollback;$/);
    assert.ok(match, 'measured request must contain only the fixed numbered probe');
    return Number(match[1]);
  }), numbers);
  for (const [i, call] of measured.entries()) {
    const descriptor = descriptors[i];
    assert.equal(call.attempt.probe, numbers[i]);
    assert.equal(call.attempt.caseId, descriptor.caseId);
    assert.equal(call.phase, descriptor.phase);
    if (descriptor.phase === 'reader-diagnostic-profile') {
      assert.equal(call.attempt.scope, descriptor.scope);
      assert.equal(call.attempt.analyze, descriptor.analyze);
      assert.equal(call.attempt.planScope, descriptor.planScope);
    }
  }
  assert.deepEqual(READER_DIAGNOSTIC_PHASES.length, 7);
});

test('installation proof stays within the bounded transaction and is the last nonempty rowset before COMMIT', async () => {
  const h = await harness(); const result = await h.run();
  const install = h.calls.find(c => c.phase === 'reader-diagnostic-install').query;
  const [beforeProof, proof, afterProof] = install.split(/(\nselect p\.proowner=[\s\S]*?::regprocedure;)/);
  assert.equal(typeof proof, 'string');
  const definition = beforeProof.match(/create function [\s\S]*?\$reader_profiler\$;/)?.[0];
  assert.equal(typeof definition, 'string');
  assert.equal(beforeProof, `begin;
set local statement_timeout='2s'; set local lock_timeout='500ms'; set local timezone='UTC';
${definition}
alter function ${privateSchema}.reader_diagnostic_probe_v1(integer) owner to postgres;
revoke all on function ${privateSchema}.reader_diagnostic_probe_v1(integer) from public,anon,authenticated;
grant execute on function ${privateSchema}.reader_diagnostic_probe_v1(integer) to service_role;`);
  assert.equal(afterProof, '\ncommit;');
  const body = beforeProof.match(/as \$reader_profiler\$([\s\S]*?)\$reader_profiler\$;/)[1];
  assert.ok(proof.includes(`p.prosrc='${body.replaceAll("'", "''")}'`));
  assert.match(proof, /p\.proowner='postgres'::regrole and not p\.prosecdef and p\.provolatile='v'/);
  assert.match(proof, /cardinality\(p\.proconfig\)=2/);
  assert.ok(proof.includes(`p.proconfig @> array['search_path=pg_catalog, ${schema}, ${privateSchema}','TimeZone=UTC']`));
  assert.match(proof, /has_function_privilege\('service_role',p\.oid,'execute'\)/);
  for (const role of ['anon', 'authenticated']) assert.ok(proof.includes(`not has_function_privilege('${role}',p.oid,'execute')`));
  assert.match(proof, /aclexplode\(coalesce\(p\.proacl,acldefault\('f',p\.proowner\)\)\)/);
  assert.match(proof, /where a\.grantee not in \(p\.proowner,'service_role'::regrole\)\) as installed,/);
  assert.match(proof, /current_setting\('statement_timeout'\)='2s' and current_setting\('lock_timeout'\)='500ms'\n    and current_setting\('TimeZone'\)='UTC' as "proofSettingsVerified"/);
  assert.ok(proof.endsWith(`from pg_proc p where p.oid='${privateSchema}.reader_diagnostic_probe_v1(integer)'::regprocedure;`));
  assert.deepEqual(result.attempts.find(a => a.phase === 'reader-diagnostic-install').summary,
    { profilerInstalled: true, ownerInvokerAclSettingsVerified: true, proofSettingsVerified: true });
});

const restRequest = (caseId = 'combined-empty', assertion = 'same-generation-adjacent-hourly-control') => ({
  caseId, assertion, alias: 'qa_012345abcdef_get_sp_platform_chart_v1', appReadMs: 3000,
  body: { p_range: '1d', p_resolution: assertion === 'case-response' ? 'daily' : 'hourly', p_include_previous: true },
});
const restOptions = patch => ({ managedUrl: 'https://bbtcaurrtyoukvjbxbbj.supabase.co',
  serviceKey: 'DO_NOT_EXPORT_TEST_KEY', schema, ...patch });

test('REST helper holds total 3s through body, cancels an ignored signal and never retries', async () => {
  let expire, calls = 0, signal, cleared = false;
  const rest = createReaderDiagnosticRest(restOptions({ now: () => 1000,
    setTimer: (fn, ms) => { assert.equal(ms, 3000); expire = fn; return 1; },
    clearTimer: id => { assert.equal(id, 1); cleared = true; },
    fetchImpl: async (url, options) => {
      calls++; signal = options.signal;
      assert.equal(url, 'https://bbtcaurrtyoukvjbxbbj.supabase.co/rest/v1/rpc/qa_012345abcdef_get_sp_platform_chart_v1');
      assert.equal(options.redirect, 'error'); assert.equal(JSON.parse(options.body).p_resolution, 'hourly');
      return { status: 200, ok: true, body: { getReader: () => ({ read: () => new Promise(() => {}) }) } };
    } }));
  const pending = rest(restRequest());
  await Promise.resolve(); expire();
  const result = await pending;
  assert.equal(calls, 1); assert.equal(signal.aborted, true); assert.equal(cleared, true);
  assert.equal(result.failure.kind, 'rest-deadline'); assert.equal(result.requestComplete, false);
  assert.doesNotMatch(JSON.stringify(result), /DO_NOT_EXPORT|value|body\":/);
});

test('REST rejects a deadline crossed only after body completion during decode/parse', async () => {
  for (const parsedAt of [2999, 3000]) {
    let reads = 0, fetches = 0, cleared = false, signal;
    const observations = [], times = [0, 2999, 2999, parsedAt];
    const rest = createReaderDiagnosticRest(restOptions({
      now: () => {
        const time = times[observations.length];
        observations.push({ time, reads });
        return time;
      },
      // No timer fires: this case must depend on the post-parse elapsed check.
      setTimer: (fn, ms) => { assert.equal(ms, 3000); return 1; },
      clearTimer: id => { assert.equal(id, 1); cleared = true; },
      fetchImpl: async (url, options) => {
        fetches++; signal = options.signal;
        return { status: 200, ok: true, body: { getReader: () => ({ read: async () => {
          reads++;
          assert.ok(reads <= 2);
          return reads === 1 ? { done: false, value: Buffer.from('{"decoded":true}') } : { done: true };
        } }) } };
      },
    }));
    const result = await rest(restRequest());
    assert.deepEqual(observations, [{ time: 0, reads: 0 }, { time: 2999, reads: 1 },
      { time: 2999, reads: 2 }, { time: parsedAt, reads: 2 }]);
    assert.equal(fetches, 1); assert.equal(reads, 2);
    assert.equal(cleared, true); assert.equal(signal.aborted, true);
    if (parsedAt < 3000) {
      assert.equal(result.ok, true); assert.equal(result.bodyComplete, true);
      assert.equal(result.elapsedMs, 2999); assert.deepEqual(result.value, { decoded: true });
    } else {
      assert.equal(result.failure.kind, 'rest-deadline'); assert.equal(result.requestComplete, false);
      assert.equal(Object.hasOwn(result, 'value'), false);
    }
  }
});

test('REST rejects target/alias/selection before fetch and covers full scalar JSON including >1000 rows', async () => {
  for (const patch of [{ managedUrl: 'https://database.bloxodes.com' },
    { managedUrl: 'https://bbtcaurrtyoukvjbxbbj.supabase.co/' }, { schema: 'public' }]) {
    assert.throws(() => createReaderDiagnosticRest(restOptions(patch)));
  }
  let calls = 0, ticks = 1;
  const rest = createReaderDiagnosticRest(restOptions({ now: () => ticks++, fetchImpl: async () => {
    calls++; return new Response(JSON.stringify({ rows: Array.from({ length: 1080 }, () => 1) }));
  } }));
  for (const patch of [{ alias: 'get_stats_prepared_platform_chart_v1' }, { caseId: 'unknown' },
    { appReadMs: 12000 }, { body: { ...restRequest().body, p_resolution: 'daily' } },
    { assertion: 'unknown' }]) await assert.rejects(() => rest({ ...restRequest(), ...patch }));
  assert.equal(calls, 0);
  const result = await rest(restRequest());
  assert.equal(calls, 1); assert.equal(result.ok, true); assert.equal(result.value.rows.length, 1080);
  assert.equal(result.bodyComplete, true); assert.equal(result.appReadMs, 3000);
  let timeCalls = 0;
  const late = createReaderDiagnosticRest(restOptions({ now: () => timeCalls++ ? 3000 : 0,
    fetchImpl: async () => new Response('{}') }));
  assert.equal((await late(restRequest())).failure.kind, 'rest-deadline');
  const oversized = createReaderDiagnosticRest(restOptions({ fetchImpl: async () => ({ status: 200, ok: true,
    body: { getReader: () => ({ read: async () => ({ done: false, value: new Uint8Array(16_777_217) }), cancel: async () => {} }) } }) }));
  assert.equal((await oversized(restRequest())).failure.kind, 'rest-body-too-large');
});

test('runner import has no top-level execution, environment or external I/O dependencies', async () => {
  const text = await readFile(new URL('../../ci/stats-prepared-reader-runner.mjs', import.meta.url), 'utf8');
  assert.deepEqual([...text.matchAll(/^import .* from '([^']+)'/gm)].map(m => m[1]), ['node:assert/strict', 'node:crypto']);
  assert.doesNotMatch(text, /process\.|node:(?:fs|child_process)|new Date\(\)|^await /m);
});
