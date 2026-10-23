#!/usr/bin/env node
/** GitHub-only, read-only managed-development compatibility proof. Node 22; no npm/dotenv. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TARGET = 'https://bbtcaurrtyoukvjbxbbj.supabase.co';
const BATCH = 1000, MAX_CODES = 3000, MAX_REQUESTS = 16, MAX_ROWS = 10010;
const WALL_MS = 60000, PARITY_MS = 20000, BODY_BYTES = 4 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FIELDS = 'id,code_page_id,code,status,rewards_text,level_requirement,is_new,first_seen_at,last_seen_at,posted_online,provider_priority'.split(',');
const receipt = { sha: null, runId: null, checks: [], requests: [] };
const started = Date.now();
let canSave = false, receivedRows = 0, parityDeadline = Infinity;
class QaFailure extends Error {}
const need = (ok, name) => { if (!ok) throw new QaFailure(name); };
const record = (name, status, extra = {}) => receipt.checks.push({ name, status, ...extra });
const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;
function micros(value) {
  const m = /^(.*T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  need(m && Number.isFinite(Date.parse(m[1] + m[3])), 'timestamp_shape');
  return BigInt(Date.parse(m[1] + m[3])) * 1000n + BigInt((m[2] ?? '').padEnd(6, '0'));
}
const ordered = (a, b) => cmp(a.status, b.status) || cmp(micros(b.last_seen_at), micros(a.last_seen_at)) || cmp(a.id, b.id);
// Compare the independent old JSON aggregate by ID; SQL never ordered equal-key ties.
const canonical = rows => rows.map(r => ({ ...r, first_seen_at: String(micros(r.first_seen_at)),
  last_seen_at: String(micros(r.last_seen_at)) })).sort((a, b) => cmp(a.id, b.id));
function validateRows(rows, id) {
  need(rows.length <= MAX_CODES, 'selected_page_row_budget');
  for (const row of rows) need(row && FIELDS.every(k => Object.hasOwn(row, k)) && UUID.test(row.id) &&
    row.code_page_id === id && ['active', 'check', 'expired'].includes(row.status), 'complete_code_fields');
  for (const row of rows) { micros(row.first_seen_at); micros(row.last_seen_at); }
}
async function query(name, table, params) {
  need(receipt.requests.length < MAX_REQUESTS && Date.now() - started < WALL_MS, 'request_or_wall_budget');
  need(Date.now() < parityDeadline, 'parity_window_exceeded');
  const url = new URL(`/rest/v1/${table}`, TARGET);
  url.search = new URLSearchParams(params).toString();
  const entry = { name, httpCode: 0, durationMs: 0, rowCount: 0 };
  receipt.requests.push(entry);
  const begin = Date.now();
  try {
    const response = await fetch(url, { method: 'GET', redirect: 'error',
      headers: { apikey: process.env.MANAGED_DEV_SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${process.env.MANAGED_DEV_SUPABASE_SERVICE_ROLE}`, Prefer: 'count=exact' },
      signal: AbortSignal.timeout(Math.max(1, Math.min(8000, WALL_MS - (begin - started), parityDeadline - begin))) });
    entry.httpCode = response.status;
    const reader = response.body.getReader(); const chunks = []; let size = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        size += value.byteLength; need(size <= BODY_BYTES, 'response_byte_budget'); chunks.push(value);
      }
    } finally { await reader.cancel(); }
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const count = /\/(\d+)$/.exec(response.headers.get('content-range') ?? '');
    const total = count ? Number(count[1]) : null;
    const rows = Array.isArray(data) ? data.length + data.reduce((n, r) => n + (Array.isArray(r.codes) ? r.codes.length : 0), 0) : 0;
    receivedRows += rows; entry.rowCount = rows; entry.totalRowCount = total;
    need(receivedRows <= MAX_ROWS, 'total_row_budget');
    // Only an exact-multiple terminal range error is acceptable; never log its body.
    if (!response.ok) {
      need(name.startsWith('selected_') && Number(params.offset) > 0 &&
        (response.status === 416 || data?.code === 'PGRST103') && total === Number(params.offset), 'http_query_failure');
      return { data: [], total };
    }
    need(Array.isArray(data), 'response_array_shape');
    if (table !== 'codes') need(data.length <= 1, 'bounded_parent_response');
    if (table === 'code_pages') need(data.every(r => !r.codes || (Array.isArray(r.codes) && r.codes.length <= 1)), 'bounded_discovery_embed');
    return { data, total };
  } catch (error) {
    if (error instanceof QaFailure) throw error;
    throw new QaFailure(['AbortError', 'TimeoutError'].includes(error?.name) ? 'request_timeout'
      : error instanceof SyntaxError ? 'invalid_json_response' : 'request_transport_failure');
  } finally { entry.durationMs = Date.now() - begin; }
}
const selection = id => ({ select: '*,code_page:code_pages!inner(is_published)', code_page_id: `eq.${id}`,
  'code_page.is_published': 'eq.true', order: 'status.asc,last_seen_at.desc,id.asc', limit: String(BATCH) });
async function selected(id, label) {
  const rows = []; const totals = [];
  for (let offset = 0; offset <= MAX_CODES; offset += BATCH) {
    const { data, total } = await query(`selected_${label}`, 'codes', { ...selection(id), offset: String(offset) });
    need(Number.isSafeInteger(total) && total <= MAX_CODES, 'selected_count_or_budget'); totals.push(total);
    need(data.length <= BATCH && (data.length === BATCH || total <= offset + data.length), 'server_cap_truncates_helper');
    for (const { code_page, ...row } of data) {
      need(code_page && !Array.isArray(code_page) && code_page.is_published === true, 'inner_parent_object'); rows.push(row);
    }
    if (data.length < BATCH) break;
  }
  validateRows(rows, id);
  return { rows, changed: totals.some(t => t !== totals[0]) || rows.length !== totals[0] };
}
async function main() {
  const env = process.env, args = process.argv.slice(2);
  need(env.GITHUB_ACTIONS === 'true' && env.CODE_LOOKUPS_QA === '1', 'explicit_github_guard');
  need(process.versions.node.split('.')[0] === '22', 'node_22_required');
  need(env.GITHUB_REPOSITORY === 'RaviTejaKNTS/Bloxodes', 'repository_guard');
  need(args.length === 2 && args[0] === '--expected-sha' && /^[a-f0-9]{40}$/.test(args[1]), 'expected_sha_required');
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, timeout: 3000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  need(sha === args[1], 'checkout_sha_guard');
  need(execFileSync('git', ['status', '--porcelain', '--untracked-files=all', '--',
    'scripts/ci/code-lookups-qa.mjs', 'apps/web/src/lib/db.ts', 'apps/web/src/lib/extension-codes.ts',
    'apps/web/src/lib/__tests__/code-lookups.test.ts'], { cwd: ROOT, timeout: 3000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() === '', 'source_files_must_match_sha');
  const event = JSON.parse(await readFile(env.GITHUB_EVENT_PATH, 'utf8'));
  need(event.repository?.full_name === env.GITHUB_REPOSITORY, 'event_repository_guard');
  if (env.GITHUB_EVENT_NAME === 'pull_request') {
    need(event.pull_request?.head?.repo?.full_name === env.GITHUB_REPOSITORY &&
      event.pull_request?.base?.repo?.full_name === env.GITHUB_REPOSITORY && event.pull_request?.head?.sha === sha, 'same_repo_pr_sha_guard');
  } else need(['push', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME) && env.GITHUB_SHA === sha, 'event_sha_guard');
  need(/^\d+$/.test(env.GITHUB_RUN_ID ?? ''), 'run_id_guard');
  receipt.sha = sha; receipt.runId = env.GITHUB_RUN_ID; canSave = true;
  need(env.MANAGED_DEV_SUPABASE_URL === TARGET && !!env.MANAGED_DEV_SUPABASE_SERVICE_ROLE, 'exact_managed_dev_credentials');
  const discovery = { select: 'id,codes!inner(id)', is_published: 'eq.true', order: 'id.asc', limit: '1', 'codes.limit': '1' };
  const { data: published } = await query('discover_published_with_codes', 'code_pages', discovery);
  if (!published.length) record('required_published_codes_fixture', 'fail', { skippedReason: 'no_published_page_with_codes' });
  else {
    const id = published[0].id; need(UUID.test(id), 'published_id_shape'); receipt.publishedPageId = id;
    parityDeadline = Date.now() + PARITY_MS;
    const before = await selected(id, 'before');
    const { data: old } = await query('old_view_once', 'code_pages_view', {
      select: 'id,codes,active_code_count', id: `eq.${id}`, is_published: 'eq.true', limit: '1' });
    const after = await selected(id, 'after');
    const withinWindow = Date.now() <= parityDeadline; parityDeadline = Infinity;
    for (const snapshot of [before, after]) {
      need(new Set(snapshot.rows.map(r => r.id)).size === snapshot.rows.length, 'no_duplicate_code_ids');
      need(snapshot.rows.every((r, i, all) => !i || ordered(all[i - 1], r) <= 0), 'status_last_seen_id_order');
    }
    record('inner_parent_complete_fields_order', before.rows.length && after.rows.length ? 'pass' : 'inconclusive',
      { rowCount: before.rows.length, ...(!(before.rows.length && after.rows.length) && { skippedReason: 'selected_codes_disappeared_during_reads' }) });
    const stable = !before.changed && !after.changed && isDeepStrictEqual(canonical(before.rows), canonical(after.rows));
    if (!withinWindow || !stable || !old.length || !before.rows.length) record('old_view_full_parity', 'inconclusive',
      { skippedReason: withinWindow ? 'selected_rows_or_publication_changed_between_reads' : 'fixed_parity_window_exceeded' });
    else {
      need(old.length === 1 && old[0].id === id && Array.isArray(old[0].codes), 'old_view_shape');
      validateRows(old[0].codes, id);
      need(old[0].active_code_count != null && isDeepStrictEqual(canonical(before.rows), canonical(old[0].codes)) &&
        Number(old[0].active_code_count) === before.rows.filter(r => r.status === 'active').length, 'old_view_ids_fields_counts_mismatch');
      record('old_view_full_parity', 'pass', { rowCount: before.rows.length });
    }
    for (const status of ['active', 'check', 'expired']) record(`status_${status}_coverage`,
      before.rows.some(r => r.status === status) ? 'pass' : 'skipped', { rowCount: before.rows.filter(r => r.status === status).length,
        ...(!before.rows.some(r => r.status === status) && { skippedReason: `selected_page_has_no_${status}_codes` }) });
    const ties = before.rows.filter((r, i, a) => i && r.status === a[i - 1].status && micros(r.last_seen_at) === micros(a[i - 1].last_seen_at)).length;
    record('id_tie_break_coverage', ties ? 'pass' : 'skipped', { rowCount: ties, ...(!ties && { skippedReason: 'no_equal_status_last_seen_pairs' }) });
    record('live_over_1000_pagination', before.rows.length > BATCH ? 'pass' : 'skipped',
      { rowCount: before.rows.length, ...(before.rows.length <= BATCH && { skippedReason: 'selected_page_at_or_below_1000' }) });
    record('live_exact_multiple_termination', before.rows.length > 0 && before.rows.length % BATCH === 0 ? 'pass' : 'skipped',
      { rowCount: before.rows.length, ...(before.rows.length % BATCH !== 0 || !before.rows.length ? { skippedReason: 'selected_count_not_a_positive_multiple_of_1000' } : {}) });
  }
  let { data: drafts } = await query('discover_draft_with_codes', 'code_pages', { ...discovery, is_published: 'eq.false' });
  if (!drafts.length) ({ data: drafts } = await query('discover_draft', 'code_pages', { select: 'id', is_published: 'eq.false', order: 'id.asc', limit: '1' }));
  if (!drafts.length) record('draft_exclusion', 'skipped', { skippedReason: 'no_existing_draft_page' });
  else {
    const draft = drafts[0]; need(UUID.test(draft.id), 'draft_id_shape'); receipt.draftPageId = draft.id;
    const { rows } = await selected(draft.id, 'draft'); need(rows.length === 0, 'draft_query_not_empty');
    record('draft_query_empty', 'pass', { rowCount: 0 });
    if (draft.codes?.length) {
      const { data: stillDraft } = await query('confirm_draft_still_has_codes', 'code_pages', { ...discovery, id: `eq.${draft.id}`, is_published: 'eq.false' });
      record('draft_exclusion', stillDraft[0]?.codes?.length ? 'pass' : 'inconclusive',
        stillDraft[0]?.codes?.length ? {} : { skippedReason: 'draft_rows_or_publication_changed_during_reads' });
    } else record('draft_exclusion', 'skipped', { skippedReason: 'existing_draft_has_no_codes_exclusion_not_proven' });
  }
  const missing = randomUUID(); receipt.nonexistentPageId = missing;
  const { data: exists } = await query('confirm_nonexistent', 'code_pages', { select: 'id', id: `eq.${missing}`, limit: '1' });
  need(exists.length === 0, 'nonexistent_id_collision');
  const { rows } = await selected(missing, 'nonexistent'); need(rows.length === 0, 'nonexistent_query_not_empty');
  record('nonexistent_query_empty', 'pass', { rowCount: 0 });
}
try { await main(); need(Date.now() - started <= WALL_MS, 'whole_wall_budget'); }
catch (error) { record(error instanceof QaFailure ? error.message : 'transport_json_or_runtime_failure', 'fail'); }
receipt.durationMs = Date.now() - started;
receipt.status = receipt.checks.some(c => c.status === 'fail') ? 'fail' : receipt.checks.some(c => c.status === 'inconclusive')
  ? 'inconclusive' : receipt.checks.some(c => c.status === 'skipped') ? 'pass_with_skips' : 'pass';
if (canSave) {
  try {
    const directory = new URL('../../tmp/test-reports/code-lookups/', import.meta.url);
    await mkdir(directory, { recursive: true });
    await writeFile(new URL('backend.json', directory), JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
  } catch { receipt.status = 'fail'; console.error('code-lookups QA receipt_write_failed'); }
}
console.log(`code-lookups backend QA: ${receipt.status}`);
process.exitCode = receipt.status === 'fail' ? 1 : receipt.status === 'inconclusive' ? 2 : 0;
