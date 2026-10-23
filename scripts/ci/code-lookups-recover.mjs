#!/usr/bin/env node
/** GitHub-only reconciliation of four reviewed failed artifacts. Never creates fixtures. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, open, readFile, rename } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { inflateRawSync } from 'node:zlib';
import { PROJECT, TARGET, fixtureIdentity, validateIdentity, cleanupSql, sqlFailureDiagnostic } from './code-lookups-fixture.mjs';

const REPO = 'RaviTejaKNTS/Bloxodes', REPO_ID = 1203603485;
const WORKFLOW = '.github/workflows/pull-request.yml', BRANCH = 'chore/audit-site-errors';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const EVIDENCE_ROOT = new URL('../../tmp/test-reports/code-lookups-recovery/', import.meta.url);
export const APPLY_SELECTION = 'reconcile-39955744530-39956105978-39957597153-39958648149';
export const LIMITS = Object.freeze({ zip: 4 * 1024 * 1024, file: 1024 * 1024,
  body: 4 * 1024 * 1024, cleanupMs: 35000, httpMs: 12000, attempts: 3, sqlCalls: 12 });
export const SELECTION = Object.freeze([
  { sha: '8c3048af8e44c1f85f8329d7dbe2a9c714d23951', runId: '39955744530', attempt: '1',
    artifactId: 12502775931, size: 1683, zipSha256: 'f0b43b8900cdb2b09bc857ac08d166c1ed2dc666a479accccc8d17be27390b68',
    nonce: 'e2101df4094b229648e862cc', prefix: 'qa_cl_53819cbe772ef28a' },
  { sha: '6856a0e0a801aea636c982d5de2678eab9258390', runId: '39956105978', attempt: '1',
    artifactId: 12502297485, size: 1673, zipSha256: 'a3f056dff5f59c5d740e57b2f0b43303e4ef7e0504d582a406802507fc8c60c5',
    nonce: 'cbfe15eca366cb2f7c4e8f14', prefix: 'qa_cl_47924cc0105a528f' },
  { sha: '6c03ec5c82f38a540217a060259b0260b35f3b5f', runId: '39957597153', attempt: '1',
    artifactId: 12502758610, size: 1688, zipSha256: '5f8dcf338e866d98056b62c6ec9e951a42a9377bf18c11334b94adc965b98cae',
    nonce: '6790ff13a4009e9ad9a5f4e9', prefix: 'qa_cl_7063e7176e50946b' },
  { sha: 'a9822be72cfba1d24d1e9867b94d55eedd66cebf', runId: '39958648149', attempt: '1',
    artifactId: 12503248885, size: 1745, zipSha256: '3d5a0d82f251c6b8c1345c18a1a62712838302658ee894023a9c2482935735e4',
    nonce: '53fa75586fa8e2fb52dfe1ae', prefix: 'qa_cl_770ca13727aa61f0' }
].map(value => Object.freeze({ ...value,
  artifactName: `code-lookups-backend-${value.sha}-${value.runId}` })));
const FILENAMES = Object.freeze(['cleanup-identity.json', 'backend.json']);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
class RecoveryFailure extends Error {}
const requireThat = (condition, reason) => { if (!condition) throw new RecoveryFailure(reason); };
const sanitized = error => error instanceof RecoveryFailure ? error.message : 'recovery_transport_json_or_runtime_failure';
const selected = value => requireThat(SELECTION.includes(value), 'reviewed_selection_required');
const contextOf = source => ({ sha: source.sha, runId: source.runId, attempt: source.attempt });

export function executionContext({ env, event, args, checkout, nodeVersion = process.versions.node }) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    requireThat(['--expected-sha', '--apply-selection'].includes(args[i]) && !Object.hasOwn(options, args[i]) &&
      typeof args[i + 1] === 'string', 'recovery_argument_allowlist');
    options[args[i]] = args[i + 1];
  }
  requireThat(env.GITHUB_ACTIONS === 'true' && env.CODE_LOOKUPS_RECOVERY === '1', 'recovery_github_guard');
  requireThat(nodeVersion.split('.')[0] === '22', 'recovery_node_22_required');
  requireThat(env.GITHUB_REPOSITORY === REPO && env.GITHUB_REPOSITORY_ID === String(REPO_ID) &&
    event.repository?.id === REPO_ID && event.repository?.full_name === REPO, 'recovery_repository_guard');
  requireThat(env.GITHUB_EVENT_NAME === 'workflow_dispatch' &&
    options['--apply-selection'] === APPLY_SELECTION && event.inputs?.code_lookups_recovery === APPLY_SELECTION,
  'recovery_explicit_selection_guard');
  const sha = options['--expected-sha'];
  requireThat(/^[a-f0-9]{40}$/.test(sha ?? '') && checkout.sha === sha && env.GITHUB_SHA === sha &&
    env.GITHUB_WORKFLOW_SHA === sha, 'recovery_checkout_sha_guard');
  requireThat(checkout.status === '' && resolve(checkout.root) === resolve(ROOT) &&
    resolve(env.GITHUB_WORKSPACE ?? '') === resolve(ROOT), 'recovery_clean_checkout_guard');
  requireThat(typeof env.GITHUB_REF_NAME === 'string' && env.GITHUB_REF_NAME.length > 0 &&
    env.GITHUB_REF === `refs/heads/${env.GITHUB_REF_NAME}` &&
    [env.GITHUB_REF, env.GITHUB_REF_NAME].includes(event.ref) &&
    env.GITHUB_WORKFLOW_REF === `${REPO}/${WORKFLOW}@${env.GITHUB_REF}`, 'recovery_event_source_guard');
  requireThat(/^\d{1,20}$/.test(env.GITHUB_RUN_ID ?? '') && /^\d{1,6}$/.test(env.GITHUB_RUN_ATTEMPT ?? ''),
    'recovery_run_guard');
  return { sha, runId: env.GITHUB_RUN_ID, attempt: env.GITHUB_RUN_ATTEMPT,
    repository: REPO, repositoryId: REPO_ID, workflow: WORKFLOW, ref: env.GITHUB_REF };
}

export function credentialGuard(env) {
  requireThat(env.MANAGED_DEV_SUPABASE_URL === TARGET && !!env.MANAGED_DEV_SUPABASE_ACCESS_TOKEN &&
    !!env.GITHUB_TOKEN, 'recovery_exact_development_credentials');
  // The job needs only a development Management token, never a production or data-plane credential.
  requireThat(!Object.entries(env).some(([name, value]) => value && (
    (/SUPABASE.*(?:TOKEN|KEY|ROLE|PASSWORD|URL)/i.test(name) &&
      !['MANAGED_DEV_SUPABASE_URL', 'MANAGED_DEV_SUPABASE_ACCESS_TOKEN'].includes(name)) ||
    /(?:PROD|PRODUCTION).*(?:TOKEN|KEY|SECRET|PASSWORD|URL)|(?:TOKEN|KEY|SECRET|PASSWORD).*PROD/i.test(name))),
  'recovery_unexpected_credentials');
}

export function validateProvenance(source, run, artifact, workflow) {
  selected(source);
  requireThat(workflow?.path === WORKFLOW && Number.isSafeInteger(workflow.id) &&
    run?.workflow_id === workflow.id && run.path === WORKFLOW, 'source_workflow_mismatch');
  requireThat(String(run.id) === source.runId && run.run_attempt === Number(source.attempt) &&
    run.status === 'completed' && run.conclusion === 'failure' && run.event === 'pull_request' &&
    run.head_sha === source.sha && run.head_branch === BRANCH &&
    run.repository?.id === REPO_ID && run.repository?.full_name === REPO &&
    run.head_repository?.id === REPO_ID && run.head_repository?.full_name === REPO,
  'source_run_mismatch');
  requireThat(Array.isArray(run.pull_requests) && run.pull_requests.length === 1 &&
    run.pull_requests[0].number === 113 && run.pull_requests[0].head?.sha === source.sha &&
    run.pull_requests[0].head?.ref === BRANCH && run.pull_requests[0].head?.repo?.id === REPO_ID &&
    run.pull_requests[0].base?.repo?.id === REPO_ID && run.pull_requests[0].base?.ref === 'production',
  'source_pr_mismatch');
  requireThat(artifact?.id === source.artifactId && artifact.name === source.artifactName && artifact.expired === false &&
    artifact.size_in_bytes === source.size && artifact.digest === `sha256:${source.zipSha256}` &&
    String(artifact.workflow_run?.id) === source.runId && artifact.workflow_run?.repository_id === REPO_ID &&
    artifact.workflow_run?.head_repository_id === REPO_ID && artifact.workflow_run?.head_sha === source.sha &&
    artifact.workflow_run?.head_branch === BRANCH && artifact.archive_download_url ===
      `https://api.github.com/repos/${REPO}/actions/artifacts/${source.artifactId}/zip`, 'source_artifact_mismatch');
}

// Tiny ZIP reader, deliberately independent of the fixed three-file runtime bundle contract.
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function extras(bytes) {
  for (let at = 0; at < bytes.length;) {
    requireThat(at + 4 <= bytes.length, 'archive_extra_invalid');
    const id = bytes.readUInt16LE(at), size = bytes.readUInt16LE(at + 2);
    requireThat(id !== 1 && id !== 0x0017 && at + 4 + size <= bytes.length, 'archive_extra_invalid');
    at += 4 + size;
  }
}
export function unpackRecoveryZip(bytes) {
  requireThat(Buffer.isBuffer(bytes) && bytes.length >= 22 && bytes.length <= LIMITS.zip, 'archive_size_invalid');
  // No comments, split archives, ZIP64 end records, prefixes or trailing payloads.
  const end = bytes.length - 22;
  requireThat(bytes.readUInt32LE(end) === 0x06054b50 && bytes.readUInt16LE(end + 20) === 0 &&
    bytes.readUInt16LE(end + 4) === 0 && bytes.readUInt16LE(end + 6) === 0 &&
    bytes.readUInt16LE(end + 8) === 2 && bytes.readUInt16LE(end + 10) === 2, 'archive_directory_invalid');
  const central = bytes.readUInt32LE(end + 16);
  requireThat(central + bytes.readUInt32LE(end + 12) === end, 'archive_directory_invalid');
  const files = new Map(), ranges = []; let at = central, total = 0;
  for (let i = 0; i < 2; i++) {
    requireThat(at + 46 <= end && bytes.readUInt32LE(at) === 0x02014b50, 'archive_entry_invalid');
    const flags = bytes.readUInt16LE(at + 8), method = bytes.readUInt16LE(at + 10);
    const crc = bytes.readUInt32LE(at + 16), compressed = bytes.readUInt32LE(at + 20), plain = bytes.readUInt32LE(at + 24);
    const nameSize = bytes.readUInt16LE(at + 28), extra = bytes.readUInt16LE(at + 30), comment = bytes.readUInt16LE(at + 32);
    const attributes = bytes.readUInt32LE(at + 38), mode = attributes >>> 16, local = bytes.readUInt32LE(at + 42);
    const host = bytes[at + 5];
    requireThat(at + 46 + nameSize + extra + comment <= end && bytes.readUInt16LE(at + 6) <= 20 &&
      bytes.readUInt16LE(at + 34) === 0 && [0, 3].includes(host) && (flags & ~0x0808) === 0 &&
      [0, 8].includes(method) && !(attributes & 0x10) &&
      ((mode & 0o170000) === 0o100000 || (host === 0 && mode === 0)), 'archive_entry_invalid');
    const nameBytes = bytes.subarray(at + 46, at + 46 + nameSize), name = nameBytes.toString('utf8');
    requireThat(FILENAMES.includes(name) && nameBytes.equals(Buffer.from(name)) && !files.has(name), 'archive_filename_invalid');
    total += plain;
    requireThat(plain > 0 && plain <= LIMITS.file && total <= LIMITS.file * 2 &&
      compressed > 0 && compressed <= LIMITS.zip && local + 30 <= central &&
      bytes.readUInt32LE(local) === 0x04034b50, 'archive_entry_bounds');
    const localName = bytes.readUInt16LE(local + 26), localExtra = bytes.readUInt16LE(local + 28);
    const start = local + 30 + localName + localExtra, stop = start + compressed;
    requireThat(start <= central && stop <= central && bytes.readUInt16LE(local + 4) <= 20 &&
      bytes.readUInt16LE(local + 6) === flags && bytes.readUInt16LE(local + 8) === method &&
      bytes.subarray(local + 30, local + 30 + localName).equals(nameBytes), 'archive_local_mismatch');
    extras(bytes.subarray(at + 46 + nameSize, at + 46 + nameSize + extra));
    extras(bytes.subarray(local + 30 + localName, start));
    let localEnd = stop;
    if (flags & 8) {
      requireThat(stop + 12 <= central, 'archive_descriptor_invalid');
      const descriptor = bytes.readUInt32LE(stop) === 0x08074b50 ? stop + 4 : stop;
      requireThat(descriptor + 12 <= central && bytes.readUInt32LE(descriptor) === crc &&
        bytes.readUInt32LE(descriptor + 4) === compressed && bytes.readUInt32LE(descriptor + 8) === plain,
      'archive_descriptor_invalid');
      localEnd = descriptor + 12;
      requireThat([0, crc].includes(bytes.readUInt32LE(local + 14)) &&
        [0, compressed].includes(bytes.readUInt32LE(local + 18)) && [0, plain].includes(bytes.readUInt32LE(local + 22)),
      'archive_local_mismatch');
    } else requireThat(bytes.readUInt32LE(local + 14) === crc && bytes.readUInt32LE(local + 18) === compressed &&
      bytes.readUInt32LE(local + 22) === plain, 'archive_local_mismatch');
    let value;
    try { value = method === 8 ? inflateRawSync(bytes.subarray(start, stop), { maxOutputLength: LIMITS.file }) : bytes.subarray(start, stop); }
    catch { throw new RecoveryFailure('archive_inflate_invalid'); }
    requireThat(value.length === plain && crc32(value) === crc, 'archive_content_invalid');
    files.set(name, value); ranges.push([local, localEnd]); at += 46 + nameSize + extra + comment;
  }
  ranges.sort((a, b) => a[0] - b[0]);
  requireThat(at === end && ranges[0][0] === 0 && ranges[0][1] === ranges[1][0] && ranges[1][1] === central,
    'archive_overlap_or_gap');
  return files;
}
export function verifiedArchive(source, bytes) {
  selected(source);
  requireThat(Buffer.isBuffer(bytes) && bytes.length === source.size && bytes.length <= LIMITS.zip &&
    digest(bytes) === source.zipSha256, 'source_zip_digest_mismatch');
  return unpackRecoveryZip(bytes);
}

export function validateDocuments(source, files) {
  selected(source);
  requireThat(files instanceof Map && files.size === 2 && FILENAMES.every(name => Buffer.isBuffer(files.get(name)) &&
    files.get(name).length > 0 && files.get(name).length <= LIMITS.file), 'source_files_invalid');
  let identity, backend;
  try {
    identity = validateIdentity(JSON.parse(files.get('cleanup-identity.json').toString('utf8')), contextOf(source));
    backend = JSON.parse(files.get('backend.json').toString('utf8'));
  } catch { throw new RecoveryFailure('source_identity_or_json_invalid'); }
  requireThat(isDeepStrictEqual(identity, fixtureIdentity({ ...contextOf(source), nonce: source.nonce })) &&
    identity.names.pages === `${source.prefix}_pages`, 'source_pinned_identity_mismatch');
  requireThat(backend?.version === 2 && backend.sha === source.sha && backend.runId === source.runId &&
    backend.attempt === source.attempt && isDeepStrictEqual(backend.fixture, identity) && backend.status === 'fail' &&
    Array.isArray(backend.checks) && Array.isArray(backend.sql) && Array.isArray(backend.requests), 'source_backend_identity_mismatch');
  const expectedChecks = ['fixture_service_only_rls_fk_storage', 'anonymous_http_denied_all_fixture_relations',
    'old_view_full_parity_999', 'old_view_full_parity_1000', 'old_view_full_parity_1001', 'old_view_full_parity_2000',
    'draft_query_empty', 'published_empty_query_empty', 'nonexistent_query_empty', 'required_fixture_compatibility'];
  requireThat(backend.checks.length === 12 && expectedChecks.every(name =>
    backend.checks.filter(check => check?.name === name && check.status === 'pass').length === 1) &&
    backend.checks.filter(check => check?.name === 'fixture_cleanup_failed' && check.status === 'fail').length === 2 &&
    isDeepStrictEqual(backend.cleanup, { status: 'failed', attempts: 3 }) && backend.sql.length === 8 &&
    backend.sql[0]?.name === 'create_and_seed_owned_fixture' && backend.sql[0].httpCode === 201 &&
    backend.sql[1]?.name === 'inspect_fixture_security_and_storage' && backend.sql[1].httpCode === 201 &&
    backend.sql.slice(2).every(entry => entry?.name === 'cleanup_exact_owned_relations' && entry.httpCode === 400) &&
    backend.requests.length > 0 && backend.requests.length <= 48, 'source_failure_history_mismatch');
  return { identity, hashes: Object.fromEntries(FILENAMES.map(name => [name, digest(files.get(name))])) };
}

async function boundedBody(response, maximum) {
  requireThat(response.body, 'recovery_response_body_missing');
  const reader = response.body.getReader(), chunks = []; let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength; requireThat(size <= maximum, 'recovery_response_byte_budget'); chunks.push(value);
    }
  } finally { await reader.cancel(); }
  return Buffer.concat(chunks);
}
export function githubSourceLoader(token, fetcher = fetch) {
  let calls = 0, workflow;
  const request = async (url, authenticated = true, redirect = 'error') => {
    requireThat(++calls <= 17, 'source_http_budget'); // one workflow + four HTTP requests per source
    return fetcher(url, { method: 'GET', redirect, headers: authenticated ? {
      Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'
    } : {}, signal: AbortSignal.timeout(LIMITS.httpMs) });
  };
  const json = async path => {
    const response = await request(`https://api.github.com/repos/${REPO}/${path}`);
    requireThat(response.ok, 'source_api_failure');
    return JSON.parse((await boundedBody(response, LIMITS.body)).toString('utf8'));
  };
  return async source => {
    selected(source);
    workflow ??= await json('actions/workflows/pull-request.yml');
    const run = await json(`actions/runs/${source.runId}`);
    const artifact = await json(`actions/artifacts/${source.artifactId}`);
    validateProvenance(source, run, artifact, workflow);
    const redirect = await request(artifact.archive_download_url, true, 'manual');
    requireThat(redirect.status === 302, 'source_download_redirect_invalid');
    const location = new URL(redirect.headers.get('location'));
    requireThat(location.protocol === 'https:' && !location.username && !location.password && !location.port && !location.hash &&
      /\.(?:blob\.core\.windows\.net|actions\.githubusercontent\.com)$/.test(location.hostname), 'source_download_host_invalid');
    await redirect.body?.cancel();
    // Never forward the GitHub token to the signed download host.
    const response = await request(location.href, false);
    requireThat(response.ok, 'source_download_failure');
    const zip = await boundedBody(response, Math.min(LIMITS.zip, source.size));
    return { zip, files: verifiedArchive(source, zip), provenance: { workflowId: workflow.id,
      runStatus: 'completed', runConclusion: 'failure', artifactDigest: artifact.digest, artifactExpired: false } };
  };
}

export function newReceipt(execution) {
  return { version: 1, purpose: 'cleanup_reconciliation_only', execution, selection: APPLY_SELECTION,
    project: PROJECT, reconciliationStatus: 'not_started', allSourcesValidated: false, sqlCalls: 0,
    sources: SELECTION.map(source => ({ source: { repository: REPO, repositoryId: REPO_ID, workflow: WORKFLOW,
      event: 'pull_request', branch: BRANCH, pullRequest: 113, ...source },
    historicalStatus: 'fail', reconciliationStatus: 'not_started', absenceProven: false, attempts: [] })) };
}

// acquire/persist/clean are explicit unit-test seams. The CLI supplies only the fixed implementations below.
export async function recoverAll({ receipt, acquire, persist, clean }) {
  const validated = [];
  try {
    await persist();
    for (let i = 0; i < SELECTION.length; i++) {
      const source = SELECTION[i], bundle = await acquire(source);
      // acquire verifies provenance, ZIP bytes and member safety first. Preserve those
      // verified originals even if document validation then refuses the entire batch.
      await persist({ source, ...bundle });
      const proof = validateDocuments(source, bundle.files);
      validated.push(proof.identity);
      Object.assign(receipt.sources[i], { identity: proof.identity, fileSha256: proof.hashes, sourceValidated: true,
        provenance: bundle.provenance });
      await persist();
    }
    receipt.allSourcesValidated = true; receipt.reconciliationStatus = 'running'; await persist();
    for (let i = 0; i < SELECTION.length; i++) {
      const entry = receipt.sources[i];
      entry.reconciliationStatus = 'running'; await persist();
      await clean(validated[i], entry, receipt, persist);
      entry.reconciliationStatus = entry.absenceProven ? 'reconciled' : 'failed'; await persist();
    }
    receipt.reconciliationStatus = receipt.sources.every(entry => entry.absenceProven) ? 'reconciled' : 'failed';
  } catch (error) {
    receipt.reconciliationStatus = 'failed'; receipt.failure = sanitized(error);
    for (const entry of receipt.sources) if (entry.reconciliationStatus === 'running') entry.reconciliationStatus = 'failed';
  } finally { await persist(); }
  return receipt;
}

export function cleanupTransport(token, { fetcher = fetch, now = Date.now,
  pause = ms => new Promise(done => setTimeout(done, ms)) } = {}) {
  let calls = 0;
  return async (identity, entry, receipt, persist) => {
    // Revalidate independently at the mutation boundary; no caller-supplied prefix or SQL.
    const source = SELECTION.find(value => isDeepStrictEqual(identity, fixtureIdentity({ ...contextOf(value), nonce: value.nonce })));
    requireThat(source && receipt.allSourcesValidated, 'cleanup_validated_selection_required');
    validateIdentity(identity, contextOf(source));
    const query = `set statement_timeout='8s'; set lock_timeout='2s'; set timezone='UTC';\n${cleanupSql(identity)}`;
    const deadline = now() + LIMITS.cleanupMs;
    for (let attempt = 0; attempt < LIMITS.attempts && now() < deadline; attempt++) {
      requireThat(calls < LIMITS.sqlCalls, 'cleanup_total_request_budget');
      const result = { name: 'cleanup_exact_owned_relations', httpCode: 0, durationMs: 0,
        outcome: 'pending', absenceProven: false };
      entry.attempts.push(result); await persist();
      if (now() >= deadline) { result.outcome = 'cleanup_wall_budget'; await persist(); break; }
      const begin = now(); let data;
      calls++; receipt.sqlCalls = calls;
      try {
        const response = await fetcher(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
          method: 'POST', redirect: 'error', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }), signal: AbortSignal.timeout(Math.max(1, Math.min(LIMITS.httpMs, deadline - begin))) });
        result.httpCode = response.status;
        data = JSON.parse((await boundedBody(response, LIMITS.body)).toString('utf8'));
        requireThat(now() <= deadline, 'cleanup_wall_budget');
        requireThat(response.ok && Array.isArray(data), 'cleanup_sql_failure');
        requireThat(isDeepStrictEqual(data, [{ cleaned: true }]), 'cleanup_absence_readback_failed');
        result.outcome = 'absence_proven'; result.absenceProven = true; entry.absenceProven = true;
      } catch (error) {
        result.outcome = sanitized(error);
        Object.assign(result, sqlFailureDiagnostic({ phase: 'cleanup_exact_owned_relations', result: data, query }));
      } finally { result.durationMs = Math.max(0, now() - begin); await persist(); }
      if (entry.absenceProven || ['fixture_cleanup_ownership_mismatch', 'wrong_object_type', 'insufficient_privilege'].includes(result.errorClass)) break;
      if (attempt < LIMITS.attempts - 1 && now() + 1000 < deadline) await pause(500);
    }
  };
}

async function durable(path, bytes, flags = 'wx', mode = 0o600) {
  const handle = await open(path, flags, mode);
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
}
async function main() {
  let receipt, directory;
  try {
    const env = process.env;
    // Only read-only Git commands. Never accept a caller-supplied checkout or source path.
    const git = args => execFileSync('git', args, { cwd: ROOT, timeout: 3000, maxBuffer: 1024 * 1024,
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    const execution = executionContext({ env, event: JSON.parse(await readFile(env.GITHUB_EVENT_PATH, 'utf8')),
      args: process.argv.slice(2), checkout: { sha: git(['rev-parse', 'HEAD']),
        root: git(['rev-parse', '--show-toplevel']), status: git(['status', '--porcelain', '--untracked-files=all']) } });
    await mkdir(EVIDENCE_ROOT, { recursive: true });
    directory = await mkdtemp(join(fileURLToPath(EVIDENCE_ROOT), `${execution.sha}-${execution.runId}-${execution.attempt}-`));
    receipt = newReceipt(execution);
    const persist = async bundle => {
      if (bundle) {
        const originals = join(directory, `source-${bundle.source.runId}`);
        await mkdir(originals, { mode: 0o700 });
        await durable(join(originals, 'source.zip'), bundle.zip, 'wx', 0o400);
        for (const name of FILENAMES) await durable(join(originals, name), bundle.files.get(name), 'wx', 0o400);
      }
      const pending = join(directory, 'receipt.pending');
      await durable(pending, JSON.stringify(receipt, null, 2) + '\n', 'w');
      await rename(pending, join(directory, 'recovery.json'));
    };
    await persist();
    try {
      credentialGuard(env);
      await recoverAll({ receipt, persist, acquire: githubSourceLoader(env.GITHUB_TOKEN),
        clean: cleanupTransport(env.MANAGED_DEV_SUPABASE_ACCESS_TOKEN) });
    } catch (error) { receipt.reconciliationStatus = 'failed'; receipt.failure = sanitized(error); await persist(); }
    process.exitCode = receipt.reconciliationStatus === 'reconciled' ? 0 : 1;
  } catch {
    // Early guard/persistence failure must not overwrite any earlier execution's evidence.
    console.error('code-lookups recovery guard_or_evidence_failure'); process.exitCode = 1;
  }
  console.log(`code-lookups recovery: ${receipt?.reconciliationStatus === 'reconciled' && process.exitCode === 0 ? 'reconciled' : 'failed'}`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
