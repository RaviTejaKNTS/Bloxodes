import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { legacyVisitExpected, assertVisitParity, validateQaCheckout, fixtureMigrationSql,
  qaSqlFailureDiagnostic, qaReceiptWithPhases, qaRpcFailureDiagnostic, qaClaimProbeDiagnostic,
  fixtureClaimDiagnosticSql, qaRpcErrorEnvelope, PREPARED_QA_MIGRATION_PATHS,
  fixtureMigrationPlan, replayFixtureMigrations, fixtureDriveBatchSql,
  qaFixtureBatchPlan, qaFixtureBatchResult, qaSourceProgress, qaStorageCheckpoint } from '../../ci/stats-prepared-db-qa.mjs';

const claimLocation = { alias: 'qa_012345abcdef_claim_sp_work_v1', maxLine: 60 };
const schema = 'qa_stats_012345abcdef', privateSchema = `${schema}_p`;
const migrationSources = () => Promise.all(PREPARED_QA_MIGRATION_PATHS.map(async path => ({
  path, bytes: await readFile(new URL(`../../../${path}`, import.meta.url)),
})));

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
  assert.match(sql, /revoke all on function qa_stats_012345abcdef_p\.qa_drive_batch_v1\(uuid,bigint,integer,integer\) from public,anon,authenticated/);
  assert.match(sql, /qa_stats_012345abcdef\.run_stats_prepared_step_v1\(p_token,p_epoch,pg_catalog\.gen_random_uuid\(\)/);
  assert.doesNotMatch(sql, /create (?:or replace )?function public\.|create or replace|\b(?:insert|update|delete|truncate)\b|qa_now\(/i);
});

const batchOutcome = (phase = 'hour-backfill', more = true) => ({ phase, more,
  platformGeneration: '00000000-0000-4000-8000-000000000001', visitGeneration: null });
const batchRows = results => [{ result: { results, sqlMs: 123.5, maximumSqlStepMs: 80 } }];

test('one Management result retains every bounded outcome and a final more=false, stripping unknown fields', () => {
  const outcomes = [batchOutcome('daily-batch'), batchOutcome('platform-publish'), batchOutcome('unchanged', false)];
  const rows = batchRows(outcomes.map(r => ({ ...r, SECRET_FIELD: 'SECRET_VALUE' })));
  rows[0].result.SECRET_BODY = 'SECRET_SQL';
  const result = qaFixtureBatchResult(rows, 256);
  assert.deepEqual(result, { results: outcomes, sqlMs: 123.5, maximumSqlStepMs: 80 });
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
    { maximumSqlStepMs: -1 }, { maximumSqlStepMs: 124 }, { maximumSqlStepMs: Infinity }]) {
    assert.throws(() => qaFixtureBatchResult([{ result: { ...valid[0].result, ...patch } }], 1),
      /^Error: fixture-drive-invalid-response$/);
  }
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
