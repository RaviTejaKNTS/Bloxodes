#!/usr/bin/env node
/** GitHub-only managed-development fixtures. No dotenv, production or local DB. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const PROJECT = 'bbtcaurrtyoukvjbxbbj';
const MANAGED_URL = `https://${PROJECT}.supabase.co`;
const MIGRATION = new URL('../../supabase/migrations/20261023100441_stats_prepared_charts_v1.sql', import.meta.url);
const RPC_NAMES = ['get_stats_prepared_health_v1', 'get_stats_prepared_platform_chart_v1',
  'get_stats_prepared_visit_share_v1', 'claim_stats_prepared_work_v1', 'run_stats_prepared_step_v1',
  'get_stats_prepared_receipt_v1', 'finish_stats_prepared_work_v1'];
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
const ident = value => { assert.match(value, /^[a-z][a-z0-9_]{0,62}$/); return value; };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const bigint = value => BigInt(String(value));
const percentage = (part, total) => total === 0n ? 0 : Math.round(Number(part) / Number(total) * 10000) / 100;
const SQL_PHASES = new Set(['source-clone', 'migration-install', 'alias-read', 'alias-install',
  'alias-acl-timeout', 'fixture-checks', 'cleanup']);
const sqlstate = value => typeof value === 'string' && /^[A-Z0-9]{5}$/.test(value) ? value : null;
const rpcErrorCode = value => sqlstate(value) ??
  (typeof value === 'string' && /^PGRST[0-9]{3}$/.test(value) ? value : 'unknown');

export function fixtureMigrationSql(bytes, schema, privateSchema) {
  assert.match(schema, /^qa_stats_[a-f0-9]{12}$/);
  assert.equal(privateSchema, `${schema}_p`);
  // Schema qualifiers/catalog literals move; the unquoted PUBLIC pseudorole
  // in REVOKE statements must retain its PostgreSQL meaning.
  return bytes.replaceAll('stats_prepared_private', privateSchema)
    .replaceAll('public.', `${schema}.`).replaceAll("'public'", literal(schema));
}

export function qaSqlFailureDiagnostic({ phase, status, result, query }) {
  assert.ok(SQL_PHASES.has(phase), 'unknown QA SQL phase');
  const diagnostic = { phase, status: Number.isInteger(status) && status >= 100 && status <= 599 ? status : null,
    sqlstate: sqlstate(result?.code) ?? sqlstate(result?.error?.code) ?? 'unknown' };
  // Management API errors can carry PostgreSQL's code only in a message.
  // Read only the fixed error prefix and numeric location; never retain text,
  // SQL excerpts, detail, hint, context, headers or the response body.
  const messages = [result?.message, result?.error?.message, result?.error, result];
  for (const message of messages) {
    if (typeof message !== 'string') continue;
    const match = /^(?:Failed to run sql query: )?ERROR:\s+([A-Z0-9]{5}):(?:\s|$)/.exec(message);
    if (!match) continue;
    if (diagnostic.sqlstate === 'unknown') diagnostic.sqlstate = match[1];
    const line = /\nLINE ([1-9][0-9]{0,5}):/.exec(message);
    if (line && Number(line[1]) <= query.split('\n').length) diagnostic.reportedLine = Number(line[1]);
    break;
  }
  const position = result?.position ?? result?.error?.position;
  if ((typeof position === 'string' || Number.isSafeInteger(position)) && /^[1-9][0-9]{0,8}$/.test(String(position)) &&
    Number(position) <= query.length) diagnostic.position = Number(position);
  return diagnostic;
}

export function qaReceiptWithPhases(identity, phases) {
  // Explicit cleanup is another process. Retain the original failure/timings
  // instead of replacing them with the cleanup request's single success.
  return { ...identity, phases: [...(identity.phases ?? []), ...phases] };
}

export function validateQaCheckout({ expectedSha, checkoutSha, eventName, event, githubSha }) {
  assert.match(expectedSha ?? '', /^[a-f0-9]{40}$/);
  assert.equal(checkoutSha, expectedSha, 'exact checkout SHA required');
  assert.ok(['pull_request', 'workflow_dispatch', 'push'].includes(eventName), 'unsupported GitHub event');
  assert.equal(event.repository?.full_name, 'RaviTejaKNTS/Bloxodes');
  if (eventName === 'pull_request') {
    assert.equal(event.pull_request?.head?.repo?.full_name, 'RaviTejaKNTS/Bloxodes');
    assert.equal(event.pull_request?.base?.repo?.full_name, 'RaviTejaKNTS/Bloxodes');
    assert.equal(event.pull_request?.head?.sha, checkoutSha, 'same-repository PR head required');
  } else assert.equal(githubSha, checkoutSha, 'dispatch/push SHA must match checkout');
}

export function legacyVisitExpected(rows) {
  const dates = new Map(); const buckets = new Map();
  for (const r of rows) {
    if (bigint(r.visit_delta) <= 0n) continue;
    dates.set(r.stat_date, { total: bigint(r.denominator_visit_delta), games: Number(r.denominator_game_count) });
    const b = buckets.get(r.bucket_key) ?? { total: 0n, rank: Number(r.bucket_rank_start),
      rankEnd: Number(r.bucket_rank_end), universe: r.universe_id == null ? null : String(r.universe_id),
      dates: new Map() };
    b.total += bigint(r.visit_delta);
    b.dates.set(r.stat_date, (b.dates.get(r.stat_date) ?? 0n) + bigint(r.visit_delta));
    buckets.set(r.bucket_key, b);
  }
  return { dates, buckets, total: [...dates.values()].reduce((n, d) => n + d.total, 0n),
    count: Math.max(0, ...[...dates.values()].map(d => d.games)) };
}
export function assertVisitParity(chart, legacyRows) {
  const expected = legacyVisitExpected(legacyRows);
  assert.equal(bigint(chart.totalVisits), expected.total);
  assert.equal(chart.denominatorGameCount, expected.count);
  assert.equal(chart.series.length, expected.buckets.size);
  assert.equal(chart.points.length, expected.dates.size);
  assert.deepEqual(chart.series.map(s => s.key), [...expected.buckets].sort((a, b) => a[1].rank - b[1].rank).map(([key]) => key));
  for (const s of chart.series) {
    const e = expected.buckets.get(s.key);
    assert.equal(bigint(s.totalVisits), e.total);
    assert.equal(s.rankStart, e.rank); assert.equal(s.rankEnd, e.rankEnd);
    assert.equal(s.universeId == null ? null : String(s.universeId), e.universe);
    assert.equal(Number(s.sharePercent), percentage(e.total, expected.total));
  }
  for (const p of chart.points) {
    const date = p.sampledAt.slice(0, 10); const total = expected.dates.get(date).total;
    assert.equal(bigint(p.totalVisits), total);
    assert.equal(Object.values(p.visits).reduce((n, v) => n + bigint(v), 0n), total);
    for (const s of chart.series) {
      const visits = expected.buckets.get(s.key).dates.get(date) ?? 0n;
      assert.equal(bigint(p.visits[s.key]), visits);
      assert.equal(Number(p.shares[s.key]), percentage(visits, total));
    }
  }
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    assert.ok(['--mode', '--expected-sha', '--receipt'].includes(argv[i]) && !(argv[i] in options));
    options[argv[i]] = argv[i + 1]; assert.ok(options[argv[i]]);
  }
  const mode = options['--mode'] ?? 'fixture';
  assert.ok(['fixture', 'benchmark', 'cleanup'].includes(mode));
  assert.equal(env.GITHUB_ACTIONS, 'true', 'GitHub execution only');
  assert.equal(env.GITHUB_REPOSITORY, 'RaviTejaKNTS/Bloxodes');
  assert.match(options['--expected-sha'] ?? '', /^[a-f0-9]{40}$/);
  const checkoutSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const event = JSON.parse(await readFile(env.GITHUB_EVENT_PATH, 'utf8'));
  validateQaCheckout({ expectedSha: options['--expected-sha'], checkoutSha,
    eventName: env.GITHUB_EVENT_NAME, event, githubSha: env.GITHUB_SHA });
  assert.equal(env.SUPABASE_URL ?? env.MANAGED_DEV_SUPABASE_URL, MANAGED_URL);
  const token = env.MANAGED_DEV_SUPABASE_ACCESS_TOKEN;
  const service = env.MANAGED_DEV_SUPABASE_SERVICE_ROLE ?? env.SUPABASE_SERVICE_ROLE;
  assert.ok(token && service, 'Management API and managed-development service credentials required');
  const receiptPath = options['--receipt'] ?? path.join(env.RUNNER_TEMP, 'stats-prepared-db-qa.json');
  const phases = []; let identity;
  const saveReceipt = () => writeFile(receiptPath, JSON.stringify(qaReceiptWithPhases(identity, phases), null, 2));
  async function sql(query, phase = 'fixture-checks') {
    assert.ok(SQL_PHASES.has(phase), 'unknown QA SQL phase');
    const started = Date.now();
    const submittedQuery = `set statement_timeout='110s'; set lock_timeout='2s'; set timezone='UTC';\n${query}`;
    let response; let result; let failureKind;
    try {
      response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: submittedQuery }),
        signal: AbortSignal.timeout(120_000), redirect: 'error',
      });
    } catch { failureKind = 'request-error'; }
    if (response) {
      try { result = await response.json(); } catch { failureKind = 'invalid-json'; }
      if (!failureKind && (!response.ok || !Array.isArray(result))) failureKind = 'sql-response-error';
    }
    if (failureKind) {
      const failure = { kind: 'sql', ...qaSqlFailureDiagnostic({ phase, status: response?.status,
        result, query: submittedQuery }), ms: Date.now() - started, ok: false, failureKind };
      phases.push(failure);
      // Save before finally cleanup or a runner interruption can obscure it.
      if (phase === 'cleanup') identity.cleanupSqlFailure = failure;
      else identity.sqlFailure ??= failure;
      await saveReceipt();
      throw new Error(`fixture-sql-failed-${phase}-${failure.status ?? 'no-response'}-${failure.sqlstate}`);
    }
    phases.push({ kind: 'sql', phase, ms: Date.now() - started, status: response.status, ok: true });
    return result;
  }
  const scalar = async expression => (await sql(`select ${expression} as result;`))[0].result;
  async function transport(name, body = {}, { expectedError, retrySchema = false, key = service } = {}) {
    let result;
    for (let attempt = 0; attempt < (retrySchema ? 12 : 1); attempt++) {
      const started = Date.now();
      const response = await fetch(`${MANAGED_URL}/rest/v1/rpc/${ident(name)}`, { method: 'POST', redirect: 'error',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(12_000) });
      result = await response.json();
      const code = rpcErrorCode(result?.code);
      phases.push({ kind: 'rest', rpc: name, ms: Date.now() - started, status: response.status, code });
      if (retrySchema && result?.code === 'PGRST202') { await pause(500); continue; }
      if (expectedError) { assert.equal(code, expectedError); return result; }
      assert.equal(response.ok, true, `fixture-rpc-failed-${response.status}-${code}`);
      return result;
    }
    throw new Error('fixture-schema-cache-not-ready');
  }
  async function cleanup() {
    if (!identity) return;
    ident(identity.schema); ident(identity.privateSchema); ident(identity.prefix);
    assert.match(identity.schema, /^qa_stats_[a-f0-9]{12}$/);
    assert.ok(identity.privateSchema === `${identity.schema}_p` && identity.prefix === `qa_${identity.schema.slice(9)}_`);
    assert.equal(identity.project, PROJECT); assert.equal(identity.sha, checkoutSha);
    assert.deepEqual(identity.functions, [...RPC_NAMES.map(name => identity.prefix + name.replace('_stats_prepared_', '_sp_')), identity.prefix + 'timeout']);
    identity.cleaned = false;
    await sql(identity.functions.map(name => `drop function if exists public.${ident(name)} cascade;`).join('\n') +
      `\ndrop schema if exists ${identity.schema} cascade; drop schema if exists ${identity.privateSchema} cascade; notify pgrst,'reload schema';`, 'cleanup');
    identity.cleaned = true;
    await saveReceipt();
  }
  if (mode === 'cleanup') { identity = JSON.parse(await readFile(receiptPath, 'utf8')); await cleanup(); return; }
  const suffix = createHash('sha256').update(`${env.GITHUB_RUN_ID}:${env.GITHUB_RUN_ATTEMPT}:${randomUUID()}`).digest('hex').slice(0, 12);
  const schema = ident(`qa_stats_${suffix}`); const privateSchema = ident(`${schema}_p`); const prefix = ident(`qa_${suffix}_`);
  const alias = name => ident(prefix + name.replace('_stats_prepared_', '_sp_'));
  identity = { project: PROJECT, sha: checkoutSha, mode, schema, privateSchema, prefix,
    functions: [...RPC_NAMES.map(alias), prefix + 'timeout'], cleaned: false, completed: false };
  await writeFile(receiptPath, JSON.stringify(identity, null, 2));
  const games = mode === 'benchmark' ? 100_000 : 1105;
  let claim; let sourceRows; let maximumStepMs = 0;
  try {
    await sql(`create schema ${schema}; grant usage on schema ${schema} to service_role;\n` +
      ['roblox_universes', 'stats_game_current_index', 'roblox_universe_stats_hourly', 'roblox_universe_stats_daily', 'revalidation_events']
        .map(table => `create table ${schema}.${table} (like public.${table} including all); grant select,insert,update,delete on ${schema}.${table} to service_role;`).join('\n'), 'source-clone');
    const migrationBytes = await readFile(MIGRATION, 'utf8');
    identity.migrationSha256 = createHash('sha256').update(migrationBytes).digest('hex');
    const migration = fixtureMigrationSql(migrationBytes, schema, privateSchema);
    await sql(migration, 'migration-install');
    // Execute exact function bodies/settings through real PostgREST using unique
    // service-only aliases. All table/helper references still point at fixtures.
    for (const name of RPC_NAMES) {
      const row = (await sql(`select pg_get_functiondef(oid) as definition,pg_get_function_identity_arguments(oid) as args from pg_proc where pronamespace=${literal(schema)}::regnamespace and proname=${literal(name)};`, 'alias-read'))[0];
      await sql('begin;\n' + row.definition.replace(`FUNCTION ${schema}.${name}(`, `FUNCTION public.${alias(name)}(`) +
        `;\nrevoke all on function public.${alias(name)}(${row.args}) from public,anon,authenticated; grant execute on function public.${alias(name)}(${row.args}) to service_role; commit;`, 'alias-install');
    }
    // Function-specific ACL statements need identity argument types: use a
    // catalog DO rather than assuming grant-all can address overloaded routines.
    await sql(`do $qa$ declare f record; begin for f in select oid::regprocedure sig from pg_proc where pronamespace='public'::regnamespace and proname like ${literal(prefix + '%')} loop execute 'revoke all on function '||f.sig||' from public,anon,authenticated'; execute 'grant execute on function '||f.sig||' to service_role'; end loop; end $qa$;` +
      `create function public.${prefix}timeout() returns void language sql volatile security invoker set search_path='' set statement_timeout='100ms' as 'select pg_catalog.pg_sleep(1)'; revoke all on function public.${prefix}timeout() from public,anon,authenticated; grant execute on function public.${prefix}timeout() to service_role; notify pgrst,'reload schema';`, 'alias-acl-timeout');
    await transport(alias('get_stats_prepared_health_v1'), {}, { retrySchema: true });
    await transport(prefix + 'timeout', {}, { expectedError: '57014', retrySchema: true });
    const cold = await scalar(`${schema}.get_stats_prepared_platform_chart_v1('90d','hourly',true)`);
    assert.equal(cold.meta.state, 'unavailable'); assert.deepEqual(cold.currentRows, []);
    assert.equal((await scalar(`${schema}.get_stats_prepared_health_v1()`)).ok, true);
    const acl = await sql(`select n.nspname,p.proname,has_function_privilege('anon',p.oid,'EXECUTE') a,has_function_privilege('authenticated',p.oid,'EXECUTE') u from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in (${literal(schema)},${literal(privateSchema)});`);
    assert.ok(acl.length > 10); assert.ok(acl.every(r => !r.a && !r.u));
    assert.equal(await scalar(`not exists(select 1 from pg_tables where schemaname=${literal(schema)} and tablename like 'stats_prepared_%' and not rowsecurity)`), true);
    const fixture = await readFile(new URL('./fixtures/stats-prepared-source.sql', import.meta.url), 'utf8');
    const universesPart = fixture.slice(0, fixture.indexOf('insert into __SCHEMA__.roblox_universe_stats_daily'));
    await sql(universesPart.replaceAll('__SCHEMA__', schema).replaceAll('__GAMES__', String(games)));
    if (mode === 'benchmark') await sql(`insert into ${schema}.stats_game_current_index(universe_id,slug,name)
      select n,'fixture-'||n,'Fixture '||n from generate_series(3,${games}) n;`);
    const dailyPart = fixture.slice(fixture.indexOf('insert into __SCHEMA__.roblox_universe_stats_daily'), fixture.indexOf('-- Raw history'));
    for (let first = 1; first <= games; first += 1000) {
      await sql(dailyPart.replaceAll('__SCHEMA__', schema).replaceAll('__GAMES__', String(games))
        .replaceAll('__START_ID__', String(first)).replaceAll('__END_ID__', String(Math.min(games, first + 999))));
    }
    await sql(fixture.slice(fixture.indexOf('-- Raw history')).replaceAll('__SCHEMA__', schema));
    if (mode === 'benchmark') {
      // 16 million representative hourly rows, 9.1 million daily rows. Batches
      // bound setup writes too. Index creation happened on empty fixture tables.
      for (let first = 3; first <= games; first += 1000) await sql(`insert into ${schema}.roblox_universe_stats_hourly(universe_id,hour_start,playing,avg_playing,peak_playing,sample_count,first_sampled_at,last_sampled_at)
        select n,h,2,2,3,1,h,h from generate_series(${first},${Math.min(games, first + 999)}) n cross join generate_series(date_trunc('hour',now())-interval '160 hours',date_trunc('hour',now())-interval '1 hour',interval '1 hour') h;`);
    }
    sourceRows = (await sql(`select (select count(*) from ${schema}.roblox_universe_stats_hourly)::text hourly,(select count(*) from ${schema}.roblox_universe_stats_daily)::text daily;`))[0];
    // Only this run's isolated source copies are analyzed. No real managed-
    // development/production source maintenance is performed.
    await sql(`analyze ${schema}.roblox_universes; analyze ${schema}.roblox_universe_stats_hourly; analyze ${schema}.roblox_universe_stats_daily;`);
    identity.sourceIndexes = await sql(`select tablename,indexname,indexdef from pg_indexes where schemaname=${literal(schema)}
      and tablename in ('roblox_universe_stats_hourly','roblox_universe_stats_daily','stats_prepared_visits','stats_prepared_visit_totals') order by tablename,indexname;`);
    identity.dailySourcePlan = await sql(`explain (format json,settings true) select d.* from
      (select universe_id from ${schema}.roblox_universes order by universe_id limit 256) u cross join lateral
      (select * from ${schema}.roblox_universe_stats_daily s where s.universe_id=u.universe_id
        and s.stat_date between current_date-180 and current_date offset 0) d;`);
    const bootstrapStarted = Date.now();
    identity.bootstrapStartedAt = new Date(bootstrapStarted).toISOString();
    const observe = result => {
      if (result?.platformGeneration && identity.firstPlatformObservedMs == null) identity.firstPlatformObservedMs = Date.now() - bootstrapStarted;
      if (result?.visitGeneration && identity.firstVisitObservedMs == null) identity.firstVisitObservedMs = Date.now() - bootstrapStarted;
    };
    const requestId = randomUUID();
    claim = await transport(alias('claim_stats_prepared_work_v1'), { p_worker_id: 'github-fixture', p_request_id: requestId });
    assert.ok(claim.claimed);
    identity.hourlySourcePlan = await sql(`explain (format json,settings true) select sum(coalesce(h.avg_playing,h.playing::numeric))
      from ${schema}.roblox_universe_stats_hourly h join ${schema}.stats_prepared_members m using(universe_id)
      where h.hour_start=date_trunc('hour',now())-interval '1 hour';`);
    assert.equal((await transport(alias('claim_stats_prepared_work_v1'), { p_worker_id: 'other', p_request_id: randomUUID() })).claimed, false);
    assert.equal((await transport(alias('claim_stats_prepared_work_v1'), { p_worker_id: 'github-fixture', p_request_id: requestId })).leaseToken, claim.leaseToken);
    const stepArgs = stepId => ({ p_lease_token: claim.leaseToken, p_epoch: claim.epoch, p_step_id: stepId, p_work: { kind: 'advance' } });
    const firstStep = stepArgs(randomUUID());
    const firstResult = await transport(alias('run_stats_prepared_step_v1'), firstStep);
    observe(firstResult);
    assert.deepEqual(await transport(alias('run_stats_prepared_step_v1'), firstStep), firstResult);
    assert.equal((await transport(alias('get_stats_prepared_receipt_v1'), { p_step_id: firstStep.p_step_id })).found, true);
    async function drive() {
      const started = Date.now(); let done = false; let total = 0;
      // Management API batches reduce HTTP overhead; exact RPC transport and
      // pre-execution timeouts are separately proved above and below. Each SQL
      // transaction contains 8 bounded calls and has a 60-second outer deadline.
      while (!done && total < 6000 && Date.now() - started < 1_200_000) {
        if (mode === 'benchmark') {
          const began = Date.now();
          const result = await transport(alias('run_stats_prepared_step_v1'), stepArgs(randomUUID()));
          observe(result);
          maximumStepMs = Math.max(maximumStepMs, Date.now() - began);
          total++; done = !result.more;
          if (total % 128 === 0) console.log(JSON.stringify({ phase: result.phase, steps: total, elapsedMs: Date.now() - started }));
          continue;
        }
        const batch = Array.from({ length: 8 }, () => randomUUID());
        const expressions = batch.map(id => `${schema}.run_stats_prepared_step_v1(${literal(claim.leaseToken)},${literal(claim.epoch)},${literal(id)},'{"kind":"advance"}')`);
        const results = await sql(`set statement_timeout='60s';\n` + expressions.map(e => `select ${e} as result;`).join('\n'));
        for (const r of results) observe(r.result);
        total += 8; done = results.some(r => r.result?.more === false);
        if (total % 256 === 0) console.log(JSON.stringify({ phase: 'fixture-bootstrap', steps: total, elapsedMs: Date.now() - started }));
      }
      assert.ok(done, 'bounded-bootstrap-incomplete');
      const receipt = { steps: total, ms: Date.now() - started };
      identity.bootstrap ??= receipt;
      (identity.bootstrapRuns ??= []).push(receipt);
    }
    await drive();
    const platform = await transport(alias('get_stats_prepared_platform_chart_v1'), { p_range: '90d', p_resolution: 'hourly', p_include_previous: true });
    assert.ok(platform.currentRows.length > 1000, 'scalar JSON must exceed REST row cap');
    assert.equal(platform.meta.previous.reason, 'retention-gap');
    const row = platform.currentRows.at(-1);
    assert.equal(row.playing, mode === 'benchmark' ? '200026' : '30');
    assert.equal(row.peak_players, mode === 'benchmark' ? '300028' : '34');
    assert.equal(Number(row.avg_players), mode === 'benchmark' ? 200025.7 : 29.7);
    assert.equal(row.rating_percent, '80.1'); assert.equal(row.samples, mode === 'benchmark' ? '100001' : '3');
    for (const range of ['1d', '7d', '14d', '30d', '90d']) for (const resolution of ['hourly', 'daily', 'weekly', 'monthly']) {
      const value = await scalar(`${schema}.get_stats_prepared_platform_chart_v1(${literal(range)},${literal(resolution)},true)`);
      assert.ok(value.meta.generationId); assert.ok(Array.isArray(value.currentRows) && Array.isArray(value.previousRows));
      assert.equal(value.meta.windowEnd, value.meta.asOf);
    }
    const legacyFile = await readFile(new URL('../../supabase/migrations/20260918000008_stats_visit_share_chart.sql', import.meta.url), 'utf8');
    await sql(legacyFile.replaceAll('public.', `${schema}.`));
    for (const days of [1, 7, 14, 30, 90]) {
      const prepared = await scalar(`${schema}.get_stats_prepared_visit_share_v1('${days}d')`);
      const legacy = await scalar(`(select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('universe_id',r.universe_id::text,'visit_delta',r.visit_delta::text,'denominator_visit_delta',r.denominator_visit_delta::text)),'[]') from ${schema}.get_stats_visit_share_chart(${literal(prepared.meta.windowStart.slice(0, 10))},${literal(prepared.meta.windowEnd.slice(0, 10))}) r)`);
      assertVisitParity(prepared.chart, legacy);
      assert.ok(prepared.chart.points.length <= days + 1 && prepared.chart.points.length >= days);
      assert.ok(prepared.chart.series.some(s => s.key === 'other_tracked'));
      assert.equal(prepared.chart.generatedAt, prepared.meta.generatedAt);
    }
    const before = await scalar(`${schema}.get_stats_prepared_health_v1()`);
    const noChange = await transport(alias('run_stats_prepared_step_v1'), stepArgs(randomUUID()));
    assert.equal(noChange.phase, 'unchanged');
    assert.equal((await scalar(`${schema}.get_stats_prepared_health_v1()`)).operational.platformGeneration, before.operational.platformGeneration);
    // Bookkeeping-only writes do not dirty source; old metric updates/deletes do.
    await sql(`update ${schema}.roblox_universe_stats_hourly set updated_at=clock_timestamp() where universe_id=1 and hour_start=date_trunc('hour',now())-interval '12 hours';`);
    assert.equal(await scalar(`(select count(*) from ${schema}.stats_prepared_dirty)`), 0);
    await sql(`update ${schema}.roblox_universe_stats_hourly set avg_playing=99.25 where universe_id=1 and hour_start=date_trunc('hour',now())-interval '12 hours';
      delete from ${schema}.roblox_universe_stats_daily where universe_id=5 and stat_date=current_date-14;`);
    assert.equal(await scalar(`(select count(*) from ${schema}.stats_prepared_dirty where kind in ('h','d'))`), 2);
    const lastGood = before.operational.platformGeneration;
    // Failure result preserves last-good pointers and durable sanitized code.
    await transport(alias('finish_stats_prepared_work_v1'), { p_lease_token: claim.leaseToken, p_epoch: claim.epoch, p_outcome: { status: 'error', code: 'sql-timeout' } });
    const failed = await scalar(`${schema}.get_stats_prepared_health_v1()`);
    assert.equal(failed.operational.platformGeneration, lastGood); assert.equal(failed.operational.errorCode, 'sql-timeout');
    assert.equal(failed.operational.lastReceipt.outcome.code, 'sql-timeout');
    assert.equal((await scalar(`${schema}.get_stats_prepared_platform_chart_v1('1d','hourly',false)`)).meta.state, 'last-good');
    await sql(`update ${schema}.stats_prepared_control set retry_at=null where id;`);
    const oldClaim = claim;
    claim = await transport(alias('claim_stats_prepared_work_v1'), { p_worker_id: 'replacement', p_request_id: randomUUID() });
    await transport(alias('run_stats_prepared_step_v1'), { ...stepArgs(randomUUID()), p_lease_token: oldClaim.leaseToken, p_epoch: oldClaim.epoch }, { expectedError: '55000' });
    await drive();
    assert.notEqual((await scalar(`${schema}.get_stats_prepared_health_v1()`)).operational.platformGeneration, lastGood);
    const repaired = await scalar(`${schema}.get_stats_prepared_platform_chart_v1('1d','hourly',false)`);
    const repairedHour = (await sql(`select hour_start::text t from ${schema}.roblox_universe_stats_hourly where universe_id=1 and avg_playing=99.25 limit 1;`))[0].t;
    assert.equal(repaired.currentRows.find(r => Date.parse(r.hour_start) === Date.parse(repairedHour)).playing,
      mode === 'benchmark' ? '200101' : '105');
    const newVisit = await scalar(`${schema}.get_stats_prepared_visit_share_v1('90d')`);
    const newLegacy = await scalar(`(select jsonb_agg(to_jsonb(r)||jsonb_build_object('universe_id',r.universe_id::text,'visit_delta',r.visit_delta::text,'denominator_visit_delta',r.denominator_visit_delta::text)) from ${schema}.get_stats_visit_share_chart(${literal(newVisit.meta.windowStart.slice(0, 10))},${literal(newVisit.meta.windowEnd.slice(0, 10))}) r)`);
    assertVisitParity(newVisit.chart, newLegacy);
    // A new membership invalidates historic population; retained source absence
    // is published as a gap and never prevents current data from advancing.
    await transport(alias('finish_stats_prepared_work_v1'), { p_lease_token: claim.leaseToken, p_epoch: claim.epoch, p_outcome: { status: 'completed' } });
    if (mode === 'fixture') {
      await sql(`update ${schema}.roblox_universe_stats_daily set visit_delta=0 where stat_date>=current_date-1;`);
      claim = await transport(alias('claim_stats_prepared_work_v1'), { p_worker_id: 'zero-positive', p_request_id: randomUUID() });
      await drive();
      const empty = await scalar(`${schema}.get_stats_prepared_visit_share_v1('1d')`);
      assert.equal(empty.meta.state, 'empty'); assert.equal(empty.meta.current.reason, 'zero-denominator');
      assert.deepEqual(empty.chart.series, []); assert.deepEqual(empty.chart.points, []);
      await transport(alias('finish_stats_prepared_work_v1'), { p_lease_token: claim.leaseToken, p_epoch: claim.epoch, p_outcome: { status: 'completed' } });
      await sql(`delete from ${schema}.roblox_universe_stats_daily where stat_date=current_date;`);
      claim = await transport(alias('claim_stats_prepared_work_v1'), { p_worker_id: 'missing-current-day', p_request_id: randomUUID() });
      await drive();
      const missing = await scalar(`${schema}.get_stats_prepared_visit_share_v1('1d')`);
      assert.equal(missing.meta.state, 'partial'); assert.equal(missing.meta.current.reason, 'producer-behind');
      await transport(alias('finish_stats_prepared_work_v1'), { p_lease_token: claim.leaseToken, p_epoch: claim.epoch, p_outcome: { status: 'completed' } });
      await sql(`update ${schema}.roblox_universe_stats_hourly set visits_end=9007199254740993 where universe_id=1 and hour_start=(select max(hour_start) from ${schema}.roblox_universe_stats_hourly);`);
      claim = await transport(alias('claim_stats_prepared_work_v1'), { p_worker_id: 'large-counter', p_request_id: randomUUID() });
      await drive();
      const large = await scalar(`${schema}.get_stats_prepared_platform_chart_v1('1d','hourly',false)`);
      assert.equal(large.currentRows.at(-1).visits, '9007199254741993');
      await transport(alias('finish_stats_prepared_work_v1'), { p_lease_token: claim.leaseToken, p_epoch: claim.epoch, p_outcome: { status: 'completed' } });
      const goodGeneration = large.meta.generationId;
      await sql(`update ${schema}.roblox_universe_stats_hourly set avg_playing='NaN'::numeric where universe_id=1 and hour_start=(select max(hour_start) from ${schema}.roblox_universe_stats_hourly);`);
      claim = await transport(alias('claim_stats_prepared_work_v1'), { p_worker_id: 'invalid-source', p_request_id: randomUUID() });
      const failedStep = stepArgs(randomUUID());
      await transport(alias('run_stats_prepared_step_v1'), failedStep, { expectedError: '23514' });
      assert.equal((await transport(alias('get_stats_prepared_receipt_v1'), { p_step_id: failedStep.p_step_id })).found, false);
      assert.equal((await scalar(`${schema}.get_stats_prepared_platform_chart_v1('1d','hourly',false)`)).meta.generationId, goodGeneration);
      await transport(alias('finish_stats_prepared_work_v1'), { p_lease_token: claim.leaseToken, p_epoch: claim.epoch, p_outcome: { status: 'error', code: 'sql-source-invalid' } });
      await sql(`update ${schema}.roblox_universe_stats_hourly set avg_playing=23.5 where universe_id=1 and hour_start=(select max(hour_start) from ${schema}.roblox_universe_stats_hourly);
        update ${schema}.stats_prepared_control set retry_at=null where id;`);
      claim = await transport(alias('claim_stats_prepared_work_v1'), { p_worker_id: 'valid-source-restored', p_request_id: randomUUID() });
      await drive();
      await transport(alias('finish_stats_prepared_work_v1'), { p_lease_token: claim.leaseToken, p_epoch: claim.epoch, p_outcome: { status: 'completed' } });
    }
    const visitBeforeMembership = (await scalar(`${schema}.get_stats_prepared_health_v1()`)).operational.visitGeneration;
    await sql(`delete from ${schema}.stats_game_current_index where universe_id=2;`);
    claim = await transport(alias('claim_stats_prepared_work_v1'), { p_worker_id: 'membership', p_request_id: randomUUID() });
    await drive();
    const changed = await scalar(`${schema}.get_stats_prepared_platform_chart_v1('90d','hourly',true)`);
    assert.equal(changed.currentRows.at(-1).playing, mode === 'benchmark' ? '200020' : '24');
    assert.equal(changed.meta.previous.reason, 'retention-gap');
    const afterMembershipHealth = await scalar(`${schema}.get_stats_prepared_health_v1()`);
    assert.equal(afterMembershipHealth.operational.visitGeneration, visitBeforeMembership,
      'platform-only membership changes must not relabel unchanged full-population visit data');
    // Incomplete bundle cannot change active pointer.
    const visit = (await scalar(`${schema}.get_stats_prepared_health_v1()`)).operational.visitGeneration;
    await sql(`do $qa$ declare g uuid; begin insert into ${schema}.stats_prepared_generations(product,as_of,membership,signature,metadata_revision,manifest,totals_done)
      values('visit',now(),'test','test',0,'{}',true) returning id into g;
      begin perform ${privateSchema}.stats_prepared_visit_publish_v1(g); raise exception 'qa-should-have-failed';
      exception when raise_exception then if sqlerrm<>'incomplete-visit-bundle' then raise; end if; end;
      delete from ${schema}.stats_prepared_generations where id=g; end $qa$;`);
    assert.equal((await scalar(`${schema}.get_stats_prepared_health_v1()`)).operational.visitGeneration, visit);
    await transport(alias('finish_stats_prepared_work_v1'), { p_lease_token: claim.leaseToken, p_epoch: claim.epoch, p_outcome: { status: 'completed' } });
    const expiring = await transport(alias('claim_stats_prepared_work_v1'), { p_worker_id: 'expiring', p_request_id: randomUUID() });
    await sql(`update ${schema}.stats_prepared_control set lease_until=clock_timestamp()-interval '1 second' where id;`);
    claim = await transport(alias('claim_stats_prepared_work_v1'), { p_worker_id: 'replacement-after-expiry', p_request_id: randomUUID() });
    await transport(alias('run_stats_prepared_step_v1'), { ...stepArgs(randomUUID()), p_lease_token: expiring.leaseToken, p_epoch: expiring.epoch }, { expectedError: '55000' });
    await transport(alias('run_stats_prepared_step_v1'), { ...stepArgs(randomUUID()), p_lease_token: null }, { expectedError: '55000' });
    await transport(alias('finish_stats_prepared_work_v1'), { p_lease_token: claim.leaseToken, p_epoch: claim.epoch, p_outcome: { status: 'completed' } });
    // No-active-lease checks use fresh UUIDs: replay of an existing committed
    // receipt is intentionally allowed, but a new mutation must be fenced.
    for (const p_lease_token of [null, randomUUID()]) {
      await transport(alias('run_stats_prepared_step_v1'), { p_lease_token, p_epoch: claim.epoch,
        p_step_id: randomUUID(), p_work: { kind: 'advance' } }, { expectedError: '55000' });
      await transport(alias('finish_stats_prepared_work_v1'), { p_lease_token, p_epoch: claim.epoch,
        p_outcome: { status: 'completed' } }, { expectedError: '55000' });
    }
    if (mode === 'fixture') {
      const beginRun = async worker => {
        claim = await transport(alias('claim_stats_prepared_work_v1'), { p_worker_id: worker, p_request_id: randomUUID() });
        assert.equal(claim.claimed, true);
      };
      const finishRun = () => transport(alias('finish_stats_prepared_work_v1'), {
        p_lease_token: claim.leaseToken, p_epoch: claim.epoch, p_outcome: { status: 'completed' } });
      const advance = () => transport(alias('run_stats_prepared_step_v1'), stepArgs(randomUUID()));
      const dayVersion = () => scalar(`(select version from ${schema}.stats_prepared_buckets where kind='d' and bucket=(current_date-1)::timestamptz)`);
      // Change an already-scanned ID before completion. The scan must preserve
      // the newer dirty revision and the prior ready day, rather than publish
      // the mixed scan or acknowledge the newer source write.
      await sql(`update ${schema}.roblox_universe_stats_daily set visit_delta=123 where universe_id=1 and stat_date=current_date-1;`);
      const priorDay = await dayVersion();
      await beginRun('mid-scan-change');
      let phase;
      for (let n = 0; n < 32 && phase !== 'daily-start'; n++) phase = (await advance()).phase;
      assert.equal(phase, 'daily-start');
      const scan = (await sql(`select c.daily_scan,v.revision from ${schema}.stats_prepared_control c
        join ${schema}.stats_prepared_versions v on v.scan=c.daily_scan where v.bucket=(current_date-1)::timestamptz;`))[0];
      assert.equal((await advance()).phase, 'daily-batch');
      await sql(`update ${schema}.roblox_universe_stats_daily set visit_delta=124 where universe_id=1 and stat_date=current_date-1;`);
      for (let n = 0; n < 16 && phase !== 'daily-complete'; n++) phase = (await advance()).phase;
      assert.equal(phase, 'daily-complete');
      assert.equal(await dayVersion(), priorDay);
      assert.equal(await scalar(`exists(select 1 from ${schema}.stats_prepared_dirty where kind='d'
        and bucket=(current_date-1)::timestamptz and revision>${Number(scan.revision)})`), true);
      assert.equal(await scalar(`exists(select 1 from ${schema}.stats_prepared_buckets b join ${schema}.stats_prepared_versions v on v.id=b.version where v.scan=${literal(scan.daily_scan)})`), false);
      await drive();
      assert.equal(await scalar(`(select visits::text from ${schema}.stats_prepared_visits where version=${literal(await dayVersion())} and universe_id=1)`), '124');
      await finishRun();

      // Finalization/provenance/metadata-only writes must invalidate a visit
      // generation even when every numeric contribution stays identical.
      let previousVisit = await scalar(`${schema}.get_stats_prepared_visit_share_v1('7d')`);
      for (const [worker, change] of [
        ['finalization-only', `update ${schema}.roblox_universe_stats_daily set is_finalized=false where universe_id=3 and stat_date=current_date-2;`],
        ['provenance-only', `update ${schema}.roblox_universe_stats_daily set snapshot=jsonb_build_object('source','qa-unknown') where universe_id=3 and stat_date=current_date-2;`],
        ['metadata-only', `update ${schema}.roblox_universes set display_name='QA renamed fixture 3' where universe_id=3;`],
      ]) {
        await sql(change); await beginRun(worker); await drive();
        const nextVisit = await scalar(`${schema}.get_stats_prepared_visit_share_v1('7d')`);
        assert.notEqual(nextVisit.meta.generationId, previousVisit.meta.generationId, worker);
        assert.notEqual(nextVisit.meta.sourceRevision, previousVisit.meta.sourceRevision, worker);
        assert.equal(nextVisit.chart.totalVisits, previousVisit.chart.totalVisits, worker);
        if (worker === 'finalization-only') {
          assert.equal(await scalar(`(select finalized from ${schema}.stats_prepared_versions where id=(select version from ${schema}.stats_prepared_buckets where kind='d' and bucket=(current_date-2)::timestamptz))`), false);
          assert.equal(nextVisit.meta.current.lastSourceAt, previousVisit.meta.current.lastSourceAt);
        }
        if (worker === 'metadata-only') assert.equal(nextVisit.chart.series.find(s => String(s.universeId) === '3').name, 'QA renamed fixture 3');
        previousVisit = nextVisit; await finishRun();
      }
      // Database guards reject actual mutations of ready rows/ranges and a
      // retained generation delete, not just malformed RPC inputs.
      await sql(`do $qa$ begin
        begin update ${schema}.stats_prepared_generations set payload_hash='mutated'
          where id=(select active_platform from ${schema}.stats_prepared_control);
          raise exception 'qa-ready-generation-mutation-accepted'; exception when sqlstate '55000' then null; end;
        begin update ${schema}.stats_prepared_visit_ranges set chart='{}'
          where generation=(select active_visit from ${schema}.stats_prepared_control) and days=1;
          raise exception 'qa-ready-range-mutation-accepted'; exception when sqlstate '55000' then null; end;
        begin delete from ${schema}.stats_prepared_generations
          where id=(select active_visit from ${schema}.stats_prepared_control);
          raise exception 'qa-retained-delete-accepted'; exception when sqlstate '55000' then null; end;
      end $qa$;`);

      // Six-version saturation blocks a new day scan until bounded cleanup
      // creates space. Bucket and active/previous manifest references survive.
      const protectedVersions = await scalar(`(select jsonb_agg(distinct v.id order by v.id) from ${schema}.stats_prepared_versions v
        where exists(select 1 from ${schema}.stats_prepared_buckets b where b.version=v.id)
        or exists(select 1 from ${schema}.stats_prepared_generations g join ${schema}.stats_prepared_control c
          on g.id in (c.active_visit,c.previous_visit) where g.manifest->'days' @> jsonb_build_array(jsonb_build_object('version',v.id))))`);
      await sql(`insert into ${schema}.stats_prepared_versions(kind,bucket,membership,revision,status,created_at)
        select 'd',(current_date-10)::timestamptz,'qa-orphan',n,'failed','epoch'::timestamptz+n*interval '1 second'
        from generate_series(1,6-(select count(*)::integer from ${schema}.stats_prepared_versions
          where kind='d' and bucket=(current_date-10)::timestamptz)) n;
        insert into ${schema}.stats_prepared_visits(version,universe_id,visits)
        select v.id,n,1 from ${schema}.stats_prepared_versions v cross join generate_series(1,1105) n
        where v.membership='qa-orphan' and v.revision=1;
        update ${schema}.roblox_universe_stats_daily set is_finalized=false where universe_id=4 and stat_date=current_date-10;`);
      const orphan = await scalar(`(select id from ${schema}.stats_prepared_versions where membership='qa-orphan' and revision=1)`);
      assert.equal(await scalar(`(select count(*) from ${schema}.stats_prepared_versions where kind='d' and bucket=(current_date-10)::timestamptz)`), 6);
      assert.equal(await scalar(`${privateSchema}.stats_prepared_daily_v1()`), 'daily-cleanup-wait');
      await scalar(`${privateSchema}.stats_prepared_cleanup_v1()`);
      assert.equal(await scalar(`(select count(*) from ${schema}.stats_prepared_visits where version=${literal(orphan)})`), 105);
      assert.equal(await scalar(`exists(select 1 from ${schema}.stats_prepared_versions where id=${literal(orphan)})`), true);
      await scalar(`${privateSchema}.stats_prepared_cleanup_v1()`);
      assert.equal(await scalar(`exists(select 1 from ${schema}.stats_prepared_versions where id=${literal(orphan)})`), false);
      assert.equal(await scalar(`(select count(*) from ${schema}.stats_prepared_versions where id in (select jsonb_array_elements_text(${literal(JSON.stringify(protectedVersions))}::jsonb)::uuid))`), protectedVersions.length);
      await beginRun('cleanup-cap-recovery'); await drive(); await finishRun();

      // Freeze ONLY the isolated functions' clock. Retain their real bodies,
      // grants, statement limits and RPC transport; never change a public source
      // or production clock. Tomorrow 03:30 guarantees post-midnight buckets.
      await sql(`create table ${schema}.qa_clock(at timestamptz not null);
        insert into ${schema}.qa_clock values(date_trunc('day',now())+interval '1 day 3 hours 30 minutes');
        grant select on ${schema}.qa_clock to service_role;
        create function ${privateSchema}.qa_now() returns timestamptz language sql stable security invoker set search_path='' as
          'select at from ${schema}.qa_clock';
        revoke all on function ${privateSchema}.qa_now() from public,anon,authenticated;
        grant execute on function ${privateSchema}.qa_now() to service_role;`);
      const definitions = await sql(`select pg_get_functiondef(p.oid) definition from pg_proc p
        where p.pronamespace in (${literal(schema)}::regnamespace,${literal(privateSchema)}::regnamespace)
        and (p.proname like '%stats_prepared%_v1');`);
      for (const { definition } of definitions) await sql(definition
        .replace(/\b(?:clock_timestamp|now)\(\)/g, `${privateSchema}.qa_now()`)
        .replace(/\bcurrent_date\b/g, `(${privateSchema}.qa_now() at time zone 'UTC')::date`));
      // Refresh aliases from those clock-controlled isolated definitions.
      for (const name of RPC_NAMES) {
        const row = (await sql(`select pg_get_functiondef(oid) definition from pg_proc
          where pronamespace=${literal(schema)}::regnamespace and proname=${literal(name)};`))[0];
        await sql(row.definition.replace(`FUNCTION ${schema}.${name}(`, `FUNCTION public.${alias(name)}(`));
      }
      const clockNow = `${privateSchema}.qa_now()`;
      await sql(`insert into ${schema}.roblox_universe_stats_hourly(universe_id,hour_start,playing,avg_playing,peak_playing,visits_end,favorites_end,rating_percent,sample_count,first_sampled_at,last_sampled_at)
        select 1,h,24,23.5,27,1000,50,90.15,2,h,h+interval '1 minute'
        from generate_series((select max(hour_start)+interval '1 hour' from ${schema}.roblox_universe_stats_hourly),date_trunc('hour',${clockNow}),interval '1 hour') h;`);
      await beginRun('observed-open-hour'); await drive();
      const open = await scalar(`${schema}.get_stats_prepared_platform_chart_v1('1d','hourly',true)`);
      assert.equal(open.meta.current.provisional, true);
      const openHour = open.currentRows.at(-1);
      const openVersion = await scalar(`(select version from ${schema}.stats_prepared_buckets where kind='h' and bucket=${literal(openHour.hour_start)})`);
      assert.equal(await scalar(`(select finalized from ${schema}.stats_prepared_versions where id=${literal(openVersion)})`), false);
      const frozen = await scalar(`(select to_jsonb(g) from ${schema}.stats_prepared_generations g where id=${literal(open.meta.generationId)})`);
      await finishRun();
      // Seed only later hours before clock advance. The previously observed open
      // hour receives no further source write; its version and timestamps stay.
      await sql(`insert into ${schema}.roblox_universe_stats_hourly(universe_id,hour_start,playing,avg_playing,peak_playing,visits_end,favorites_end,rating_percent,sample_count,first_sampled_at,last_sampled_at)
        select 1,h,24,23.5,27,1000,50,90.15,2,h,h+interval '1 minute'
        from generate_series(date_trunc('hour',${clockNow})+interval '1 hour',date_trunc('hour',${clockNow})+interval '24 hours',interval '1 hour') h;
        update ${schema}.qa_clock set at=at+interval '24 hours';`);
      await beginRun('close-hour-without-source-write');
      // Stop at the first new publication so the initial generation remains
      // protected as previous while its bytes/coverage are compared.
      phase = null;
      for (let n = 0; n < 128 && phase !== 'platform-publish'; n++) phase = (await advance()).phase;
      assert.equal(phase, 'platform-publish');
      const closed = await scalar(`${schema}.get_stats_prepared_platform_chart_v1('1d','hourly',true)`);
      assert.equal(closed.meta.previous.observedBuckets, closed.meta.previous.expectedBuckets);
      assert.equal(closed.meta.previous.reason, 'complete'); assert.equal(closed.meta.previous.provisional, false);
      assert.equal(closed.meta.current.provisional, true, 'the new observed open hour remains provisional');
      assert.equal(closed.previousRows.find(r => r.hour_start === openHour.hour_start).recorded_at, openHour.recorded_at);
      assert.equal(await scalar(`(select version from ${schema}.stats_prepared_buckets where kind='h' and bucket=${literal(openHour.hour_start)})`), openVersion);
      assert.deepEqual(await scalar(`(select to_jsonb(g) from ${schema}.stats_prepared_generations g where id=${literal(open.meta.generationId)})`), frozen);
      const frozenCoverage = await scalar(`(select ${privateSchema}.stats_prepared_period_v1(g.payload->'hourly',
        ${literal(open.meta.windowStart)},g.as_of,true,g.as_of) from ${schema}.stats_prepared_generations g where g.id=${literal(open.meta.generationId)})`);
      assert.deepEqual(frozenCoverage.coverage, open.meta.current, 'old generation coverage stays frozen after wall-clock advance');
      await drive();
      await finishRun();

      // Hourly TRUNCATE must invalidate today's 01:00, 02:00 and open 03:00,
      // plus expose uncertainty for retained history outside the rebuild horizon.
      const beforeTruncate = await scalar(`${schema}.get_stats_prepared_platform_chart_v1('1d','hourly',true)`);
      assert.equal(beforeTruncate.meta.current.observedBuckets, beforeTruncate.meta.current.expectedBuckets);
      assert.equal(beforeTruncate.meta.current.provisional, true, 'fully observed current period still contains an open hour');
      assert.ok(beforeTruncate.currentRows.filter(r => Date.parse(r.hour_start) > Date.parse(beforeTruncate.meta.asOf.slice(0, 10))).length >= 2);
      await sql(`truncate ${schema}.roblox_universe_stats_hourly;`);
      assert.equal(await scalar(`exists(select 1 from ${schema}.stats_prepared_dirty where kind='h' and bucket=date_trunc('hour',${clockNow}))`), true);
      assert.equal(await scalar(`not exists(select 1 from ${schema}.stats_prepared_dirty where kind='h' and
        (bucket<date_trunc('day',${clockNow})-interval '90 days' or bucket>date_trunc('hour',${clockNow})))`), true);
      await beginRun('hourly-truncate'); await drive();
      const truncated = await scalar(`${schema}.get_stats_prepared_platform_chart_v1('1d','hourly',true)`);
      assert.deepEqual(truncated.currentRows, []); assert.equal(truncated.meta.current.observedBuckets, 0);
      const retained = await scalar(`${schema}.get_stats_prepared_platform_chart_v1('90d','hourly',true)`);
      assert.equal(retained.meta.previous.reason, 'retention-gap'); assert.equal(retained.meta.previous.provisional, true);
      assert.ok((await scalar(`${schema}.get_stats_prepared_health_v1()`)).operational.outsideHorizonAt);
      await finishRun();
      // Daily TRUNCATE stays date-bounded; no hourly expansion or future dates.
      await sql(`truncate ${schema}.roblox_universe_stats_daily;`);
      assert.equal(await scalar(`(select count(*) from ${schema}.stats_prepared_dirty where kind='d')`), 181);
      assert.equal(await scalar(`(select max(bucket)=date_trunc('day',${clockNow}) from ${schema}.stats_prepared_dirty where kind='d')`), true);

      // Start a separate tiny scenario in the same run-owned schemas. The
      // earlier retained hourly history and daily rows would hide the publisher's
      // zero-observation branch. Reset only fixture prepared state, after both
      // cloned sources are empty; keep the real isolated functions and clock.
      assert.equal(await scalar(`(select count(*) from ${schema}.roblox_universe_stats_hourly)
        +(select count(*) from ${schema}.roblox_universe_stats_daily)`), 0);
      const preparedTables = ['control', 'members', 'dirty', 'versions', 'buckets', 'visits',
        'generations', 'visit_universes', 'visit_totals', 'visit_ranges', 'receipts'];
      await sql(`truncate ${preparedTables.map(t => `${schema}.stats_prepared_${t}`).join(',')};
        insert into ${schema}.stats_prepared_control(id) values(true);
        delete from ${schema}.roblox_universes where universe_id<>1;`);
      assert.equal(await scalar(`(select count(*) from ${schema}.stats_game_current_index)`), 1);
      assert.equal(await scalar(`(select universe_id::text from ${schema}.stats_game_current_index)`), '1');
      const platformStamp = () => scalar(`(select jsonb_build_object(
        'active',c.active_platform,'previous',c.previous_platform,'signature',c.platform_signature,
        'generationCount',(select count(*) from ${schema}.stats_prepared_generations where product='platform'),
        'asOf',g.as_of,'generatedAt',g.generated_at,'publishedAt',g.published_at,'payloadHash',g.payload_hash)
        from ${schema}.stats_prepared_control c left join ${schema}.stats_prepared_generations g on g.id=c.active_platform)`);
      const assertUnavailable = async generation => {
        for (const resolution of ['hourly', 'daily']) {
          const value = await transport(alias('get_stats_prepared_platform_chart_v1'), {
            p_range: '1d', p_resolution: resolution, p_include_previous: true });
          assert.equal(value.meta.generationId, generation);
          assert.equal(value.meta.state, 'unavailable', resolution);
          assert.deepEqual(value.currentRows, []); assert.deepEqual(value.previousRows, []);
          assert.equal(value.meta.current.observedBuckets, 0);
          assert.equal(value.meta.previous.observedBuckets, 0);
          assert.equal(value.meta.sourceAsOf, null);
          assert.equal(value.meta.current.firstSourceAt, null);
          assert.equal(value.meta.current.lastSourceAt, null);
          if (generation !== null) {
            assert.ok(value.meta.current.expectedBuckets > 0);
            assert.equal(value.meta.current.processedBuckets, value.meta.current.expectedBuckets);
            assert.equal(value.meta.current.missingBuckets.length, value.meta.current.expectedBuckets);
          }
        }
      };
      const finishEmptyRun = async () => {
        const result = await finishRun();
        assert.equal(result.status, 'completed'); assert.equal(result.remainingBuckets, 0);
        assert.equal(result.dailyScan, null);
        const health = (await scalar(`${schema}.get_stats_prepared_health_v1()`)).operational;
        assert.equal(health.errorCode, null); assert.equal(health.leaseUntil, null);
      };
      const advanceClock = () => sql(`update ${schema}.qa_clock set at=at+interval '1 minute';`);
      const assertUnchangedEmptyRun = async (worker, stamp) => {
        // Move time within the same UTC hour. An unchanged check must not
        // manufacture a new anchor/publication time, including for empty output.
        await advanceClock(); await beginRun(worker);
        const result = await advance();
        assert.equal(result.phase, 'unchanged'); assert.equal(result.more, false);
        await finishEmptyRun();
        assert.deepEqual(await platformStamp(), stamp);
        await assertUnavailable(stamp.active);
      };
      await beginRun('cold-empty-platform'); await drive(); await finishEmptyRun();
      const coldEmptyStamp = await platformStamp();
      assert.equal(coldEmptyStamp.active, null); assert.equal(coldEmptyStamp.previous, null);
      assert.equal(coldEmptyStamp.generationCount, 0);
      assert.equal(coldEmptyStamp.asOf, null); assert.equal(coldEmptyStamp.generatedAt, null);
      assert.equal(coldEmptyStamp.publishedAt, null);
      await assertUnavailable(null);
      await assertUnchangedEmptyRun('cold-empty-unchanged', coldEmptyStamp);

      identity.finalObservationScenarios = [];
      for (const [kind, removal] of [['h', 'delete'], ['d', 'delete'], ['h', 'truncate'], ['d', 'truncate']]) {
        const scenario = `final-${kind === 'h' ? 'hourly' : 'daily'}-${removal}`;
        const source = `${schema}.roblox_universe_stats_${kind === 'h' ? 'hourly' : 'daily'}`;
        assert.equal(await scalar(`(select count(*) from ${schema}.roblox_universe_stats_hourly)
          +(select count(*) from ${schema}.roblox_universe_stats_daily)`), 0, scenario);
        assert.equal(await scalar(`not exists(select 1 from ${schema}.stats_prepared_buckets b
          join ${schema}.stats_prepared_versions v on v.id=b.version where v.observed>0)`), true, scenario);
        if (kind === 'h') {
          await sql(`insert into ${source}(universe_id,hour_start,playing,avg_playing,peak_playing,
            visits_end,favorites_end,rating_percent,sample_count,first_sampled_at,last_sampled_at)
            values(1,date_trunc('hour',${clockNow})-interval '1 hour',24,23.5,27,1000,50,90.15,2,
              date_trunc('hour',${clockNow})-interval '1 hour',date_trunc('hour',${clockNow})-interval '59 minutes');`);
        } else {
          await sql(`insert into ${source}(universe_id,stat_date,playing,avg_playing,peak_playing,
            visits,favorites,rating_end,sample_count,visit_delta,visits_start,visits_end,recorded_at,is_finalized,snapshot)
            values(1,(${clockNow} at time zone 'UTC')::date-1,24,23.5,27,1000,50,90.15,2,7,993,1000,
              date_trunc('day',${clockNow})-interval '12 hours',true,'{"source":"roblox_universe_stats_hourly"}');`);
        }
        await beginRun(`${scenario}-seed`); await drive();
        const useful = await transport(alias('get_stats_prepared_platform_chart_v1'), {
          p_range: '1d', p_resolution: kind === 'h' ? 'hourly' : 'daily', p_include_previous: true });
        assert.ok(['ready', 'partial'].includes(useful.meta.state), scenario);
        assert.equal(useful.currentRows.length, 1); assert.equal(useful.meta.current.observedBuckets, 1);
        assert.equal(useful.currentRows[0].playing, '24');
        const sourceTime = await scalar(`(select ${kind === 'h' ? 'last_sampled_at' : 'recorded_at'} from ${source})`);
        assert.ok(sourceTime); assert.ok(Number.isFinite(Date.parse(sourceTime)));
        assert.equal(Date.parse(useful.meta.sourceAsOf), Date.parse(sourceTime));
        assert.equal(Date.parse(useful.currentRows[0].recorded_at), Date.parse(sourceTime));
        const usefulGeneration = await scalar(`(select to_jsonb(g) from ${schema}.stats_prepared_generations g
          where g.id=${literal(useful.meta.generationId)})`);
        await finishRun();
        // Exactly one observed source row exists across BOTH granularities.
        assert.equal(await scalar(`(select count(*) from ${schema}.roblox_universe_stats_hourly)
          +(select count(*) from ${schema}.roblox_universe_stats_daily)`), 1);
        await advanceClock();
        await sql(`${removal === 'delete' ? 'delete from' : 'truncate'} ${source};`);
        assert.equal(await scalar(`(select count(*) from ${source})`), 0);
        assert.equal(await scalar(`exists(select 1 from ${schema}.stats_prepared_dirty where kind=${literal(kind)})`), true);
        if (removal === 'truncate') {
          assert.equal(await scalar(`(select max(bucket)=date_trunc('${kind === 'h' ? 'hour' : 'day'}',${clockNow})
            from ${schema}.stats_prepared_dirty where kind=${literal(kind)})`), true);
          if (kind === 'd') assert.equal(await scalar(`(select count(*) from ${schema}.stats_prepared_dirty where kind='d')`), 181);
        }
        await beginRun(scenario);
        // Check the first replacement while the genuine useful generation is
        // still the protected previous pointer. Ordinary later cleanup may
        // remove it after further empty coverage publications supersede it.
        let replacement;
        for (let n = 0; n < 128; n++) {
          const result = await advance();
          if (result.platformGeneration !== useful.meta.generationId) { replacement = result; break; }
          assert.equal(result.more, true, `${scenario}-stopped-with-old-generation`);
        }
        assert.ok(replacement, `${scenario}-replacement-not-published`);
        assert.equal(replacement.phase, 'platform-publish');
        assert.ok(replacement.platformGeneration);
        assert.equal(await scalar(`(select previous_platform from ${schema}.stats_prepared_control)`), useful.meta.generationId);
        assert.deepEqual(await scalar(`(select to_jsonb(g) from ${schema}.stats_prepared_generations g
          where g.id=${literal(useful.meta.generationId)})`), usefulGeneration);
        await assertUnavailable(replacement.platformGeneration);
        await drive(); await finishEmptyRun();
        const emptyStamp = await platformStamp();
        assert.notEqual(emptyStamp.active, useful.meta.generationId);
        assert.notEqual(emptyStamp.signature, useful.meta.sourceRevision);
        assert.ok(Date.parse(emptyStamp.generatedAt) > Date.parse(useful.meta.generatedAt));
        assert.ok(Date.parse(emptyStamp.publishedAt) > Date.parse(useful.meta.publishedAt));
        assert.equal(await scalar(`not exists(select 1 from ${schema}.stats_prepared_generations g
          cross join lateral jsonb_array_elements((g.payload->'hourly')||(g.payload->'daily')) r
          where g.id=${literal(emptyStamp.active)} and (r->>'_observed')::integer>0)`), true);
        assert.equal(await scalar(`not exists(select 1 from ${schema}.stats_prepared_buckets b
          join ${schema}.stats_prepared_versions v on v.id=b.version where v.observed>0)`), true);
        await assertUnavailable(emptyStamp.active);
        await assertUnchangedEmptyRun(`${scenario}-unchanged`, emptyStamp);
        identity.finalObservationScenarios.push({ scenario, usefulGeneration: useful.meta.generationId,
          sourceAsOf: sourceTime, firstEmptyGeneration: replacement.platformGeneration,
          finalEmptyGeneration: emptyStamp.active, emptyAsOf: emptyStamp.asOf,
          emptyGeneratedAt: emptyStamp.generatedAt, emptyPublishedAt: emptyStamp.publishedAt,
          unchangedSignature: emptyStamp.signature });
      }
      identity.protectionScenarios = ['mid-scan-source-change', 'finalization-only', 'provenance-only', 'metadata-only',
        'ready-immutability', 'six-version-bounded-cleanup', 'frozen-hour-closure', 'hourly-truncate', 'daily-truncate',
        'cold-empty-no-publication', ...identity.finalObservationScenarios.map(s => s.scenario)];
    }
    const stats = phases.filter(p => p.kind === 'rest' && p.rpc === alias('run_stats_prepared_step_v1') && p.status === 200);
    maximumStepMs = Math.max(maximumStepMs, 0, ...stats.map(p => p.ms));
    identity.preparedStorage = await sql(`select c.relname,pg_total_relation_size(c.oid)::text bytes from pg_class c
      where c.relnamespace=${literal(schema)}::regnamespace and c.relkind='r' and c.relname like 'stats_prepared_%' order by c.relname;`);
    identity.completed = true; identity.sourceRows = sourceRows; identity.maximumTransportStepMs = maximumStepMs;
    identity.transportTimeoutProved = true; identity.semanticParity = 'all-five-ranges';
    console.log(JSON.stringify({ status: 'passed', mode, sourceRows, maximumStepMs, receipt: receiptPath }));
  } finally {
    try { await cleanup(); } catch { identity.cleanupFailed = true; await saveReceipt(); throw new Error('fixture-cleanup-failed-see-receipt'); }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => {
  console.error(JSON.stringify({ code: 'stats-prepared-qa-failed', name: error.name,
    message: String(error.message).slice(0, 4000) })); process.exitCode = 1;
});
