#!/usr/bin/env node
/** GitHub-only recovery of one frozen failed artifact. Never creates fixtures. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, open, readFile, rename } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { crc32 } from './code-lookups-recover.mjs';
import { qaSqlFailureDiagnostic } from './stats-prepared-db-qa.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const REPO = 'RaviTejaKNTS/Bloxodes', REPO_ID = 1203603485;
const WORKFLOW = '.github/workflows/pull-request.yml', BRANCH = 'chore/audit-site-errors';
const PROJECT = 'bbtcaurrtyoukvjbxbbj', TARGET = `https://${PROJECT}.supabase.co`;
export const APPLY_SELECTION = 'reconcile-39973670048';
export const SOURCE = Object.freeze({ runId: '39973670048', attempt: 1,
  sha: '9d97c858ba9f0182b2261ac9cb8765b126a9c4a6', artifactId: 12510770736, size: 1249,
  zipSha256: 'f3030c5149677b672ee8b961c61477d062e10971ebe956ab3ee8616e681d83cf',
  artifactName: 'stats-prepared-database-9d97c858ba9f0182b2261ac9cb8765b126a9c4a6-39973670048',
  schema: 'qa_stats_681b32f02ed9', privateSchema: 'qa_stats_681b32f02ed9_p', prefix: 'qa_681b32f02ed9_' });
const RPCS = Object.freeze({ get_sp_health_v1: '', get_sp_platform_chart_v1: 'text, text, boolean',
  get_sp_visit_share_v1: 'text', claim_sp_work_v1: 'text, uuid',
  run_sp_step_v1: 'uuid, bigint, uuid, jsonb', get_sp_receipt_v1: 'uuid',
  finish_sp_work_v1: 'uuid, bigint, jsonb', timeout: '' });
const TABLES = ['roblox_universes', 'stats_game_current_index', 'roblox_universe_stats_hourly',
  'roblox_universe_stats_daily', 'revalidation_events', 'stats_prepared_control', 'stats_prepared_members',
  'stats_prepared_dirty', 'stats_prepared_versions', 'stats_prepared_buckets', 'stats_prepared_visits',
  'stats_prepared_generations', 'stats_prepared_visit_universes', 'stats_prepared_visit_totals',
  'stats_prepared_visit_ranges', 'stats_prepared_receipts'];
const FUNCTIONS = ['get_stats_prepared_health_v1', 'get_stats_prepared_platform_chart_v1',
  'get_stats_prepared_visit_share_v1', 'claim_stats_prepared_work_v1', 'run_stats_prepared_step_v1',
  'get_stats_prepared_receipt_v1', 'finish_stats_prepared_work_v1'];
const HELPERS = ['stats_prepared_row_v1', 'stats_prepared_capture_v1', 'stats_prepared_period_v1',
  'stats_prepared_empty_coverage_v1', 'stats_prepared_publish_platform_v1', 'stats_prepared_hour_v1',
  'stats_prepared_daily_v1', 'stats_prepared_visit_start_v1', 'stats_prepared_visit_totals_v1',
  'stats_prepared_visit_range_v1', 'stats_prepared_visit_publish_v1', 'stats_prepared_cleanup_v1',
  'stats_prepared_immutable_v1'];
const literal = s => `'${s.replaceAll("'", "''")}'`;
const names = Object.keys(RPCS).map(name => SOURCE.prefix + name);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
class RecoveryFailure extends Error {}
const requireThat = (ok, reason) => { if (!ok) throw new RecoveryFailure(reason); };
const safeFailure = error => error instanceof RecoveryFailure ? error.message : 'recovery_guard_transport_or_evidence_failure';

export function executionContext({ env, event, args, checkout, nodeVersion = process.versions.node }) {
  requireThat(args.length === 4 && args[0] === '--expected-sha' && args[2] === '--apply-selection' &&
    args[3] === APPLY_SELECTION && /^[a-f0-9]{40}$/.test(args[1] ?? ''), 'recovery_arguments');
  const sha = args[1];
  requireThat(env.GITHUB_ACTIONS === 'true' && env.STATS_PREPARED_RECOVERY === '1' &&
    nodeVersion.split('.')[0] === '22' && env.GITHUB_EVENT_NAME === 'workflow_dispatch' &&
    event.inputs?.stats_prepared_recovery === APPLY_SELECTION, 'recovery_manual_selection');
  requireThat(env.GITHUB_REPOSITORY === REPO && env.GITHUB_REPOSITORY_ID === String(REPO_ID) &&
    event.repository?.full_name === REPO && event.repository?.id === REPO_ID, 'recovery_repository');
  requireThat(checkout.sha === sha && env.GITHUB_SHA === sha && env.GITHUB_WORKFLOW_SHA === sha &&
    checkout.status === '' && resolve(checkout.root) === resolve(ROOT) &&
    resolve(env.GITHUB_WORKSPACE ?? '') === resolve(ROOT), 'recovery_checkout');
  requireThat(env.GITHUB_REF === `refs/heads/${env.GITHUB_REF_NAME}` && env.GITHUB_REF_NAME === BRANCH &&
    [env.GITHUB_REF, BRANCH].includes(event.ref) &&
    env.GITHUB_WORKFLOW_REF === `${REPO}/${WORKFLOW}@${env.GITHUB_REF}` &&
    /^\d{1,20}$/.test(env.GITHUB_RUN_ID ?? '') && /^\d{1,6}$/.test(env.GITHUB_RUN_ATTEMPT ?? ''), 'recovery_event');
  requireThat(env.MANAGED_DEV_SUPABASE_URL === TARGET && !!env.MANAGED_DEV_SUPABASE_ACCESS_TOKEN &&
    !!env.GITHUB_TOKEN && !Object.entries(env).some(([key, value]) => value && (
      (/SUPABASE.*(?:URL|TOKEN|KEY|ROLE|PASSWORD)/i.test(key) &&
        !['MANAGED_DEV_SUPABASE_URL', 'MANAGED_DEV_SUPABASE_ACCESS_TOKEN'].includes(key)) ||
      /(?:PROD|PRODUCTION).*(?:TOKEN|KEY|SECRET|PASSWORD|URL)|(?:TOKEN|KEY|SECRET|PASSWORD).*PROD/i.test(key))),
  'recovery_credentials');
  return { sha, runId: env.GITHUB_RUN_ID, attempt: env.GITHUB_RUN_ATTEMPT };
}

export function validateProvenance(run, artifact, workflow) {
  requireThat(workflow?.path === WORKFLOW && Number.isSafeInteger(workflow.id) &&
    run?.workflow_id === workflow.id && run.path === WORKFLOW && String(run.id) === SOURCE.runId &&
    run.run_attempt === SOURCE.attempt && run.event === 'workflow_dispatch' && run.status === 'completed' &&
    run.conclusion === 'failure' && run.head_sha === SOURCE.sha && run.head_branch === BRANCH &&
    run.repository?.id === REPO_ID && run.repository?.full_name === REPO &&
    run.head_repository?.id === REPO_ID && run.head_repository?.full_name === REPO, 'source_run_mismatch');
  requireThat(artifact?.id === SOURCE.artifactId && artifact.name === SOURCE.artifactName &&
    artifact.size_in_bytes === SOURCE.size && artifact.digest === `sha256:${SOURCE.zipSha256}` &&
    artifact.expired === false && String(artifact.workflow_run?.id) === SOURCE.runId &&
    artifact.workflow_run.repository_id === REPO_ID && artifact.workflow_run.head_repository_id === REPO_ID &&
    artifact.workflow_run.head_sha === SOURCE.sha && artifact.workflow_run.head_branch === BRANCH &&
    artifact.archive_download_url === `https://api.github.com/repos/${REPO}/actions/artifacts/${SOURCE.artifactId}/zip`,
  'source_artifact_mismatch');
}

// One pinned member, with exact archive digest. No shell unzip or paths from ZIP metadata.
export function verifiedReceipt(bytes) {
  requireThat(Buffer.isBuffer(bytes) && bytes.length === SOURCE.size && digest(bytes) === SOURCE.zipSha256,
    'source_zip_digest_mismatch');
  const end = bytes.length - 22;
  requireThat(bytes.readUInt32LE(end) === 0x06054b50 && bytes.readUInt32LE(0) === 0x04034b50 &&
    bytes.readUInt16LE(end + 4) === 0 && bytes.readUInt16LE(end + 6) === 0 &&
    bytes.readUInt16LE(end + 8) === 1 && bytes.readUInt16LE(end + 10) === 1 &&
    bytes.readUInt16LE(end + 20) === 0, 'source_archive_directory');
  const at = bytes.readUInt32LE(end + 16);
  requireThat(at >= 30 && at + 46 <= end && bytes.readUInt32LE(at) === 0x02014b50 &&
    at + bytes.readUInt32LE(end + 12) === end, 'source_archive_bounds');
  const compressed = bytes.readUInt32LE(at + 20), plain = bytes.readUInt32LE(at + 24);
  const flags = bytes.readUInt16LE(at + 8), method = bytes.readUInt16LE(at + 10);
  const nameSize = bytes.readUInt16LE(at + 28), extraSize = bytes.readUInt16LE(at + 30);
  const start = 30 + bytes.readUInt16LE(26) + bytes.readUInt16LE(28);
  requireThat(plain > 0 && plain <= 128 * 1024 && compressed > 0 && start + compressed <= at &&
    bytes.readUInt32LE(at + 42) === 0 && bytes.readUInt16LE(at + 34) === 0 &&
    (flags & ~0x0808) === 0 && [0, 8].includes(method) &&
    bytes.readUInt16LE(6) === flags && bytes.readUInt16LE(8) === method &&
    at + 46 + nameSize + extraSize + bytes.readUInt16LE(at + 32) === end &&
    bytes.subarray(at + 46, at + 46 + nameSize).equals(Buffer.from('stats-prepared-db-qa.json')) &&
    bytes.subarray(30, 30 + bytes.readUInt16LE(26)).equals(Buffer.from('stats-prepared-db-qa.json')),
  'source_archive_member');
  const raw = method === 8 ? inflateRawSync(bytes.subarray(start, start + compressed), { maxOutputLength: 128 * 1024 }) :
    bytes.subarray(start, start + compressed);
  requireThat(raw.length === plain && crc32(raw) === bytes.readUInt32LE(at + 16), 'source_archive_crc');
  validateDocument(JSON.parse(raw.toString('utf8')));
  return raw;
}

export function validateDocument(receipt) {
  requireThat(receipt?.project === PROJECT && receipt.sha === SOURCE.sha && receipt.mode === 'benchmark' &&
    receipt.schema === SOURCE.schema && receipt.privateSchema === SOURCE.privateSchema && receipt.prefix === SOURCE.prefix &&
    JSON.stringify(receipt.functions) === JSON.stringify(names) && receipt.cleaned === false && receipt.completed === false &&
    receipt.sqlFailure?.phase === 'fixture-checks' && receipt.sqlFailure.sqlstate === '53100' &&
    receipt.sqlFailure.status === 400 && receipt.cleanupFailed === true && Array.isArray(receipt.phases) &&
    !receipt.drives && receipt.phases.filter(p => p?.phase === 'cleanup' && p.ok === false && p.status === 400).length === 2,
  'source_receipt_mismatch');
  return receipt;
}

export function absenceSql() {
  return `select not exists(select 1 from pg_namespace where nspname in (${literal(SOURCE.schema)},${literal(SOURCE.privateSchema)}))
    and not exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname in (${names.map(literal)})) as absent;`;
}

export function cleanupSql() {
  // Explicit transaction mode overrides only this transaction, including when
  // provider defaults are read-only. No global/role/database/session setting.
  // RESTRICT makes unknown/external dependencies fail and roll the whole drop back.
  return `begin;
set transaction read write;
set local statement_timeout='20s'; set local lock_timeout='2s'; set local search_path=pg_catalog;
do $recovery$ declare r record; changed integer; turn integer; target_tables oid[]; table_list text; begin
  if exists(select 1 from pg_namespace where nspname in (${literal(SOURCE.schema)},${literal(SOURCE.privateSchema)})
    and nspowner<>(select oid from pg_roles where rolname=current_user)) then
    raise exception 'recovery_ownership_mismatch'; end if;
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in (${literal(SOURCE.schema)},${literal(SOURCE.privateSchema)}) and
    (c.relowner<>(select oid from pg_roles where rolname=current_user) or
      (c.relkind='r' and (n.nspname<>${literal(SOURCE.schema)} or c.relname not in (${TABLES.map(literal)}))) or
      c.relkind not in ('r','i','S'))) then raise exception 'recovery_relation_mismatch'; end if;
  -- Capture only independently validated owned, allowlisted ordinary tables.
  select coalesce(array_agg(c.oid),'{}'::oid[]),
    string_agg(format('%I.%I',n.nspname,c.relname),', ' order by c.relname)
    into target_tables,table_list from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname=${literal(SOURCE.schema)} and c.relkind='r' and c.relname in (${TABLES.map(literal)})
      and c.relowner=(select oid from pg_roles where rolname=current_user);
  -- Reject either direction before mutation: dropping an outbound FK would also
  -- remove its internal triggers on the external referenced table, even with RESTRICT.
  if exists(select 1 from pg_constraint where contype='f' and
    ((conrelid=any(target_tables))<>(confrelid=any(target_tables))))
    then raise exception 'recovery_external_fk_dependency'; end if;
  -- An external sequence/index/partition must never disappear through an automatic dependency.
  if exists(select 1 from pg_depend d join pg_class c on d.classid='pg_class'::regclass and c.oid=d.objid
    join pg_class parent on d.refclassid='pg_class'::regclass and parent.oid=d.refobjid
    join pg_namespace n on n.oid=parent.relnamespace
    where n.nspname in (${literal(SOURCE.schema)},${literal(SOURCE.privateSchema)})
      and c.relnamespace<>parent.relnamespace and c.oid<>parent.reltoastrelid
      and not exists(select 1 from pg_class toast where toast.oid=parent.reltoastrelid and toast.reltoastrelid=c.oid))
    then raise exception 'recovery_external_relation_dependency'; end if;
  for r in select p.*,n.nspname,oidvectortypes(p.proargtypes) args from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace where n.nspname in
    (${literal(SOURCE.schema)},${literal(SOURCE.privateSchema)}) or
    (n.nspname='public' and p.proname in (${names.map(literal)})) loop
    if r.proowner<>(select oid from pg_roles where rolname=current_user) or r.prokind<>'f' or
      (r.nspname=${literal(SOURCE.schema)} and r.proname not in (${FUNCTIONS.map(literal)})) or
      (r.nspname=${literal(SOURCE.privateSchema)} and r.proname not in (${HELPERS.map(literal)})) or
      (r.nspname='public' and (r.prosecdef or not (${Object.entries(RPCS).map(([name, args]) => `(r.proname=${literal(SOURCE.prefix + name)} and r.args=${literal(args)})`).join(' or ')})))
      then raise exception 'recovery_function_mismatch'; end if;
  end loop;
  -- Remove only triggers attached to the owned tables; functions may depend on
  -- owned row types. RESTRICT handles order without widening the deletion set.
  for r in select t.tgname,c.relname from pg_trigger t join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace where n.nspname=${literal(SOURCE.schema)} and not t.tgisinternal loop
    execute format('drop trigger %I on %I.%I restrict',r.tgname,${literal(SOURCE.schema)},r.relname);
  end loop;
  for turn in 1..32 loop
    changed:=0;
    for r in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in (${literal(SOURCE.schema)},${literal(SOURCE.privateSchema)}) or
      (n.nspname='public' and p.proname in (${names.map(literal)})) loop
      begin execute 'drop function '||r.sig||' restrict'; changed:=changed+1;
      exception when dependent_objects_still_exist then null; end;
    end loop;
    -- One exact group handles intragroup FKs, including cycles, without removing
    -- external dependencies. Keep retries for function/composite-type ordering.
    if table_list is not null then
      begin execute 'drop table '||table_list||' restrict'; table_list:=null; changed:=changed+1;
      exception when dependent_objects_still_exist then null; end;
    end if;
    exit when changed=0;
  end loop;
  ${[SOURCE.schema, SOURCE.privateSchema].map(schema => `execute 'drop schema if exists ${schema} restrict';`).join('\n  ')}
  if exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname in (${names.map(literal)}))
    then raise exception 'recovery_alias_dependency'; end if;
end $recovery$;
notify pgrst,'reload schema';
commit;
select true as "guardedDropCommitted";`;
}

async function body(response, max) {
  requireThat(response.body, 'response_body_missing');
  const reader = response.body.getReader(), chunks = []; let length = 0;
  try { for (;;) { const { done, value } = await reader.read(); if (done) break;
    length += value.byteLength; requireThat(length <= max, 'response_byte_budget'); chunks.push(value); }
  } finally { await reader.cancel(); }
  return Buffer.concat(chunks);
}
export async function acquireSource(token, fetcher = fetch) {
  const request = async (url, authenticated = true, redirect = 'error') => fetcher(url, {
    method: 'GET', redirect, signal: AbortSignal.timeout(12000), headers: authenticated ? {
      Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } : {} });
  const json = async suffix => { const response = await request(`https://api.github.com/repos/${REPO}/${suffix}`);
    requireThat(response.ok, 'source_api_failure'); return JSON.parse((await body(response, 1024 * 1024)).toString('utf8')); };
  const workflow = await json('actions/workflows/pull-request.yml');
  const run = await json(`actions/runs/${SOURCE.runId}`), artifact = await json(`actions/artifacts/${SOURCE.artifactId}`);
  validateProvenance(run, artifact, workflow);
  const redirect = await request(artifact.archive_download_url, true, 'manual');
  requireThat(redirect.status === 302, 'source_download_redirect');
  const location = new URL(redirect.headers.get('location'));
  requireThat(location.protocol === 'https:' && !location.username && !location.password && !location.port && !location.hash &&
    /\.(?:blob\.core\.windows\.net|actions\.githubusercontent\.com)$/.test(location.hostname), 'source_download_host');
  await redirect.body?.cancel();
  const response = await request(location.href, false);
  requireThat(response.ok, 'source_download_failure');
  const zip = await body(response, SOURCE.size), original = verifiedReceipt(zip);
  return { zip, original };
}

// Explicit test seams; the CLI always supplies acquireSource and the default verifier.
export async function recover({ acquire, persist, query, receipt, verify = verifiedReceipt }) {
  try {
    await persist();
    const bundle = await acquire();
    // Validate at the mutation boundary even when an injected acquisition seam is used.
    const original = verify(bundle.zip);
    requireThat(original.equals(bundle.original), 'source_original_mismatch');
    validateDocument(JSON.parse(original.toString('utf8')));
    await persist(bundle); receipt.sourceValidated = true; await persist();
    const dropped = await query(cleanupSql(), 'cleanup');
    requireThat(JSON.stringify(dropped) === '[{"guardedDropCommitted":true}]', 'recovery_drop_commit_not_proven');
    receipt.guardedDropCommitted = true;
    const rows = await query(absenceSql(), 'absence');
    requireThat(JSON.stringify(rows) === '[{"absent":true}]', 'recovery_absence_not_proven');
    receipt.absenceProven = true; receipt.status = 'reconciled';
  } catch (error) { receipt.status = 'failed'; receipt.failure = safeFailure(error); }
  finally { await persist(); }
  return receipt;
}

async function durable(file, bytes, flags = 'wx', mode = 0o600) {
  const handle = await open(file, flags, mode);
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
}
async function main() {
  let receipt;
  try {
    const env = process.env;
    const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', timeout: 3000,
      stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1024 * 1024 }).trim();
    const execution = executionContext({ env, args: process.argv.slice(2),
      event: JSON.parse(await readFile(env.GITHUB_EVENT_PATH, 'utf8')), checkout: {
        sha: git(['rev-parse', 'HEAD']), root: git(['rev-parse', '--show-toplevel']),
        status: git(['status', '--porcelain', '--untracked-files=all']) } });
    const root = join(ROOT, 'tmp/test-reports/stats-prepared-recovery');
    await mkdir(root, { recursive: true });
    const directory = await mkdtemp(join(root, `${execution.sha}-${execution.runId}-${execution.attempt}-`));
    receipt = { execution, source: SOURCE, historicalCompleted: false, historicalCleaned: false,
      status: 'not_started', sourceValidated: false, absenceProven: false, requests: [] };
    const persist = async bundle => {
      if (bundle) {
        await durable(join(directory, 'source.zip'), bundle.zip, 'wx', 0o400);
        await durable(join(directory, 'original-stats-prepared-db-qa.json'), bundle.original, 'wx', 0o400);
      }
      await durable(join(directory, 'recovery.pending'), JSON.stringify(receipt, null, 2), 'w');
      await rename(join(directory, 'recovery.pending'), join(directory, 'recovery.json'));
    };
    await recover({ receipt, persist, acquire: () => acquireSource(env.GITHUB_TOKEN),
      query: async (query, phase) => {
        const entry = { phase, status: null, ok: false, ms: 0 }; receipt.requests.push(entry); await persist();
        const started = Date.now(); let result;
        try {
          const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
            method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000), headers: {
              Authorization: `Bearer ${env.MANAGED_DEV_SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }) });
          entry.status = response.status;
          result = JSON.parse((await body(response, 128 * 1024)).toString('utf8'));
          requireThat(response.ok && Array.isArray(result), 'recovery_sql_failure'); entry.ok = true; return result;
        } catch (error) {
          Object.assign(entry, qaSqlFailureDiagnostic({ phase: 'cleanup', status: entry.status, result, query }));
          entry.phase = phase; throw error;
        } finally { entry.ms = Date.now() - started; await persist(); }
      } });
    process.exitCode = receipt.status === 'reconciled' ? 0 : 1;
  } catch { console.error('stats-prepared recovery guard_or_evidence_failure'); process.exitCode = 1; }
  console.log(`stats-prepared recovery: ${receipt?.status === 'reconciled' && process.exitCode === 0 ? 'reconciled' : 'failed'}`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
