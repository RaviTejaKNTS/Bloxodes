import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { legacyVisitExpected, assertVisitParity, validateQaCheckout, fixtureMigrationSql,
  qaSqlFailureDiagnostic, qaReceiptWithPhases, qaRpcFailureDiagnostic, qaClaimProbeDiagnostic,
  fixtureClaimDiagnosticSql, qaRpcErrorEnvelope, PREPARED_QA_MIGRATION_PATHS,
  fixtureMigrationPlan, replayFixtureMigrations, fixtureDriveBatchSql,
  qaFixtureBatchPlan, qaFixtureBatchResult, qaSourceProgress, qaStorageCheckpoint,
  qaAdvanceStateSql, qaAdvanceState, qaAdvanceOutcome, qaTimingSummary, qaBeginDriveAttempt,
  qaRecordFixtureBatch, qaDriveFailure, DAILY_DIAGNOSTIC_PROBES, fixtureDailyDiagnosticSql,
  qaDailyPlanSummary, qaDailyProbeResult, qaDailyBoundaryResult, qaRunDailyDiagnostic,
  qaDailyCatalogResult, qaDailyBackendResult, qaDailyProbeRequest,
  qaInterruptDailyDiagnostic, DAILY_LEASE_BUDGET, validateQaReaderSelection,
  qaReaderSqlAdapter, qaInterruptReaderDiagnostic, qaReaderDefinitionProof } from '../../ci/stats-prepared-db-qa.mjs';
import { READER_DIAGNOSTIC_PHASES } from '../../ci/stats-prepared-reader-runner.mjs';

const claimLocation = { alias: 'qa_012345abcdef_claim_sp_work_v1', maxLine: 60 };
const schema = 'qa_stats_012345abcdef', privateSchema = `${schema}_p`;
const migrationSources = () => Promise.all(PREPARED_QA_MIGRATION_PATHS.map(async path => ({
  path, bytes: await readFile(new URL(`../../../${path}`, import.meta.url)),
})));

test('main reader diagnostic requires its sole explicit manual purpose', () => {
  for (const value of [true, 'true']) assert.doesNotThrow(() => validateQaReaderSelection('workflow_dispatch', {
    inputs: { stats_prepared_reader_diagnostic: value } }));
  for (const event of ['pull_request', 'push']) assert.throws(() => validateQaReaderSelection(event, {
    inputs: { stats_prepared_reader_diagnostic: true } }), /manual reader diagnostic only/);
  for (const inputs of [{}, { stats_prepared_reader_diagnostic: false }, { stats_prepared_reader_diagnostic: 'true',
    stats_prepared_daily_diagnostic: true }, { stats_prepared_reader_diagnostic: true, stats_prepared_benchmark: true },
    { stats_prepared_reader_diagnostic: true, stats_prepared_capacity_probe: true },
    { stats_prepared_reader_diagnostic: true, stats_prepared_recovery: 'reconcile-39973670048' },
    { stats_prepared_reader_diagnostic: true, code_lookups_recovery: 'reconcile-39955744530-39956105978-39957597153-39958648149' },
    { stats_prepared_reader_diagnostic: true, selected_roblox_bundle_hash: 'a'.repeat(64) },
    { stats_prepared_reader_diagnostic: true, selected_franchise_bundle_hash: 'b'.repeat(64), selected_franchise_stage: true }]) {
    assert.throws(() => validateQaReaderSelection('workflow_dispatch', { inputs }));
  }
});

test('reader adapter sets complete only after this successful SQL call fully resolves', async () => {
  const phase = 'reader-diagnostic-profile', phases = [];
  let release;
  const body = new Promise(resolve => { release = resolve; });
  const rows = [{ probe: { outcome: 'ok' } }]; let returned = false;
  const request = qaReaderSqlAdapter(async (query, suppliedPhase) => {
    assert.equal(query, 'fixed-query'); assert.equal(suppliedPhase, phase);
    await body;
    phases.push({ kind: 'sql', phase, status: 201, ok: true });
    return rows;
  }, phases)('fixed-query', phase).then(result => { returned = true; return result; });
  await Promise.resolve(); assert.equal(returned, false); assert.deepEqual(phases, []);
  release(); assert.deepEqual(await request, { ok: true, status: 201, rows, requestComplete: true });
  const failurePhases = [];
  const failed = await qaReaderSqlAdapter(async () => {
    failurePhases.push({ kind: 'sql', phase, status: 400, ok: false, sqlstate: '57014',
      errorClass: 'statement-timeout', message: 'SECRET_SQL' });
    throw new Error('SECRET_PROVIDER');
  }, failurePhases)('fixed-query', phase);
  assert.deepEqual(failed, { ok: false, status: 400,
    failure: { sqlstate: '57014', errorClass: 'statement-timeout' } });
  assert.equal(Object.hasOwn(failed, 'requestComplete'), false);
  assert.doesNotMatch(JSON.stringify(failed), /SECRET/);
  for (const evidence of [null, { kind: 'sql', phase: 'cleanup', status: 200, ok: true },
    { kind: 'sql', phase, status: 500, ok: true }, { kind: 'sql', phase, status: 200, ok: false },
    { kind: 'rest', phase, status: 200, ok: true }]) {
    const calls = [];
    const result = await qaReaderSqlAdapter(async () => { if (evidence) calls.push(evidence); return rows; }, calls)('fixed-query', phase);
    assert.equal(result.ok, false); assert.equal(Object.hasOwn(result, 'requestComplete'), false);
  }
  const stale = [{ kind: 'sql', phase, status: 200, ok: true }];
  assert.equal((await qaReaderSqlAdapter(async () => rows, stale)('fixed-query', phase)).ok, false);
  await assert.rejects(qaReaderSqlAdapter(async () => { throw new Error('must not dispatch'); }, [])('', 'arbitrary-phase'),
    /unknown reader SQL phase/);
});

test('main SQL allowlist admits exactly the seven fixed reader phase labels', () => {
  assert.deepEqual(READER_DIAGNOSTIC_PHASES, ['reader-diagnostic-preflight', 'reader-diagnostic-install',
    'reader-diagnostic-setup', 'reader-diagnostic-readback', 'reader-diagnostic-profile',
    'reader-diagnostic-response', 'reader-diagnostic-rest']);
  for (const phase of READER_DIAGNOSTIC_PHASES) assert.deepEqual(qaSqlFailureDiagnostic({ phase, status: 400,
    result: { code: '57014', message: 'SECRET' }, query: 'fixed' }), { phase, status: 400, sqlstate: '57014' });
  assert.throws(() => qaSqlFailureDiagnostic({ phase: 'reader-diagnostic-arbitrary', query: '' }), /unknown QA SQL phase/);
});

test('reader installation proof retains hashes and rejects changed alias settings, inventory or ACL', async () => {
  const migrations = fixtureMigrationPlan(await migrationSources(), schema, privateSchema);
  const names = [...new Set(migrations.flatMap(({ sql }) => [...sql.matchAll(
    /create (?:or replace )?function ([a-z0-9_]+)[.]([a-z0-9_]+)[(]/g)].map(m => `${m[1]}.${m[2]}`)))];
  const rows = names.map(qualified => {
    const [namespace, name] = qualified.split('.');
    return { schema: namespace, name, definition: `CREATE OR REPLACE FUNCTION ${qualified}() RETURNS jsonb SET statement_timeout TO '2s' AS 'SECRET_BODY'`,
      owner: 'postgres', service_execute: true, anon_execute: false, authenticated_execute: false, public_execute: false };
  });
  for (const row of [...rows].filter(row => row.schema === schema)) {
    const name = `qa_012345abcdef_${row.name.replace('_stats_prepared_', '_sp_')}`;
    rows.push({ ...row, schema: 'public', name,
      definition: row.definition.replace(`FUNCTION ${schema}.${row.name}(`, `FUNCTION public.${name}(`) });
  }
  const proof = qaReaderDefinitionProof(rows, migrations, schema, privateSchema);
  assert.equal(proof.length, rows.length); assert.ok(proof.every(r => /^[a-f0-9]{64}$/.test(r.definitionSha256) && r.serviceOnly));
  assert.doesNotMatch(JSON.stringify(proof), /SECRET|CREATE|statement_timeout/);
  for (const patch of [{ owner: 'other' }, { service_execute: false }, { anon_execute: true },
    { authenticated_execute: true }, { public_execute: true }, { definition: null }]) {
    const invalid = structuredClone(rows); Object.assign(invalid[0], patch);
    assert.throws(() => qaReaderDefinitionProof(invalid, migrations, schema, privateSchema));
  }
  const changed = structuredClone(rows); changed.at(-1).definition += ' SET lock_timeout TO 0';
  assert.throws(() => qaReaderDefinitionProof(changed, migrations, schema, privateSchema), /reader-alias-definition-settings/);
  assert.throws(() => qaReaderDefinitionProof(rows.slice(1), migrations, schema, privateSchema), /reader-installed-function-inventory/);
  assert.throws(() => qaReaderDefinitionProof(rows, migrations, 'public', privateSchema));
});

test('reader interrupted pending evidence survives repeated cleanup without completing or replacing failure', () => {
  const snapshot = { completed: false, acceptance: false, diagnostic: { status: 'incomplete',
    sqlDeadline: 'incomplete', restDeadline: 'incomplete' }, definitionHashes: { periodBodySha256: 'a'.repeat(64) },
    attempts: [{ attempt: 1, phase: 'reader-diagnostic-profile', status: 'validated', summary: { 'Planning Time': 1 } },
      { attempt: 2, phase: 'reader-diagnostic-profile', status: 'incomplete', isolation: 'unknown',
        failure: { kind: 'request-failed', sqlstate: '57014', errorClass: 'unknown' } },
      { attempt: 3, phase: 'reader-diagnostic-response', status: 'pending', startedAtMs: 123, generation: 'owned-generation' }] };
  const failure = { phase: 'reader-diagnostic-profile', status: 400, sqlstate: '57014' };
  const original = qaReceiptWithPhases({ mode: 'reader-diagnostic', completed: false, acceptance: false,
    readerDiagnostic: snapshot, sqlFailure: failure }, [failure]);
  const recovered = JSON.parse(JSON.stringify(original));
  qaInterruptReaderDiagnostic(recovered.readerDiagnostic);
  const once = qaReceiptWithPhases({ ...recovered, cleaned: true }, [{ phase: 'cleanup', ok: true }]);
  qaInterruptReaderDiagnostic(once.readerDiagnostic);
  const twice = qaReceiptWithPhases(once, [{ phase: 'cleanup', ok: true }]);
  assert.equal(original.readerDiagnostic.attempts[2].status, 'pending');
  assert.equal(twice.readerDiagnostic.attempts[2].status, 'interrupted');
  assert.equal(twice.readerDiagnostic.attempts[2].startedAtMs, 123);
  assert.equal(twice.readerDiagnostic.attempts[2].generation, 'owned-generation');
  assert.equal(twice.readerDiagnostic.attempts[2].isolation, 'unknown');
  assert.deepEqual(twice.readerDiagnostic.attempts.slice(0, 2), snapshot.attempts.slice(0, 2));
  assert.deepEqual(twice.readerDiagnostic.definitionHashes, snapshot.definitionHashes);
  assert.deepEqual(twice.sqlFailure, failure); assert.equal(twice.phases.length, 3);
  for (const value of [twice, twice.readerDiagnostic]) {
    assert.equal(value.completed, false); assert.equal(value.acceptance, false);
  }
  const profiled = { completed: false, acceptance: false, diagnostic: { status: 'profiled' }, attempts: [] };
  qaInterruptReaderDiagnostic(profiled); assert.equal(profiled.diagnostic.status, 'profiled');
});

test('main reader branch follows installation proof and returns before ordinary smoke, source and producer work', async () => {
  const driver = await readFile(new URL('../../ci/stats-prepared-db-qa.mjs', import.meta.url), 'utf8');
  const main = driver.slice(driver.indexOf('export async function main('));
  const start = main.indexOf("    if (mode === 'reader-diagnostic') {\n      try {");
  const normal = main.indexOf("    await transport(alias('get_stats_prepared_health_v1'), {}, { retrySchema: true });");
  assert.ok(start >= 0);
  for (const anchor of ['await replayFixtureMigrations(', 'assert.equal(identity.claimReplacementPreserved, true)',
    "'alias-acl-timeout');"]) assert.ok(main.indexOf(anchor) >= 0 && start > main.indexOf(anchor), anchor);
  assert.ok(normal > start);
  const branch = main.slice(start, normal);
  assert.ok(branch.indexOf('qaReaderDefinitionProof(') < branch.indexOf('const document = await response.json()'));
  assert.ok(branch.indexOf("assert.equal(identity.readerInstallation.schemaCacheVisible, true") < branch.indexOf('await runReaderDiagnostic('));
  assert.match(branch, /sql: qaReaderSqlAdapter\(sql, phases\)/);
  assert.match(branch, /rest: createReaderDiagnosticRest\(\{ managedUrl: MANAGED_URL, serviceKey: service, schema \}\)/);
  assert.match(branch, /identity.completed = false; identity.acceptance = false;/);
  assert.match(branch, /identity.readerDiagnostic = snapshot;\s+await saveReceipt\(\);/);
  assert.match(branch, /result.diagnostic.status !== 'profiled'[\s\S]*throw new Error\('reader-diagnostic-incomplete'\)/);
  assert.match(branch, /return;\s+}\s*$/);
  assert.doesNotMatch(branch, /sourceInsert\(|await transport\(|retrySchema|for \(|refresh_prepared|run_stats_prepared_step|claim_stats_prepared_work|finish_stats_prepared_work/);
  for (const anchor of ['const cold = await scalar(', "const fixture = await readFile(new URL('./fixtures/stats-prepared-source.sql'",
    'await sourceInsert(', "if (mode === 'daily-diagnostic') {", 'const requestId = randomUUID();']) {
    assert.ok(main.indexOf(anchor) > normal, anchor);
  }
  assert.ok(main.indexOf('validateQaReaderSelection(env.GITHUB_EVENT_NAME, event)') < main.indexOf('const token ='));
  const dirty = main.slice(main.indexOf("['status', '--porcelain'"), main.indexOf('QA source files must match checkout SHA'));
  for (const name of ['stats-prepared-reader-diagnostic.mjs', 'stats-prepared-reader-runner.mjs']) assert.ok(dirty.includes(name));
  assert.match(main, /qaInterruptReaderDiagnostic\(identity.readerDiagnostic\)/);
  assert.match(main, /finally \{\s+try \{ await cleanup\(\);/);
});

test('six whole-call policy probes retain frozen source identity and use matched owner DDL before service measurement', async () => {
  const [{ bytes }] = await migrationSources();
  const diagnostic = fixtureDailyDiagnosticSql(bytes, schema, privateSchema);
  for (const args of [[bytes, 'public', privateSchema], [bytes, schema, 'stats_prepared_private'],
    [Buffer.concat([bytes, Buffer.from('\n')]), schema, privateSchema]]) {
    assert.throws(() => fixtureDailyDiagnosticSql(...args));
  }
  const original = bytes.toString('utf8');
  const start = original.indexOf(' with source as materialized (');
  const cte = original.slice(start, original.indexOf(' from sums s where v.id=s.version;', start) + ' from sums s where v.id=s.version;'.length);
  assert.equal(diagnostic.cteSha256, createHash('sha256').update(cte).digest('hex'));
  assert.deepEqual(DAILY_DIAGNOSTIC_PROBES.map(({ arm, policy, after }) => [arm, policy, after]), [
    ['A', 'auto', 0], ['B', 'force_custom_plan', 0], ['B', 'force_custom_plan', 0], ['A', 'auto', 0],
    ['B', 'force_custom_plan', 256], ['A', 'auto', 256],
  ]);
  assert.ok(Object.isFrozen(DAILY_DIAGNOSTIC_PROBES) && DAILY_DIAGNOSTIC_PROBES.every(Object.isFrozen));
  assert.match(diagnostic.install, /EXPLAIN \(ANALYZE,BUFFERS,WAL,SETTINGS,FORMAT JSON\) select qa_stats_012345abcdef[.]run_stats_prepared_step_v1/);
  assert.match(diagnostic.install, /exception when query_canceled or others then/);
  assert.match(diagnostic.install, /before_state is distinct from after_state/);
  assert.match(diagnostic.install, /daily-probe-wrong-phase/);
  assert.match(diagnostic.install, /lease_token=p_token and epoch=p_epoch/);
  assert.match(diagnostic.install, /daily-probe-wrong-cursor/);
  assert.match(diagnostic.install, /current_user<>'service_role'/);
  assert.match(diagnostic.install, /pg_backend_pid\(\)/);
  assert.match(diagnostic.install, /'callerPlanCacheMode',current_setting\('plan_cache_mode'\)/);
  assert.doesNotMatch(diagnostic.install, /daily-cte|daily-helper|shared-cleanup|cleanup-generation-candidate|with source as materialized/);
  assert.doesNotMatch(diagnostic.install, /create or replace|security definer|disable trigger|session_replication_role|drop index|drop constraint|pg_stat_statements/i);
  const identities = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'];
  for (const { order, policy, after } of DAILY_DIAGNOSTIC_PROBES) {
    const request = diagnostic.probe(order, identities[0], '1', identities[1], diagnosticCatalog());
    assert.match(request, /^begin; set local statement_timeout='100s'; set local lock_timeout='500ms';/);
    assert.match(request, /current_user<>'postgres'/);
    assert.match(request, /original-catalog-drift/);
    const ddl = `alter function ${privateSchema}.stats_prepared_daily_v1() set plan_cache_mode = ${policy};`;
    assert.equal(request.split('alter function ').length - 1, 1);
    assert.ok(request.indexOf(ddl) > request.indexOf('do $qa_owner$'));
    assert.ok(request.indexOf(ddl) < request.indexOf('set local role service_role;'));
    assert.ok(request.includes(`qa_daily_probe_v1('${policy}',${after},`));
    assert.match(request, /rollback;$/);
    assert.doesNotMatch(request, /commit;|(?:^|;\s*)set (?:local )?plan_cache_mode|alter (?:database|role)|grant|security definer|insert into|delete from|update .*lease_until/i);
  }
  for (const args of [['SECRET', identities[0], '1', identities[1], diagnosticCatalog()],
    [0, identities[0], '1', identities[1], diagnosticCatalog()], [7, identities[0], '1', identities[1], diagnosticCatalog()],
    [1, 'SECRET', '1', identities[1], diagnosticCatalog()], [1, identities[0], '1;select 1', identities[1], diagnosticCatalog()],
    [1, identities[0], '1', identities[1], diagnosticCatalog('auto')]]) assert.throws(() => diagnostic.probe(...args));
  const advance = diagnostic.advance(identities[0], '1', identities[1]);
  assert.match(advance, /statement_timeout='60s'/); assert.match(advance, /commit;$/);
  assert.doesNotMatch(advance, /alter function|qa_daily_probe/);
});

const diagnosticPlan = () => [{ 'Planning Time': 1.5, 'Execution Time': 40000, 'Query Text': 'SECRET SQL',
  JIT: { Functions: 12, Timing: { Generation: 2, Emission: 50, Total: 52, SECRET: 'SECRET' },
    Options: { Inlining: false, SECRET: 'SECRET' } },
  Settings: { work_mem: '4MB', track_io_timing: 'off', search_path: 'SECRET', jit: 'off', random_page_cost: 'SECRET' },
  Triggers: [{ 'Trigger Name': 'RI_ConstraintTrigger_c_12345', 'Constraint Name': 'SECRET',
    Relation: 'stats_prepared_visits', Time: 1234, Calls: 23296 }],
  Plan: { 'Node Type': 'ModifyTable', 'Operation': 'Update', 'Relation Name': 'stats_prepared_versions', Schema: schema,
    'Actual Rows': 91, 'Actual Loops': 1, 'Actual Total Time': 39000, 'Shared Hit Blocks': 987, 'WAL Bytes': 456,
    'Output': ['SECRET'], 'Index Cond': 'SECRET', 'Filter': 'SECRET',
    Plans: [{ 'Node Type': 'Index Scan', 'Relation Name': 'roblox_universe_stats_daily',
      'Index Name': 'roblox_universe_stats_daily_universe_id_stat_date_key', 'Actual Rows': 91, 'Actual Loops': 256 },
    { 'Node Type': 'CTE Scan', 'CTE Name': 'source', 'Subplan Name': 'CTE source', 'Actual Rows': 23296,
      'Temp Written Blocks': 100, 'Temp Read Blocks': 100 },
    { 'Node Type': 'Sort', 'Sort Method': 'external merge', 'Sort Space Type': 'Disk', 'Sort Space Used': 900,
      'Sort Key': ['SECRET'], 'Actual Rows': 23296, 'Actual Loops': 1 }] } }];

test('daily plan receipts retain rows, loops, materialization, spills, buffers, WAL and FK costs without SQL or arbitrary labels', () => {
  const summary = qaDailyPlanSummary(diagnosticPlan(), schema);
  assert.equal(summary['Execution Time'], 40000);
  assert.deepEqual(summary.jit, { Functions: 12, timing: { Generation: 2, Emission: 50, Total: 52 }, options: { Inlining: false } });
  assert.equal(summary.plan.relation, 'stats_prepared_versions'); assert.equal(summary.plan.schema, 'owned');
  assert.equal(summary.plan['WAL Bytes'], 456);
  assert.equal(summary.plan.plans[0]['Actual Loops'], 256);
  assert.equal(summary.plan.plans[0].index, 'roblox_universe_stats_daily_universe_id_stat_date_key');
  assert.equal(summary.plan.plans[1]['CTE Name'], 'source');
  assert.equal(summary.plan.plans[1]['Temp Written Blocks'], 100);
  assert.equal(summary.plan.plans[2]['Sort Space Type'], 'Disk');
  assert.deepEqual(summary.triggers, [{ relation: 'stats_prepared_visits', kind: 'foreign-key', Time: 1234, Calls: 23296 }]);
  assert.deepEqual(summary.settings, { work_mem: '4MB', jit: 'off', track_io_timing: 'off' });
  assert.doesNotMatch(JSON.stringify(summary), /SECRET|Index Cond|Filter|Query Text|Sort Key|Output|Constraint Name/);
  const hostile = diagnosticPlan();
  hostile[0].Plan = { 'Node Type': 'SECRET', 'Relation Name': 'SECRET', Schema: 'SECRET', 'Index Name': 'SECRET',
    'CTE Name': 'SECRET', 'Subplan Name': 'SECRET', 'Join Type': 'SECRET', 'Actual Rows': 1,
    'Actual Loops': 1, 'Actual Total Time': 1, 'WAL Bytes': Infinity, 'Plan Rows': 'SECRET' };
  hostile[0].Triggers[0].Relation = 'SECRET'; hostile[0].Triggers[0]['Trigger Name'] = 'SECRET';
  assert.doesNotMatch(JSON.stringify(qaDailyPlanSummary(hostile, schema)), /SECRET|Infinity/);
  assert.throws(() => qaDailyPlanSummary([], schema), /invalid-daily-plan/);
  assert.throws(() => qaDailyPlanSummary([{ Plan: { 'Node Type': 'Result' } }], schema), /daily-plan-missing-analyze/);
  const oversized = diagnosticPlan(); oversized[0].Plan.Plans = Array.from({ length: 512 }, () => ({ 'Node Type': 'Result' }));
  assert.throws(() => qaDailyPlanSummary(oversized, schema), /daily-plan-too-large/);
});

const diagnosticCatalog = policy => ({ oid: '12345', ownerOid: '10', ownerIsPostgres: true, securityInvoker: true,
  definitionMd5: (policy ? 'b' : 'a').repeat(32), bodyMd5: 'c'.repeat(32), aclMd5: 'd'.repeat(32),
  proconfig: ['search_path=""', 'TimeZone=UTC', ...(policy ? [`plan_cache_mode=${policy}`] : [])] });
const diagnosticBackend = (pid = 101) => ({ pid, serverVersionNum: '170006', role: 'service_role', callerPlanCacheMode: 'auto' });

const diagnosticResult = () => ({ rollbackVerified: true, dailyAfter: '0', chunkIds: 256,
  backend: diagnosticBackend(), helperCatalog: diagnosticCatalog('auto'),
  ioTimingEnabled: false, sqlstate: null, plan: diagnosticPlan(), beforeState: { utcHour: 1792771200,
    tables: Object.fromEntries(['stats_prepared_control', 'stats_prepared_members', 'stats_prepared_dirty',
      'stats_prepared_versions', 'stats_prepared_buckets', 'stats_prepared_visits', 'stats_prepared_generations',
      'stats_prepared_visit_universes', 'stats_prepared_visit_totals', 'stats_prepared_visit_ranges',
      'stats_prepared_receipts', 'revalidation_events'].map(table => [table, { rows: 0, digest: 'a'.repeat(32) }])) } });

test('daily probe accepts only full state proof; SQLSTATE failure cannot become a profiled plan or leak its body', () => {
  const result = diagnosticResult(); result.SECRET = 'SECRET'; result.beforeState.SECRET = 'SECRET';
  result.beforeState.tables.SECRET = 'SECRET'; result.beforeState.tables.stats_prepared_visits.SECRET = 'SECRET';
  const evidence = qaDailyProbeResult(result, schema, 0);
  assert.equal(Object.keys(evidence.beforeState.tables).length, 12); assert.equal(evidence.rollbackVerified, true);
  assert.doesNotMatch(JSON.stringify(evidence), /SECRET/);
  assert.equal(qaDailyProbeResult({ ...result, dailyAfter: '256' }, schema, 256).dailyAfter, '256');
  const failed = qaDailyProbeResult({ ...result, sqlstate: '57014', plan: 'SECRET SQL' }, schema, 0);
  assert.equal(failed.sqlstate, '57014'); assert.equal(failed.summary, undefined);
  assert.doesNotMatch(JSON.stringify(failed), /SECRET/);
  for (const patch of [{ rollbackVerified: false }, { rollbackVerified: 'SECRET' }, { dailyAfter: '256' },
    { chunkIds: 255 }, { ioTimingEnabled: 'SECRET' }, { sqlstate: 'SECRET' }, { beforeState: {} }]) {
    assert.throws(() => qaDailyProbeResult({ ...result, ...patch }, schema, 0), /^Error: invalid-daily-probe-result$/);
  }
  for (const patch of [{ rows: -1 }, { rows: 'SECRET' }, { digest: 'SECRET' }]) {
    const invalid = diagnosticResult(); Object.assign(invalid.beforeState.tables.stats_prepared_visits, patch);
    assert.throws(() => qaDailyProbeResult(invalid, schema, 0), /^Error: invalid-daily-probe-result$/);
  }
});

test('catalog and backend projection reject arbitrary metadata without exposing definitions or provider strings', () => {
  const catalog = { ...diagnosticCatalog('force_custom_plan'), SECRET: 'SECRET SQL', prosrc: 'SECRET SQL' };
  const backend = { ...diagnosticBackend(), SECRET: 'SECRET SQL' };
  assert.deepEqual(qaDailyCatalogResult(catalog), diagnosticCatalog('force_custom_plan'));
  assert.deepEqual(qaDailyBackendResult(backend), diagnosticBackend());
  assert.doesNotMatch(JSON.stringify(qaDailyProbeResult({ ...diagnosticResult(), backend, helperCatalog: catalog }, schema, 0)), /SECRET|prosrc/);
  for (const patch of [{ proconfig: ['SECRET'] }, { proconfig: ['search_path=""', 'TimeZone=UTC', 'SECRET=SECRET'] },
    { ownerOid: 'SECRET' }, { ownerIsPostgres: false }, { securityInvoker: false }, { definitionMd5: 'SECRET' }, { aclMd5: 'SECRET' }]) {
    assert.throws(() => qaDailyCatalogResult({ ...catalog, ...patch }), /invalid-daily-helper-catalog/);
  }
  for (const patch of [{ pid: -1 }, { pid: '101' }, { serverVersionNum: 'SECRET' }, { role: 'postgres' }, { callerPlanCacheMode: 'SECRET' }]) {
    assert.throws(() => qaDailyBackendResult({ ...backend, ...patch }), /invalid-daily-backend/);
  }
});

test('only the completed exact Management probe request may establish outer rollback completion', async () => {
  const validPhase = { kind: 'sql', phase: 'daily-diagnostic-probe', status: 200, ok: true };
  const phases = [];
  const result = await qaDailyProbeRequest({ phases, schema, after: 0, query: 'fixed-query', sql: async (query, phase) => {
    assert.equal(query, 'fixed-query'); assert.equal(phase, 'daily-diagnostic-probe');
    phases.push(validPhase); return [{ result: diagnosticResult() }];
  } });
  assert.equal(result.outerRollbackRequestComplete, true); assert.equal(result.requestComplete, true);
  for (const variant of ['stale', 'wrong-phase', 'failed', 'nonarray', 'multiple', 'throw']) {
    const history = [validPhase];
    await assert.rejects(qaDailyProbeRequest({ phases: history, schema, after: 0, query: 'fixed-query', sql: async () => {
      if (variant === 'throw') throw new Error('transport-unknown');
      if (variant !== 'stale') history.push({ ...validPhase,
        ...(variant === 'wrong-phase' ? { phase: 'daily-diagnostic-state' } : {}),
        ...(variant === 'failed' ? { ok: false, status: 500 } : {}) });
      return variant === 'nonarray' ? {} : variant === 'multiple' ? [{ result: diagnosticResult() }, {}] : [{ result: diagnosticResult() }];
    } }));
  }
});

// No services or real timers: model the frozen claim/finish/advance changes and
// full logical fingerprints while a monotonic clock advances through requests.
function dailyHarness(options = {}) {
  let elapsed = 0, wallDrift = 0, serial = 0, epoch = 0, scan = null, after = '0', steps = 0;
  let lease, successAt = null, checkedAt, probeCount = 0;
  const base = Date.UTC(2026, 9, 23, 0, 2), receipts = [], events = [], saved = [], diagnostic = {};
  const uuid = () => `00000000-0000-4000-8000-${String(++serial).padStart(12, '0')}`;
  const clock = { mono: () => elapsed, wall: () => base + elapsed + wallDrift };
  const iso = value => new Date(value ?? clock.wall()).toISOString();
  const digest = value => createHash('md5').update(JSON.stringify(value)).digest('hex');
  const fp = (value, rows = 0) => ({ rows, digest: digest(value) });
  const tick = kind => {
    events.push({ kind, at: elapsed, epoch, lease: lease && { ...lease } });
    elapsed += options.duration?.(kind, probeCount) ?? ({ probe: 75_000, advance: 23_000 }[kind] ?? 1000);
  };
  const makeState = finished => {
    const tables = structuredClone(diagnosticResult().beforeState.tables);
    for (const key of Object.keys(tables)) tables[key] = fp(key);
    tables.stats_prepared_control = fp({ lease, successAt, checkedAt, scan, after, steps }, 1);
    tables.stats_prepared_members = fp([1, 2], 2);
    tables.stats_prepared_receipts = fp(receipts, receipts.length);
    const source = Object.fromEntries(Object.entries({ roblox_universes: 1105, stats_game_current_index: 2,
      roblox_universe_stats_daily: 100555, roblox_universe_stats_hourly: 8640 }).map(([key, count]) => [key, fp(key, count)]));
    const value = { full: { utcHour: Math.floor(clock.wall() / 3_600_000) * 3600, tables }, source,
      backend: diagnosticBackend(202), helperCatalog: diagnosticCatalog(),
      fixedControl: digest({ scan, after, steps }), ...lease, dbNow: iso(), successAt, checkedAt,
      worker: 'github-fixture', failures: 0, retryAt: null, errorCode: null,
      dailyScan: scan, dailyAfter: after, steps, dueHour: false, chunk: fp(after, 256),
      retainedReceipts: fp(receipts.filter(row => row.stepId !== finished?.leaseToken), receipts.filter(row => row.stepId !== finished?.leaseToken).length),
      expectedFinish: Boolean(finished && receipts.some(row => row.stepId === finished.leaseToken && row.kind === 'yielded')) };
    options.patchState?.(value, { epoch, probeCount, finished });
    return value;
  };
  const requests = {
    claim: async requestId => {
      tick('claim'); epoch++;
      checkedAt = iso(); lease = { leaseToken: uuid(), epoch: String(epoch), expiresAt: iso(clock.wall() + 240_000), requestId };
      return { claimed: true, ...lease };
    },
    finish: async old => {
      assert.equal(old.leaseToken, lease.leaseToken);
      assert.ok(Date.parse(old.expiresAt) - clock.wall() >= DAILY_LEASE_BUDGET.controlMs);
      tick('finish'); successAt = iso(); checkedAt = successAt;
      receipts.push({ stepId: old.leaseToken, kind: 'yielded', epoch: old.epoch });
      return { status: 'yielded', dailyScan: scan, dailyAfter: after, steps };
    },
    state: async finished => { tick('state'); return qaDailyBoundaryResult(makeState(finished)); },
    advance: async (old, stepId) => {
      lease.expiresAt = iso(clock.wall() + 240_000); tick('advance'); steps++;
      const phase = options.neverDailyStart ? 'hour' : scan ? 'daily-batch' : 'daily-start';
      if (phase === 'daily-batch') after = '256'; else if (phase === 'daily-start') scan = uuid();
      receipts.push({ stepId, kind: phase });
      return { outcome: { phase, more: true }, backend: diagnosticBackend(101) };
    },
    probe: async (entry, old, stepId, originalCatalog) => {
      assert.deepEqual(originalCatalog, diagnosticCatalog());
      assert.equal(String(entry.after), after); assert.equal(old.leaseToken, lease.leaseToken);
      assert.ok(Date.parse(old.expiresAt) - clock.wall() >= DAILY_LEASE_BUDGET.requestMs +
        DAILY_LEASE_BUDGET.stateMs + DAILY_LEASE_BUDGET.controlMs + DAILY_LEASE_BUDGET.marginMs);
      const boundary = makeState(); probeCount++;
      tick('probe');
      if (options.failProbe) throw new Error('SECRET TRANSPORT BODY');
      if (options.clockDrift) wallDrift += 5000;
      const result = { rollbackVerified: true, beforeState: boundary.full, dailyAfter: after, chunkIds: 256,
        backend: diagnosticBackend(probeCount % 2 ? 303 : 304), helperCatalog: diagnosticCatalog(entry.policy),
        requestComplete: true, outerRollbackRequestComplete: true, httpStatus: 200,
        sqlstate: options.probeSqlstate ?? null,
        ...(options.probeSqlstate ? {} : { summary: { 'Execution Time': 850, plan: { 'Shared Hit Blocks': 213144 } } }) };
      options.patchProbe?.(result, entry);
      return result;
    },
  };
  const save = async () => {
    saved.push(structuredClone(diagnostic));
    if (options.interruptAfterProbe && probeCount > 0 && diagnostic.pending?.kind === 'state' && diagnostic.pending.status === 'pending') {
      throw new Error('simulated-post-probe-interruption');
    }
    if (options.interruptKind && diagnostic.pending?.kind === options.interruptKind && diagnostic.pending.status === 'pending') {
      options.interruptKind = null; throw new Error('simulated-runner-interruption');
    }
  };
  return { diagnostic, events, saved, run: () => qaRunDailyDiagnostic({ diagnostic, requests, save, clock, uuid }) };
}

test('six successful slow whole probes use fresh leases, exact A-B-B-A / B-A order and restored catalogs', async () => {
  const harness = dailyHarness(); await harness.run();
  const { diagnostic, events } = harness;
  assert.equal(diagnostic.status, 'profiled'); assert.equal(diagnostic.acceptance, false);
  assert.equal(diagnostic.probes.length, 6);
  assert.deepEqual(diagnostic.probes.map(({ order, arm, policy, dailyAfter }) => ({ order, arm, policy, after: Number(dailyAfter) })), DAILY_DIAGNOSTIC_PROBES);
  assert.equal(new Set(diagnostic.probes.map(row => row.lease.leaseToken)).size, 6);
  assert.equal(new Set(diagnostic.requests.map(row => row.requestId)).size, diagnostic.requests.length);
  assert.equal(new Set(diagnostic.probes.map(row => row.stepId)).size, 6);
  assert.ok(diagnostic.ms > 240_000 && diagnostic.ms < 1_200_000);
  assert.deepEqual(diagnostic.advances.map(row => row.outcome.phase), ['daily-start', 'daily-batch']);
  assert.deepEqual(events.filter(row => ['advance', 'probe'].includes(row.kind)).map(row => row.kind),
    ['advance', 'probe', 'probe', 'probe', 'probe', 'advance', 'probe', 'probe']);
  assert.equal(events.filter(row => row.kind === 'finish').length, 7);
  assert.ok(diagnostic.leases.every(row => row.crossLeasePreparedAndSourceVerified));
  assert.ok(diagnostic.probes.every(row => row.leaseBaselineVerified && row.rollbackVerified && row.catalogRestoredVerified &&
    row.outerRollbackRequestComplete && row.isolation === 'verified-logical-rollback-and-catalog-restored'));
  assert.equal(diagnostic.conclusion, 'inconclusive-no-causal-verdict');
  assert.equal(diagnostic.genericPlanProven, false); assert.equal(diagnostic.workerAcceptance, false);
  assert.match(diagnostic.planHistory, /matched-DDL-invalidates-plans-not-uninterrupted-cache-history/);
  assert.ok(diagnostic.backendCalls.some(row => row.kind === 'advance'));
  const probeRequests = diagnostic.requests.filter(row => row.kind === 'probe');
  assert.deepEqual(probeRequests[0].priorKnownCallsAtObservedPid, []);
  assert.equal(probeRequests[2].priorKnownCallsAtObservedPid.length, 1);
  for (const row of probeRequests) for (const index of row.priorKnownCallsAtObservedPid) {
    assert.equal(diagnostic.backendCalls[index].backend.pid, row.backend.pid);
  }
  assert.ok(diagnostic.probes.every(row => row.backend.pid !== row.restorationBackend.pid));
});

test('renew before insufficient full probe reserve; never advance just to renew', async () => {
  const harness = dailyHarness({ duration: (kind, count) => kind === 'probe' ? count === 4 ? 100_000 : 75_000 : kind === 'advance' ? 23_000 : 1000 });
  await harness.run();
  const fourth = harness.events.filter(row => row.kind === 'probe')[3];
  const bridge = harness.events.filter(row => row.kind === 'advance')[1];
  assert.ok(bridge.epoch > fourth.epoch);
  assert.equal(harness.diagnostic.advances.length, 2);
  assert.equal(harness.diagnostic.probes.length, 6);
});

test('reject cursor, scan, chunk, source, member, hour and unauthorized control/receipt drift across claims', async () => {
  const patches = [value => { value.dailyAfter = '1'; }, value => { value.dailyScan = '00000000-0000-4000-8000-999999999999'; },
    value => { value.chunk.digest = 'b'.repeat(32); }, value => { value.source.roblox_universe_stats_daily.digest = 'b'.repeat(32); },
    value => { value.full.tables.stats_prepared_members.digest = 'b'.repeat(32); }, value => { value.full.utcHour += 3600; },
    value => { value.fixedControl = 'b'.repeat(32); }, value => { value.retainedReceipts.digest = 'b'.repeat(32); },
    value => { value.expectedFinish = false; }, value => { value.full.tables.stats_prepared_versions.digest = 'b'.repeat(32); }];
  for (const patch of patches) {
    const harness = dailyHarness({ patchState: (value, context) => { if (context.epoch === 2) patch(value); } });
    await assert.rejects(harness.run(), /daily-diagnostic-[a-z-]+/);
    assert.equal(harness.diagnostic.status, 'failed'); assert.equal(harness.diagnostic.probes.length, 0);
  }
});

test('clock drift and cumulative total budget fail closed with durable request evidence', async () => {
  for (const options of [{ clockDrift: true }, { neverDailyStart: true }]) {
    const harness = dailyHarness(options);
    await assert.rejects(harness.run(), /daily-diagnostic-clock-drift|bounded-daily-diagnostic-incomplete/);
    assert.equal(harness.diagnostic.status, 'failed');
    assert.ok(harness.saved.some(row => row.pending?.status === 'pending'));
    assert.ok(harness.diagnostic.probes.length < 6);
  }
});

test('post-probe source drift fails even when all twelve prepared table fingerprints match', async () => {
  const harness = dailyHarness({ patchState: (value, context) => {
    if (context.probeCount > 0) value.source.roblox_universe_stats_hourly.digest = 'b'.repeat(32);
  } });
  await assert.rejects(harness.run(), /daily-diagnostic-source-drift/);
  assert.equal(harness.diagnostic.status, 'failed');
  assert.equal(harness.diagnostic.probes[0].rollbackVerified, true);
  assert.equal(harness.diagnostic.probes[0].status, 'failed');
});

test('failed requests and runner interruption retain pending identities through explicit cleanup', async () => {
  const failed = dailyHarness({ failProbe: true });
  await assert.rejects(failed.run());
  assert.equal(failed.diagnostic.pending.kind, 'probe'); assert.equal(failed.diagnostic.pending.status, 'failed');
  assert.equal(failed.diagnostic.probes[0].status, 'failed');
  assert.equal(failed.events.at(-1).kind, 'probe'); // No subsequent state or retry.
  assert.equal(failed.diagnostic.probes[0].isolation, 'unknown');
  const retained = structuredClone(failed.diagnostic);
  qaInterruptDailyDiagnostic(failed.diagnostic); // Successful owned cleanup is not closure proof.
  assert.deepEqual(failed.diagnostic, retained);
  assert.doesNotMatch(JSON.stringify(failed.diagnostic), /SECRET/);
  const interrupted = dailyHarness({ interruptKind: 'claim' });
  await assert.rejects(interrupted.run(), /simulated-runner-interruption/);
  const durable = interrupted.saved.find(row => row.pending?.kind === 'claim');
  assert.equal(interrupted.events.length, 0); // Saved before dispatch.
  qaInterruptDailyDiagnostic(durable);
  assert.equal(durable.pending.status, 'interrupted'); assert.equal(durable.requests[0].status, 'interrupted');
  assert.ok(durable.pending.requestId); assert.equal(durable.acceptance, false);
});

test('each of the six probes fails closed on un-restored table state, before a later probe can run', async () => {
  for (let order = 1; order <= 6; order++) {
    const harness = dailyHarness({ patchState: (value, context) => {
      if (context.probeCount === order) value.full.tables.stats_prepared_versions.digest = 'b'.repeat(32);
    } });
    await assert.rejects(harness.run(), /daily-probe-poststate-drift/);
    assert.equal(harness.diagnostic.probes.length, order);
    assert.equal(harness.diagnostic.probes.at(-1).status, 'failed');
    assert.equal(harness.diagnostic.probes.at(-1).isolation, 'unknown');
    assert.equal(harness.diagnostic.probes.at(-1).catalogRestoredVerified, undefined);
    assert.equal(harness.diagnostic.acceptance, false);
  }
});

test('restored catalog must match original proconfig, definition, body, owner, ACL and identity', async () => {
  const patches = [catalog => { catalog.proconfig.push('plan_cache_mode=auto'); },
    ...['definitionMd5', 'bodyMd5', 'aclMd5'].map(key => catalog => { catalog[key] = 'e'.repeat(32); }),
    ...['oid', 'ownerOid'].map(key => catalog => { catalog[key] = '999'; })];
  for (const patch of patches) {
    const harness = dailyHarness({ patchState: (value, context) => {
      if (context.probeCount > 0) patch(value.helperCatalog);
    } });
    await assert.rejects(harness.run(), /daily-helper-catalog-not-restored|daily-original-policy-changed/);
    assert.equal(harness.diagnostic.probes.length, 1);
    assert.equal(harness.diagnostic.probes[0].outerRollbackRequestComplete, true);
    assert.equal(harness.diagnostic.probes[0].isolation, 'unknown');
    assert.equal(harness.diagnostic.probes[0].catalogRestoredVerified, undefined);
  }
});

test('applied policy is catalog evidence; caller policy is separate and never an inside-helper observation', async () => {
  const patches = [row => { row.helperCatalog = diagnosticCatalog('force_custom_plan'); },
    row => { row.helperCatalog.bodyMd5 = 'e'.repeat(32); }, row => { row.requestComplete = false; },
    row => { row.outerRollbackRequestComplete = false; }];
  for (const patchProbe of patches) {
    const harness = dailyHarness({ patchProbe });
    await assert.rejects(harness.run(), /daily-helper-policy-drift|daily-helper-identity-drift|daily-probe-request-incomplete/);
    assert.equal(harness.diagnostic.probes.length, 1);
    assert.equal(harness.diagnostic.probes[0].isolation, 'unknown');
  }
  const harness = dailyHarness(); await harness.run();
  const custom = harness.diagnostic.probes.find(row => row.arm === 'B');
  assert.equal(custom.backend.callerPlanCacheMode, 'auto');
  assert.ok(custom.helperCatalog.proconfig.includes('plan_cache_mode=force_custom_plan'));
  assert.equal(custom.insideHelperPolicy, undefined);
});

test('all-fast A, first-only slow A and repeated slow A with fast B never manufacture a generic-plan verdict', async () => {
  for (const pattern of ['all-fast', 'first-A-slow', 'all-A-slow']) {
    const harness = dailyHarness({ patchProbe: (row, entry) => {
      const slow = pattern === 'all-A-slow' && entry.arm === 'A' || pattern === 'first-A-slow' && entry.order === 1;
      row.summary = { 'Execution Time': slow ? 25241.653 : 850.627,
        plan: { 'Shared Hit Blocks': slow ? 4572573 : 213144 } };
    } });
    await harness.run();
    assert.equal(harness.diagnostic.probes.length, 6);
    assert.equal(harness.diagnostic.status, 'profiled');
    assert.equal(harness.diagnostic.conclusion, 'inconclusive-no-causal-verdict');
    assert.equal(harness.diagnostic.genericPlanProven, false);
    assert.equal(harness.diagnostic.acceptance, false);
    assert.equal(harness.diagnostic.workerAcceptance, false);
    assert.match(harness.diagnostic.interpretation, /A-must-reproduce-slow-high-hit-path-B-speed-alone-cannot-prove-generic/);
  }
});

test('caught SQL failure may prove restored state but cannot profile successfully or continue', async () => {
  const harness = dailyHarness({ probeSqlstate: '57014' });
  await assert.rejects(harness.run(), /daily-probe-failed-see-receipt/);
  assert.equal(harness.diagnostic.probes.length, 1);
  const probe = harness.diagnostic.probes[0];
  assert.equal(probe.status, 'failed'); assert.equal(probe.catalogRestoredVerified, true);
  assert.equal(probe.sqlstate, '57014'); assert.equal(probe.summary, undefined);
  assert.equal(harness.diagnostic.acceptance, false);
});

test('interruption after received probe preserves plan and leaves catalog/isolation unknown through cleanup', async () => {
  const harness = dailyHarness({ interruptAfterProbe: true });
  await assert.rejects(harness.run(), /simulated-post-probe-interruption/);
  const durable = harness.saved.find(row => row.pending?.kind === 'state' && row.probes[0]?.outerRollbackRequestComplete);
  assert.ok(durable);
  qaInterruptDailyDiagnostic(durable);
  assert.equal(durable.pending.status, 'interrupted');
  assert.equal(durable.probes[0].status, 'interrupted');
  assert.equal(durable.probes[0].isolation, 'unknown');
  assert.equal(durable.probes[0].catalogRestoredVerified, undefined);
  assert.equal(durable.probes[0].summary['Execution Time'], 850);
  assert.equal(durable.probes[0].outerRollbackRequestComplete, true);
  assert.equal(durable.acceptance, false);
});

test('boundary SQL separately hashes source and retained receipts; no direct lease or cursor writes', async () => {
  const [{ bytes }] = await migrationSources();
  const queries = fixtureDailyDiagnosticSql(bytes, schema, privateSchema);
  const query = queries.boundary({ leaseToken: '00000000-0000-4000-8000-000000000001', epoch: '1' });
  for (const table of ['roblox_universes', 'stats_game_current_index', 'roblox_universe_stats_hourly', 'roblox_universe_stats_daily']) assert.ok(query.includes(`${schema}.${table}`));
  assert.match(query, /'retainedReceipts'/); assert.match(query, /'expectedFinish'/); assert.match(query, /'fixedControl'/);
  assert.doesNotMatch(query, /\b(?:insert|update|delete|truncate)\b/i);
  assert.throws(() => queries.boundary({ leaseToken: 'SECRET', epoch: '1' }));
});

test('disk and read-only diagnostics use SQLSTATE without copying messages or guessing quota causes', () => {
  for (const [code, errorClass] of [['53100', 'disk-full'], ['25006', 'read-only-transaction']]) {
    for (const result of [{ code, message: 'SECRET_DISK_PATH' },
      { error: { code, message: 'SECRET_QUERY' } },
      { message: `Failed to run sql query: ERROR:  ${code}: SECRET` }]) {
      const diagnostic = qaSqlFailureDiagnostic({ phase: 'source-daily', status: 400, result, query: 'select 1;' });
      assert.deepEqual(diagnostic, { phase: 'source-daily', status: 400, sqlstate: code, errorClass });
      assert.doesNotMatch(JSON.stringify(diagnostic), /SECRET|quota|free|WAL/);
    }
  }
  assert.deepEqual(qaSqlFailureDiagnostic({ phase: 'cleanup', status: 400,
    result: { message: 'provider SECRET read only disk full' }, query: '' }),
  { phase: 'cleanup', status: 400, sqlstate: 'unknown' });
});

test('source batch progress distinguishes daily and hourly insertion without claiming actual row readback', () => {
  assert.deepEqual(qaSourceProgress('source-daily', 7001, 8000, 91), {
    phase: 'source-daily', firstUniverse: 7001, lastUniverse: 8000, expectedRows: 91000 });
  assert.equal(qaSourceProgress('source-hourly', 99003, 100000, 160).expectedRows, 159680);
  for (const args of [['fixture-checks', 1, 2, 91], ['source-daily', 0, 1, 91],
    ['source-daily', 2, 1, 91], ['source-daily', 1, 100001, 91], ['source-hourly', 1, 2, Infinity]]) {
    assert.throws(() => qaSourceProgress(...args));
  }
  const pending = qaSourceProgress('source-daily', 8001, 9000, 91);
  const saved = qaReceiptWithPhases({ completed: false, sourceProgress: { completedBatches: 10, pending } }, []);
  const cleaned = qaReceiptWithPhases({ ...saved, cleaned: true }, [{ phase: 'cleanup', ok: true }]);
  assert.deepEqual(cleaned.sourceProgress.pending, pending); assert.equal(cleaned.completed, false);
});

test('storage checkpoints allow only numeric counters and read-only flags, never infer physical free disk', () => {
  const row = { databaseBytes: '842624147', sourceBytes: '511934464', sourceIndexBytes: '100',
    preparedBytes: '40960', tempBytes: '10000000000', tempFiles: '10',
    defaultReadOnly: 'on', transactionReadOnly: 'on', providerMessage: 'SECRET' };
  const checkpoint = qaStorageCheckpoint([row]);
  assert.equal(checkpoint.databaseBytes, '842624147'); assert.equal(checkpoint.defaultReadOnly, 'on');
  assert.doesNotMatch(JSON.stringify(checkpoint), /SECRET|provider|freeDisk/);
  for (const invalid of [[], [row, row], [{ ...row, databaseBytes: '-1' }],
    [{ ...row, tempBytes: 'SECRET' }], [{ ...row, defaultReadOnly: 'SECRET' }]]) {
    assert.throws(() => qaStorageCheckpoint(invalid));
  }
});

test('fixture batches preserve the 6000-step and 20-minute drive bounds, reserving the existing request deadline', () => {
  assert.deepEqual(qaFixtureBatchPlan(0, 0), { limit: 256, workBudgetMs: 40_000 });
  assert.deepEqual(qaFixtureBatchPlan(5888, 1_080_000), { limit: 112, workBudgetMs: 40_000 });
  assert.deepEqual(qaFixtureBatchPlan(5999, 1_080_000), { limit: 1, workBudgetMs: 40_000 });
  assert.equal(qaFixtureBatchPlan(6000, 0), null);
  assert.equal(qaFixtureBatchPlan(0, 1_080_001), null);
  assert.equal(qaFixtureBatchPlan(0, 1_200_000), null);
  for (const args of [[-1, 0], [6001, 0], [0.5, 0], [0, -1], [0, NaN], [0, Infinity]]) {
    assert.throws(() => qaFixtureBatchPlan(...args));
  }
});

test('fixture batch SQL refuses foreign namespaces and adds only a private orchestration helper', () => {
  for (const args of [['public', privateSchema], [schema, 'stats_prepared_private'],
    [schema, 'qa_stats_abcdef012345_p'], [schema + ';select 1', privateSchema]]) {
    assert.throws(() => fixtureDriveBatchSql(...args));
  }
  const sql = fixtureDriveBatchSql(schema, privateSchema);
  assert.match(sql, /security invoker set search_path=''/);
  assert.match(sql, /revoke all on function qa_stats_012345abcdef_p\.qa_drive_batch_v1\(uuid,bigint,integer,integer,uuid\) from public,anon,authenticated/);
  assert.match(sql, /step_id:=case when n=1 then p_first_step else pg_catalog\.gen_random_uuid\(\) end/);
  assert.match(sql, /qa_stats_012345abcdef\.run_stats_prepared_step_v1\(p_token,p_epoch,step_id/);
  assert.doesNotMatch(sql, /create (?:or replace )?function public\.|create or replace|\b(?:insert|update|delete|truncate)\b|qa_now\(/i);
});

const batchOutcome = (phase = 'hour-backfill', more = true) => ({ phase, more,
  platformGeneration: '00000000-0000-4000-8000-000000000001', visitGeneration: null });
const stepUuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const advanceState = (patch = {}) => ({ dailyScan: null, dailyAfter: '0', controlSteps: 0,
  platformGeneration: null, visitGeneration: null, visitBuild: null, visitAfter: null, visitTotalsDone: null, ...patch });
const batchRows = results => {
  const calls = results.map((r, i) => r === null ? null : ({ stepId: stepUuid(i + 1),
    sqlMs: i === 0 ? 80 : 10, preState: advanceState(), ...r }));
  return [{ result: { results: calls, sqlMs: 123.5, maximumSqlStepMs: 80, finalState: advanceState() } }];
};

test('one Management result retains every bounded outcome and a final more=false, stripping unknown fields', () => {
  const outcomes = [batchOutcome('daily-batch'), batchOutcome('platform-publish'), batchOutcome('unchanged', false)];
  const rows = batchRows(outcomes.map(r => ({ ...r, SECRET_FIELD: 'SECRET_VALUE' })));
  rows[0].result.SECRET_BODY = 'SECRET_SQL';
  const result = qaFixtureBatchResult(rows, 256);
  assert.deepEqual(result.results, rows[0].result.results.map(({ SECRET_FIELD, ...r }) => r));
  assert.equal(result.calls, 3); assert.equal(result.sqlMs, 123.5); assert.equal(result.maximumSqlStepMs, 80);
  assert.equal(result.maximum.phase, 'daily-batch'); assert.equal(result.maximum.stepId, stepUuid(1));
  assert.doesNotMatch(JSON.stringify(result), /SECRET/);
  assert.equal(qaFixtureBatchResult(batchRows([batchOutcome()]), 1).results[0].more, true);
});

test('missing, split, oversized, prematurely finished or malformed batch results fail closed', () => {
  const valid = batchRows([batchOutcome()]);
  for (const [rows, limit] of [[null, 1], [[], 1], [[...valid, ...valid], 2],
    [[{ result: {} }], 1], [batchRows([]), 1], [batchRows([batchOutcome(), batchOutcome()]), 1],
    [batchRows([batchOutcome('unchanged', false), batchOutcome()]), 2], [valid, 0], [valid, 257],
    [batchRows([null]), 1], [batchRows([batchOutcome('SECRET_PHASE')]), 1],
    [batchRows([{ ...batchOutcome(), more: 'false' }]), 1],
    [batchRows([{ ...batchOutcome(), platformGeneration: 'SECRET_TOKEN' }]), 1],
    [batchRows([{ phase: 'hour', more: true }]), 1]]) {
    assert.throws(() => qaFixtureBatchResult(rows, limit), /^Error: fixture-drive-invalid-response$/);
  }
  for (const patch of [{ sqlMs: -1 }, { sqlMs: '1' }, { sqlMs: NaN }, { sqlMs: 60_001 },
    { maximumSqlStepMs: -1 }, { maximumSqlStepMs: 124 }, { maximumSqlStepMs: Infinity },
    { maximumSqlStepMs: 79 }, { finalState: {} }]) {
    assert.throws(() => qaFixtureBatchResult([{ result: { ...valid[0].result, ...patch } }], 1),
      /^Error: fixture-drive-invalid-response$/);
  }
});

test('maximum timing retains exact phase, UUID and pre-cursor when the slowest call is not last', () => {
  const rows = batchRows([batchOutcome('hour'), batchOutcome('daily-batch'), batchOutcome('platform-publish')]);
  const calls = rows[0].result.results;
  calls[1].sqlMs = 24_105.820;
  calls[1].preState = advanceState({ dailyScan: stepUuid(90), dailyAfter: '9007199254740993', controlSteps: 7 });
  Object.assign(rows[0].result, { maximumSqlStepMs: 24_105.820, sqlMs: 24_200 });
  const batch = qaFixtureBatchResult(rows, 3);
  assert.equal(batch.maximum.phase, 'daily-batch'); assert.equal(batch.maximum.stepId, stepUuid(2));
  assert.equal(batch.maximum.preState.dailyAfter, '9007199254740993');
  assert.equal(batch.maximum.preState.dailyScan, stepUuid(90));
  assert.deepEqual(batch.phaseStats['daily-batch'], { calls: 1, sqlMs: 24_105.820, maximumSqlStepMs: 24_105.820 });
  assert.equal(batch.slowCalls.length, 1); assert.deepEqual(batch.slowCalls[0], batch.maximum);
  assert.equal(batch.timingScope, 'outer-advance-including-shared-cleanup');
  assert.equal(batch.sharedCleanup, 'unattributed');
});

test('slow receipts have a fixed eight-call bound, retain inclusive threshold and deterministic ties', () => {
  const calls = Array.from({ length: 256 }, (_, i) => ({ ...batchOutcome(i % 2 ? 'hour' : 'daily-batch'),
    stepId: stepUuid(i + 1), sqlMs: i < 20 ? 1000 : 0.5, preState: advanceState() }));
  const summary = qaTimingSummary(calls);
  assert.equal(summary.calls, 256); assert.equal(summary.slowCalls.length, 8);
  assert.deepEqual(summary.slowCalls.map(r => r.stepId), Array.from({ length: 8 }, (_, i) => stepUuid(i + 1)));
  assert.equal(summary.maximum.stepId, stepUuid(1));
  assert.deepEqual(summary.phaseStats.hour, { calls: 128, sqlMs: 10059, maximumSqlStepMs: 1000 });
  assert.deepEqual(summary.phaseStats['daily-batch'], summary.phaseStats.hour);
  assert.equal(qaTimingSummary([{ ...calls[0], sqlMs: 999.999 }]).slowCalls.length, 0);
  assert.throws(() => qaTimingSummary([...calls, calls[0]]), /invalid-response/);
});

test('batch parsing rejects malformed timing, UUID, cursors, duplicate IDs and inconsistent totals', () => {
  for (const patch of [{ stepId: 'SECRET_UUID' }, { stepId: null }, { stepId: 1 }, { sqlMs: -1 },
    { sqlMs: '80' }, { sqlMs: Infinity }, { sqlMs: 60001 }, { preState: null },
    { preState: advanceState({ dailyAfter: '9223372036854775808' }) },
    { preState: advanceState({ dailyAfter: '00' }) }, { preState: advanceState({ dailyAfter: '-1' }) },
    { preState: advanceState({ dailyScan: 'SECRET' }) }, { preState: advanceState({ controlSteps: 0.5 }) },
    { preState: advanceState({ controlSteps: 2147483648 }) },
    { preState: advanceState({ visitBuild: stepUuid(99) }) },
    { preState: advanceState({ visitAfter: '1', visitTotalsDone: false }) }]) {
    const rows = batchRows([{ ...batchOutcome(), ...patch }]);
    assert.throws(() => qaFixtureBatchResult(rows, 1), /^Error: fixture-drive-invalid-response$/);
  }
  const duplicate = batchRows([batchOutcome(), { ...batchOutcome(), stepId: stepUuid(1) }]);
  assert.throws(() => qaFixtureBatchResult(duplicate, 2), /invalid-response/);
  const impossible = batchRows([batchOutcome(), batchOutcome()]);
  impossible[0].result.sqlMs = 85;
  assert.throws(() => qaFixtureBatchResult(impossible, 2), /invalid-response/);
  const state = qaAdvanceState(advanceState({ SECRET_FIELD: 'SECRET' }));
  assert.doesNotMatch(JSON.stringify(state), /SECRET/);
  assert.equal(qaAdvanceState(advanceState({ dailyAfter: '9223372036854775807',
    visitBuild: stepUuid(9), visitAfter: '9223372036854775807', visitTotalsDone: true })).visitAfter, '9223372036854775807');
});

const fixtureRun = () => ({ scenario: 'initial-bootstrap', status: 'running', steps: 0, batches: 0,
  sqlMs: 0, requestOverheadMs: 0, maximumSqlStepMs: 0, phaseCounts: {} });

test('saved per-batch and per-drive maxima correlate exactly across batches while every call is counted', () => {
  const run = fixtureRun();
  for (let batchNumber = 1; batchNumber <= 2; batchNumber++) {
    const calls = Array.from({ length: 256 }, (_, i) => ({ ...batchOutcome(i === 1 ? 'daily-batch' : 'hour'),
      stepId: stepUuid((batchNumber - 1) * 256 + i + 1), sqlMs: i < 20 ? 1000 : 0.5,
      preState: advanceState({ dailyAfter: String(batchNumber) }) }));
    calls[1].sqlMs = 2000;
    const batch = qaFixtureBatchResult([{ result: { results: calls, sqlMs: 22_000,
      maximumSqlStepMs: 2000, finalState: advanceState() } }], 256);
    qaBeginDriveAttempt(run, { transport: 'sql', steps: 256, workBudgetMs: 40000,
      firstStepId: calls[0].stepId, state: advanceState() });
    qaRecordFixtureBatch(run, batch, 23_000);
  }
  assert.equal(run.steps, 512); assert.equal(run.batches, 2); assert.equal(run.batchReceipts.length, 2);
  assert.equal(run.maximumSqlStepMs, 2000); assert.equal(run.maximum.stepId, stepUuid(2));
  assert.equal(run.maximum.phase, 'daily-batch'); assert.equal(run.maximum.batchNumber, 1);
  assert.equal(run.maximum.preState.dailyAfter, '1');
  assert.equal(run.slowCalls.length, 8); assert.equal(run.slowCalls[1].stepId, stepUuid(258));
  assert.equal(run.slowCalls[1].batchNumber, 2);
  assert.equal(run.phaseCounts.hour, 510); assert.equal(run.phaseCounts['daily-batch'], 2);
  assert.equal(run.phaseStats.hour.sqlMs, 38_236); assert.equal(run.phaseStats['daily-batch'].sqlMs, 4000);
  assert.equal(run.sqlMs, 44_000); assert.equal(run.requestOverheadMs, 2000);
  assert.equal(run.pendingBatch, undefined);
  for (const receipt of run.batchReceipts) {
    assert.equal(receipt.slowCalls.length, 8); assert.equal(receipt.actualCalls, 256);
    assert.equal(receipt.status, 'completed'); assert.equal(receipt.sharedCleanup, 'unattributed');
    assert.equal(receipt.results, undefined);
  }
});

test('pending attempts survive serialization, SQL failure, interruption and repeated cleanup without raw errors', () => {
  const run = fixtureRun();
  qaBeginDriveAttempt(run, { transport: 'sql', steps: 256, workBudgetMs: 40000,
    firstStepId: stepUuid(1), state: advanceState({ dailyAfter: '512' }) });
  const saved = JSON.parse(JSON.stringify(run));
  assert.equal(saved.pendingBatch.status, 'pending'); assert.equal(saved.pendingBatch.attempt, 1);
  assert.equal(saved.pendingBatch.batchNumber, 1); assert.equal(saved.pendingBatch.scenario, 'initial-bootstrap');
  assert.equal(saved.pendingBatch.attemptedPhase, null);
  assert.equal(saved.pendingBatch.stepIdentityScope, 'first-call-only');
  qaDriveFailure(saved, { sqlstate: '57014', status: 400, ms: 60005, message: 'SECRET_SQL', details: 'SECRET' });
  assert.deepEqual(saved.failure, { code: '57014', status: 400, ms: 60005, kind: 'dispatch-or-response-failure' });
  assert.equal(saved.batchReceipts[0].status, 'failed'); assert.equal(saved.pendingBatch.firstStepId, stepUuid(1));
  const interrupted = JSON.parse(JSON.stringify(run));
  qaDriveFailure(interrupted, { interrupted: true });
  assert.equal(interrupted.status, 'interrupted'); assert.equal(interrupted.batchReceipts[0].failure.kind, 'interrupted');
  const before = qaReceiptWithPhases({ completed: false, drives: [saved, interrupted],
    pendingAdvance: { stepId: stepUuid(77), status: 'failed', failure: saved.failure } }, []);
  const after = qaReceiptWithPhases({ ...before, cleaned: true }, [{ phase: 'cleanup', ok: true }]);
  assert.deepEqual(after.drives, before.drives); assert.deepEqual(after.pendingAdvance, before.pendingAdvance);
  assert.equal(after.completed, false); assert.equal(saved.steps, 0); assert.equal(saved.maximum, undefined);
  assert.doesNotMatch(JSON.stringify(after), /SECRET/);
  qaDriveFailure(interrupted, { code: 'SECRET', status: 'SECRET', ms: Infinity });
  assert.equal(interrupted.failure.kind, 'interrupted'); assert.equal(interrupted.status, 'interrupted');
  const legacy = { status: 'running', pendingBatch: { transport: 'sql', steps: 256 } };
  qaDriveFailure(legacy, { interrupted: true });
  assert.equal(legacy.pendingBatch.status, 'interrupted');
});

test('REST success metadata strips arbitrary fields and rejects invalid phases and step identity', () => {
  assert.deepEqual(qaAdvanceOutcome({ ...batchOutcome('visit-totals'), SECRET: 'SECRET' }, stepUuid(7)),
    { ...batchOutcome('visit-totals'), stepId: stepUuid(7) });
  for (const [value, stepId] of [[batchOutcome('SECRET'), stepUuid(1)], [batchOutcome(), 'SECRET'],
    [{ ...batchOutcome(), more: 1 }, stepUuid(1)], [{ ...batchOutcome(), visitGeneration: 'SECRET' }, stepUuid(1)]]) {
    assert.throws(() => qaAdvanceOutcome(value, stepId), /invalid-response/);
  }
  const stateSql = qaAdvanceStateSql(schema);
  assert.doesNotMatch(stateSql, /public\.|roblox_|\b(?:count|insert|update|delete)\b/i);
  assert.throws(() => qaAdvanceStateSql('public'));
});

test('cleanup preserves the started scenario and pending batch without manufacturing drive completion', () => {
  const drive = { scenario: 'late-source-repair', status: 'running', steps: 512, sqlMs: 350,
    requestOverheadMs: 6000, phaseCounts: { 'hour-backfill': 512 },
    pendingBatch: { transport: 'sql', steps: 256, workBudgetMs: 40_000, startedAt: '2026-10-23T14:06:50Z' } };
  const saved = qaReceiptWithPhases({ completed: false, cleaned: false, drives: [drive] }, []);
  const cleanup = { kind: 'sql', phase: 'cleanup', ms: 100, status: 201, ok: true };
  const cleaned = qaReceiptWithPhases({ ...saved, cleaned: true }, [cleanup]);
  assert.deepEqual(cleaned.drives, [drive]);
  assert.equal(cleaned.completed, false); assert.equal(cleaned.cleaned, true);
  assert.deepEqual(cleaned.phases, [cleanup]);
});

test('forward claim changes only the full membership DELETE predicate and preserves frozen applied bytes', async () => {
  const [original, correction] = await migrationSources();
  assert.equal(createHash('sha256').update(original.bytes).digest('hex'),
    '286252e4620d906b21c2472a36773b45dbf3d6c42c6b5c44063e71ee65228fbd');
  const originalSql = original.bytes.toString('utf8');
  assert.match(originalSql, /create table public\.stats_prepared_members \(universe_id bigint primary key\);/);
  const claim = originalSql.match(/^create function public\.claim_stats_prepared_work_v1\(p_worker_id text,p_request_id uuid\) returns jsonb\n[\s\S]*?^end \$\$;/m)?.[0];
  assert.ok(claim);
  assert.equal(correction.bytes.toString('utf8').replace(/^(?:--[^\n]*\n)*/, ''),
    claim.replace('create function ', 'create or replace function ')
      .replace('delete from public.stats_prepared_members;',
        'delete from public.stats_prepared_members where universe_id is not null;') + '\n');
});

test('migration plan requires both exact ordered files and records each raw byte hash and size', async () => {
  const sources = await migrationSources();
  assert.deepEqual(PREPARED_QA_MIGRATION_PATHS, [
    'supabase/migrations/20261023100441_stats_prepared_charts_v1.sql',
    'supabase/migrations/20261023131347_stats_prepared_claim_membership_delete_predicate.sql',
  ]);
  const plan = fixtureMigrationPlan(sources, schema, privateSchema);
  for (let i = 0; i < sources.length; i++) {
    const { path, bytes } = sources[i];
    assert.deepEqual(plan[i], { path, bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      sql: fixtureMigrationSql(bytes.toString('utf8'), schema, privateSchema) });
    assert.equal(plan[i].sql.replaceAll(privateSchema, 'stats_prepared_private')
      .replaceAll(`${schema}.`, 'public.').replaceAll(`'${schema}'`, "'public'"), bytes.toString('utf8'));
    assert.doesNotMatch(plan[i].sql, /\bpublic\.|stats_prepared_private|'public'/);
  }
  assert.match(plan[0].sql, /delete from qa_stats_012345abcdef\.stats_prepared_members;/);
  assert.match(plan[1].sql, /create or replace function qa_stats_012345abcdef\.claim_stats_prepared_work_v1/);
  assert.match(plan[1].sql, /delete from qa_stats_012345abcdef\.stats_prepared_members where universe_id is not null;/);
  for (const invalid of [sources.slice(0, 1), sources.slice(1), [...sources].reverse(),
    [sources[0], sources[0]], [...sources, sources[1]],
    [{ ...sources[0], bytes: Buffer.concat([sources[0].bytes, Buffer.from('\n')]) }, sources[1]],
    [sources[0], { ...sources[1], bytes: sources[1].bytes.toString('utf8') }]]) {
    assert.throws(() => fixtureMigrationPlan(invalid, schema, privateSchema));
  }
});

test('migration replay awaits the original before correction and cannot complete after either install fails', async () => {
  const plan = fixtureMigrationPlan(await migrationSources(), schema, privateSchema);
  const started = [], installed = [];
  let releaseOriginal;
  const originalGate = new Promise(resolve => { releaseOriginal = resolve; });
  const replay = replayFixtureMigrations(plan, async (sql, receipt) => {
    started.push(receipt.path);
    assert.equal(sql, plan[started.length - 1].sql);
    assert.deepEqual(Object.keys(receipt).sort(), ['bytes', 'path', 'sha256']);
    if (started.length === 1) await originalGate;
    installed.push(receipt);
  });
  assert.deepEqual(started, [PREPARED_QA_MIGRATION_PATHS[0]]);
  assert.deepEqual(installed, []);
  releaseOriginal(); await replay;
  assert.deepEqual(started, PREPARED_QA_MIGRATION_PATHS);
  assert.deepEqual(installed, plan.map(({ sql, ...receipt }) => receipt));
  for (const failedPath of PREPARED_QA_MIGRATION_PATHS) {
    const attempts = []; let completed = false;
    await assert.rejects(async () => {
      await replayFixtureMigrations(plan, async (sql, receipt) => {
        attempts.push(receipt.path);
        if (receipt.path === failedPath) throw new Error('migration-install-failed');
      });
      completed = true;
    }, /migration-install-failed/);
    assert.equal(completed, false);
    assert.deepEqual(attempts, PREPARED_QA_MIGRATION_PATHS.slice(0,
      PREPARED_QA_MIGRATION_PATHS.indexOf(failedPath) + 1));
  }
});

test('ordered migration receipts survive cleanup with legacy original hash and partial installs intact', async () => {
  const migrations = fixtureMigrationPlan(await migrationSources(), schema, privateSchema)
    .map(({ sql, ...receipt }) => receipt);
  const cleanup = { kind: 'sql', phase: 'cleanup', status: 201, ok: true, ms: 1 };
  for (const installedMigrations of [migrations.slice(0, 1), migrations]) {
    const identity = { migrations, installedMigrations, migrationSha256: migrations[0].sha256,
      completed: false, cleaned: false };
    const saved = qaReceiptWithPhases(identity, []);
    const cleaned = qaReceiptWithPhases({ ...saved, cleaned: true }, [cleanup]);
    assert.deepEqual(cleaned.migrations, migrations);
    assert.deepEqual(cleaned.installedMigrations, installedMigrations);
    assert.equal(cleaned.migrationSha256, migrations[0].sha256);
    assert.equal(cleaned.completed, false); assert.equal(cleaned.cleaned, true);
    assert.deepEqual(cleaned.phases, [cleanup]);
    assert.doesNotMatch(JSON.stringify(cleaned), /create or replace|delete from|"sql"\s*:/i);
  }
});

test('cardinality classification requires an exact known primary message and its matching SQLSTATE', () => {
  const cases = [
    ['21000', 'ON CONFLICT DO UPDATE command cannot affect row a second time', 'on-conflict-double-target'],
    ['21000', 'more than one row returned by a subquery used as an expression', 'scalar-subquery-many-rows'],
    ['21000', 'DELETE requires a WHERE clause', 'safeupdate-delete-without-where'],
    ['21000', 'UPDATE requires a WHERE clause', 'safeupdate-update-without-where'],
    ['P0003', 'query returned more than one row', 'plpgsql-too-many-rows'],
  ];
  for (const [code, message, errorClass] of cases) {
    for (const result of [{ code, message }, { error: { code, message } },
      { message: `Failed to run sql query: ERROR:  ${code}: ${message}\nDETAIL: SECRET_DETAIL` }]) {
      assert.deepEqual(qaRpcFailureDiagnostic({ result }), { sqlstate: code, errorClass });
    }
    for (const result of [{ code, message: `${message} SECRET_SQL` }, { code, details: message }, { code, hint: message },
      { code: 'XX000', message }, { code, message: `SECRET_PREFIX ${message}` }]) {
      assert.equal(qaRpcFailureDiagnostic({ result }).errorClass, 'unknown');
    }
  }
  assert.deepEqual(qaRpcFailureDiagnostic({ result: { code: '21000' } }),
    { sqlstate: '21000', errorClass: 'unknown' });
  assert.deepEqual(qaSqlFailureDiagnostic({ phase: 'claim-diagnostic', status: 400, query: 'select 1;',
    result: { message: 'ERROR:  21000: more than one row returned by a subquery used as an expression' } }),
    { phase: 'claim-diagnostic', status: 400, sqlstate: '21000', errorClass: 'scalar-subquery-many-rows' });
});

test('HTTP error envelope diagnostics retain only fixed slot shapes, including unsupported responses', () => {
  const result = { code: '21000', message: 'SECRET_SQL', details: null, hint: null,
    context: 'SECRET_CONTEXT', error: { code: 'SECRET_CODE', message: { SECRET_KEY: 'SECRET_VALUE' } },
    SECRET_HEADER: 'SECRET_TOKEN', body: 'SECRET_BODY' };
  assert.deepEqual(qaRpcErrorEnvelope(result), { root: 'object', code: 'string', message: 'string',
    details: 'null', hint: 'null', context: 'string', error: 'object', nestedCode: 'string', nestedMessage: 'object' });
  assert.doesNotMatch(JSON.stringify(qaRpcErrorEnvelope(result)), /SECRET|body|header/i);
  for (const [input, root] of [[null, 'null'], [[], 'array'], ['SECRET_BODY', 'string'], [42, 'other'],
    [undefined, 'absent'], [{}, 'object']]) {
    assert.deepEqual(qaRpcErrorEnvelope(input), { root, code: 'absent', message: 'absent', details: 'absent',
      hint: 'absent', context: 'absent', error: 'absent', nestedCode: 'absent', nestedMessage: 'absent' });
  }
});

test('RPC diagnostics retain only a bounded line from this exact claim alias frame', () => {
  for (const qualifier of ['', 'public.']) {
    const diagnostic = qaRpcFailureDiagnostic({ claimLocation, result: {
      code: '21000', message: 'more than one row returned by a subquery used as an expression',
      details: `SECRET_SQL\nPL/pgSQL function ${qualifier}${claimLocation.alias}(text,uuid) line 37 at SQL statement\nSECRET_KEY`,
      hint: 'SECRET_HINT', context: 'SECRET_CONTEXT', body: 'SECRET_BODY', api_key: 'SECRET_KEY' } });
    assert.deepEqual(diagnostic,
      { sqlstate: '21000', errorClass: 'scalar-subquery-many-rows', functionLine: 37 });
    assert.doesNotMatch(JSON.stringify(diagnostic), /SECRET|qa_|SQL|statement|text|uuid/);
  }
  // Other function frames, even with a valid line, cannot locate this claim.
  for (const context of [
    `PL/pgSQL function public.qa_abcdef012345_claim_sp_work_v1(text,uuid) line 3 at SQL statement`,
    `PL/pgSQL function private.${claimLocation.alias}(text,uuid) line 3 at SQL statement`,
    `PL/pgSQL function public.${claimLocation.alias}(text,uuid) line 61 at SQL statement`,
    `PL/pgSQL function public.${claimLocation.alias}(text,uuid) line 0 at SQL statement`,
    `PL/pgSQL function public.${claimLocation.alias}(text,uuid) line 1;SECRET at SQL statement`,
    `SECRET PL/pgSQL function public.${claimLocation.alias}(text,uuid) line 3 at SQL statement`,
  ]) assert.deepEqual(qaRpcFailureDiagnostic({ claimLocation, result: { code: '21000', context } }),
    { sqlstate: '21000', errorClass: 'unknown' });
  assert.deepEqual(qaRpcFailureDiagnostic({ result: { code: 'SECRET_CODE', message: 'SECRET_SQL' } }),
    { sqlstate: 'unknown', errorClass: 'unknown' });
});

test('claim probe receipts discard extra data and refuse invalid classes, states and rollback results', () => {
  const input = { sqlstate: '21000', errorClass: 'on-conflict-double-target', rollbackVerified: true,
    functionLine: 24, message: 'SECRET_MESSAGE', context: 'SECRET_CONTEXT', query: 'SECRET_SQL' };
  const diagnostic = qaClaimProbeDiagnostic(input, claimLocation);
  assert.deepEqual(diagnostic, { sqlstate: '21000', errorClass: 'on-conflict-double-target',
    rollbackVerified: true, functionLine: 24 });
  assert.doesNotMatch(JSON.stringify(diagnostic), /SECRET|context|query|message/);
  for (const changed of [{ sqlstate: 'SECRET' }, { errorClass: 'SECRET' }, { sqlstate: 'P0003' },
    { rollbackVerified: false }, { rollbackVerified: 'true' }, { errorClass: 'rolled-back-success' }]) {
    assert.throws(() => qaClaimProbeDiagnostic({ ...input, ...changed }, claimLocation),
      /fixture-claim-diagnostic-invalid/);
  }
  for (const functionLine of ['24', 61, 0, -1, 2.5, Number.MAX_SAFE_INTEGER]) {
    assert.equal('functionLine' in qaClaimProbeDiagnostic({ ...input, functionLine }, claimLocation), false);
  }
  assert.deepEqual(qaClaimProbeDiagnostic({ sqlstate: null, errorClass: 'rolled-back-success',
    rollbackVerified: true }, claimLocation),
    { sqlstate: null, errorClass: 'rolled-back-success', rollbackVerified: true });
  assert.deepEqual(qaClaimProbeDiagnostic({ sqlstate: 'XX000', errorClass: 'unknown',
    rollbackVerified: true }, claimLocation),
    { sqlstate: 'XX000', errorClass: 'unknown', rollbackVerified: true });
});

test('claim diagnostic SQL authoring refuses any namespace, alias, line bound or UUID outside this fixture', () => {
  const schema = 'qa_stats_012345abcdef', privateSchema = `${schema}_p`;
  const requestId = '00000000-0000-4000-8000-000000000001';
  for (const [s, p, location, id] of [
    ['public', privateSchema, claimLocation, requestId],
    [schema, 'stats_prepared_private', claimLocation, requestId],
    [schema, privateSchema, { ...claimLocation, alias: 'claim_stats_prepared_work_v1' }, requestId],
    [schema, privateSchema, { ...claimLocation, alias: 'qa_abcdef012345_claim_sp_work_v1' }, requestId],
    [schema, privateSchema, { ...claimLocation, maxLine: 0 }, requestId],
    [schema, privateSchema, { ...claimLocation, maxLine: 10001 }, requestId],
    [schema, privateSchema, claimLocation, "'SECRET_SQL"],
  ]) assert.throws(() => fixtureClaimDiagnosticSql(s, p, location, id));
});

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
  const rpcFailure = { kind: 'rest', status: 400, code: '21000', sqlstate: '21000', errorClass: 'unknown',
    errorEnvelope: qaRpcErrorEnvelope({ code: '21000', message: 'SECRET_SQL', details: null, hint: null }) };
  const claimDiagnostic = { sqlstate: '21000', errorClass: 'scalar-subquery-many-rows',
    functionLine: 37, rollbackVerified: true };
  const claimCleanup = qaReceiptWithPhases({ completed: false, cleaned: true,
    rpcFailure, claimDiagnostic, phases: [clone, rpcFailure] }, [cleanup]);
  assert.deepEqual(claimCleanup.rpcFailure, rpcFailure);
  assert.deepEqual(claimCleanup.claimDiagnostic, claimDiagnostic);
  assert.deepEqual(claimCleanup.phases, [clone, rpcFailure, cleanup]);
  assert.equal(claimCleanup.completed, false);
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
