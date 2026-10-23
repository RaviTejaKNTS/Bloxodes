#!/usr/bin/env node
/** GitHub-only managed-development compatibility proof. Node 22; no npm/dotenv. */
import { mkdir, open, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import { PROJECT, TARGET, MIGRATION, PAGES, QaFailure, need, fixtureIdentity, validateIdentity,
  cleanupRecovery, oracleDefinition, setupSql, inspectSql, cleanupSql } from './code-lookups-fixture.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DIRECTORY = new URL('../../tmp/test-reports/code-lookups/', import.meta.url);
const IDENTITY = new URL('cleanup-identity.json', DIRECTORY), BACKEND = new URL('backend.json', DIRECTORY);
const BATCH = 1000, MAX_CODES = 2000, MAX_REQUESTS = 48, MAX_ROWS = 16050, MAX_SQL = 6;
const WALL_MS = 120000, CLEANUP_MS = 35000, PARITY_MS = 20000, BODY_BYTES = 4 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FIELDS = 'id,code_page_id,code,status,rewards_text,level_requirement,is_new,first_seen_at,last_seen_at,posted_online,provider_priority'.split(',');
let receipt = { version: 2, sha: null, runId: null, checks: [], requests: [], sql: [], status: 'running' };
const started = Date.now();
let canSave = false, notStarted = false, receivedRows = 0, parityDeadline = Infinity, identity, context, mode, sqlCalls = 0;
const record = (name, status, extra = {}) => receipt.checks.push({ name, status, ...extra });
const recordFailure = error => {
  const name = error instanceof QaFailure ? error.message : 'transport_json_or_runtime_failure';
  record(name, 'fail'); console.error(`code-lookups QA ${name}`);
};
const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function durableFile(path, value, flag = 'w') {
  await mkdir(DIRECTORY, { recursive: true });
  const file = await open(path, flag, 0o600);
  try { await file.writeFile(JSON.stringify(value, null, 2) + '\n'); await file.sync(); }
  finally { await file.close(); }
}
const save = () => durableFile(BACKEND, receipt);
async function recoveryFile(path) {
  try { return { state: 'present', text: await readFile(path, 'utf8') }; }
  catch (error) { return { state: error.code === 'ENOENT' ? 'missing' : 'unreadable' }; }
}
function micros(value) {
  const m = /^(.*T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  need(m && Number.isFinite(Date.parse(m[1] + m[3])), 'timestamp_shape');
  return BigInt(Date.parse(m[1] + m[3])) * 1000n + BigInt((m[2] ?? '').padEnd(6, '0'));
}
const ordered = (a, b) => cmp(a.status, b.status) || cmp(micros(b.last_seen_at), micros(a.last_seen_at)) || cmp(a.id, b.id);
// The old aggregate leaves equal-key ties unordered. Preserve every real field, normalize only timestamps.
const canonical = rows => rows.map(r => ({ ...r, first_seen_at: String(micros(r.first_seen_at)),
  last_seen_at: String(micros(r.last_seen_at)) })).sort((a, b) => cmp(a.id, b.id));
function validateRows(rows, id) {
  need(rows.length <= MAX_CODES, 'selected_page_row_budget');
  for (const row of rows) {
    need(row && FIELDS.every(k => Object.hasOwn(row, k)) && UUID.test(row.id) &&
      row.code_page_id === id && ['active', 'check', 'expired'].includes(row.status), 'complete_code_fields');
    micros(row.first_seen_at); micros(row.last_seen_at);
  }
  need(new Set(rows.map(r => r.id)).size === rows.length, 'no_duplicate_code_ids');
}
async function json(response) {
  const reader = response.body.getReader(), chunks = []; let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength; need(size <= BODY_BYTES, 'response_byte_budget'); chunks.push(value);
    }
  } finally { await reader.cancel(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
// Only fixed generated SQL reaches this transport. No response/error text or SQL is retained.
async function sql(name, query, deadline = started + WALL_MS) {
  need(++sqlCalls <= MAX_SQL && Date.now() < deadline, 'sql_request_or_wall_budget');
  const entry = { name, httpCode: 0, durationMs: 0 }; receipt.sql.push(entry); const begin = Date.now();
  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
      method: 'POST', redirect: 'error', headers: { Authorization: `Bearer ${process.env.MANAGED_DEV_SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `set statement_timeout='8s'; set lock_timeout='2s'; set timezone='UTC';\n${query}` }),
      signal: AbortSignal.timeout(Math.max(1, Math.min(12000, deadline - begin))) });
    entry.httpCode = response.status;
    const data = await json(response);
    if (/^[A-Z0-9]{5}$/.test(data?.code ?? '')) entry.sqlstate = data.code;
    need(response.ok && Array.isArray(data), 'fixture_sql_failure'); return data;
  } finally { entry.durationMs = Date.now() - begin; }
}
async function query(name, table, params, { key = process.env.MANAGED_DEV_SUPABASE_SERVICE_ROLE,
  schemaRetry = false, denied = false } = {}) {
  need(identity && Object.values(identity.names).includes(table), 'rest_relation_allowlist');
  need(receipt.requests.length < MAX_REQUESTS && Date.now() - started < WALL_MS, 'request_or_wall_budget');
  need(Date.now() < parityDeadline, 'parity_window_exceeded');
  const url = new URL(`/rest/v1/${table}`, TARGET); url.search = new URLSearchParams(params).toString();
  const entry = { name, httpCode: 0, durationMs: 0, rowCount: 0 }; receipt.requests.push(entry); const begin = Date.now();
  try {
    const response = await fetch(url, { method: 'GET', redirect: 'error', headers: { apikey: key,
      Authorization: `Bearer ${key}`, Prefer: 'count=exact' },
      signal: AbortSignal.timeout(Math.max(1, Math.min(8000, WALL_MS - (begin - started), parityDeadline - begin))) });
    entry.httpCode = response.status; const data = await json(response);
    if (denied) {
      need([401, 403].includes(response.status) && data?.code === '42501', 'anonymous_fixture_access_not_denied');
      return {};
    }
    // Retry only cache discovery, before any oracle read. Query failures never become empty passes.
    if (schemaRetry && ['PGRST200', 'PGRST205'].includes(data?.code) && [400, 404].includes(response.status)) return { pending: true };
    const count = /\/(\d+)$/.exec(response.headers.get('content-range') ?? '');
    const total = count ? Number(count[1]) : null;
    const rows = Array.isArray(data) ? data.length + data.reduce((n, r) => n + (Array.isArray(r.codes) ? r.codes.length : 0), 0) : 0;
    receivedRows += rows; entry.rowCount = rows; entry.totalRowCount = total;
    need(receivedRows <= MAX_ROWS, 'total_row_budget');
    if (!response.ok) {
      need(name.startsWith('selected_') && Number(params.offset) > 0 &&
        (response.status === 416 || data?.code === 'PGRST103') && total === Number(params.offset), 'http_query_failure');
      return { data: [], total };
    }
    need(Array.isArray(data), 'response_array_shape');
    if (table !== identity.names.codes) need(data.length <= 1, 'bounded_parent_response');
    return { data, total };
  } finally { entry.durationMs = Date.now() - begin; }
}
const selection = id => ({ select: `*,code_page:${identity.names.pages}!inner(is_published)`, code_page_id: `eq.${id}`,
  'code_page.is_published': 'eq.true', order: 'status.asc,last_seen_at.desc,id.asc', limit: String(BATCH) });
async function selected(id, label) {
  const rows = [], totals = [];
  for (let offset = 0; offset <= MAX_CODES; offset += BATCH) {
    const { data, total } = await query(`selected_${label}`, identity.names.codes, { ...selection(id), offset: String(offset) });
    need(Number.isSafeInteger(total) && total <= MAX_CODES, 'selected_count_or_budget'); totals.push(total);
    need(data.length <= BATCH && (data.length === BATCH || total <= offset + data.length), 'server_cap_truncates_helper');
    for (const { code_page, ...row } of data) {
      need(code_page && !Array.isArray(code_page) && code_page.is_published === true, 'inner_parent_object'); rows.push(row);
    }
    if (data.length < BATCH) break;
  }
  validateRows(rows, id);
  need(totals.every(t => t === rows.length), 'selected_snapshot_count_changed');
  need(rows.every((r, i) => !i || ordered(rows[i - 1], r) <= 0), 'status_last_seen_id_order');
  return rows;
}
async function page(id, published, label) {
  const { data } = await query(label, identity.names.pages, { select: 'id,is_published', id: `eq.${id}`, limit: '1' });
  need(data.length === (published === null ? 0 : 1) && (published === null || data[0].is_published === published), 'fixture_page_state');
}
async function verify() {
  const source = await readFile(new URL(`../../${MIGRATION}`, import.meta.url), 'utf8');
  const candidate = fixtureIdentity({ ...context, nonce: randomBytes(12).toString('hex') });
  const oracle = oracleDefinition(source, candidate);
  // Exclusive creation prevents a second invocation losing an outstanding fixture's identity.
  try { await durableFile(IDENTITY, candidate, 'wx'); }
  catch (error) {
    if (error.code === 'EEXIST') throw new QaFailure('fixture_identity_already_exists');
    throw error;
  }
  // Neither guards nor a refused second verify may replace existing fixture evidence.
  // Authorize saving only after this invocation exclusively persists its own identity.
  identity = candidate; canSave = true;
  receipt.fixture = identity; receipt.oracleSource = { path: MIGRATION, sha256: oracle.sha256 }; await save();
  await sql('create_and_seed_owned_fixture', setupSql(identity, oracle));
  const inspection = await sql('inspect_fixture_security_and_storage', inspectSql(identity));
  need(inspection.length === 4 && inspection.every(r => r.owned && r.source_fk_ok && r.service_select && !r.anon_access &&
    !r.user_access && !r.other_access && !r.application_triggers && !r.shared_sequence_default && !r.external_fk &&
    (r.relkind === 'v' ? r.options.includes('security_invoker=true') : r.relrowsecurity && r.relforcerowsecurity)), 'fixture_service_only_security');
  need(inspection.find(r => r.relname === identity.names.codes)?.foreign_keys === 1 &&
    inspection.find(r => r.relname === identity.names.pages)?.foreign_keys === 1, 'fixture_real_foreign_keys');
  const bytes = inspection.reduce((n, r) => n + r.bytes, 0);
  need(Number.isSafeInteger(bytes) && bytes <= 16 * 1024 * 1024, 'fixture_storage_budget');
  record('fixture_service_only_rls_fk_storage', 'pass', { bytes });
  let ready = false;
  for (let attempt = 0; attempt < 10; attempt++) {
    const result = await query('schema_cache_ready', identity.names.codes, { ...selection(PAGES.empty), limit: '1' }, { schemaRetry: true });
    if (!result.pending) { need(result.data.length === 0, 'published_empty_schema_probe'); ready = true; break; }
    if (attempt < 9) await pause(500);
  }
  need(ready, 'schema_cache_not_ready');
  for (const table of Object.values(identity.names)) await query('anonymous_fixture_denied', table,
    { select: table === identity.names.universes ? 'universe_id' : 'id', limit: '1' },
    { key: process.env.MANAGED_DEV_SUPABASE_ANON_KEY, denied: true });
  record('anonymous_http_denied_all_fixture_relations', 'pass');
  for (const { count, id } of PAGES.sizes) {
    await page(id, true, `published_${count}`);
    parityDeadline = Date.now() + PARITY_MS;
    const before = await selected(id, `${count}_before`);
    // Exactly one canonical old-view request for each fixed published fixture, with no oracle retry.
    const { data: old } = await query(`old_view_once_${count}`, identity.names.oracle, {
      select: 'id,codes,active_code_count', id: `eq.${id}`, is_published: 'eq.true', limit: '1' });
    const after = await selected(id, `${count}_after`);
    need(Date.now() <= parityDeadline, 'parity_window_exceeded'); parityDeadline = Infinity;
    need(before.length === count && isDeepStrictEqual(canonical(before), canonical(after)), 'owned_fixture_full_snapshot_stability');
    need(old.length === 1 && old[0].id === id && Array.isArray(old[0].codes), 'old_view_shape');
    validateRows(old[0].codes, id);
    need(isDeepStrictEqual(canonical(before), canonical(old[0].codes)) &&
      Number(old[0].active_code_count) === count - 2 && before.filter(r => r.status === 'active').length === count - 2,
      'old_view_ids_fields_counts_mismatch');
    need(['active', 'check', 'expired'].every(status => before.some(r => r.status === status)) &&
      ['rewards_text', 'level_requirement', 'is_new'].every(field => before.some(r => r[field] === null)), 'fixture_status_null_coverage');
    need(before.some((r, i) => i && r.status === before[i - 1].status && micros(r.last_seen_at) === micros(before[i - 1].last_seen_at)), 'fixture_tie_coverage');
    need(new Set(before.filter(r => r.status === 'active').map(r => String(micros(r.last_seen_at)))).size > 1,
      'fixture_descending_timestamp_coverage');
    if (count === 2000) {
      need(before.slice(BATCH).some(r => r.status === 'active') &&
        micros(before[count - 3].first_seen_at) > micros(before[0].first_seen_at), 'active_and_newest_beyond_first_batch');
      need(before[BATCH - 1].status === before[BATCH].status &&
        micros(before[BATCH - 1].last_seen_at) === micros(before[BATCH].last_seen_at), 'equal_sort_keys_across_batch_boundary');
    }
    record(`old_view_full_parity_${count}`, 'pass', { rowCount: count, activeCount: count - 2 });
  }
  await page(PAGES.draft, false, 'draft_exists');
  const { data: draftCodes } = await query('draft_has_owned_code', identity.names.codes,
    { select: 'id', code_page_id: `eq.${PAGES.draft}`, limit: '1' });
  need(draftCodes.length === 1, 'draft_fixture_has_code');
  for (const [label, id, state] of [['draft', PAGES.draft, false], ['published_empty', PAGES.empty, true], ['nonexistent', PAGES.missing, null]]) {
    if (label !== 'draft') await page(id, state, `${label}_state`);
    need((await selected(id, label)).length === 0, `${label}_query_not_empty`); record(`${label}_query_empty`, 'pass');
  }
}
async function cleanup() {
  if (!identity) return;
  validateIdentity(identity, context);
  const deadline = Date.now() + CLEANUP_MS;
  receipt.cleanup = { status: 'failed', attempts: 0 };
  for (let attempt = 0; attempt < 3; attempt++) {
    receipt.cleanup.attempts++;
    try {
      const result = await sql('cleanup_exact_owned_relations', cleanupSql(identity), deadline);
      need(result.length === 1 && result[0].cleaned === true, 'fixture_cleanup_readback');
      receipt.cleanup.status = 'pass'; return;
    } catch { if (attempt < 2 && Date.now() + 1000 < deadline) await pause(500); }
  }
  throw new QaFailure('fixture_cleanup_failed');
}
async function guard() {
  const env = process.env, args = process.argv.slice(2), options = {};
  for (let i = 0; i < args.length; i += 2) {
    need(['--mode', '--expected-sha'].includes(args[i]) && !Object.hasOwn(options, args[i]) && args[i + 1], 'argument_allowlist');
    options[args[i]] = args[i + 1];
  }
  mode = options['--mode'] ?? 'verify'; need(['verify', 'cleanup'].includes(mode), 'mode_allowlist');
  need(env.GITHUB_ACTIONS === 'true' && env.CODE_LOOKUPS_QA === '1', 'explicit_github_guard');
  need(process.versions.node.split('.')[0] === '22', 'node_22_required');
  need(env.GITHUB_REPOSITORY === 'RaviTejaKNTS/Bloxodes', 'repository_guard');
  need(/^[a-f0-9]{40}$/.test(options['--expected-sha'] ?? ''), 'expected_sha_required');
  const git = args => execFileSync('git', args, { cwd: ROOT, timeout: 3000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const sha = git(['rev-parse', 'HEAD']); need(sha === options['--expected-sha'], 'checkout_sha_guard');
  need(git(['status', '--porcelain', '--untracked-files=all', '--', 'scripts/ci/code-lookups-*', MIGRATION,
    '.github/workflows/pull-request.yml', 'apps/web/src/lib/db.ts', 'apps/web/src/lib/extension-codes.ts',
    'apps/web/src/lib/__tests__/code-lookups.test.ts']) === '', 'source_files_must_match_sha');
  const event = JSON.parse(await readFile(env.GITHUB_EVENT_PATH, 'utf8'));
  need(event.repository?.full_name === env.GITHUB_REPOSITORY, 'event_repository_guard');
  if (env.GITHUB_EVENT_NAME === 'pull_request') need(event.pull_request?.head?.repo?.full_name === env.GITHUB_REPOSITORY &&
    event.pull_request?.base?.repo?.full_name === env.GITHUB_REPOSITORY && event.pull_request?.head?.sha === sha, 'same_repo_pr_sha_guard');
  else need(['push', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME) && env.GITHUB_SHA === sha, 'event_sha_guard');
  need(/^\d{1,20}$/.test(env.GITHUB_RUN_ID ?? '') && /^\d{1,6}$/.test(env.GITHUB_RUN_ATTEMPT ?? ''), 'run_identity_guard');
  context = { sha, runId: env.GITHUB_RUN_ID, attempt: env.GITHUB_RUN_ATTEMPT };
  receipt.sha = sha; receipt.runId = context.runId; receipt.attempt = context.attempt;
  need(env.MANAGED_DEV_SUPABASE_URL === TARGET && !!env.MANAGED_DEV_SUPABASE_SERVICE_ROLE &&
    !!env.MANAGED_DEV_SUPABASE_ACCESS_TOKEN && !!env.MANAGED_DEV_SUPABASE_ANON_KEY, 'exact_managed_dev_credentials');
}
try {
  await guard();
  if (mode === 'cleanup') {
    const recovery = cleanupRecovery({ context,
      identityFile: await recoveryFile(IDENTITY), backendFile: await recoveryFile(BACKEND) });
    ({ identity, receipt, canSave, notStarted } = recovery);
    if (recovery.failure) console.error(`code-lookups QA ${recovery.failure}`);
    await cleanup();
  } else {
    try {
      await verify(); need(Date.now() - started <= WALL_MS, 'whole_wall_budget'); record('required_fixture_compatibility', 'pass');
    } catch (error) { recordFailure(error); }
    finally { await cleanup(); }
  }
} catch (error) { recordFailure(error); }
receipt.durationMs = Date.now() - started;
receipt.status = receipt.checks.some(c => c?.status === 'fail') ? 'fail' : notStarted ? 'not_started' : 'pass';
if (canSave) {
  try { await save(); } catch { receipt.status = 'fail'; console.error('code-lookups QA receipt_write_failed'); }
}
console.log(`code-lookups backend QA ${mode ?? 'guard'}: ${notStarted ? 'not_started_noop' : receipt.status}`);
process.exitCode = receipt.status === 'fail' ? 1 : 0;
