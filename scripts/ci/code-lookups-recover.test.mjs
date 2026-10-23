/** Builtin Node 22 regressions for GitHub only. No real network or database access. */
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { deflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { fixtureIdentity, cleanupSql, TARGET } from './code-lookups-fixture.mjs';
import { APPLY_SELECTION, LIMITS, SELECTION, executionContext, credentialGuard, validateProvenance,
  crc32, unpackRecoveryZip, verifiedArchive, validateDocuments, githubSourceLoader, newReceipt,
  recoverAll, cleanupTransport } from './code-lookups-recover.mjs';

const REPO = 'RaviTejaKNTS/Bloxodes', ID = 1203603485;
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const owned = source => fixtureIdentity({ sha: source.sha, runId: source.runId, attempt: source.attempt, nonce: source.nonce });
function documents(source) {
  const fixture = owned(source);
  const checks = ['fixture_service_only_rls_fk_storage', 'anonymous_http_denied_all_fixture_relations',
    'old_view_full_parity_999', 'old_view_full_parity_1000', 'old_view_full_parity_1001', 'old_view_full_parity_2000',
    'draft_query_empty', 'published_empty_query_empty', 'nonexistent_query_empty', 'required_fixture_compatibility']
    .map(name => ({ name, status: 'pass' }));
  checks.push(...Array.from({ length: 2 }, () => ({ name: 'fixture_cleanup_failed', status: 'fail' })));
  const sql = [{ name: 'create_and_seed_owned_fixture', httpCode: 201 },
    { name: 'inspect_fixture_security_and_storage', httpCode: 201 },
    ...Array.from({ length: 6 }, () => ({ name: 'cleanup_exact_owned_relations', httpCode: 400,
      ...(source === SELECTION[3] ? { phase: 'cleanup_exact_owned_relations', sqlstate: '42601',
        errorClass: 'syntax_error', reportedLine: 10 } : {}) }))];
  const backend = { version: 2, sha: source.sha, runId: source.runId, attempt: source.attempt, fixture,
    checks, sql, requests: [{ name: 'old_view_once_2000', httpCode: 200, rowCount: 2001 }],
    status: 'fail', cleanup: { status: 'failed', attempts: 3 } };
  return new Map([['cleanup-identity.json', Buffer.from(JSON.stringify(fixture, null, 3) + '\n\n')],
    ['backend.json', Buffer.from(JSON.stringify(backend, null, 3) + '\n\n')]]);
}
function provenance(source) {
  const workflow = { id: 12345, path: '.github/workflows/pull-request.yml' };
  const run = { id: Number(source.runId), run_attempt: 1, workflow_id: workflow.id, path: workflow.path,
    status: 'completed', conclusion: 'failure', event: 'pull_request', head_sha: source.sha,
    head_branch: 'chore/audit-site-errors', repository: { id: ID, full_name: REPO }, head_repository: { id: ID, full_name: REPO },
    pull_requests: [{ number: 113, head: { sha: source.sha, ref: 'chore/audit-site-errors', repo: { id: ID } },
      base: { ref: 'production', repo: { id: ID } } }] };
  const artifact = { id: source.artifactId, name: source.artifactName, expired: false, size_in_bytes: source.size,
    digest: `sha256:${source.zipSha256}`, archive_download_url: `https://api.github.com/repos/${REPO}/actions/artifacts/${source.artifactId}/zip`,
    workflow_run: { id: Number(source.runId), repository_id: ID, head_repository_id: ID,
      head_sha: source.sha, head_branch: 'chore/audit-site-errors' } };
  return { workflow, run, artifact };
}
function execution() {
  const sha = 'f'.repeat(40), ref = 'refs/heads/chore/audit-site-errors';
  return { nodeVersion: '22.0.0', args: ['--expected-sha', sha, '--apply-selection', APPLY_SELECTION],
    checkout: { sha, status: '', root: ROOT }, event: { repository: { id: ID, full_name: REPO },
      ref, inputs: { code_lookups_recovery: APPLY_SELECTION } },
    env: { GITHUB_ACTIONS: 'true', CODE_LOOKUPS_RECOVERY: '1', GITHUB_REPOSITORY: REPO, GITHUB_REPOSITORY_ID: String(ID),
      GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_SHA: sha, GITHUB_WORKFLOW_SHA: sha,
      GITHUB_WORKSPACE: ROOT, GITHUB_REF: ref, GITHUB_REF_NAME: 'chore/audit-site-errors',
      GITHUB_WORKFLOW_REF: `${REPO}/.github/workflows/pull-request.yml@${ref}`, GITHUB_RUN_ID: '40000000000', GITHUB_RUN_ATTEMPT: '1' } };
}

// Small independent ZIP encoder for hostile byte mutations. Supports actual data descriptors.
function zip(entries = [...documents(SELECTION[0])], { descriptor = false, method = 8 } = {}) {
  const localParts = [], centralParts = []; let offset = 0;
  for (const [name, bytes] of entries) {
    const filename = Buffer.from(name), compressed = method === 8 ? deflateRawSync(bytes) : bytes;
    const crc = crc32(bytes), flags = descriptor ? 8 : 0;
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4); local.writeUInt16LE(flags, 6); local.writeUInt16LE(method, 8);
    if (!descriptor) { local.writeUInt32LE(crc, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(bytes.length, 22); }
    local.writeUInt16LE(filename.length, 26);
    const trailing = Buffer.alloc(descriptor ? 16 : 0);
    if (descriptor) { trailing.writeUInt32LE(0x08074b50); trailing.writeUInt32LE(crc, 4);
      trailing.writeUInt32LE(compressed.length, 8); trailing.writeUInt32LE(bytes.length, 12); }
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6); central.writeUInt16LE(flags, 8); central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(filename.length, 28); central.writeUInt32LE((0o100600 << 16) >>> 0, 38); central.writeUInt32LE(offset, 42);
    localParts.push(local, filename, compressed, trailing); centralParts.push(central, filename);
    offset += local.length + filename.length + compressed.length + trailing.length;
  }
  const central = Buffer.concat(centralParts), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, central, end]);
}
const centralOffset = bytes => bytes.readUInt32LE(bytes.length - 6);
function mutate(bytes, change) { const copy = Buffer.from(bytes); change(copy, centralOffset(copy)); return copy; }
function changeDocument(files, name, change) {
  const copy = new Map(files), parsed = JSON.parse(copy.get(name)); change(parsed);
  copy.set(name, Buffer.from(JSON.stringify(parsed))); return copy;
}
const jsonResponse = (value, status = 200) => new Response(JSON.stringify(value), { status });

describe('fixed artifact reconciliation (GitHub Node 22 only)', { skip: process.env.GITHUB_ACTIONS !== 'true' }, () => {
  before(() => assert.equal(process.versions.node.split('.')[0], '22'));

  it('freezes exactly the four reviewed contexts and sixteen distinct names', () => {
    assert.equal(SELECTION.length, 4); assert.equal(LIMITS.sqlCalls, 12);
    assert.equal(LIMITS.cleanupMs, 35000); assert.equal(LIMITS.attempts, 3); assert.equal(LIMITS.httpMs, 12000);
    assert.equal(new Set(SELECTION.flatMap(source => Object.values(owned(source).names))).size, 16);
    assert.deepEqual(SELECTION.map(source => [source.runId, source.artifactId, source.size]), [
      ['39955744530', 12502775931, 1683], ['39956105978', 12502297485, 1673],
      ['39957597153', 12502758610, 1688], ['39958648149', 12503248885, 1745]]);
    assert.ok(Object.isFrozen(SELECTION) && SELECTION.every(Object.isFrozen));
    assert.throws(() => validateDocuments({ ...SELECTION[0] }, documents(SELECTION[0])), /reviewed_selection_required/);
  });

  it('requires current manual event, exact input and args, real checkout fields, full SHA and Node 22', () => {
    assert.equal(executionContext(execution()).sha, 'f'.repeat(40));
    const changes = [
      value => { value.nodeVersion = '24.0.0'; }, value => { value.env.GITHUB_ACTIONS = 'false'; },
      value => { value.env.CODE_LOOKUPS_RECOVERY = ''; }, value => { value.env.GITHUB_EVENT_NAME = 'pull_request'; },
      value => { value.env.GITHUB_REPOSITORY_ID = '1'; }, value => { value.event.repository.id = 1; },
      value => { value.event.repository.full_name = 'fork/Bloxodes'; }, value => { value.env.GITHUB_REPOSITORY = 'fork/Bloxodes'; },
      value => { value.checkout.sha = SELECTION[0].sha; }, value => { value.checkout.status = ' M scripts/ci/code-lookups-fixture.mjs'; },
      value => { value.checkout.root = '/tmp/other'; }, value => { value.env.GITHUB_WORKSPACE = '/tmp/other'; },
      value => { value.env.GITHUB_SHA = SELECTION[0].sha; }, value => { value.env.GITHUB_WORKFLOW_SHA = SELECTION[0].sha; },
      value => { value.env.GITHUB_WORKFLOW_REF = `${REPO}/.github/workflows/other.yml@${value.env.GITHUB_REF}`; },
      value => { value.event.ref = 'production'; }, value => { value.env.GITHUB_REF = 'refs/tags/unsafe'; },
      value => { value.env.GITHUB_RUN_ID = '1\nSECRET'; }, value => { value.env.GITHUB_RUN_ATTEMPT = ''; },
      value => { value.event.inputs.code_lookups_recovery = 'true'; }, value => { value.args[3] = 'true'; },
      value => { value.args[1] = 'f'.repeat(7); }, value => { value.args.push('--schema', 'public'); },
      value => { value.args.push('--source-file', '/tmp/identity.json'); }, value => { value.args.push('--expected-sha', 'f'.repeat(40)); },
      value => { value.args.pop(); }
    ];
    for (const change of changes) { const value = execution(); change(value); assert.throws(() => executionContext(value)); }
  });

  it('requires only exact managed-development credentials and refuses production/data-plane credentials', () => {
    const env = { MANAGED_DEV_SUPABASE_URL: TARGET, MANAGED_DEV_SUPABASE_ACCESS_TOKEN: 'synthetic-management', GITHUB_TOKEN: 'synthetic-github' };
    credentialGuard(env);
    for (const key of Object.keys(env)) assert.throws(() => credentialGuard({ ...env, [key]: '' }));
    assert.throws(() => credentialGuard({ ...env, MANAGED_DEV_SUPABASE_URL: 'https://database.bloxodes.com' }));
    for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE', 'MANAGED_DEV_SUPABASE_SERVICE_ROLE', 'PRODUCTION_TOKEN',
      'PROD_DB_PASSWORD', 'MANAGED_DEV_SUPABASE_ANON_KEY']) assert.throws(() => credentialGuard({ ...env, [key]: 'synthetic' }));
  });

  it('validates every source run and immutable artifact field against the same-repo failed PR 113', () => {
    for (const source of SELECTION) {
      const good = provenance(source); validateProvenance(source, good.run, good.artifact, good.workflow);
      const changes = [
        p => { p.run.id++; }, p => { p.run.run_attempt++; }, p => { p.run.head_sha = '0'.repeat(40); },
        p => { p.run.status = 'in_progress'; }, p => { p.run.conclusion = 'success'; }, p => { p.run.event = 'workflow_dispatch'; },
        p => { p.run.repository.id++; }, p => { p.run.repository.full_name = 'fork/Bloxodes'; },
        p => { p.run.head_repository.id++; }, p => { p.run.head_branch = 'other'; }, p => { p.run.workflow_id++; },
        p => { p.run.path = 'other.yml'; }, p => { p.workflow.path = 'other.yml'; },
        p => { p.run.pull_requests = []; }, p => { p.run.pull_requests[0].number++; },
        p => { p.run.pull_requests[0].head.repo.id++; }, p => { p.run.pull_requests[0].head.sha = 'g'.repeat(40); },
        p => { p.run.pull_requests[0].head.ref = 'other'; }, p => { p.run.pull_requests[0].base.repo.id++; },
        p => { p.run.pull_requests[0].base.ref = 'main'; }, p => { p.artifact.id++; },
        p => { p.artifact.name += '-other'; }, p => { p.artifact.expired = true; }, p => { p.artifact.size_in_bytes++; },
        p => { p.artifact.digest = `sha256:${'0'.repeat(64)}`; }, p => { p.artifact.workflow_run.id++; },
        p => { p.artifact.workflow_run.repository_id++; }, p => { p.artifact.workflow_run.head_repository_id++; },
        p => { p.artifact.workflow_run.head_sha = '0'.repeat(40); }, p => { p.artifact.workflow_run.head_branch = 'other'; },
        p => { p.artifact.archive_download_url = 'https://untrusted.invalid/archive.zip'; }
      ];
      for (const change of changes) { const p = structuredClone(good); change(p);
        assert.throws(() => validateProvenance(source, p.run, p.artifact, p.workflow)); }
    }
  });

  it('accepts historical run and artifact SHAs when the associated PR head has advanced', () => {
    // Retained run 39955744530 has head_sha 8c3048af..., while its nested PR
    // head now reports 665a622a... . Later pushes must not invalidate the run.
    const currentPrHead = '665a622a588bc81fb9c773baa51213505a138aa4';
    for (const source of SELECTION) {
      for (const associatedHead of [currentPrHead, 'e'.repeat(40), '0'.repeat(40)]) {
        const p = provenance(source);
        p.run.pull_requests[0].head.sha = associatedHead;
        assert.notEqual(associatedHead, source.sha);
        assert.equal(p.run.head_sha, source.sha);
        assert.equal(p.artifact.workflow_run.head_sha, source.sha);
        assert.doesNotThrow(() => validateProvenance(source, p.run, p.artifact, p.workflow));
        for (const change of [
          value => { value.run.head_sha = associatedHead; },
          value => { value.artifact.workflow_run.head_sha = associatedHead; }
        ]) {
          const invalid = structuredClone(p); change(invalid);
          assert.throws(() => validateProvenance(source, invalid.run, invalid.artifact, invalid.workflow),
            /source_(?:run|artifact)_mismatch/);
        }
      }
    }
  });

  it('requires a full SHA-shaped nested PR head and the exact PR number, refs and repositories', () => {
    const source = SELECTION[0], good = provenance(source);
    good.run.pull_requests[0].head.sha = '665a622a588bc81fb9c773baa51213505a138aa4';
    for (const invalidSha of [undefined, null, 123, {}, ['a'.repeat(40)], '', 'a'.repeat(39),
      'a'.repeat(41), 'g'.repeat(40), 'a'.repeat(40) + '\n']) {
      const p = structuredClone(good); p.run.pull_requests[0].head.sha = invalidSha;
      assert.throws(() => validateProvenance(source, p.run, p.artifact, p.workflow), /source_pr_mismatch/);
    }
    for (const change of [
      p => { p.run.pull_requests[0].number = 114; },
      p => { p.run.pull_requests[0].head.ref = 'other'; },
      p => { p.run.pull_requests[0].base.ref = 'main'; },
      p => { p.run.pull_requests[0].head.repo.id++; },
      p => { p.run.pull_requests[0].base.repo.id++; }
    ]) {
      const p = structuredClone(good); change(p);
      assert.throws(() => validateProvenance(source, p.run, p.artifact, p.workflow), /source_pr_mismatch/);
    }
  });

  it('decodes only two regular files in memory, including bounded deflate and data descriptors', () => {
    const files = documents(SELECTION[0]);
    for (const method of [0, 8]) for (const descriptor of [false, true])
      assert.deepEqual(unpackRecoveryZip(zip([...files], { method, descriptor })), files);
    assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
  });

  it('rejects traversal, duplicate, extra, directory, link, encrypted, ZIP64 and malformed ZIPs', () => {
    const files = [...documents(SELECTION[0])], valid = zip(files);
    const bad = [Buffer.alloc(0), Buffer.alloc(LIMITS.zip + 1), Buffer.concat([valid, Buffer.from('tail')]),
      zip([files[0]]), zip([...files, ['extra.json', Buffer.from('{}')]]), zip([files[0], files[0]]),
      ...['../backend.json', '/backend.json', 'dir/backend.json', 'backend.json/', 'backend.json\0'].map(name => zip([files[0], [name, files[1][1]]])),
      mutate(valid, (b, c) => b.writeUInt32LE((0o120777 << 16) >>> 0, c + 38)),
      mutate(valid, (b, c) => b.writeUInt32LE((0o040755 << 16) >>> 0, c + 38)),
      mutate(valid, (b, c) => b.writeUInt16LE(1, c + 8)),
      mutate(valid, (b, c) => b.writeUInt16LE(0x40, c + 8)),
      mutate(valid, (b, c) => b.writeUInt16LE(45, c + 6)),
      mutate(valid, (b, c) => b.writeUInt32LE(0xffffffff, c + 24)),
      mutate(valid, b => b.writeUInt16LE(1, b.length - 18)),
      mutate(valid, (b, c) => b.writeUInt16LE(12, c + 10)),
      mutate(valid, b => b.writeUInt16LE(8, 6)),
      mutate(valid, (b, c) => b.writeUInt32LE(1, c + 42)),
      mutate(valid, (b, c) => b.writeUInt32LE(1, c + 16)),
      mutate(zip(files, { descriptor: true }), b => { b[b.indexOf(Buffer.from([0x50, 0x4b, 0x07, 0x08])) + 4] ^= 1; })
    ];
    for (const bytes of bad) assert.throws(() => unpackRecoveryZip(bytes));
    const bomb = zip([['cleanup-identity.json', Buffer.alloc(LIMITS.file + 1, 65)], files[1]]);
    assert.throws(() => unpackRecoveryZip(bomb), /archive_entry_bounds/);
    // Lie about a highly compressed member's output length: zlib's own output cap must still stop it.
    const lied = mutate(bomb, (b, c) => { b.writeUInt32LE(1, 22); b.writeUInt32LE(1, c + 24); });
    assert.throws(() => unpackRecoveryZip(lied), /archive_inflate_invalid/);
  });

  it('checks actual ZIP digest and exact binary length, even for structurally valid two-file archives', () => {
    for (const source of SELECTION) {
      assert.throws(() => verifiedArchive(source, Buffer.alloc(source.size)), /source_zip_digest_mismatch/);
      assert.throws(() => verifiedArchive(source, zip([...documents(source)])), /source_zip_digest_mismatch/);
      assert.throws(() => verifiedArchive(source, Buffer.alloc(source.size + 1)), /source_zip_digest_mismatch/);
    }
  });

  it('rejects identity/context/nonce/allowlist tampering and retains failed compatibility history', () => {
    for (const source of SELECTION) {
      const files = documents(source), before = new Map([...files].map(([name, bytes]) => [name, Buffer.from(bytes)]));
      const result = validateDocuments(source, files); assert.deepEqual(result.identity, owned(source));
      for (const name of files.keys()) assert.equal(result.hashes[name], hash(files.get(name)));
      for (const change of [v => { v.nonce = '0'.repeat(24); }, v => { v.sha = SELECTION[0].sha === source.sha ? '0'.repeat(40) : SELECTION[0].sha; },
        v => { v.runId = '1'; }, v => { v.attempt = '2'; }, v => { v.project = 'production'; }, v => { v.schema = 'private'; },
        v => { v.names.codes = 'codes'; }, v => { v.names.extra = 'code_pages'; }, v => { v.extra = true; }])
        assert.throws(() => validateDocuments(source, changeDocument(files, 'cleanup-identity.json', change)));
      for (const change of [v => { v.fixture.nonce = '0'.repeat(24); }, v => { v.sha = '0'.repeat(40); },
        v => { v.runId = '1'; }, v => { v.attempt = '2'; }, v => { v.status = 'pass'; },
        v => { v.checks = v.checks.filter(c => c.name !== 'fixture_cleanup_failed'); },
        v => { v.checks[9].status = 'fail'; }, v => { v.sql.pop(); }, v => { v.sql[2].httpCode = 200; },
        v => { v.cleanup.status = 'pass'; }, v => { v.requests = []; }])
        assert.throws(() => validateDocuments(source, changeDocument(files, 'backend.json', change)));
      assert.deepEqual(files, before, 'validation preserves original bytes, whitespace and failed history');
    }
  });

  it('uses only API artifact IDs and never sends the GitHub token to the signed download host', async () => {
    const source = SELECTION[0], p = provenance(source), calls = [];
    p.run.pull_requests[0].head.sha = '665a622a588bc81fb9c773baa51213505a138aa4';
    const acquire = githubSourceLoader('SYNTHETIC_GITHUB_SECRET', async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith('/actions/workflows/pull-request.yml')) return jsonResponse(p.workflow);
      if (url.endsWith(`/actions/runs/${source.runId}`)) return jsonResponse(p.run);
      if (url.endsWith(`/actions/artifacts/${source.artifactId}`)) return jsonResponse(p.artifact);
      if (url === p.artifact.archive_download_url) return new Response(null, { status: 302,
        headers: { location: 'https://test.blob.core.windows.net/signed-artifact?sig=SYNTHETIC_SIGNATURE' } });
      assert.equal(url, 'https://test.blob.core.windows.net/signed-artifact?sig=SYNTHETIC_SIGNATURE');
      assert.deepEqual(options.headers, {}); assert.equal(options.redirect, 'error');
      return new Response(Buffer.alloc(source.size));
    });
    await assert.rejects(acquire(source), /source_zip_digest_mismatch/);
    assert.equal(calls.length, 5);
    for (const call of calls.slice(0, 4)) assert.equal(call.options.headers.Authorization, 'Bearer SYNTHETIC_GITHUB_SECRET');
    assert.equal(calls[3].options.redirect, 'manual');
  });

  it('fails bad provenance before download and refuses arbitrary download hosts', async () => {
    const source = SELECTION[0], p = provenance(source);
    for (const badProvenance of [true, false]) {
      const seen = [];
      const acquire = githubSourceLoader('synthetic', async url => {
        seen.push(url);
        if (url.endsWith('/pull-request.yml')) return jsonResponse(p.workflow);
        if (url.endsWith(`/runs/${source.runId}`)) return jsonResponse(p.run);
        if (url.endsWith(`/artifacts/${source.artifactId}`)) return jsonResponse({ ...p.artifact, expired: badProvenance });
        return new Response(null, { status: 302, headers: { location: 'https://evil.invalid/steal' } });
      });
      await assert.rejects(acquire(source), badProvenance ? /source_artifact_mismatch/ : /source_download_host_invalid/);
      assert.equal(seen.length, badProvenance ? 3 : 4);
    }
  });

  it('validates all FOUR original contexts before any cleanup and preserves originals after reconciliation', async () => {
    const receipt = newReceipt({ sha: 'f'.repeat(40), runId: '40000000000', attempt: '1' });
    const inputs = SELECTION.map(documents), originals = inputs.map(files => new Map([...files].map(([n, b]) => [n, Buffer.from(b)])));
    const order = [], saved = [];
    await recoverAll({ receipt, acquire: async source => { order.push(`load:${source.runId}`); return { files: inputs[SELECTION.indexOf(source)] }; },
      persist: async () => { saved.push(structuredClone(receipt)); }, clean: async (identity, entry) => {
        assert.equal(receipt.allSourcesValidated, true); assert.equal(order.filter(s => s.startsWith('load:')).length, 4);
        order.push(`clean:${identity.runId}`); entry.absenceProven = true;
      } });
    assert.deepEqual(order.slice(0, 4), SELECTION.map(s => `load:${s.runId}`));
    assert.equal(receipt.reconciliationStatus, 'reconciled'); assert.ok(receipt.sources.every(s => s.absenceProven && s.historicalStatus === 'fail'));
    assert.deepEqual(inputs, originals); assert.ok(saved.length >= 10);
    for (const files of inputs) {
      const backend = JSON.parse(files.get('backend.json')); assert.equal(backend.status, 'fail');
      assert.equal(backend.checks.filter(c => c.name === 'fixture_cleanup_failed').length, 2);
    }
  });

  it('a bad fourth artifact or failed persistence prevents ALL database calls and saves partial evidence', async () => {
    for (const fault of ['fourth_identity', 'fourth_download', 'persistence']) {
      const receipt = newReceipt({ sha: 'f'.repeat(40) }); let cleanCalls = 0, saves = 0;
      const snapshots = [];
      await recoverAll({ receipt, acquire: async source => {
        if (source === SELECTION[3] && fault === 'fourth_download') throw new Error('PRIVATE_BODY SECRET');
        const files = documents(source);
        return { files: source === SELECTION[3] && fault === 'fourth_identity' ?
          changeDocument(files, 'backend.json', value => { value.fixture.names.codes = 'codes'; }) : files };
      }, persist: async () => {
        saves++; if (fault === 'persistence' && saves === 3) throw new Error('PRIVATE_PATH SECRET');
        snapshots.push(structuredClone(receipt));
      }, clean: async () => { cleanCalls++; } });
      assert.equal(cleanCalls, 0); assert.equal(receipt.allSourcesValidated, false);
      assert.equal(receipt.reconciliationStatus, 'failed'); assert.ok(receipt.sources.every(s => !s.absenceProven));
      assert.equal(snapshots.at(-1).reconciliationStatus, 'failed'); assert.doesNotMatch(JSON.stringify(receipt), /PRIVATE|SECRET/);
    }
  });

  it('partial cleanup remains failed; both successful and failed attempts survive in a separate receipt', async () => {
    const receipt = newReceipt({ sha: 'f'.repeat(40) }), snapshots = []; let calls = 0;
    const clean = cleanupTransport('SYNTHETIC_MANAGEMENT_SECRET', { pause: async () => {}, fetcher: async (url, options) => {
      calls++; assert.equal(url, 'https://api.supabase.com/v1/projects/bbtcaurrtyoukvjbxbbj/database/query');
      assert.equal(options.method, 'POST'); assert.equal(options.redirect, 'error');
      assert.equal(options.headers.Authorization, 'Bearer SYNTHETIC_MANAGEMENT_SECRET');
      const query = JSON.parse(options.body).query;
      const source = SELECTION.find(s => query.includes(s.prefix)); assert.ok(source);
      assert.equal(query, `set statement_timeout='8s'; set lock_timeout='2s'; set timezone='UTC';\n${cleanupSql(owned(source))}`);
      return source === SELECTION[1] ? jsonResponse({ error: { message:
        'Failed to run sql query: ERROR: 42601: PRIVATE_SQL SECRET\nLINE 10: PRIVATE_BODY' } }, 400) : jsonResponse([{ cleaned: true }]);
    } });
    await recoverAll({ receipt, acquire: async source => ({ files: documents(source) }),
      persist: async () => { snapshots.push(structuredClone(receipt)); }, clean });
    assert.equal(calls, 6); assert.equal(receipt.sqlCalls, 6); assert.equal(receipt.reconciliationStatus, 'failed');
    assert.deepEqual(receipt.sources.map(s => s.absenceProven), [true, false, true, true]);
    const failed = receipt.sources[1]; assert.equal(failed.attempts.length, 3);
    for (const attempt of failed.attempts) {
      assert.equal(attempt.sqlstate, '42601'); assert.equal(attempt.errorClass, 'syntax_error');
      assert.equal(attempt.reportedLine, 10); assert.equal(attempt.httpCode, 400);
    }
    assert.equal(snapshots.at(-1).reconciliationStatus, 'failed');
    assert.doesNotMatch(JSON.stringify(receipt), /SYNTHETIC|SECRET|PRIVATE|set statement_timeout|Failed to run sql/);
    assert.ok(receipt.sources.every(s => s.historicalStatus === 'fail'));
  });

  it('caps four identities at twelve requests, and ownership/kind/privilege failures have no override', async () => {
    for (const [failure, expected] of [[{ code: '42601', message: 'PRIVATE_SQL' }, 12],
      [{ code: 'P0001', message: 'fixture_cleanup_ownership_mismatch' }, 4],
      [{ code: '42809', message: 'PRIVATE_KIND' }, 4], [{ code: '42501', message: 'PRIVATE_ROLE' }, 4]]) {
      const receipt = newReceipt({ sha: 'f'.repeat(40) }); let calls = 0;
      await recoverAll({ receipt, acquire: async source => ({ files: documents(source) }), persist: async () => {},
        clean: cleanupTransport('synthetic', { pause: async () => {}, fetcher: async () => { calls++; return jsonResponse(failure, 400); } }) });
      assert.equal(calls, expected); assert.equal(receipt.sqlCalls, expected); assert.equal(receipt.reconciliationStatus, 'failed');
      assert.ok(receipt.sources.every(s => !s.absenceProven && s.attempts.length <= 3));
      assert.doesNotMatch(JSON.stringify(receipt), /PRIVATE|synthetic/);
    }
  });

  it('requires exact positive four-name proof, bounds bodies/deadlines, and sanitizes thrown secrets', async () => {
    for (const response of [[], [{ cleaned: false }], [{ cleaned: true }, { cleaned: true }],
      [{ cleaned: true, extra: 'PRIVATE_BODY' }], { cleaned: true }]) {
      const receipt = newReceipt({ sha: 'f'.repeat(40) }); receipt.allSourcesValidated = true;
      await cleanupTransport('synthetic', { pause: async () => {}, fetcher: async () => jsonResponse(response) })(owned(SELECTION[0]), receipt.sources[0], receipt, async () => {});
      assert.equal(receipt.sources[0].absenceProven, false); assert.equal(receipt.sqlCalls, 3);
      assert.doesNotMatch(JSON.stringify(receipt), /PRIVATE_BODY/);
    }
    for (const mode of ['oversize', 'timeout', 'throw']) {
      const receipt = newReceipt({ sha: 'f'.repeat(40) }); receipt.allSourcesValidated = true; let time = 0, calls = 0;
      await cleanupTransport('synthetic', { now: () => time, pause: async ms => { time += ms; }, fetcher: async () => {
        calls++;
        if (mode === 'throw') throw new Error('SECRET PRIVATE_SQL');
        if (mode === 'timeout') { time += 35001; return jsonResponse([{ cleaned: true }]); }
        return new Response('S'.repeat(LIMITS.body + 1));
      } })(owned(SELECTION[0]), receipt.sources[0], receipt, async () => {});
      assert.equal(calls, mode === 'timeout' ? 1 : 3); assert.equal(receipt.sources[0].absenceProven, false);
      assert.doesNotMatch(JSON.stringify(receipt), /SECRET|PRIVATE_SQL|SSSS/);
    }
  });

  it('never runs cleanup for an unselected identity or before complete validation', async () => {
    const receipt = newReceipt({ sha: 'f'.repeat(40) }); let calls = 0;
    const clean = cleanupTransport('synthetic', { fetcher: async () => { calls++; return jsonResponse([{ cleaned: true }]); } });
    await assert.rejects(clean(owned(SELECTION[0]), receipt.sources[0], receipt, async () => {}), /cleanup_validated_selection_required/);
    receipt.allSourcesValidated = true;
    await assert.rejects(clean(fixtureIdentity({ sha: 'e'.repeat(40), runId: '1', attempt: '1', nonce: 'd'.repeat(24) }),
      receipt.sources[0], receipt, async () => {}), /cleanup_validated_selection_required/);
    assert.equal(calls, 0);
  });
});
