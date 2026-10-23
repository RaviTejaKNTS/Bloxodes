#!/usr/bin/env node
/** GitHub-only managed-development fixtures. No dotenv, production or local DB. */
import assert from 'node:assert/strict';
import { readFile, open, rename } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { validatePreparedSelection } from './stats-prepared-selection.mjs';
import { READER_DIAGNOSTIC_MIGRATIONS } from './stats-prepared-reader-diagnostic.mjs';
import { runReaderDiagnostic, createReaderDiagnosticRest,
  READER_DIAGNOSTIC_PHASES } from './stats-prepared-reader-runner.mjs';

const PROJECT = 'bbtcaurrtyoukvjbxbbj';
const MANAGED_URL = `https://${PROJECT}.supabase.co`;
export const PREPARED_QA_MIGRATION_PATHS = Object.freeze([
  'supabase/migrations/20261023100441_stats_prepared_charts_v1.sql',
  'supabase/migrations/20261023131347_stats_prepared_claim_membership_delete_predicate.sql',
]);
const ORIGINAL_MIGRATION_SHA256 = '286252e4620d906b21c2472a36773b45dbf3d6c42c6b5c44063e71ee65228fbd';
const RPC_NAMES = ['get_stats_prepared_health_v1', 'get_stats_prepared_platform_chart_v1',
  'get_stats_prepared_visit_share_v1', 'claim_stats_prepared_work_v1', 'run_stats_prepared_step_v1',
  'get_stats_prepared_receipt_v1', 'finish_stats_prepared_work_v1'];
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
const ident = value => { assert.match(value, /^[a-z][a-z0-9_]{0,62}$/); return value; };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const bigint = value => BigInt(String(value));
const percentage = (part, total) => total === 0n ? 0 : Math.round(Number(part) / Number(total) * 10000) / 100;
const DRIVE_MAX_STEPS = 6000, DRIVE_BUDGET_MS = 1_200_000;
const FIXTURE_BATCH_MAX_STEPS = 256, FIXTURE_BATCH_WORK_MS = 40_000, FIXTURE_BATCH_OUTER_MS = 60_000;
const MANAGEMENT_REQUEST_MS = 120_000;
const SLOW_CALL_MS = 1000, SLOW_CALL_LIMIT = 8;
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const STEP_PHASES = new Set(['platform-publish', 'hour', 'daily-start', 'daily-cleanup-wait',
  'daily-membership-restart', 'daily-complete', 'daily-batch', 'visit-totals',
  ...[1, 7, 14, 30, 90].map(days => `visit-range-${days}`), 'visit-publish', 'hour-backfill', 'unchanged', 'cleanup']);
const SQL_PHASES = new Set(['source-clone', 'migration-install', 'alias-read', 'alias-install',
  'alias-acl-timeout', 'claim-diagnostic-install', 'claim-diagnostic', 'fixture-drive-install',
  'fixture-drive', 'fixture-checks', 'cleanup', 'source-preflight', 'source-storage',
  'source-universes', 'source-current-index', 'source-daily', 'source-hourly-history',
  'source-hourly', 'source-counts', 'source-analyze', 'daily-diagnostic-install',
  'daily-diagnostic-reach', 'daily-diagnostic-probe', 'daily-diagnostic-state',
  ...READER_DIAGNOSTIC_PHASES]);
const PG_STATE_CLASSES = Object.freeze({ '53100': 'disk-full', '25006': 'read-only-transaction' });
const sqlstate = value => typeof value === 'string' && /^[A-Z0-9]{5}$/.test(value) ? value : null;
const rpcErrorCode = value => sqlstate(value) ??
  (typeof value === 'string' && /^PGRST[0-9]{3}$/.test(value) ? value : 'unknown');
const PG_ERROR_CLASSES = [
  ['21000', 'ON CONFLICT DO UPDATE command cannot affect row a second time', 'on-conflict-double-target'],
  ['21000', 'more than one row returned by a subquery used as an expression', 'scalar-subquery-many-rows'],
  // PostgREST also uses 21000/HTTP 400 for pg-safeupdate. This is not proof
  // of duplicate rows; require the complete primary message before naming it.
  ['21000', 'DELETE requires a WHERE clause', 'safeupdate-delete-without-where'],
  ['21000', 'UPDATE requires a WHERE clause', 'safeupdate-update-without-where'],
  ['P0003', 'query returned more than one row', 'plpgsql-too-many-rows'],
];

export function qaRpcErrorEnvelope(result) {
  // Inspect only known slots. Never copy values, arbitrary keys, lengths or
  // response headers into the receipt, even when the primary class is unknown.
  const shape = value => value === undefined ? 'absent' : value === null ? 'null' :
    Array.isArray(value) ? 'array' : ['string', 'object'].includes(typeof value) ? typeof value : 'other';
  return { root: shape(result), code: shape(result?.code), message: shape(result?.message),
    details: shape(result?.details), hint: shape(result?.hint), context: shape(result?.context),
    error: shape(result?.error), nestedCode: shape(result?.error?.code),
    nestedMessage: shape(result?.error?.message) };
}

function validateClaimLocation(location) {
  assert.match(location?.alias ?? '', /^qa_[a-f0-9]{12}_claim_sp_work_v1$/);
  assert.ok(Number.isSafeInteger(location.maxLine) && location.maxLine > 0 && location.maxLine <= 10000,
    'invalid claim definition line bound');
}

export function qaRpcFailureDiagnostic({ result, claimLocation }) {
  let code = sqlstate(result?.code) ?? sqlstate(result?.error?.code) ?? 'unknown';
  const messages = [result?.message, result?.error?.message, result?.error, result];
  const primaryMessages = [];
  for (const message of messages) {
    if (typeof message !== 'string') continue;
    const match = /^(?:Failed to run sql query: )?ERROR:\s+([A-Z0-9]{5}):[ \t]*([^\r\n]*)/.exec(message);
    if (match) {
      if (code === 'unknown') code = match[1];
      if (code === match[1]) primaryMessages.push(match[2]);
    } else primaryMessages.push(message);
  }
  const diagnostic = { sqlstate: code, errorClass: PG_STATE_CLASSES[code] ?? PG_ERROR_CLASSES.find(([state, message]) =>
    state === code && primaryMessages.includes(message))?.[2] ?? 'unknown' };
  if (claimLocation) {
    validateClaimLocation(claimLocation);
    // Only an exact frame for this run's known claim alias may supply a line.
    // Never retain a function name, statement text or the rest of CONTEXT.
    const frame = new RegExp(`^PL/pgSQL function (?:public[.])?${claimLocation.alias}[(]text,uuid[)] line ([1-9][0-9]{0,5}) at [^\\r\\n]+$`, 'm');
    for (const context of [result?.context, result?.details, result?.error?.context,
      result?.error?.details, ...messages]) {
      if (typeof context !== 'string') continue;
      const match = frame.exec(context);
      if (match && Number(match[1]) <= claimLocation.maxLine) {
        diagnostic.functionLine = Number(match[1]); break;
      }
    }
  }
  return diagnostic;
}

export function qaClaimProbeDiagnostic(result, location) {
  validateClaimLocation(location);
  const success = result?.errorClass === 'rolled-back-success' && result?.sqlstate === null;
  const code = sqlstate(result?.sqlstate);
  const known = PG_STATE_CLASSES[code] === result?.errorClass ||
    PG_ERROR_CLASSES.some(([state, , name]) => state === code && name === result?.errorClass);
  if (result?.rollbackVerified !== true || (!success && (!code || (!known && result?.errorClass !== 'unknown')))) {
    throw new Error('fixture-claim-diagnostic-invalid');
  }
  const diagnostic = { sqlstate: success ? null : code, errorClass: result.errorClass, rollbackVerified: true };
  if (Number.isSafeInteger(result.functionLine) && result.functionLine > 0 && result.functionLine <= location.maxLine) {
    diagnostic.functionLine = result.functionLine;
  }
  return diagnostic;
}

export function fixtureClaimDiagnosticSql(schema, privateSchema, location, requestId) {
  fixtureMigrationSql('', schema, privateSchema); validateClaimLocation(location);
  assert.equal(location.alias, `qa_${schema.slice(9)}_claim_sp_work_v1`);
  assert.match(requestId, /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
  // Claim can modify only these three owned tables. Compare their full values,
  // including revisions, timestamps and lease fields, across the subtransaction.
  const snapshot = `select jsonb_build_object(
    'control',(select jsonb_agg(to_jsonb(c) order by id) from ${schema}.stats_prepared_control c),
    'members',(select jsonb_agg(to_jsonb(m) order by universe_id) from ${schema}.stats_prepared_members m),
    'dirty',(select jsonb_agg(to_jsonb(d) order by kind,bucket) from ${schema}.stats_prepared_dirty d))`;
  const framePattern = `(?n)^PL/pgSQL function (?:public[.])?${location.alias}[(]text,uuid[)] line ([1-9][0-9]{0,5}) at [^\r\n]+$`;
  return {
    install: `begin;
create function ${privateSchema}.qa_claim_diagnostic_v1() returns jsonb
language plpgsql volatile security invoker set search_path='' set timezone='UTC'
set statement_timeout='5s' set lock_timeout='500ms' as $qa_claim$
declare before_state jsonb; after_state jsonb; diagnostic jsonb; claim_result jsonb;
  error_state text; error_message text; error_context text; frame text[];
begin
  ${snapshot} into before_state;
  begin
    claim_result:=public.${location.alias}('github-fixture',${literal(requestId)}::uuid);
    if claim_result->>'claimed' is distinct from 'true' then
      raise exception 'qa-claim-probe-unclaimed' using errcode='55000';
    end if;
    -- Force successful calls to roll back as well. This result is never a lease.
    raise exception using errcode='PZ001',message='qa-claim-probe-rollback';
  exception when others then
    get stacked diagnostics error_state=returned_sqlstate,error_message=message_text,error_context=pg_exception_context;
    if error_state='PZ001' and error_message='qa-claim-probe-rollback' then
      diagnostic:=jsonb_build_object('sqlstate',null,'errorClass','rolled-back-success');
    else
      diagnostic:=jsonb_build_object('sqlstate',error_state,'errorClass',case
        ${Object.entries(PG_STATE_CLASSES).map(([state, name]) => `when error_state=${literal(state)} then ${literal(name)}`).join('\n        ')}
        ${PG_ERROR_CLASSES.map(([state, message, name]) => `when error_state=${literal(state)} and error_message=${literal(message)} then ${literal(name)}`).join('\n        ')}
        else 'unknown' end);
      frame:=regexp_match(error_context,${literal(framePattern)});
      if frame[1] is not null and frame[1]::integer<=${location.maxLine} then
        diagnostic:=diagnostic||jsonb_build_object('functionLine',frame[1]::integer);
      end if;
    end if;
  end;
  ${snapshot} into after_state;
  if before_state is distinct from after_state then
    raise exception 'qa-claim-probe-state-changed' using errcode='55000';
  end if;
  return diagnostic||jsonb_build_object('rollbackVerified',true);
end $qa_claim$;
revoke all on function ${privateSchema}.qa_claim_diagnostic_v1() from public,anon,authenticated;
grant execute on function ${privateSchema}.qa_claim_diagnostic_v1() to service_role;
commit;`,
    // Real API failure remains the primary evidence. This separate SQL probe
    // uses the same alias and role, but is not another API success/timeout proof.
    probe: `begin; set local statement_timeout='5s'; set local lock_timeout='500ms';
set local role service_role;
select ${privateSchema}.qa_claim_diagnostic_v1() as result;
rollback;`,
  };
}

export function fixtureMigrationSql(bytes, schema, privateSchema) {
  assert.match(schema, /^qa_stats_[a-f0-9]{12}$/);
  assert.equal(privateSchema, `${schema}_p`);
  // Schema qualifiers/catalog literals move; the unquoted PUBLIC pseudorole
  // in REVOKE statements must retain its PostgreSQL meaning.
  return bytes.replaceAll('stats_prepared_private', privateSchema)
    .replaceAll('public.', `${schema}.`).replaceAll("'public'", literal(schema));
}

export function fixtureMigrationPlan(sources, schema, privateSchema) {
  assert.deepEqual(sources.map(source => source.path), PREPARED_QA_MIGRATION_PATHS,
    'exact ordered prepared migrations required');
  return sources.map(({ path, bytes }, index) => {
    assert.ok(Buffer.isBuffer(bytes), 'raw migration bytes required');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (index === 0) assert.equal(sha256, ORIGINAL_MIGRATION_SHA256, 'applied migration bytes must remain frozen');
    return { path, sha256, bytes: bytes.length,
      sql: fixtureMigrationSql(bytes.toString('utf8'), schema, privateSchema) };
  });
}

export async function replayFixtureMigrations(plan, install) {
  // Await each installation. Aliases may be read only after this whole replay
  // succeeds; a correction failure must never expose the original claim as QA.
  for (const { sql, ...receipt } of plan) await install(sql, receipt);
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
  const { errorClass } = qaRpcFailureDiagnostic({ result });
  if (errorClass !== 'unknown') diagnostic.errorClass = errorClass;
  return diagnostic;
}

export function qaReceiptWithPhases(identity, phases) {
  // Explicit cleanup is another process. Retain the original failure/timings
  // instead of replacing them with the cleanup request's single success.
  return { ...identity, phases: [...(identity.phases ?? []), ...phases] };
}

export function validateQaReaderSelection(eventName, event) {
  assert.equal(eventName, 'workflow_dispatch', 'manual reader diagnostic only');
  assert.equal(validatePreparedSelection(eventName, event).purpose,
    'stats_prepared_reader_diagnostic', 'explicit reader diagnostic selection required');
}

/** Adapt only the existing fully received Management transport; never retry. */
export function qaReaderSqlAdapter(sql, phases) {
  return async (query, phase) => {
    assert.ok(READER_DIAGNOSTIC_PHASES.includes(phase), 'unknown reader SQL phase');
    const before = phases.length;
    try {
      const rows = await sql(query, phase);
      const evidence = phases.length === before + 1 ? phases.at(-1) : null;
      if (evidence?.kind === 'sql' && evidence.phase === phase && evidence.ok === true &&
        Number.isInteger(evidence.status) && evidence.status >= 200 && evidence.status < 300 && Array.isArray(rows)) {
        return { ok: true, status: evidence.status, rows, requestComplete: true };
      }
    } catch { /* Provider/assertion details remain in the existing sanitized seam. */ }
    const evidence = phases.length === before + 1 && phases.at(-1)?.phase === phase ? phases.at(-1) : null;
    return { ok: false, status: Number.isInteger(evidence?.status) && evidence.status >= 100 && evidence.status <= 599
      ? evidence.status : null, failure: { sqlstate: sqlstate(evidence?.sqlstate) ?? 'unknown',
      errorClass: ['statement-timeout', 'user-cancel'].includes(evidence?.errorClass) ? evidence.errorClass : 'unknown' } };
  };
}

export function qaInterruptReaderDiagnostic(snapshot) {
  if (!snapshot) return;
  let interrupted = false;
  for (const attempt of snapshot.attempts ?? []) {
    if (attempt.status === 'pending') {
      interrupted = true;
      attempt.status = 'interrupted';
      // Cleanup proves owned-object removal, never the interrupted session's rollback.
      attempt.isolation = 'unknown';
    }
  }
  snapshot.completed = false; snapshot.acceptance = false;
  if (interrupted && snapshot.diagnostic?.status !== 'profiled') snapshot.diagnostic.status = 'interrupted';
}

export function qaReaderDefinitionProof(rows, migrations, schema, privateSchema) {
  fixtureMigrationSql('', schema, privateSchema);
  const prefix = `qa_${schema.slice(9)}_`;
  const expected = [...new Set(migrations.flatMap(({ sql }) => [...sql.matchAll(
    /create (?:or replace )?function ([a-z0-9_]+)[.]([a-z0-9_]+)[(]/g)].map(m => `${m[1]}.${m[2]}`)))];
  const aliases = RPC_NAMES.map(name => `public.${prefix}${name.replace('_stats_prepared_', '_sp_')}`);
  assert.deepEqual(rows.map(r => `${r.schema}.${r.name}`).sort(), [...expected, ...aliases].sort(),
    'reader-installed-function-inventory');
  for (const row of rows) {
    assert.ok(row.owner === 'postgres' && row.service_execute === true && row.anon_execute === false &&
      row.authenticated_execute === false && row.public_execute === false, 'reader-installed-function-acl');
    assert.equal(typeof row.definition, 'string', 'reader-installed-function-definition');
  }
  for (const name of RPC_NAMES) {
    const original = rows.find(r => r.schema === schema && r.name === name);
    const exposed = rows.find(r => r.schema === 'public' && r.name === prefix + name.replace('_stats_prepared_', '_sp_'));
    assert.equal(exposed.definition, original.definition.replace(`FUNCTION ${schema}.${name}(`,
      `FUNCTION public.${exposed.name}(`), 'reader-alias-definition-settings');
  }
  return rows.map(row => ({ schema: row.schema, name: row.name,
    definitionSha256: createHash('sha256').update(row.definition).digest('hex'), owner: row.owner,
    serviceOnly: true, aliasDefinitionSettingsVerified: row.schema === 'public' }));
}

export async function writeQaReceipt(receiptPath, receipt) {
  // Atomic replacement preserves the previous durable evidence on interruption.
  const pending = `${receiptPath}.pending`;
  const handle = await open(pending, 'w', 0o600);
  try { await handle.writeFile(JSON.stringify(receipt, null, 2)); await handle.sync(); }
  finally { await handle.close(); }
  await rename(pending, receiptPath);
}

export function qaSourceProgress(phase, first, last, rowsPerGame) {
  assert.ok(['source-universes', 'source-current-index', 'source-daily', 'source-hourly-history', 'source-hourly'].includes(phase));
  assert.ok([first, last, rowsPerGame].every(Number.isSafeInteger) && first > 0 && last >= first && rowsPerGame > 0);
  assert.ok(last <= 100_000 && rowsPerGame <= 4320, 'invalid source batch bounds');
  return { phase, firstUniverse: first, lastUniverse: last, expectedRows: (last - first + 1) * rowsPerGame };
}

export function qaStorageCheckpoint(rows) {
  assert.ok(Array.isArray(rows) && rows.length === 1, 'invalid source storage checkpoint');
  const row = rows[0];
  assert.ok(['on', 'off'].includes(row.defaultReadOnly) && ['on', 'off'].includes(row.transactionReadOnly));
  const result = { defaultReadOnly: row.defaultReadOnly, transactionReadOnly: row.transactionReadOnly };
  for (const key of ['databaseBytes', 'sourceBytes', 'sourceIndexBytes', 'preparedBytes', 'tempBytes', 'tempFiles']) {
    assert.match(row[key] ?? '', /^[0-9]{1,20}$/, 'invalid source storage byte counter'); result[key] = row[key];
  }
  return result;
}

export function fixtureDriveBatchSql(schema, privateSchema) {
  fixtureMigrationSql('', schema, privateSchema);
  // Fixture orchestration only: call the installed, unmodified advance function
  // with a fresh receipt UUID each time. Never write pending work or skip buckets.
  // One SELECT returns the entire batch; do not depend on Management API handling
  // of multiple SELECT result sets. The existing outer 60s deadline still wins.
  return `begin;
create function ${privateSchema}.qa_drive_batch_v1(p_token uuid,p_epoch bigint,p_steps integer,p_budget_ms integer,p_first_step uuid)
returns jsonb language plpgsql volatile security invoker set search_path='' set timezone='UTC' as $qa_drive$
declare started timestamptz:=clock_timestamp(); began timestamptz; outcome jsonb;
  outcomes jsonb:='[]'; maximum_ms numeric:=0; step_ms numeric; n integer; step_id uuid; pre_state jsonb;
begin
  if p_steps is null or p_steps not between 1 and ${FIXTURE_BATCH_MAX_STEPS}
    or p_budget_ms is null or p_budget_ms not between 1 and ${FIXTURE_BATCH_WORK_MS} or p_first_step is null then
    raise exception 'invalid-fixture-batch' using errcode='22023';
  end if;
  for n in 1..p_steps loop
    -- Leave room for another step using this batch's observed maximum and a
    -- 6s floor. The real outer deadline still cancels an unexpectedly slow call.
    exit when n>1 and extract(epoch from (clock_timestamp()-started))*1000
      +greatest(maximum_ms,6000)>=p_budget_ms;
    step_id:=case when n=1 then p_first_step else pg_catalog.gen_random_uuid() end;
    ${qaAdvanceStateSql(schema)} into pre_state;
    began:=clock_timestamp();
    outcome:=${schema}.run_stats_prepared_step_v1(p_token,p_epoch,step_id,'{"kind":"advance"}'::jsonb);
    step_ms:=extract(epoch from (clock_timestamp()-began))*1000;
    maximum_ms:=greatest(maximum_ms,step_ms);
    outcomes:=outcomes||jsonb_build_array(outcome||jsonb_build_object('stepId',step_id,'sqlMs',step_ms,'preState',pre_state));
    exit when outcome->'more'='false'::jsonb;
  end loop;
  ${qaAdvanceStateSql(schema)} into pre_state;
  return jsonb_build_object('results',outcomes,'sqlMs',extract(epoch from (clock_timestamp()-started))*1000,
    'maximumSqlStepMs',maximum_ms,'finalState',pre_state);
end $qa_drive$;
revoke all on function ${privateSchema}.qa_drive_batch_v1(uuid,bigint,integer,integer,uuid) from public,anon,authenticated;
grant execute on function ${privateSchema}.qa_drive_batch_v1(uuid,bigint,integer,integer,uuid) to service_role;
commit;`;
}

// Only a singleton control row and the unique building visit generation. No
// source scans/counts or payloads. This is context, not a prediction of which
// branch will run (publication probes and shared cleanup can also do work).
export function qaAdvanceStateSql(schema) {
  fixtureMigrationSql('', schema, `${schema}_p`);
  return `select jsonb_build_object('dailyScan',c.daily_scan,'dailyAfter',c.daily_after::text,
    'controlSteps',c.steps,'platformGeneration',c.active_platform,'visitGeneration',c.active_visit,
    'visitBuild',g.id,'visitAfter',g.after_id::text,'visitTotalsDone',g.totals_done)
    from ${schema}.stats_prepared_control c left join ${schema}.stats_prepared_generations g
      on g.product='visit' and g.status='building' where c.id`;
}

export const DAILY_DIAGNOSTIC_PROBES = Object.freeze(['whole-advance', 'daily-helper', 'daily-cte',
  'shared-cleanup', 'cleanup-generation-candidate', 'cleanup-version-candidate']);
const DAILY_STATE_TABLES = Object.freeze({
  stats_prepared_control: 'id', stats_prepared_members: 'universe_id', stats_prepared_dirty: 'kind,bucket',
  stats_prepared_versions: 'id', stats_prepared_buckets: 'kind,bucket', stats_prepared_visits: 'version,universe_id',
  stats_prepared_generations: 'id', stats_prepared_visit_universes: 'universe_id',
  stats_prepared_visit_totals: 'generation,universe_id', stats_prepared_visit_ranges: 'generation,days',
  stats_prepared_receipts: 'step_id', revalidation_events: 'entity_type,slug',
});
const DAILY_SOURCE_TABLES = Object.freeze({ roblox_universes: 'universe_id', stats_game_current_index: 'universe_id',
  roblox_universe_stats_hourly: 'universe_id,hour_start', roblox_universe_stats_daily: 'universe_id,stat_date' });
export const DAILY_LEASE_BUDGET = Object.freeze({ requestMs: MANAGEMENT_REQUEST_MS, controlMs: 12_000,
  stateMs: 12_000, marginMs: 5_000, totalMs: DRIVE_BUDGET_MS });
const DAILY_PLAN_RELATIONS = new Set([...Object.keys(DAILY_STATE_TABLES), 'roblox_universes',
  'stats_game_current_index', 'roblox_universe_stats_hourly', 'roblox_universe_stats_daily']);
const DAILY_PLAN_NODES = new Set(['Result', 'ProjectSet', 'ModifyTable', 'Append', 'Merge Append', 'Recursive Union',
  'BitmapAnd', 'BitmapOr', 'Seq Scan', 'Sample Scan', 'Gather', 'Gather Merge', 'Index Scan', 'Index Only Scan',
  'Bitmap Index Scan', 'Bitmap Heap Scan', 'Tid Scan', 'Tid Range Scan', 'Subquery Scan', 'Function Scan',
  'Table Function Scan', 'Values Scan', 'CTE Scan', 'Named Tuplestore Scan', 'WorkTable Scan', 'Foreign Scan',
  'Custom Scan', 'Nested Loop', 'Merge Join', 'Hash Join', 'Materialize', 'Memoize', 'Sort', 'Incremental Sort',
  'Group', 'Aggregate', 'WindowAgg', 'Unique', 'SetOp', 'LockRows', 'Limit', 'Hash']);
const DAILY_PLAN_NUMBERS = ['Startup Cost', 'Total Cost', 'Plan Rows', 'Plan Width', 'Actual Startup Time',
  'Actual Total Time', 'Actual Rows', 'Actual Loops', 'Rows Removed by Filter', 'Rows Removed by Join Filter',
  'Rows Removed by Index Recheck', 'Heap Fetches', 'Shared Hit Blocks', 'Shared Read Blocks', 'Shared Dirtied Blocks',
  'Shared Written Blocks', 'Local Hit Blocks', 'Local Read Blocks', 'Local Dirtied Blocks', 'Local Written Blocks',
  'Temp Read Blocks', 'Temp Written Blocks', 'I/O Read Time', 'I/O Write Time', 'Shared I/O Read Time',
  'Shared I/O Write Time', 'Local I/O Read Time', 'Local I/O Write Time', 'Temp I/O Read Time', 'Temp I/O Write Time',
  'WAL Records', 'WAL FPI', 'WAL Bytes', 'Sort Space Used', 'Hash Buckets', 'Original Hash Buckets',
  'Hash Batches', 'Original Hash Batches', 'Peak Memory Usage', 'Disk Usage', 'HashAgg Batches',
  'Planned Partitions', 'Tuples Inserted', 'Conflicting Tuples', 'Workers Planned', 'Workers Launched'];

// Positive field projection: plans can contain source values, SQL, arbitrary
// expressions, function arguments, settings paths and provider strings. None of
// those are receipt fields. Unknown labels become fixed tags, never copied text.
export function qaDailyPlanSummary(plan, schema) {
  fixtureMigrationSql('', schema, `${schema}_p`);
  assert.ok(Array.isArray(plan) && plan.length === 1 && plan[0]?.Plan, 'invalid-daily-plan');
  assert.ok(['Execution Time'].every(key => Number.isFinite(plan[0][key]) && plan[0][key] >= 0) &&
    ['Actual Rows', 'Actual Loops', 'Actual Total Time'].every(key =>
      Number.isFinite(plan[0].Plan[key]) && plan[0].Plan[key] >= 0), 'daily-plan-missing-analyze');
  let count = 0;
  const numbers = (input, fields) => Object.fromEntries(fields.filter(key =>
    typeof input?.[key] === 'number' && Number.isFinite(input[key]) && input[key] >= 0).map(key => [key, input[key]]));
  const relation = value => DAILY_PLAN_RELATIONS.has(value) ? value : 'other';
  const node = (input, depth = 0) => {
    assert.ok(input && typeof input === 'object' && !Array.isArray(input) && depth <= 64 && ++count <= 512, 'daily-plan-too-large');
    const output = { node: DAILY_PLAN_NODES.has(input['Node Type']) ? input['Node Type'] : 'other',
      ...numbers(input, DAILY_PLAN_NUMBERS) };
    if (input['Relation Name'] !== undefined) output.relation = relation(input['Relation Name']);
    if (input['Schema'] !== undefined) output.schema = input.Schema === schema ? 'owned' : 'other';
    if (input['Index Name'] !== undefined) {
      // Only fixed names on the known prepared tables and cloned source tables.
      const known = [...DAILY_PLAN_RELATIONS].flatMap(name => [name + '_pkey', name + '_universe_id_stat_date_idx',
        name + '_universe_id_stat_date_key']);
      known.push('stats_prepared_versions_scan', 'stats_prepared_one_build', 'stats_prepared_receipts_time');
      output.index = known.includes(input['Index Name']) ? input['Index Name'] : 'other';
    }
    for (const key of ['CTE Name', 'Subplan Name']) {
      const labels = ['source', 'contributions', 'universe_registry', 'sums'];
      const label = key === 'Subplan Name' && typeof input[key] === 'string' ? input[key].replace(/^CTE /, '') : input[key];
      if (input[key] !== undefined) output[key] = labels.includes(label) ? label : 'other';
    }
    for (const [key, values] of Object.entries({ 'Parent Relationship': ['Outer', 'Inner', 'SubPlan', 'InitPlan', 'Member'],
      'Join Type': ['Inner', 'Left', 'Right', 'Full', 'Semi', 'Anti'], 'Strategy': ['Plain', 'Sorted', 'Hashed', 'Mixed'],
      'Operation': ['Insert', 'Update', 'Delete', 'Merge'], 'Sort Method': ['quicksort', 'top-N heapsort', 'external merge', 'external sort'],
      'Sort Space Type': ['Memory', 'Disk'] })) {
      if (input[key] !== undefined) output[key] = values.includes(input[key]) ? input[key] : 'other';
    }
    if (Array.isArray(input.Plans)) output.plans = input.Plans.map(child => node(child, depth + 1));
    if (Array.isArray(input.Workers)) {
      assert.ok(input.Workers.length <= 32, 'daily-plan-too-many-workers');
      output.workers = input.Workers.map(worker => numbers(worker, ['Worker Number', ...DAILY_PLAN_NUMBERS]));
    }
    return output;
  };
  const root = plan[0];
  const summary = { ...numbers(root, ['Planning Time', 'Execution Time']), plan: node(root.Plan),
    triggers: [], settings: {} };
  if (root.Planning) summary.planning = numbers(root.Planning, DAILY_PLAN_NUMBERS);
  if (root.JIT) {
    summary.jit = { ...numbers(root.JIT, ['Functions']),
      timing: numbers(root.JIT.Timing, ['Generation', 'Inlining', 'Optimization', 'Emission', 'Total']), options: {} };
    for (const key of ['Inlining', 'Optimization', 'Expressions', 'Deforming']) {
      if (typeof root.JIT.Options?.[key] === 'boolean') summary.jit.options[key] = root.JIT.Options[key];
    }
  }
  assert.ok(!root.Triggers || Array.isArray(root.Triggers) && root.Triggers.length <= 64, 'invalid-daily-triggers');
  for (const trigger of root.Triggers ?? []) summary.triggers.push({ relation: relation(trigger.Relation),
    kind: /^RI_ConstraintTrigger_[ac]_[0-9]+$/.test(trigger['Trigger Name'] ?? '') ? 'foreign-key' : 'other',
    ...numbers(trigger, ['Time', 'Calls']) });
  // Numeric/unit settings only. No raw Settings map, search_path or plan text.
  for (const key of ['work_mem', 'hash_mem_multiplier', 'effective_cache_size', 'random_page_cost',
    'seq_page_cost', 'max_parallel_workers_per_gather', 'jit', 'track_io_timing', 'plan_cache_mode']) {
    const value = root.Settings?.[key];
    if (typeof value === 'string' && /^(?:[0-9]+(?:[.][0-9]+)?(?:kB|MB|GB)?|on|off|auto|force_generic_plan|force_custom_plan)$/.test(value)) summary.settings[key] = value;
  }
  return summary;
}

export function fixtureDailyDiagnosticSql(bytes, schema, privateSchema) {
  fixtureMigrationSql('', schema, privateSchema);
  assert.ok(Buffer.isBuffer(bytes));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), ORIGINAL_MIGRATION_SHA256,
    'daily diagnostic requires exact immutable source');
  const source = bytes.toString('utf8');
  const body = name => {
    const start = source.indexOf(`create function stats_prepared_private.stats_prepared_${name}_v1()`);
    assert.ok(start >= 0);
    const end = source.indexOf('end $$;', start);
    assert.ok(end > start);
    return source.slice(start, end + 'end $$;'.length);
  };
  const daily = body('daily'), cleanup = body('cleanup');
  const cteStart = daily.indexOf(' with source as materialized ('), cteEnd = daily.indexOf(' from sums s where v.id=s.version;');
  assert.ok(cteStart > 0 && cteEnd > cteStart);
  const exactCte = daily.slice(cteStart, cteEnd + ' from sums s where v.id=s.version;'.length);
  const candidate = (first, last) => {
    const start = cleanup.indexOf(first), end = cleanup.indexOf(last, start);
    assert.ok(start > 0 && end > start);
    return cleanup.slice(start, end + last.length);
  };
  const generation = candidate(' select id into gid from', ' order by created_at limit 1;').replace('select id into gid', 'select id');
  const version = candidate(' select v.id into vid from', ' order by v.created_at limit 1;').replace('select v.id into vid', 'select v.id');
  const parameterize = query => fixtureMigrationSql(query, schema, privateSchema)
    .replace(/\bc[.]daily_scan\b/g, '$4').replace(/\bc[.]active_platform\b/g, '$5')
    .replace(/\bc[.]previous_platform\b/g, '$6').replace(/\bc[.]active_visit\b/g, '$7')
    .replace(/\bc[.]previous_visit\b/g, '$8').replace(/\bids\b/g, '$1')
    .replace(/\blow_date\b/g, '$2').replace(/\bhigh_date\b/g, '$3');
  const queries = [
    `select ${schema}.run_stats_prepared_step_v1($9,$10,$11,'{"kind":"advance"}'::jsonb)`,
    `select ${privateSchema}.stats_prepared_daily_v1()`, parameterize(exactCte),
    `select ${privateSchema}.stats_prepared_cleanup_v1()`, parameterize(generation), parameterize(version),
  ];
  const snapshot = `select jsonb_build_object('utcHour',extract(epoch from date_trunc('hour',now())),
    'tables',jsonb_build_object(${Object.entries(DAILY_STATE_TABLES).map(([table, keys]) => `${literal(table)},
      (select jsonb_build_object('rows',count(*),'digest',md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by ${keys}),'')))
       from ${schema}.${table} t)`).join(',\n')}))`;
  // NONACCEPTANCE diagnostic only. The CTE and candidate SELECTs are extracted
  // byte-for-byte from the frozen migration, then schema-qualified and bound to
  // typed USING parameters. EXECUTE replans with current values (custom-plan
  // behavior); this does not establish a cached/generic PL/pgSQL plan or HTTP SLA.
  return { cteSha256: createHash('sha256').update(exactCte).digest('hex'),
    install: `begin;
create function ${privateSchema}.qa_daily_state_v1() returns jsonb language sql volatile security invoker
set search_path='' set timezone='UTC' as $qa_state$ ${snapshot} $qa_state$;
create function ${privateSchema}.qa_daily_probe_v1(p_probe text,p_after bigint,p_token uuid,p_epoch bigint,p_step uuid)
returns jsonb language plpgsql volatile security invoker set search_path='' set timezone='UTC' as $qa_probe$
declare before_state jsonb; after_state jsonb; c ${schema}.stats_prepared_control;
  ids bigint[]; low_date date; high_date date; query text; plan jsonb; error_state text; error_message text;
begin
  if p_probe not in (${DAILY_DIAGNOSTIC_PROBES.map(literal)}) or p_probe is null
    or p_after not in (0,256) or p_after is null or p_step is null then
    raise exception 'invalid-daily-probe' using errcode='22023';
  end if;
  select * into c from ${schema}.stats_prepared_control where id for update;
  if c.daily_scan is null or c.daily_after<>p_after or c.lease_token is distinct from p_token
    or c.lease_epoch is distinct from p_epoch or c.lease_until<=clock_timestamp() then
    raise exception 'daily-probe-wrong-state' using errcode='55000';
  end if;
  select array_agg(universe_id order by universe_id) into ids from
    (select universe_id from ${schema}.roblox_universes where universe_id>c.daily_after order by universe_id limit 256) u;
  if cardinality(ids) is distinct from 256 then raise exception 'daily-probe-wrong-chunk' using errcode='55000'; end if;
  select min(bucket)::date,max(bucket)::date into low_date,high_date
    from ${schema}.stats_prepared_versions where scan=c.daily_scan and status='building';
  if low_date is null or high_date is null then raise exception 'daily-probe-no-building-dates' using errcode='55000'; end if;
  query:=case p_probe ${DAILY_DIAGNOSTIC_PROBES.map((probe, i) => `when ${literal(probe)} then ${literal(queries[i])}`).join('\n')} end;
  before_state:=${privateSchema}.qa_daily_state_v1();
  begin
    execute 'EXPLAIN (ANALYZE,BUFFERS,WAL,SETTINGS,FORMAT JSON) '||query into plan
      using ids,low_date,high_date,c.daily_scan,c.active_platform,c.previous_platform,c.active_visit,c.previous_visit,p_token,p_epoch,p_step;
    if p_probe='whole-advance' and (select outcome->>'phase' from ${schema}.stats_prepared_receipts where step_id=p_step)
      is distinct from 'daily-batch' then raise exception 'daily-probe-wrong-phase' using errcode='55000'; end if;
    if p_probe in ('whole-advance','daily-helper') and (select daily_after from ${schema}.stats_prepared_control where id)
      is distinct from ids[256] then raise exception 'daily-probe-wrong-cursor' using errcode='55000'; end if;
    raise exception using errcode='PZ002',message='daily-probe-rollback';
  exception when query_canceled or others then
    get stacked diagnostics error_state=returned_sqlstate,error_message=message_text;
    if error_state='PZ002' and error_message='daily-probe-rollback' then error_state:=null;
    else plan:=null; end if;
  end;
  after_state:=${privateSchema}.qa_daily_state_v1();
  if before_state is distinct from after_state then raise exception 'daily-probe-state-changed' using errcode='55000'; end if;
  return jsonb_build_object('plan',plan,'sqlstate',error_state,'rollbackVerified',true,'beforeState',before_state,
    'dailyAfter',c.daily_after::text,'chunkIds',cardinality(ids),'ioTimingEnabled',current_setting('track_io_timing')='on');
end $qa_probe$;
revoke all on function ${privateSchema}.qa_daily_state_v1() from public,anon,authenticated;
revoke all on function ${privateSchema}.qa_daily_probe_v1(text,bigint,uuid,bigint,uuid) from public,anon,authenticated;
grant execute on function ${privateSchema}.qa_daily_state_v1() to service_role;
grant execute on function ${privateSchema}.qa_daily_probe_v1(text,bigint,uuid,bigint,uuid) to service_role;
commit;`,
    // Restored subtransaction is verified before returning, outer ROLLBACK also
    // covers locks and any future helper changes. Only the helper returns data.
    probe: (probe, after, token, epoch, step) => {
      assert.ok(DAILY_DIAGNOSTIC_PROBES.includes(probe) && [0, 256].includes(after));
      assert.match(token, UUID); assert.match(step, UUID); assert.match(String(epoch), /^[1-9][0-9]{0,18}$/);
      return `begin; set local statement_timeout='100s'; set local lock_timeout='500ms'; set local role service_role;
select ${privateSchema}.qa_daily_probe_v1(${literal(probe)},${after},${literal(token)},${literal(epoch)},${literal(step)}) as result;
rollback;`;
    },
    // A new full baseline per lease. Only normal finish/claim deltas may differ
    // across it; source rows and every other prepared row remain fingerprinted.
    boundary: (finished = null) => {
      if (finished) { assert.match(finished.leaseToken, UUID); assert.match(String(finished.epoch), /^[1-9][0-9]{0,18}$/); }
      const token = finished ? `${literal(finished.leaseToken)}::uuid` : 'null::uuid';
      const epoch = finished ? `${literal(finished.epoch)}::bigint` : 'null::bigint';
      return `select jsonb_build_object('full',(${snapshot}),
        'dbNow',clock_timestamp(),'source',jsonb_build_object(${Object.entries(DAILY_SOURCE_TABLES).map(([table, keys]) => `${literal(table)},
          (select jsonb_build_object('rows',count(*),'digest',md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by ${keys}),'')))
           from ${schema}.${table} t)`).join(',\n')}),
        'fixedControl',md5((to_jsonb(c)-array['lease_token','lease_epoch','lease_until','lease_request','worker_id',
          'checked_at','success_at','error_code','failures','retry_at'])::text),
        'leaseToken',c.lease_token,'epoch',c.lease_epoch::text,'expiresAt',c.lease_until,'requestId',c.lease_request,
        'worker',c.worker_id,'checkedAt',c.checked_at,'successAt',c.success_at,
        'failures',c.failures,'errorCode',c.error_code,'retryAt',c.retry_at,
        'dailyScan',c.daily_scan,'dailyAfter',c.daily_after::text,'steps',c.steps,
        'dueHour',exists(select 1 from ${schema}.stats_prepared_dirty where kind='h' and bucket>=now()-interval '48 hours'),
        'chunk',(select jsonb_build_object('rows',count(*),'digest',md5(coalesce(string_agg(universe_id::text,',' order by universe_id),'')))
          from (select universe_id from ${schema}.roblox_universes where universe_id>c.daily_after order by universe_id limit 256) u),
        'retainedReceipts',(select jsonb_build_object('rows',count(*),'digest',md5(coalesce(string_agg(md5(to_jsonb(r)::text),'' order by step_id),'')))
          from ${schema}.stats_prepared_receipts r where step_id is distinct from ${token}),
        'expectedFinish',exists(select 1 from ${schema}.stats_prepared_receipts r where r.step_id=${token}
          and r.lease_token=${token} and r.epoch=${epoch} and r.outcome=jsonb_build_object('status','yielded','code',null,
            'remainingBuckets',(select count(*) from ${schema}.stats_prepared_dirty),'dailyScan',c.daily_scan,
            'dailyAfter',c.daily_after::text,'steps',c.steps,
            'visitStage',(select id from ${schema}.stats_prepared_generations where product='visit' and status='building')))) as result
        from ${schema}.stats_prepared_control c where c.id;`;
    } };
}

export function qaDailyProbeResult(result, schema, after) {
  const invalid = () => { throw new Error('invalid-daily-probe-result'); };
  if (![0, 256].includes(after) || result?.rollbackVerified !== true || result.dailyAfter !== String(after) ||
    result.chunkIds !== 256 || typeof result.ioTimingEnabled !== 'boolean') invalid();
  const beforeState = { utcHour: result.beforeState?.utcHour, tables: {} };
  if (!Number.isSafeInteger(beforeState.utcHour) || beforeState.utcHour <= 0) invalid();
  for (const table of Object.keys(DAILY_STATE_TABLES)) {
    const row = result.beforeState?.tables?.[table];
    if (!Number.isSafeInteger(row?.rows) || row.rows < 0 || typeof row.digest !== 'string' || !/^[a-f0-9]{32}$/.test(row.digest)) invalid();
    beforeState.tables[table] = { rows: row.rows, digest: row.digest };
  }
  const code = result.sqlstate === null ? null : sqlstate(result.sqlstate);
  if (result.sqlstate !== null && !code) invalid();
  return { rollbackVerified: true, dailyAfter: String(after), chunkIds: 256, beforeState,
    ioTimingEnabled: result.ioTimingEnabled, sqlstate: code,
    ...(code === null ? { summary: qaDailyPlanSummary(result.plan, schema) } : {}) };
}

export function qaDailyBoundaryResult(value) {
  const valid = ok => assert.ok(ok, 'invalid-daily-boundary');
  const fingerprint = row => {
    valid(Number.isSafeInteger(row?.rows) && row.rows >= 0 && typeof row.digest === 'string' && /^[a-f0-9]{32}$/.test(row.digest));
    return { rows: row.rows, digest: row.digest };
  };
  valid(Number.isSafeInteger(value?.full?.utcHour) && value.full.utcHour > 0);
  const full = { utcHour: value.full.utcHour, tables: {} }, source = {};
  for (const table of Object.keys(DAILY_STATE_TABLES)) full.tables[table] = fingerprint(value.full.tables?.[table]);
  for (const table of Object.keys(DAILY_SOURCE_TABLES)) source[table] = fingerprint(value.source?.[table]);
  valid(typeof value.fixedControl === 'string' && /^[a-f0-9]{32}$/.test(value.fixedControl));
  for (const key of ['leaseToken', 'requestId']) valid(UUID.test(value[key] ?? ''));
  valid(value.dailyScan === null || UUID.test(value.dailyScan ?? ''));
  valid(typeof value.epoch === 'string' && /^[1-9][0-9]{0,18}$/.test(value.epoch) &&
    typeof value.dailyAfter === 'string' && /^(0|[1-9][0-9]{0,18})$/.test(value.dailyAfter));
  for (const key of ['dbNow', 'expiresAt', 'checkedAt']) valid(typeof value[key] === 'string' && Number.isFinite(Date.parse(value[key])));
  valid(value.successAt === null || typeof value.successAt === 'string' && Number.isFinite(Date.parse(value.successAt)));
  valid(value.worker === 'github-fixture' && value.failures === 0 && value.errorCode === null && value.retryAt === null);
  valid(Number.isSafeInteger(value.steps) && value.steps >= 0 && typeof value.dueHour === 'boolean' && typeof value.expectedFinish === 'boolean');
  return { full, source, fixedControl: value.fixedControl, leaseToken: value.leaseToken, epoch: value.epoch,
    expiresAt: value.expiresAt, requestId: value.requestId, worker: value.worker, checkedAt: value.checkedAt,
    successAt: value.successAt, dbNow: value.dbNow, dailyScan: value.dailyScan, dailyAfter: value.dailyAfter,
    steps: value.steps, dueHour: value.dueHour, chunk: fingerprint(value.chunk),
    retainedReceipts: fingerprint(value.retainedReceipts), expectedFinish: value.expectedFinish };
}

export function qaInterruptDailyDiagnostic(diagnostic) {
  if (!diagnostic) return;
  if (diagnostic.pending?.status === 'pending') {
    diagnostic.pending.status = 'interrupted';
    for (const attempt of diagnostic.requests ?? []) {
      if (attempt.requestId === diagnostic.pending.requestId) attempt.status = 'interrupted';
    }
    for (const attempt of [...(diagnostic.probes ?? []), ...(diagnostic.advances ?? [])]) {
      if (diagnostic.pending.stepId && attempt.stepId === diagnostic.pending.stepId && attempt.status === 'pending') attempt.status = 'interrupted';
    }
  }
  if (['pending', 'running'].includes(diagnostic.status)) diagnostic.status = 'interrupted';
}

/** Pure orchestration seam: the CLI supplies bounded real requests; tests supply clocks/control stubs. */
export async function qaRunDailyDiagnostic({ diagnostic, requests, save, uuid = randomUUID,
  clock = { mono: () => performance.now(), wall: () => Date.now() } }) {
  const limits = DAILY_LEASE_BUDGET, started = clock.mono(), wallStarted = clock.wall();
  let previousMono = started, claim, deadline, current, sourceBaseline, hourBaseline, membersBaseline;
  Object.assign(diagnostic, { status: 'running', acceptance: false, requests: [], probes: [], advances: [], leases: [],
    comparison: 'new-full-baseline-per-lease-only-verified-finish-claim-deltas',
    leaseSchedule: 'one-probe-per-fresh-normal-claim', limits });
  const now = () => {
    const mono = clock.mono(), wall = clock.wall();
    assert.ok(Number.isFinite(mono) && mono >= previousMono && Number.isFinite(wall) &&
      Math.abs((wall - wallStarted) - (mono - started)) <= 1000, 'daily-diagnostic-clock-drift');
    previousMono = mono; return mono;
  };
  const admission = reserve => assert.ok(now() - started + reserve <= limits.totalMs, 'bounded-daily-diagnostic-incomplete');
  const call = async (kind, cap, body, metadata = {}) => {
    admission(cap);
    const attempt = { requestId: uuid(), kind, status: 'pending', startedMs: now() - started, ...metadata };
    diagnostic.requests.push(attempt); diagnostic.pending = attempt;
    await save(); admission(['probe', 'advance'].includes(kind) ? workReserve : cap);
    if (['probe', 'advance'].includes(kind)) leaseReserve(workReserve);
    if (kind === 'finish') leaseReserve(limits.controlMs + limits.marginMs);
    if (kind === 'state') leaseReserve(limits.stateMs + limits.controlMs + limits.marginMs);
    const sent = now();
    try {
      const result = await body(attempt);
      attempt.ms = now() - sent;
      assert.ok(attempt.ms <= cap, 'daily-diagnostic-request-budget');
      attempt.status = 'completed'; delete diagnostic.pending; await save(); return result;
    } catch (error) {
      attempt.status = 'failed'; attempt.failure = 'daily-diagnostic-request-failed';
      diagnostic.pending = attempt; await save(); throw error;
    }
  };
  const leaseReserve = reserve => assert.ok(deadline - now() >= reserve, 'daily-diagnostic-lease-reserve');
  const setLease = value => {
    assert.ok(value?.claimed === true && UUID.test(value.leaseToken ?? '') &&
      /^[1-9][0-9]{0,18}$/.test(value.epoch) && Number.isFinite(Date.parse(value.expiresAt)), 'daily-diagnostic-claim-invalid');
    // Actual returned expiry, conservatively mapped onto the monotonic clock.
    assert.ok(Date.parse(value.expiresAt) - clock.wall() <= 240_000 + limits.marginMs, 'daily-diagnostic-claim-clock-drift');
    claim = { leaseToken: value.leaseToken, epoch: value.epoch, expiresAt: value.expiresAt, requestId: value.requestId };
    deadline = now() + Date.parse(claim.expiresAt) - clock.wall() - limits.marginMs;
  };
  const claimFresh = async () => {
    const value = await call('claim', limits.controlMs, async attempt => ({ ...await requests.claim(attempt.requestId), requestId: attempt.requestId }));
    setLease(value);
  };
  const checkState = value => {
    assert.ok(Math.abs(Date.parse(value.dbNow) - clock.wall()) <= limits.stateMs + limits.marginMs, 'daily-diagnostic-server-clock-drift');
    assert.equal(value.full.utcHour, Math.floor(clock.wall() / 3_600_000) * 3600, 'daily-diagnostic-hour-drift');
    hourBaseline ??= value.full.utcHour; sourceBaseline ??= value.source; membersBaseline ??= value.full.tables.stats_prepared_members;
    assert.equal(value.full.utcHour, hourBaseline, 'daily-diagnostic-hour-drift');
    assert.deepEqual(value.source, sourceBaseline, 'daily-diagnostic-source-drift');
    assert.deepEqual(value.full.tables.stats_prepared_members, membersBaseline, 'daily-diagnostic-members-drift');
    for (const [table, count] of Object.entries({ roblox_universes: 1105, stats_game_current_index: 2,
      roblox_universe_stats_daily: 100555, roblox_universe_stats_hourly: 8640 })) assert.equal(value.source[table].rows, count, 'daily-diagnostic-source-count');
    assert.equal(value.full.tables.stats_prepared_members.rows, 2, 'daily-diagnostic-members-count');
    assert.equal(value.leaseToken, claim.leaseToken, 'daily-diagnostic-lease-drift');
    assert.equal(value.epoch, claim.epoch, 'daily-diagnostic-epoch-drift');
    assert.equal(value.requestId, claim.requestId, 'daily-diagnostic-request-drift');
    assert.equal(Date.parse(value.expiresAt), Date.parse(claim.expiresAt), 'daily-diagnostic-expiry-drift');
    assert.ok(Date.parse(value.checkedAt) <= Date.parse(value.dbNow), 'daily-diagnostic-control-time-drift');
    return value;
  };
  const readState = async (finished = null) => checkState(await call('state', limits.stateMs,
    () => requests.state(finished), { lease: { ...claim } }));
  const finish = async () => {
    leaseReserve(limits.controlMs + limits.marginMs);
    const old = { ...claim };
    const result = await call('finish', limits.controlMs, () => requests.finish(old), { lease: old, outcome: 'yielded' });
    assert.equal(result?.status, 'yielded', 'daily-diagnostic-finish-invalid');
    assert.equal(result.dailyScan, current.dailyScan, 'daily-diagnostic-finish-scan-drift');
    assert.equal(result.dailyAfter, current.dailyAfter, 'daily-diagnostic-finish-cursor-drift');
    assert.equal(result.steps, current.steps, 'daily-diagnostic-finish-steps-drift');
    return old;
  };
  const rotate = async () => {
    // Reserve the entire control/state sequence before releasing the live lease.
    admission(2 * limits.controlMs + limits.stateMs);
    const before = current, old = await finish();
    await claimFresh(); const after = await readState(old);
    assert.notEqual(claim.leaseToken, old.leaseToken, 'daily-diagnostic-claim-replayed');
    assert.equal(BigInt(claim.epoch), BigInt(old.epoch) + 1n, 'daily-diagnostic-epoch-drift');
    assert.equal(after.fixedControl, before.fixedControl, 'daily-diagnostic-control-drift');
    assert.equal(after.dailyScan, before.dailyScan, 'daily-diagnostic-scan-drift');
    assert.equal(after.dailyAfter, before.dailyAfter, 'daily-diagnostic-cursor-drift');
    assert.deepEqual(after.chunk, before.chunk, 'daily-diagnostic-chunk-drift');
    for (const table of Object.keys(DAILY_STATE_TABLES).filter(table => !['stats_prepared_control', 'stats_prepared_receipts'].includes(table))) {
      assert.deepEqual(after.full.tables[table], before.full.tables[table], 'daily-diagnostic-prepared-drift');
    }
    assert.equal(after.expectedFinish, true, 'daily-diagnostic-finish-receipt-invalid');
    assert.deepEqual(after.retainedReceipts, before.full.tables.stats_prepared_receipts, 'daily-diagnostic-existing-receipts-drift');
    assert.equal(after.full.tables.stats_prepared_receipts.rows, before.full.tables.stats_prepared_receipts.rows + 1, 'daily-diagnostic-receipt-count-drift');
    assert.ok(Date.parse(after.successAt) >= Date.parse(before.dbNow) && Date.parse(after.successAt) <= Date.parse(after.dbNow) &&
      Date.parse(after.checkedAt) >= Date.parse(after.successAt) && Date.parse(after.checkedAt) <= Date.parse(after.dbNow), 'daily-diagnostic-control-time-drift');
    current = after;
    diagnostic.leases.push({ ...claim, baseline: after.full, source: after.source, fixedControl: after.fixedControl,
      expectedDeltas: { control: 'normal-yielded-finish-and-new-claim', receipt: old.leaseToken },
      crossLeasePreparedAndSourceVerified: true });
    await save();
  };
  const workReserve = limits.requestMs + limits.stateMs + limits.controlMs + limits.marginMs;
  const advance = async () => {
    assert.ok(diagnostic.advances.length < DRIVE_MAX_STEPS, 'bounded-daily-diagnostic-incomplete');
    if (deadline - now() < workReserve) await rotate();
    leaseReserve(workReserve); admission(workReserve);
    const attempt = { stepId: uuid(), status: 'pending', dailyAfter: current.dailyAfter };
    diagnostic.advances.push(attempt); await save();
    const result = await call('advance', limits.requestMs, () => requests.advance(claim, attempt.stepId), { stepId: attempt.stepId, lease: { ...claim } });
    Object.assign(attempt, { status: 'completed', outcome: result });
    // Committed advances legitimately renew the lease. Read its actual expiry;
    // never infer a new 240-second lease from completion time.
    const updated = await call('state', limits.stateMs, () => requests.state());
    setLease({ claimed: true, ...claim, expiresAt: updated.expiresAt });
    current = checkState(updated);
    await save(); return result;
  };
  try {
    await save(); await claimFresh(); current = await readState();
    let outcome;
    do { outcome = await advance(); assert.equal(outcome.more, true, 'daily-start-not-reached'); }
    while (outcome.phase !== 'daily-start');
    for (const after of [0, 256]) {
      assert.ok(current.dailyScan && current.dailyAfter === String(after), 'daily-diagnostic-cursor-drift');
      assert.ok(current.steps < 24, 'daily-diagnostic-unexpected-publication-turn');
      if (current.steps % 4 === 0 && current.dueHour) {
        const scan = current.dailyScan;
        assert.equal((await advance()).phase, 'hour');
        assert.equal(current.dailyAfter, String(after)); assert.equal(current.dailyScan, scan);
      }
      const groupBaseline = current;
      for (const probe of DAILY_DIAGNOSTIC_PROBES) {
        await rotate(); leaseReserve(workReserve); admission(workReserve);
        assert.equal(current.fixedControl, groupBaseline.fixedControl, 'daily-diagnostic-control-drift');
        const baseline = current.full;
        const attempt = { probe, dailyAfter: String(after), stepId: uuid(), status: 'pending', lease: { ...claim },
          baseline: 'new-full-baseline-for-this-lease', leaseIndex: diagnostic.leases.length - 1 };
        diagnostic.probes.push(attempt); await save();
        const evidence = await call('probe', limits.requestMs, () => requests.probe(probe, after, claim, attempt.stepId),
          { probe, dailyAfter: String(after), stepId: attempt.stepId, lease: { ...claim } });
        Object.assign(attempt, evidence);
        assert.deepEqual(evidence.beforeState, baseline, 'daily-probe-prestate-drift');
        assert.equal(evidence.rollbackVerified, true, 'daily-probe-rollback-unverified');
        assert.equal(evidence.sqlstate, null, 'daily-probe-failed-see-receipt');
        const next = await readState();
        assert.deepEqual(next.full, baseline, 'daily-probe-poststate-drift');
        assert.equal(next.fixedControl, current.fixedControl, 'daily-diagnostic-control-drift');
        current = next; attempt.status = 'profiled'; attempt.leaseBaselineVerified = true; await save();
      }
      if (after === 0) {
        const scan = current.dailyScan;
        assert.equal((await advance()).phase, 'daily-batch'); assert.equal(current.dailyAfter, '256');
        assert.equal(current.dailyScan, scan, 'daily-diagnostic-scan-drift');
      }
    }
    await finish();
    assert.equal(new Set(diagnostic.probes.map(item => `${item.dailyAfter}:${item.probe}`)).size, 12);
    diagnostic.status = 'profiled'; diagnostic.ms = now() - started; await save();
  } catch (error) {
    for (const attempt of [...diagnostic.probes, ...diagnostic.advances]) {
      if (attempt.status === 'pending') { attempt.status = 'failed'; attempt.failure = 'daily-diagnostic-incomplete'; }
    }
    diagnostic.status = 'failed'; diagnostic.failure = 'daily-diagnostic-incomplete';
    diagnostic.ms = clock.mono() - started; await save(); throw error;
  }
}

const invalidTiming = () => { throw new Error('fixture-drive-invalid-response'); };
export function qaAdvanceState(value) {
  const state = {};
  for (const key of ['dailyScan', 'platformGeneration', 'visitGeneration', 'visitBuild']) {
    if (value?.[key] !== null && (typeof value?.[key] !== 'string' || !UUID.test(value[key]))) invalidTiming();
    state[key] = value[key];
  }
  for (const key of ['dailyAfter', 'visitAfter']) {
    const n = value?.[key];
    if (!(key === 'visitAfter' && n === null) &&
      (typeof n !== 'string' || !/^(0|[1-9][0-9]{0,18})$/.test(n) || BigInt(n) > 9223372036854775807n)) invalidTiming();
    state[key] = n;
  }
  if (!Number.isSafeInteger(value?.controlSteps) || value.controlSteps < 0 || value.controlSteps > 2147483647 ||
    ![true, false, null].includes(value?.visitTotalsDone) ||
    ((state.visitBuild === null) !== (state.visitAfter === null)) ||
    ((state.visitBuild === null) !== (value.visitTotalsDone === null))) invalidTiming();
  return { ...state, controlSteps: value.controlSteps, visitTotalsDone: value.visitTotalsDone };
}

export function qaAdvanceOutcome(value, stepId) {
  if (typeof stepId !== 'string' || !UUID.test(stepId) || !STEP_PHASES.has(value?.phase) || typeof value.more !== 'boolean') invalidTiming();
  for (const key of ['platformGeneration', 'visitGeneration']) {
    if (value[key] !== null && (typeof value[key] !== 'string' || !UUID.test(value[key]))) invalidTiming();
  }
  return { stepId, phase: value.phase, more: value.more,
    platformGeneration: value.platformGeneration, visitGeneration: value.visitGeneration };
}

export function qaTimingSummary(calls) {
  if (!Array.isArray(calls) || calls.length < 1 || calls.length > FIXTURE_BATCH_MAX_STEPS) invalidTiming();
  const phaseStats = {}; let maximum = null; const slowCalls = [];
  for (const call of calls) {
    const timing = { ...qaAdvanceOutcome(call, call.stepId), sqlMs: call.sqlMs, preState: qaAdvanceState(call.preState) };
    if (!Number.isFinite(timing.sqlMs) || timing.sqlMs < 0 || timing.sqlMs > FIXTURE_BATCH_OUTER_MS) invalidTiming();
    const stats = phaseStats[timing.phase] ??= { calls: 0, sqlMs: 0, maximumSqlStepMs: 0 };
    stats.calls++; stats.sqlMs += timing.sqlMs; stats.maximumSqlStepMs = Math.max(stats.maximumSqlStepMs, timing.sqlMs);
    // First call wins ties, including across batches. Never infer the maximum
    // from the final result, phase counts or the last observed cursor.
    if (!maximum || timing.sqlMs > maximum.sqlMs) maximum = timing;
    if (timing.sqlMs >= SLOW_CALL_MS) {
      slowCalls.push(timing); slowCalls.sort((a, b) => b.sqlMs - a.sqlMs); slowCalls.length = Math.min(slowCalls.length, SLOW_CALL_LIMIT);
    }
  }
  return { calls: calls.length, phaseStats, maximum, slowCalls,
    timingScope: 'outer-advance-including-shared-cleanup', sharedCleanup: 'unattributed' };
}

export function qaDriveFailure(run, failure = {}) {
  if (!run.failure) run.status = failure.interrupted ? 'interrupted' : 'failed';
  const code = sqlstate(failure.sqlstate) ?? rpcErrorCode(failure.code);
  const detail = { code, status: Number.isInteger(failure.status) && failure.status >= 100 && failure.status <= 599 ? failure.status : null,
    ms: Number.isFinite(failure.ms) && failure.ms >= 0 && failure.ms <= DRIVE_BUDGET_MS ? failure.ms : null,
    kind: failure.interrupted ? 'interrupted' : 'dispatch-or-response-failure' };
  if (run.pendingBatch) {
    // Keep the original attempt and UUID after failure and explicit cleanup.
    run.pendingBatch.status = run.status;
    run.pendingBatch.failure ??= detail;
    // JSON readback does not retain the in-memory alias between these fields.
    const savedAttempt = run.batchReceipts?.at(-1);
    if (savedAttempt && savedAttempt.attempt === run.pendingBatch.attempt && savedAttempt.firstStepId === run.pendingBatch.firstStepId) {
      savedAttempt.status = run.pendingBatch.status; savedAttempt.failure ??= run.pendingBatch.failure;
    }
  }
  run.failure ??= detail;
}

export function qaBeginDriveAttempt(run, { transport, steps, workBudgetMs, firstStepId, state }) {
  assert.match(run.scenario, /^[a-z][a-z0-9-]{0,79}$/);
  assert.ok(['sql', 'rest'].includes(transport) && typeof firstStepId === 'string' && UUID.test(firstStepId));
  assert.ok(Number.isSafeInteger(steps) && steps >= 1 && steps <= FIXTURE_BATCH_MAX_STEPS);
  assert.ok(transport === 'sql' ? Number.isSafeInteger(workBudgetMs) && workBudgetMs >= 1 && workBudgetMs <= FIXTURE_BATCH_WORK_MS : steps === 1);
  assert.ok(!run.pendingBatch, 'fixture-attempt-already-pending');
  const attempts = run.batchReceipts ??= [];
  assert.ok(attempts.length < DRIVE_MAX_STEPS);
  const attempt = { scenario: run.scenario, batchNumber: (run.batches ?? run.steps) + 1,
    attempt: attempts.length + 1, transport, steps, ...(transport === 'sql' ? { workBudgetMs } : {}),
    firstStepId, stepIdentityScope: transport === 'sql' ? 'first-call-only' : 'exact-call',
    attemptedPhase: null, preState: qaAdvanceState(state), status: 'pending', startedAt: new Date().toISOString() };
  attempts.push(attempt); run.pendingBatch = attempt;
  return attempt;
}

export function qaRecordFixtureBatch(run, batch, requestMs) {
  const attempt = run.pendingBatch;
  assert.ok(attempt?.transport === 'sql' && attempt.status === 'pending');
  assert.equal(batch.results[0].stepId, attempt.firstStepId, 'fixture-first-step-identity-mismatch');
  assert.ok(Number.isFinite(requestMs) && requestMs >= 0 && requestMs <= MANAGEMENT_REQUEST_MS);
  Object.assign(attempt, { status: 'completed', actualCalls: batch.calls, requestMs, sqlMs: batch.sqlMs,
    requestOverheadMs: Math.max(0, requestMs - batch.sqlMs), maximum: batch.maximum,
    phaseStats: batch.phaseStats, slowCalls: batch.slowCalls,
    timingScope: batch.timingScope, sharedCleanup: batch.sharedCleanup });
  run.steps += batch.calls; run.batches++;
  run.sqlMs += batch.sqlMs; run.requestOverheadMs += attempt.requestOverheadMs;
  run.maximumSqlStepMs = Math.max(run.maximumSqlStepMs, batch.maximumSqlStepMs);
  const withBatch = call => ({ ...call, batchNumber: attempt.batchNumber, attempt: attempt.attempt });
  if (!run.maximum || batch.maximum.sqlMs > run.maximum.sqlMs) run.maximum = withBatch(batch.maximum);
  run.slowCalls = [...(run.slowCalls ?? []), ...batch.slowCalls.map(withBatch)]
    .sort((a, b) => b.sqlMs - a.sqlMs).slice(0, SLOW_CALL_LIMIT);
  for (const [phase, stats] of Object.entries(batch.phaseStats)) {
    run.phaseCounts[phase] = (run.phaseCounts[phase] ?? 0) + stats.calls;
    const sum = (run.phaseStats ??= {})[phase] ??= { calls: 0, sqlMs: 0, maximumSqlStepMs: 0 };
    sum.calls += stats.calls; sum.sqlMs += stats.sqlMs;
    sum.maximumSqlStepMs = Math.max(sum.maximumSqlStepMs, stats.maximumSqlStepMs);
  }
  run.lastPhase = batch.results.at(-1).phase;
  delete run.pendingBatch;
}

export function qaFixtureBatchPlan(steps, elapsedMs) {
  assert.ok(Number.isSafeInteger(steps) && steps >= 0 && steps <= DRIVE_MAX_STEPS);
  assert.ok(Number.isFinite(elapsedMs) && elapsedMs >= 0);
  if (steps === DRIVE_MAX_STEPS || DRIVE_BUDGET_MS - elapsedMs < MANAGEMENT_REQUEST_MS) return null;
  return { limit: Math.min(FIXTURE_BATCH_MAX_STEPS, DRIVE_MAX_STEPS - steps), workBudgetMs: FIXTURE_BATCH_WORK_MS };
}

export function qaFixtureBatchResult(rows, limit) {
  const invalid = () => { throw new Error('fixture-drive-invalid-response'); };
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > FIXTURE_BATCH_MAX_STEPS ||
    !Array.isArray(rows) || rows.length !== 1) invalid();
  const batch = rows[0]?.result;
  if (!Array.isArray(batch?.results) || batch.results.length < 1 || batch.results.length > limit ||
    !Number.isFinite(batch.sqlMs) || batch.sqlMs < 0 || batch.sqlMs > FIXTURE_BATCH_OUTER_MS ||
    !Number.isFinite(batch.maximumSqlStepMs) || batch.maximumSqlStepMs < 0 ||
    batch.maximumSqlStepMs > batch.sqlMs) invalid();
  const ids = new Set();
  const results = batch.results.map((r, index) => {
    const outcome = qaAdvanceOutcome(r, r?.stepId);
    if ((outcome.more === false && index !== batch.results.length - 1) || ids.has(outcome.stepId)) invalid();
    ids.add(outcome.stepId);
    return { ...outcome, sqlMs: r.sqlMs, preState: qaAdvanceState(r.preState) };
  });
  const summary = qaTimingSummary(results);
  if (summary.maximum.sqlMs !== batch.maximumSqlStepMs ||
    results.reduce((sum, r) => sum + r.sqlMs, 0) > batch.sqlMs + 0.001) invalid();
  return { results, sqlMs: batch.sqlMs, maximumSqlStepMs: batch.maximumSqlStepMs,
    finalState: qaAdvanceState(batch.finalState), ...summary };
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
  assert.ok(['fixture', 'benchmark', 'cleanup', 'daily-diagnostic', 'reader-diagnostic'].includes(mode));
  assert.equal(env.GITHUB_ACTIONS, 'true', 'GitHub execution only');
  assert.equal(env.GITHUB_REPOSITORY, 'RaviTejaKNTS/Bloxodes');
  assert.match(options['--expected-sha'] ?? '', /^[a-f0-9]{40}$/);
  const checkoutSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const event = JSON.parse(await readFile(env.GITHUB_EVENT_PATH, 'utf8'));
  validateQaCheckout({ expectedSha: options['--expected-sha'], checkoutSha,
    eventName: env.GITHUB_EVENT_NAME, event, githubSha: env.GITHUB_SHA });
  if (mode === 'daily-diagnostic') assert.equal(env.GITHUB_EVENT_NAME, 'workflow_dispatch', 'manual diagnostic only');
  if (mode === 'reader-diagnostic') validateQaReaderSelection(env.GITHUB_EVENT_NAME, event);
  if (mode !== 'cleanup') {
    assert.equal(execFileSync('git', ['status', '--porcelain', '--untracked-files=all', '--',
      ...PREPARED_QA_MIGRATION_PATHS, 'scripts/ci/stats-prepared-db-qa.mjs',
      'scripts/ci/stats-prepared-reader-diagnostic.mjs', 'scripts/ci/stats-prepared-reader-runner.mjs',
      'scripts/ci/stats-prepared-selection.mjs',
      'scripts/ci/fixtures/stats-prepared-source.sql', 'scripts/shared/prepared-charts-*.mjs',
      'scripts/universes/refresh-prepared-charts.mjs', 'scripts/universes/__tests__/prepared-charts*.test.mjs',
      'types/stats-prepared.ts'], { encoding: 'utf8' }).trim(), '', 'QA source files must match checkout SHA');
  }
  assert.equal(env.SUPABASE_URL ?? env.MANAGED_DEV_SUPABASE_URL, MANAGED_URL);
  const token = env.MANAGED_DEV_SUPABASE_ACCESS_TOKEN;
  const service = env.MANAGED_DEV_SUPABASE_SERVICE_ROLE ?? env.SUPABASE_SERVICE_ROLE;
  assert.ok(token && service, 'Management API and managed-development service credentials required');
  const receiptPath = options['--receipt'] ?? path.join(env.RUNNER_TEMP, 'stats-prepared-db-qa.json');
  const phases = []; let identity; let claimLocation; let advanceContext; let advanceAttempt = 0;
  const saveReceipt = () => writeQaReceipt(receiptPath, qaReceiptWithPhases(identity, phases));
  async function sql(query, phase = 'fixture-checks', { requestMs = MANAGEMENT_REQUEST_MS } = {}) {
    assert.ok(SQL_PHASES.has(phase), 'unknown QA SQL phase');
    const started = Date.now();
    const submittedQuery = `set statement_timeout='110s'; set lock_timeout='2s'; set timezone='UTC';\n${query}`;
    let response; let result; let failureKind;
    try {
      response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: submittedQuery }),
        signal: AbortSignal.timeout(requestMs), redirect: 'error',
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
      result = undefined;
      const isAdvance = name.endsWith('_run_sp_step_v1');
      if (isAdvance) {
        assert.match(body.p_step_id ?? '', UUID);
        identity.pendingAdvance = { stepId: body.p_step_id, attempt: ++advanceAttempt,
          scenario: advanceContext?.scenario ?? null, attemptedPhase: null,
          ...(advanceContext ? { snapshot: advanceContext } : {}), status: 'pending', startedAt: new Date().toISOString() };
        // File-only evidence, no extra HTTP/SQL per advance. Preserve the exact
        // pending UUID even when fetch aborts or the job is interrupted.
        await saveReceipt();
      }
      const started = Date.now();
      let response; let failureKind;
      try {
        response = await fetch(`${MANAGED_URL}/rest/v1/rpc/${ident(name)}`, { method: 'POST', redirect: 'error',
          headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body), signal: AbortSignal.timeout(12_000) });
      } catch { failureKind = 'request-error'; }
      if (response) {
        try { result = await response.json(); } catch { failureKind = 'invalid-json'; }
      }
      const code = rpcErrorCode(result?.code);
      let outcome;
      if (isAdvance && response?.ok && !failureKind) {
        try { outcome = qaAdvanceOutcome(result, body.p_step_id); }
        catch { failureKind = 'invalid-advance-metadata'; }
      }
      const failed = Boolean(failureKind || !response?.ok);
      const phase = { kind: 'rest', rpc: name, ms: Date.now() - started, status: response?.status ?? null, code,
        ...(isAdvance ? { stepId: body.p_step_id, attempt: advanceAttempt, attemptedPhase: null,
          ...(advanceContext ? { snapshot: advanceContext } : {}),
          ...(outcome ? { outcome, phase: outcome.phase,
            timingScope: 'outer-advance-including-shared-cleanup', sharedCleanup: 'unattributed' } : {}) } : {}),
        ...(failureKind ? { failureKind } : {}),
        ...(failed ? { ...qaRpcFailureDiagnostic({ result,
          claimLocation: name === claimLocation?.alias ? claimLocation : undefined }),
          errorEnvelope: qaRpcErrorEnvelope(result) } : {}) };
      phases.push(phase);
      if (isAdvance) {
        if (failed) Object.assign(identity.pendingAdvance, { status: 'failed', failure: phase });
        else {
          delete identity.pendingAdvance;
          if (advanceContext) advanceContext = { ...advanceContext,
            successfulCallsSinceSnapshot: advanceContext.successfulCallsSinceSnapshot + 1, previousOutcome: outcome };
        }
      }
      if (failureKind) {
        identity.rpcFailure ??= phase; await saveReceipt();
        throw new Error(`fixture-rpc-failed-${phase.status ?? 'no-response'}-${failureKind}`);
      }
      if (retrySchema && result?.code === 'PGRST202') { await pause(500); continue; }
      if (expectedError) { await saveReceipt(); assert.equal(code, expectedError); return result; }
      if (failed) { identity.rpcFailure ??= phase; await saveReceipt(); }
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
    assert.ok(['fixture', 'benchmark', 'daily-diagnostic', 'reader-diagnostic'].includes(identity.mode));
    assert.deepEqual(identity.functions, [...RPC_NAMES.map(name => identity.prefix + name.replace('_stats_prepared_', '_sp_')), identity.prefix + 'timeout']);
    for (const run of identity.drives ?? []) {
      if (run.status === 'running') qaDriveFailure(run, { interrupted: true });
    }
    if (identity.pendingAdvance?.status === 'pending') {
      identity.pendingAdvance.status = 'interrupted';
      identity.pendingAdvance.failure = { kind: 'interrupted', code: 'unknown', status: null, ms: null };
    }
    qaInterruptDailyDiagnostic(identity.dailyDiagnostic);
    qaInterruptReaderDiagnostic(identity.readerDiagnostic);
    identity.cleaned = false;
    if (identity.fixtureCreationStarted === false) {
      const rows = await sql(`select not exists(select 1 from pg_namespace where nspname in
        (${literal(identity.schema)},${literal(identity.privateSchema)})) and not exists(select 1 from pg_proc
        where pronamespace='public'::regnamespace and proname in (${identity.functions.map(literal)})) as absent;`, 'cleanup');
      assert.equal(rows[0]?.absent, true, 'fixture-preflight-absence-not-proven');
      identity.cleaned = true; identity.cleanupNotNeeded = true; await saveReceipt(); return;
    }
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
    functions: [...RPC_NAMES.map(alias), prefix + 'timeout'], cleaned: false, completed: false, fixtureCreationStarted: false };
  if (mode === 'reader-diagnostic') identity.acceptance = false;
  await saveReceipt();
  const games = mode === 'benchmark' ? 100_000 : 1105;
  let claim; let sourceRows; let maximumStepMs = 0;
  async function storageCheckpoint(phase) {
    const rows = await sql(`select pg_database_size(current_database())::text "databaseBytes",
      current_setting('default_transaction_read_only') "defaultReadOnly",
      current_setting('transaction_read_only') "transactionReadOnly",
      coalesce((select sum(pg_total_relation_size(c.oid)) from pg_class c
        where c.relnamespace=to_regnamespace(${literal(schema)}) and c.relkind='r'
          and c.relname in ('roblox_universes','stats_game_current_index','roblox_universe_stats_hourly','roblox_universe_stats_daily','revalidation_events')),0)::text "sourceBytes",
      coalesce((select sum(pg_indexes_size(c.oid)) from pg_class c
        where c.relnamespace=to_regnamespace(${literal(schema)}) and c.relkind='r'
          and c.relname in ('roblox_universes','stats_game_current_index','roblox_universe_stats_hourly','roblox_universe_stats_daily','revalidation_events')),0)::text "sourceIndexBytes",
      coalesce((select sum(pg_total_relation_size(c.oid)) from pg_class c
        where c.relnamespace=to_regnamespace(${literal(schema)}) and c.relkind='r'
          and c.relname like 'stats_prepared_%'),0)::text "preparedBytes",
      coalesce((select temp_bytes from pg_stat_database where datname=current_database()),0)::text "tempBytes",
      coalesce((select temp_files from pg_stat_database where datname=current_database()),0)::text "tempFiles";`, phase);
    const checkpoint = { ...qaStorageCheckpoint(rows), completedSourceBatches: identity.sourceProgress?.completedBatches ?? 0 };
    (identity.storageCheckpoints ??= []).push(checkpoint); await saveReceipt();
    return checkpoint;
  }
  async function sourceInsert(query, phase, first, last, rowsPerGame) {
    const progress = identity.sourceProgress ??= { completedBatches: 0, expectedRowsCommitted: {} };
    progress.pending = qaSourceProgress(phase, first, last, rowsPerGame); await saveReceipt();
    await sql(query, phase);
    progress.lastCompleted = progress.pending;
    progress.expectedRowsCommitted[phase] = (progress.expectedRowsCommitted[phase] ?? 0) + progress.pending.expectedRows;
    progress.completedBatches++; delete progress.pending; await saveReceipt();
    if (progress.completedBatches % 10 === 0) await storageCheckpoint('source-storage');
  }
  try {
    const preflight = await storageCheckpoint('source-preflight');
    // This is a read-only-state guard, not proof of disk, WAL or plan headroom.
    // Representative benchmark capacity still requires operator review.
    if (preflight.defaultReadOnly !== 'off' || preflight.transactionReadOnly !== 'off') {
      identity.preflightBlocked = 'read-only'; await saveReceipt();
    }
    assert.ok(preflight.defaultReadOnly === 'off' && preflight.transactionReadOnly === 'off',
      'fixture-source-preflight-read-only');
    const migrationSources = await Promise.all(PREPARED_QA_MIGRATION_PATHS.map(async migrationPath => ({
      path: migrationPath, bytes: await readFile(new URL(`../../${migrationPath}`, import.meta.url)),
    })));
    const migrations = fixtureMigrationPlan(migrationSources, schema, privateSchema);
    if (mode === 'reader-diagnostic') assert.deepEqual(migrations.map(({ sql, ...receipt }) => receipt),
      READER_DIAGNOSTIC_MIGRATIONS, 'exact frozen reader migrations required');
    identity.migrations = migrations.map(({ sql, ...receipt }) => receipt);
    // Compatibility only: final proof is the complete ordered two-file receipt.
    identity.migrationSha256 = identity.migrations[0].sha256;
    identity.installedMigrations = [];
    await saveReceipt();
    identity.fixtureCreationStarted = true; await saveReceipt();
    await sql(`create schema ${schema}; grant usage on schema ${schema} to service_role;\n` +
      ['roblox_universes', 'stats_game_current_index', 'roblox_universe_stats_hourly', 'roblox_universe_stats_daily', 'revalidation_events']
        .map(table => `create table ${schema}.${table} (like public.${table} including all); grant select,insert,update,delete on ${schema}.${table} to service_role;`).join('\n'), 'source-clone');
    let originalClaim;
    await replayFixtureMigrations(migrations, async (migration, receipt) => {
      await sql(migration, 'migration-install');
      identity.installedMigrations.push(receipt);
      await saveReceipt();
      const rows = await sql(`select p.oid::text oid,p.proowner::text owner,p.proacl::text acl,
        p.prosecdef security_definer,p.provolatile volatility,p.proconfig settings,
        pg_get_function_identity_arguments(p.oid) args,pg_get_function_result(p.oid) result,
        has_function_privilege('service_role',p.oid,'EXECUTE') service_execute,
        has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,
        has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute,
        exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
          where a.grantee=0 and a.privilege_type='EXECUTE') public_execute
        from pg_proc p where p.oid=${literal(`${schema}.claim_stats_prepared_work_v1(text,uuid)`)}::regprocedure;`);
      assert.equal(rows.length, 1);
      const row = rows[0];
      assert.equal(row.security_definer, false); assert.equal(row.volatility, 'v');
      assert.equal(row.result, 'jsonb'); assert.equal(row.service_execute, true);
      assert.equal(row.anon_execute, false); assert.equal(row.authenticated_execute, false);
      assert.equal(row.public_execute, false);
      if (!originalClaim) originalClaim = row;
      else {
        assert.deepEqual(row, originalClaim, 'claim replacement must preserve identity, owner, ACL, signature and settings');
        identity.claimReplacementPreserved = true;
        await saveReceipt();
      }
    });
    assert.deepEqual(identity.installedMigrations, identity.migrations);
    assert.equal(identity.claimReplacementPreserved, true);
    if (mode === 'fixture') await sql(fixtureDriveBatchSql(schema, privateSchema), 'fixture-drive-install');
    // Execute exact function bodies/settings through real PostgREST using unique
    // service-only aliases. All table/helper references still point at fixtures.
    for (const name of RPC_NAMES) {
      const row = (await sql(`select pg_get_functiondef(oid) as definition,pg_get_function_identity_arguments(oid) as args from pg_proc where pronamespace=${literal(schema)}::regnamespace and proname=${literal(name)};`, 'alias-read'))[0];
      if (name === 'claim_stats_prepared_work_v1') {
        claimLocation = { alias: alias(name), maxLine: row.definition.split('\n').length };
        validateClaimLocation(claimLocation);
      }
      await sql('begin;\n' + row.definition.replace(`FUNCTION ${schema}.${name}(`, `FUNCTION public.${alias(name)}(`) +
        `;\nrevoke all on function public.${alias(name)}(${row.args}) from public,anon,authenticated; grant execute on function public.${alias(name)}(${row.args}) to service_role; commit;`, 'alias-install');
    }
    // Function-specific ACL statements need identity argument types: use a
    // catalog DO rather than assuming grant-all can address overloaded routines.
    await sql(`do $qa$ declare f record; begin for f in select oid::regprocedure sig from pg_proc where pronamespace='public'::regnamespace and proname like ${literal(prefix + '%')} loop execute 'revoke all on function '||f.sig||' from public,anon,authenticated'; execute 'grant execute on function '||f.sig||' to service_role'; end loop; end $qa$;` +
      `create function public.${prefix}timeout() returns void language sql volatile security invoker set search_path='' set statement_timeout='100ms' as 'select pg_catalog.pg_sleep(1)'; revoke all on function public.${prefix}timeout() from public,anon,authenticated; grant execute on function public.${prefix}timeout() to service_role; notify pgrst,'reload schema';`, 'alias-acl-timeout');
    if (mode === 'reader-diagnostic') {
      try {
        const definitions = await sql(`select n.nspname as schema,p.proname as name,
          pg_get_functiondef(p.oid) as definition,pg_get_userbyid(p.proowner) as owner,
          has_function_privilege('service_role',p.oid,'EXECUTE') service_execute,
          has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,
          has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute,
          exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
            where a.grantee=0 and a.privilege_type='EXECUTE') public_execute
          from pg_proc p join pg_namespace n on n.oid=p.pronamespace
          where n.nspname in (${literal(schema)},${literal(privateSchema)}) or
            (n.nspname='public' and p.proname in (${RPC_NAMES.map(name => literal(alias(name))).join(',')}));`, 'alias-read');
        identity.readerInstallation = { functions: qaReaderDefinitionProof(definitions, migrations, schema, privateSchema),
          schemaCacheVisible: false };
        await saveReceipt();
        // Discover aliases in the service-role OpenAPI document before measured
        // requests. No reader/health/timeout RPC is used as an installation probe.
        const started = Date.now(); let response; let visible = false;
        try {
          response = await fetch(`${MANAGED_URL}/rest/v1/`, { headers: { apikey: service,
            Authorization: `Bearer ${service}`, Accept: 'application/openapi+json' },
            signal: AbortSignal.timeout(12_000), redirect: 'error' });
          const document = await response.json();
          visible = response.ok && RPC_NAMES.every(name =>
            Object.hasOwn(document?.paths ?? {}, `/rpc/${alias(name)}`));
        } catch { /* Only fixed installation evidence is retained. */ }
        phases.push({ kind: 'schema-cache', phase: 'alias-install',
          status: response?.status ?? null, ms: Date.now() - started, visible });
        identity.readerInstallation.schemaCacheVisible = visible;
        await saveReceipt();
        assert.equal(identity.readerInstallation.schemaCacheVisible, true, 'reader-schema-cache-not-ready');
        const result = await runReaderDiagnostic({ schema, privateSchema, migrationSources,
          sql: qaReaderSqlAdapter(sql, phases),
          rest: createReaderDiagnosticRest({ managedUrl: MANAGED_URL, serviceKey: service, schema }),
          persist: async snapshot => {
            identity.completed = false; identity.acceptance = false;
            identity.readerDiagnostic = snapshot;
            await saveReceipt();
          } });
        if (result.diagnostic.status !== 'profiled') throw new Error('reader-diagnostic-incomplete');
      } catch {
        identity.readerFailure ??= 'reader-diagnostic-incomplete'; await saveReceipt();
        throw new Error('reader-diagnostic-incomplete');
      }
      console.log(JSON.stringify({ status: 'reader-diagnostic-profiled', acceptance: false, mode, receipt: receiptPath }));
      return;
    }
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
    await sourceInsert(universesPart.replaceAll('__SCHEMA__', schema).replaceAll('__GAMES__', String(games)),
      'source-universes', 1, games, 1);
    if (mode === 'benchmark') await sourceInsert(`insert into ${schema}.stats_game_current_index(universe_id,slug,name)
      select n,'fixture-'||n,'Fixture '||n from generate_series(3,${games}) n;`, 'source-current-index', 3, games, 1);
    const dailyPart = fixture.slice(fixture.indexOf('insert into __SCHEMA__.roblox_universe_stats_daily'), fixture.indexOf('-- Raw history'));
    for (let first = 1; first <= games; first += 1000) {
      await sourceInsert(dailyPart.replaceAll('__SCHEMA__', schema).replaceAll('__GAMES__', String(games))
        .replaceAll('__START_ID__', String(first)).replaceAll('__END_ID__', String(Math.min(games, first + 999))),
      'source-daily', first, Math.min(games, first + 999), 91);
    }
    await storageCheckpoint('source-storage');
    await sourceInsert(fixture.slice(fixture.indexOf('-- Raw history')).replaceAll('__SCHEMA__', schema),
      'source-hourly-history', 1, 2, 4320);
    if (mode === 'benchmark') {
      // 16 million representative hourly rows, 9.1 million daily rows. Batches
      // bound setup writes too. Index creation happened on empty fixture tables.
      for (let first = 3; first <= games; first += 1000) await sourceInsert(`insert into ${schema}.roblox_universe_stats_hourly(universe_id,hour_start,playing,avg_playing,peak_playing,sample_count,first_sampled_at,last_sampled_at)
        select n,h,2,2,3,1,h,h from generate_series(${first},${Math.min(games, first + 999)}) n cross join generate_series(date_trunc('hour',now())-interval '160 hours',date_trunc('hour',now())-interval '1 hour',interval '1 hour') h;`,
      'source-hourly', first, Math.min(games, first + 999), 160);
    }
    await storageCheckpoint('source-storage');
    sourceRows = (await sql(`select (select count(*) from ${schema}.roblox_universe_stats_hourly)::text hourly,(select count(*) from ${schema}.roblox_universe_stats_daily)::text daily;`, 'source-counts'))[0];
    identity.sourceRows = sourceRows;
    // Only this run's isolated source copies are analyzed. No real managed-
    // development/production source maintenance is performed.
    await sql(`analyze ${schema}.roblox_universes; analyze ${schema}.roblox_universe_stats_hourly; analyze ${schema}.roblox_universe_stats_daily;`, 'source-analyze');
    if (mode !== 'daily-diagnostic') {
      identity.sourceIndexes = await sql(`select tablename,indexname,indexdef from pg_indexes where schemaname=${literal(schema)}
        and tablename in ('roblox_universe_stats_hourly','roblox_universe_stats_daily','stats_prepared_visits','stats_prepared_visit_totals') order by tablename,indexname;`);
      identity.dailySourcePlan = await sql(`explain (format json,settings true) select d.* from
        (select universe_id from ${schema}.roblox_universes order by universe_id limit 256) u cross join lateral
        (select * from ${schema}.roblox_universe_stats_daily s where s.universe_id=u.universe_id
          and s.stat_date between current_date-180 and current_date offset 0) d;`);
    }
    const bootstrapStarted = Date.now();
    identity.bootstrapStartedAt = new Date(bootstrapStarted).toISOString();
    const observe = result => {
      if (result?.platformGeneration && identity.firstPlatformObservedMs == null) identity.firstPlatformObservedMs = Date.now() - bootstrapStarted;
      if (result?.visitGeneration && identity.firstVisitObservedMs == null) identity.firstVisitObservedMs = Date.now() - bootstrapStarted;
    };
    if (mode === 'daily-diagnostic') {
      const diagnostic = identity.dailyDiagnostic = { status: 'pending', acceptance: false,
        scope: 'initial-fixture-chunks-0-and-256',
        planBinding: 'typed-execute-using-custom-values-not-cached-plpgsql' };
      await saveReceipt();
      assert.deepEqual(sourceRows, { hourly: '8640', daily: '100555' }, 'daily-diagnostic-source-population');
      const queries = fixtureDailyDiagnosticSql(await readFile(new URL(`../../${PREPARED_QA_MIGRATION_PATHS[0]}`, import.meta.url)), schema, privateSchema);
      diagnostic.cteSha256 = queries.cteSha256;
      await sql(queries.install, 'daily-diagnostic-install');
      await qaRunDailyDiagnostic({ diagnostic, save: saveReceipt, requests: {
        claim: requestId => transport(alias('claim_stats_prepared_work_v1'), { p_worker_id: 'github-fixture', p_request_id: requestId }),
        finish: lease => transport(alias('finish_stats_prepared_work_v1'), { p_lease_token: lease.leaseToken,
          p_epoch: lease.epoch, p_outcome: { status: 'yielded' } }),
        state: async finished => {
          const rows = await sql(`begin; set local statement_timeout='10s'; set local lock_timeout='500ms';
set local role service_role;
${queries.boundary(finished)}
rollback;`, 'daily-diagnostic-state', { requestMs: DAILY_LEASE_BUDGET.stateMs });
          assert.equal(rows.length, 1, 'invalid-daily-boundary-response');
          return qaDailyBoundaryResult(rows[0]?.result);
        },
        advance: async (lease, stepId) => {
          const rows = await sql(`begin; set local statement_timeout='60s'; set local lock_timeout='500ms';
set local role service_role;
select ${schema}.run_stats_prepared_step_v1(${literal(lease.leaseToken)},${literal(lease.epoch)},${literal(stepId)},'{"kind":"advance"}'::jsonb) as result;
commit;`, 'daily-diagnostic-reach');
          return qaAdvanceOutcome(rows[0]?.result, stepId);
        },
        probe: async (probe, after, lease, stepId) => {
          const rows = await sql(queries.probe(probe, after, lease.leaseToken, lease.epoch, stepId), 'daily-diagnostic-probe');
          assert.equal(rows.length, 1, 'invalid-daily-probe-response');
          return qaDailyProbeResult(rows[0]?.result, schema, after);
        },
      } });
      // A successful diagnostic keeps completed=false; it is not acceptance.
      await saveReceipt();
      console.log(JSON.stringify({ status: 'diagnostic-profiled', acceptance: false, mode, receipt: receiptPath }));
      return;
    }
    const requestId = randomUUID();
    let diagnosticInstalled = false;
    async function probeClaim() {
      const queries = fixtureClaimDiagnosticSql(schema, privateSchema, claimLocation, requestId);
      if (!diagnosticInstalled) {
        await sql(queries.install, 'claim-diagnostic-install'); diagnosticInstalled = true;
      }
      const rows = await sql(queries.probe, 'claim-diagnostic');
      return qaClaimProbeDiagnostic(rows[0]?.result, claimLocation);
    }
    try {
      claim = await transport(alias('claim_stats_prepared_work_v1'), { p_worker_id: 'github-fixture', p_request_id: requestId });
    } catch (error) {
      // One rollback-only probe, only after an actual SQL cardinality response.
      // Never convert this failed REST path into a successful bootstrap.
      if (identity.rpcFailure?.rpc === claimLocation.alias && identity.rpcFailure.sqlstate === '21000') {
        try { identity.claimDiagnostic = await probeClaim(); }
        catch { identity.claimDiagnosticFailed = true; }
        await saveReceipt();
      }
      throw error;
    }
    assert.ok(claim.claimed);
    identity.hourlySourcePlan = await sql(`explain (format json,settings true) select sum(coalesce(h.avg_playing,h.playing::numeric))
      from ${schema}.roblox_universe_stats_hourly h join ${schema}.stats_prepared_members m using(universe_id)
      where h.hour_start=date_trunc('hour',now())-interval '1 hour';`);
    assert.equal((await transport(alias('claim_stats_prepared_work_v1'), { p_worker_id: 'other', p_request_id: randomUUID() })).claimed, false);
    assert.equal((await transport(alias('claim_stats_prepared_work_v1'), { p_worker_id: 'github-fixture', p_request_id: requestId })).leaseToken, claim.leaseToken);
    const stepArgs = stepId => ({ p_lease_token: claim.leaseToken, p_epoch: claim.epoch, p_step_id: stepId, p_work: { kind: 'advance' } });
    const readAdvanceContext = async scenario => ({ scenario,
      state: qaAdvanceState(await scalar(`(${qaAdvanceStateSql(schema)})`)),
      observedAt: new Date().toISOString(), successfulCallsSinceSnapshot: 0 });
    advanceContext = await readAdvanceContext(null);
    const firstStep = stepArgs(randomUUID());
    const firstResult = await transport(alias('run_stats_prepared_step_v1'), firstStep);
    observe(firstResult);
    assert.deepEqual(await transport(alias('run_stats_prepared_step_v1'), firstStep), firstResult);
    assert.equal((await transport(alias('get_stats_prepared_receipt_v1'), { p_step_id: firstStep.p_step_id })).found, true);
    async function drive(scenario) {
      assert.match(scenario, /^[a-z][a-z0-9-]{0,79}$/);
      const started = Date.now(); let done = false; let total = 0;
      const run = { scenario, status: 'running', startedAt: new Date(started).toISOString(), steps: 0,
        transport: mode === 'benchmark' ? 'rest' : 'sql', ms: 0,
        ...(mode === 'fixture' ? { batches: 0, sqlMs: 0, requestOverheadMs: 0,
          maximumSqlStepMs: 0, phaseCounts: {} } : {}) };
      (identity.drives ??= []).push(run);
      await saveReceipt();
      console.log(JSON.stringify({ phase: 'drive-start', scenario, mode }));
      try {
        // One bounded owned-state read per drive, never one REST/SQL read per
        // REST advance. Later attempts label the snapshot's age in calls.
        advanceContext = await readAdvanceContext(scenario);
        let nextState = advanceContext.state;
        while (!done && total < DRIVE_MAX_STEPS && Date.now() - started < DRIVE_BUDGET_MS) {
          if (mode === 'benchmark') {
            const args = stepArgs(randomUUID());
            const attempt = qaBeginDriveAttempt(run, { transport: 'rest', steps: 1,
              firstStepId: args.p_step_id, state: advanceContext.state });
            attempt.successfulCallsSinceSnapshot = advanceContext.successfulCallsSinceSnapshot;
            // transport persists this attempt and the exact UUID before dispatch.
            const began = Date.now();
            const result = await transport(alias('run_stats_prepared_step_v1'), args);
            observe(result);
            maximumStepMs = Math.max(maximumStepMs, Date.now() - began);
            total++; done = !result.more;
            run.steps = total; run.ms = Date.now() - started; run.lastPhase = result.phase;
            Object.assign(attempt, { status: 'completed', actualCalls: 1, requestMs: Date.now() - began,
              outcome: qaAdvanceOutcome(result, args.p_step_id) });
            delete run.pendingBatch;
            if (done || total % 128 === 0) await saveReceipt();
            if (total % 128 === 0) console.log(JSON.stringify({ scenario, phase: result.phase, steps: total, elapsedMs: run.ms }));
            continue;
          }
          // Reserve a whole existing Management request deadline inside this drive's
          // unchanged 20-minute budget. Each batch stops itself after 40s of work
          // (plus its in-flight step), or 256 real calls, or the first more=false.
          // Actual REST bootstrap/idempotency/fencing/claims remain above/below.
          const plan = qaFixtureBatchPlan(total, Date.now() - started);
          if (!plan) break;
          const { limit, workBudgetMs } = plan;
          const attempt = qaBeginDriveAttempt(run, { transport: 'sql', steps: limit, workBudgetMs,
            firstStepId: randomUUID(), state: nextState });
          await saveReceipt();
          const began = Date.now();
          const batch = qaFixtureBatchResult(await sql(`set statement_timeout='60s';
            select ${privateSchema}.qa_drive_batch_v1(${literal(claim.leaseToken)},${literal(claim.epoch)},${limit},${workBudgetMs},${literal(attempt.firstStepId)}) as result;`,
          'fixture-drive'), limit);
          const requestMs = Date.now() - began;
          for (const result of batch.results) observe(result);
          total += batch.results.length; done = batch.results.at(-1).more === false;
          // Residual includes API/queue/serialization/round-trip work; it is not
          // a claim to have measured network latency independently.
          qaRecordFixtureBatch(run, batch, requestMs);
          run.ms = Date.now() - started; nextState = batch.finalState;
          advanceContext = { scenario, state: nextState, observedAt: new Date().toISOString(), successfulCallsSinceSnapshot: 0,
            previousOutcome: qaAdvanceOutcome(batch.results.at(-1), batch.results.at(-1).stepId) };
          await saveReceipt();
          console.log(JSON.stringify({ phase: 'fixture-drive', scenario, steps: total, elapsedMs: run.ms,
            lastPhase: run.lastPhase, batchSteps: batch.results.length, requestMs,
            sqlMs: batch.sqlMs, requestOverheadMs: Math.max(0, requestMs - batch.sqlMs),
            maximumSqlStepMs: batch.maximumSqlStepMs, maximum: batch.maximum,
            timingScope: batch.timingScope, sharedCleanup: batch.sharedCleanup }));
        }
        assert.ok(done, 'bounded-bootstrap-incomplete');
        run.status = 'completed'; run.ms = Date.now() - started;
        const receipt = { steps: total, ms: Date.now() - started };
        identity.bootstrap ??= receipt;
        (identity.bootstrapRuns ??= []).push(receipt);
      } catch (error) {
        const failure = phases.at(-1);
        qaDriveFailure(run, run.pendingBatch || failure?.ok === false ? failure : {});
        run.ms = Date.now() - started;
        throw error;
      } finally {
        if (advanceContext) advanceContext = { ...advanceContext, scenario: null };
        await saveReceipt();
      }
    }
    await drive('initial-bootstrap');
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
    if (mode === 'fixture') {
      // With no lease/backoff, claim really writes checked_at and a new lease.
      // The probe must roll all of it back and compare full owned state, leaving
      // the following replacement claim and stale-owner test untouched.
      assert.equal(await scalar(`(select lease_token is null and lease_until is null and retry_at is null
        from ${schema}.stats_prepared_control where id)`), true);
      identity.claimDiagnosticRollback = await probeClaim();
      assert.deepEqual(identity.claimDiagnosticRollback,
        { sqlstate: null, errorClass: 'rolled-back-success', rollbackVerified: true });
      await saveReceipt();
    }
    const oldClaim = claim;
    claim = await transport(alias('claim_stats_prepared_work_v1'), { p_worker_id: 'replacement', p_request_id: randomUUID() });
    await transport(alias('run_stats_prepared_step_v1'), { ...stepArgs(randomUUID()), p_lease_token: oldClaim.leaseToken, p_epoch: oldClaim.epoch }, { expectedError: '55000' });
    await drive('late-source-repair');
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
      await drive('zero-positive');
      const empty = await scalar(`${schema}.get_stats_prepared_visit_share_v1('1d')`);
      assert.equal(empty.meta.state, 'empty'); assert.equal(empty.meta.current.reason, 'zero-denominator');
      assert.deepEqual(empty.chart.series, []); assert.deepEqual(empty.chart.points, []);
      await transport(alias('finish_stats_prepared_work_v1'), { p_lease_token: claim.leaseToken, p_epoch: claim.epoch, p_outcome: { status: 'completed' } });
      await sql(`delete from ${schema}.roblox_universe_stats_daily where stat_date=current_date;`);
      claim = await transport(alias('claim_stats_prepared_work_v1'), { p_worker_id: 'missing-current-day', p_request_id: randomUUID() });
      await drive('missing-current-day');
      const missing = await scalar(`${schema}.get_stats_prepared_visit_share_v1('1d')`);
      assert.equal(missing.meta.state, 'partial'); assert.equal(missing.meta.current.reason, 'producer-behind');
      await transport(alias('finish_stats_prepared_work_v1'), { p_lease_token: claim.leaseToken, p_epoch: claim.epoch, p_outcome: { status: 'completed' } });
      await sql(`update ${schema}.roblox_universe_stats_hourly set visits_end=9007199254740993 where universe_id=1 and hour_start=(select max(hour_start) from ${schema}.roblox_universe_stats_hourly);`);
      claim = await transport(alias('claim_stats_prepared_work_v1'), { p_worker_id: 'large-counter', p_request_id: randomUUID() });
      await drive('large-counter');
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
      await drive('valid-source-restored');
      await transport(alias('finish_stats_prepared_work_v1'), { p_lease_token: claim.leaseToken, p_epoch: claim.epoch, p_outcome: { status: 'completed' } });
    }
    const visitBeforeMembership = (await scalar(`${schema}.get_stats_prepared_health_v1()`)).operational.visitGeneration;
    await sql(`delete from ${schema}.stats_game_current_index where universe_id=2;`);
    claim = await transport(alias('claim_stats_prepared_work_v1'), { p_worker_id: 'membership', p_request_id: randomUUID() });
    await drive('membership');
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
      await drive('mid-scan-change');
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
        await sql(change); await beginRun(worker); await drive(worker);
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
      await beginRun('cleanup-cap-recovery'); await drive('cleanup-cap-recovery'); await finishRun();

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
      await beginRun('observed-open-hour'); await drive('observed-open-hour');
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
      await drive('close-hour-without-source-write');
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
      await beginRun('hourly-truncate'); await drive('hourly-truncate');
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
      await beginRun('cold-empty-platform'); await drive('cold-empty-platform'); await finishEmptyRun();
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
        await beginRun(`${scenario}-seed`); await drive(`${scenario}-seed`);
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
        await drive(scenario); await finishEmptyRun();
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
