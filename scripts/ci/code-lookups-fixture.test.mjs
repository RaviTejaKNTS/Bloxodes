import assert from 'node:assert/strict';
import test from 'node:test';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TARGET, MIGRATION, CASES, PAGES, fixtureIdentity, validateIdentity, cleanupRecovery, sqlFailureDiagnostic, oracleDefinition,
  setupSql, cleanupSql } from './code-lookups-fixture.mjs';

const context = { sha: 'a'.repeat(40), runId: '39949100107', attempt: '1' };
const identity = fixtureIdentity({ ...context, nonce: 'b'.repeat(24) });
const source = await readFile(new URL(`../../${MIGRATION}`, import.meta.url), 'utf8');

test('cleanup identity rejects actual relations, extra targets, and foreign run/SHA/attempts', () => {
  assert.deepEqual(validateIdentity(structuredClone(identity), context), identity);
  for (const changed of [
    { ...identity, names: { ...identity.names, codes: 'codes' } },
    { ...identity, names: { ...identity.names, extra: 'code_pages' } },
    { ...identity, schema: 'private' }, { ...identity, project: 'production' },
    { ...identity, sha: 'c'.repeat(40) }, { ...identity, runId: '1' }, { ...identity, attempt: '2' },
    { ...identity, nonce: "'; drop table public.codes;--" }
  ]) assert.throws(() => validateIdentity(changed, context));
});

test('concurrent runs, reruns, and repeated runs at the same SHA own disjoint relation names', () => {
  const identities = [identity,
    fixtureIdentity({ ...context, runId: '39949100108', nonce: identity.nonce }),
    fixtureIdentity({ ...context, attempt: '2', nonce: identity.nonce }),
    fixtureIdentity({ ...context, nonce: 'c'.repeat(24) })];
  const names = identities.flatMap(value => Object.values(value.names));
  assert.equal(new Set(names).size, 16);
  assert.ok(names.every(name => /^qa_cl_[a-f0-9]{16}_(pages|codes|universes|oracle)$/.test(name) && name.length <= 63));
});

test('the oracle retains the complete canonical view and rejects new external dependencies', () => {
  const oracle = oracleDefinition(source, identity);
  assert.match(oracle.sha256, /^[a-f0-9]{64}$/);
  assert.ok(oracle.sql.startsWith(`create view public.${identity.names.oracle} with (security_invoker = true)`));
  assert.match(oracle.sql, /jsonb_agg\(c\.\* order by c\.status, c\.last_seen_at desc\)/);
  assert.match(oracle.sql, /as recommended_games/);
  const refs = new Set([...oracle.sql.matchAll(/public\.([a-z0-9_]+)/g)].map(match => match[1]));
  assert.deepEqual(refs, new Set(Object.values(identity.names)));
  assert.doesNotMatch(oracle.sql, /create or replace|public\.(?:codes|code_pages|roblox_universes)\b/);
  assert.throws(() => oracleDefinition(source.replace('from public.codes c', 'from public.private_codes c'), identity), /canonical_view_dependency_allowlist/);
  assert.throws(() => oracleDefinition(source.replace('jsonb_agg(c.* order by', 'jsonb_agg(c.code order by'), identity), /canonical_view_shape/);
});

test('fixture writes and drops target only the four allowlisted objects, never the source tables', () => {
  const setup = setupSql(identity, oracleDefinition(source, identity)), cleanup = cleanupSql(identity);
  const mutationTargets = [...(setup + cleanup).matchAll(/(?:insert into|alter table|drop (?:table|view) if exists|create (?:table|view)|comment on (?:table|view)) public\.([a-z0-9_]+)/g)].map(match => match[1]);
  assert.ok(mutationTargets.length > 15);
  assert.ok(mutationTargets.every(name => Object.values(identity.names).includes(name)));
  assert.match(setup, new RegExp(`foreign key\\(code_page_id\\) references public\\.${identity.names.pages}\\(id\\)`));
  assert.match(setup, /like public\.codes including all/);
  assert.match(setup, /force row level security/);
  assert.match(setup, /aclexplode/);
  assert.doesNotMatch(setup, /create trigger|create policy|alter default privileges|create schema/i);
  assert.doesNotMatch(cleanup, /\bcascade\b/i);
  assert.match(cleanup, /owner_marker is distinct from/);
  assert.match(cleanup, /r\.relowner <>/);
  assert.match(cleanup, /to_regclass/);
  assert.ok(cleanup.indexOf('fixture_cleanup_ownership_mismatch') < cleanup.indexOf('drop view'));
  assert.ok(cleanup.indexOf(identity.names.oracle + ';') < cleanup.indexOf(identity.names.codes + ';'));
  for (const count of CASES) assert.ok(setup.includes(`generate_series(1,${count})`));
  assert.equal(CASES.reduce((sum, n) => sum + n, 0) + 1, 5001);
  assert.equal(new Set([...PAGES.sizes.map(p => p.id), PAGES.draft, PAGES.empty, PAGES.missing]).size, 7);
});

const present = value => ({ state: 'present', text: JSON.stringify(value) });
const missing = { state: 'missing' };
const passingBackend = fixture => ({ version: 2, ...context, fixture, status: 'pass',
  checks: [{ name: 'required_fixture_compatibility', status: 'pass' }],
  requests: [{ name: 'old_view_once_2000', httpCode: 200, rowCount: 2001 }],
  sql: [{ name: 'create_and_seed_owned_fixture', httpCode: 201 }],
  cleanup: { status: 'pass', attempts: 1 } });

test('recovery fails closed without identity when any backend evidence remains, including failed cleanup', () => {
  const failedCleanup = passingBackend(identity);
  failedCleanup.status = 'fail'; failedCleanup.cleanup = { status: 'failed', attempts: 3 };
  failedCleanup.checks.push({ name: 'fixture_cleanup_failed', status: 'fail' });
  failedCleanup.sql.push({ name: 'cleanup_exact_owned_relations', httpCode: 500 });
  const interrupted = passingBackend(identity);
  interrupted.status = 'running'; interrupted.checks = []; delete interrupted.cleanup;
  for (const backendFile of [present(interrupted), present(failedCleanup), present(passingBackend(identity)),
    { state: 'present', text: '' }, { state: 'unreadable' }]) {
    const original = structuredClone(backendFile);
    const decision = cleanupRecovery({ context, identityFile: missing, backendFile });
    assert.equal(decision.identity, null); // The CLI's cleanup() cannot issue SQL without this.
    assert.equal(decision.canSave, false); // Preserve the existing file, including failed cleanup evidence.
    assert.equal(decision.notStarted, false);
    assert.equal(decision.failure, 'cleanup_identity_missing_with_backend_evidence');
    assert.equal(decision.receipt.status, 'fail');
    assert.deepEqual(decision.receipt.checks, [{ name: decision.failure, status: 'fail' }]);
    assert.deepEqual(decision.receipt.sql, []);
    assert.deepEqual(backendFile, original);
  }
});

test('only two absent recovery files produce an explicit not-started no-op without a saved pass', () => {
  const decision = cleanupRecovery({ context, identityFile: missing, backendFile: missing });
  assert.equal(decision.identity, null);
  assert.equal(decision.canSave, false);
  assert.equal(decision.notStarted, true);
  assert.equal(decision.failure, null);
  assert.equal(decision.receipt.status, 'not_started');
  assert.deepEqual(decision.receipt.checks, []);
  assert.deepEqual(decision.receipt.sql, []);
});

test('recovery never borrows a backend fixture as a replacement for an invalid durable identity', () => {
  for (const identityFile of [{ state: 'present', text: '' }, { state: 'unreadable' },
    present({ ...identity, names: { ...identity.names, codes: 'codes' } })]) {
    const decision = cleanupRecovery({ context, identityFile, backendFile: present(passingBackend(identity)) });
    assert.equal(decision.identity, null);
    assert.equal(decision.canSave, false);
    assert.equal(decision.notStarted, false);
    assert.equal(decision.receipt.status, 'fail');
  }
});

test('same-context different nonces cannot share success; cleanup targets only the durable identity', () => {
  const other = fixtureIdentity({ ...context, nonce: 'c'.repeat(24) });
  const prior = passingBackend(other), original = structuredClone(prior);
  const decision = cleanupRecovery({ context, identityFile: present(identity), backendFile: present(prior) });
  assert.equal(decision.failure, 'cleanup_backend_identity_mismatch');
  assert.equal(decision.receipt.status, 'fail');
  assert.equal(decision.canSave, true);
  assert.deepEqual(decision.identity, identity);
  assert.deepEqual(decision.receipt.fixture, identity);
  assert.deepEqual(decision.receipt.recovery.historicalBackend, original);
  assert.deepEqual(decision.receipt.requests, []); // Prior parity is history, not this fixture's proof.
  assert.deepEqual(decision.receipt.sql, []);
  assert.deepEqual(decision.receipt.checks, [{ name: decision.failure, status: 'fail' }]);
  const guardedCleanup = cleanupSql(decision.identity);
  for (const name of Object.values(identity.names)) assert.ok(guardedCleanup.includes(name));
  for (const name of Object.values(other.names)) assert.ok(!guardedCleanup.includes(name));
  assert.deepEqual(prior, original);
});

test('recovery binds the entire backend fixture and receipt context, including the exact relation allowlist', () => {
  const wrongFixtures = [
    { ...identity, project: 'production' }, { ...identity, schema: 'private' },
    { ...identity, sha: 'c'.repeat(40) }, { ...identity, runId: '1' }, { ...identity, attempt: '2' },
    { ...identity, names: { ...identity.names, codes: 'codes' } },
    { ...identity, names: { ...identity.names, extra: 'code_pages' } },
    { ...identity, extra: true }
  ];
  const wrongReceipts = wrongFixtures.map(fixture => passingBackend(fixture));
  for (const changed of [{ sha: 'c'.repeat(40) }, { runId: '1' }, { attempt: '2' }])
    wrongReceipts.push({ ...passingBackend(identity), ...changed });
  for (const prior of wrongReceipts) {
    const decision = cleanupRecovery({ context, identityFile: present(identity), backendFile: present(prior) });
    assert.equal(decision.failure, 'cleanup_backend_identity_mismatch');
    assert.equal(decision.receipt.status, 'fail');
    assert.deepEqual(decision.identity, identity);
    assert.deepEqual(decision.receipt.fixture, identity);
    assert.deepEqual(decision.receipt.recovery.historicalBackend, prior);
  }
});

test('matching recovery requires a completed compatibility marker before preserving passing verification', () => {
  const priorReceipts = [[], [{ name: 'old_view_full_parity_2000', status: 'pass' }],
    [{ name: 'required_fixture_compatibility', status: 'running' }],
    [{ name: 'required_fixture_compatibility', status: 'fail' }]]
    .map(checks => ({ ...passingBackend(identity), checks }));
  priorReceipts.push({ ...passingBackend(identity), status: 'running' });
  for (const prior of priorReceipts) {
    const original = structuredClone(prior);
    const decision = cleanupRecovery({ context, identityFile: present(identity), backendFile: present(prior) });
    assert.equal(decision.failure, 'verification_not_completed');
    assert.equal(decision.receipt.status, 'fail');
    assert.equal(decision.canSave, true);
    assert.deepEqual(decision.identity, identity); // Still authorize only this fixture's guarded cleanup.
    assert.deepEqual(decision.receipt.checks.slice(0, prior.checks.length), prior.checks);
    assert.deepEqual(decision.receipt.sql, prior.sql);
    assert.deepEqual(decision.receipt.requests, prior.requests);
    assert.deepEqual(prior, original);
  }
});

test('matching completed evidence is reusable while prior verification and terminal cleanup failures stay failed', () => {
  const pass = passingBackend(identity);
  const decision = cleanupRecovery({ context, identityFile: present(identity), backendFile: present(pass) });
  assert.equal(decision.failure, null);
  assert.equal(decision.receipt.status, 'pass');
  assert.deepEqual(decision.receipt, pass);
  assert.equal(decision.canSave, true);
  for (const name of ['old_view_ids_fields_counts_mismatch', 'fixture_cleanup_failed']) {
    const prior = passingBackend(identity);
    prior.status = 'fail'; prior.checks.push({ name, status: 'fail' });
    if (name === 'fixture_cleanup_failed') prior.cleanup = { status: 'failed', attempts: 3 };
    const failed = cleanupRecovery({ context, identityFile: present(identity), backendFile: present(prior) });
    assert.equal(failed.receipt.status, 'fail');
    assert.deepEqual(failed.receipt.checks, prior.checks);
    assert.deepEqual(failed.receipt.sql, prior.sql);
    assert.deepEqual(failed.identity, identity);
    assert.equal(failed.canSave, true);
  }
});

test('a durable identity permits guarded cleanup after missing or unreadable verification, never a pass', () => {
  for (const backendFile of [missing, { state: 'unreadable' }, { state: 'present', text: '' }]) {
    const decision = cleanupRecovery({ context, identityFile: present(identity), backendFile });
    assert.deepEqual(decision.identity, identity);
    assert.equal(decision.receipt.status, 'fail');
    assert.equal(decision.canSave, backendFile.state === 'missing');
    assert.equal(decision.notStarted, false);
  }
});

test('SQL diagnostics recognize Management envelopes without retaining PostgreSQL text', () => {
  const phase = 'cleanup_exact_owned_relations', query = 'select 1;\nselect 2;';
  const primary = 'Failed to run sql query: ERROR: 42601: syntax error at or near "PRIVATE_SQL"\nLINE 2: PRIVATE_SQL';
  for (const result of [{ code: '42601', message: primary }, { error: { message: primary } },
    { error: primary }, { data: { error: { message: primary } } }, primary,
    { error: JSON.stringify({ message: primary }) }, JSON.stringify({ error: { code: '42601', message: primary } })]) {
    assert.deepEqual(sqlFailureDiagnostic({ phase, query, result }),
      { phase, sqlstate: '42601', errorClass: 'syntax_error', reportedLine: 2 });
  }
  for (const [code, errorClass] of [['42501', 'insufficient_privilege'], ['2BP01', 'dependent_objects'],
    ['42P01', 'undefined_relation'], ['42809', 'wrong_object_type'], ['55P03', 'lock_unavailable'],
    ['57014', 'query_canceled'], ['40P01', 'deadlock'], ['25P02', 'transaction_aborted']]) {
    assert.deepEqual(sqlFailureDiagnostic({ phase, query, result: { error: { code, message: 'PRIVATE_SQL' } } }),
      { phase, sqlstate: code, errorClass });
  }
  assert.throws(() => sqlFailureDiagnostic({ phase: 'PRIVATE_PHASE', query, result: {} }), /sql_diagnostic_inputs/);
});

test('SQL diagnostics fail closed for conflicting states, malformed envelopes and unsafe locations', () => {
  const phase = 'cleanup_exact_owned_relations', query = 'select 1;\nselect 2;';
  for (const result of [null, [], '{invalid JSON', { code: '42501\nSECRET', message: 'SECRET' },
    { code: '42501', error: { code: '42601' } }, { code: '42501', message: 'ERROR: 42601: SECRET' },
    { message: 'ERROR: 42601: ' + 'S'.repeat(65536) }]) {
    assert.deepEqual(sqlFailureDiagnostic({ phase, query, result }), { phase, sqlstate: 'unknown', errorClass: 'unknown' });
  }
  for (const position of [-1, 0, 1.5, true, '1e1', '01', '2\nSECRET', '9999999999', query.length + 1]) {
    assert.deepEqual(sqlFailureDiagnostic({ phase, query, result: { code: '42601', position,
      message: 'ERROR: 42601: SECRET\nLINE 999999: SECRET',
      context: 'PL/pgSQL function inline_code_block line 999999 at SECRET' } }),
    { phase, sqlstate: '42601', errorClass: 'syntax_error' });
  }
  assert.deepEqual(sqlFailureDiagnostic({ phase, query, result: { error: { code: '42601', position: '9' } } }),
    { phase, sqlstate: '42601', errorClass: 'syntax_error', position: 9 });
});

test('SQL diagnostics classify only exact fixture guards and bound anonymous block locations', () => {
  const phase = 'cleanup_exact_owned_relations', query = 'begin;\ndo $qa$ begin\nend $qa$;\ncommit;';
  const message = 'Failed to run sql query: ERROR: P0001: fixture_cleanup_ownership_mismatch\n' +
    'CONTEXT: PL/pgSQL function inline_code_block line 3 at RAISE\nPRIVATE_SQL credentials=SECRET';
  assert.deepEqual(sqlFailureDiagnostic({ phase, query, result: { error: { message } } }),
    { phase, sqlstate: 'P0001', errorClass: 'fixture_cleanup_ownership_mismatch', blockLine: 3 });
  assert.deepEqual(sqlFailureDiagnostic({ phase, query, result: { code: 'P0001', message: 'fixture_cleanup_ownership_mismatch SECRET',
    context: 'PL/pgSQL function secret_function line 3 at RAISE' } }),
    { phase, sqlstate: 'P0001', errorClass: 'unknown' });
  assert.deepEqual(sqlFailureDiagnostic({ phase: 'create_and_seed_owned_fixture', query,
    result: { error: { code: 'P0001', message: 'fixture_name_collision' } } }),
    { phase: 'create_and_seed_owned_fixture', sqlstate: 'P0001', errorClass: 'fixture_name_collision' });
});

// GitHub-only subprocess regressions use the unchanged CLI, real Git guards, real
// filesystem writes and finalization. The throwaway checkout has no remote and
// receives only synthetic credentials. Never use the real receipt directory.
async function cliFixture(t, managementFailure = null) {
  assert.equal(process.versions.node.split('.')[0], '22', 'CLI regressions require GitHub Node 22');
  const scratch = fileURLToPath(new URL('../../tmp/', import.meta.url));
  await mkdir(scratch, { recursive: true });
  const root = await mkdtemp(join(scratch, 'code-lookups-cli-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const path of ['scripts/ci/code-lookups-qa.mjs', 'scripts/ci/code-lookups-fixture.mjs',
    'scripts/ci/code-lookups-fixture.test.mjs', MIGRATION]) {
    const destination = join(root, path);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(new URL(`../../${path}`, import.meta.url), destination);
  }
  // Do not inherit secrets, NODE_OPTIONS, user Git configuration or real CI event
  // files. Git writes only this disposable test checkout, later on GitHub.
  const gitEnv = { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_TERMINAL_PROMPT: '0' };
  const git = args => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], {
    cwd: root, env: gitEnv, encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git(['init', '--quiet']);
  git(['add', '--', 'scripts/ci', MIGRATION]);
  git(['-c', 'user.name=Fixture test', '-c', 'user.email=fixture@example.invalid',
    '-c', 'commit.gpgSign=false', 'commit', '--quiet', '-m', 'Isolated CLI regression inputs']);
  const cliContext = { ...context, sha: git(['rev-parse', 'HEAD']) };
  const owned = fixtureIdentity({ ...cliContext, nonce: identity.nonce });
  const directory = join(root, 'tmp/test-reports/code-lookups');
  await mkdir(directory, { recursive: true });
  const identityPath = join(directory, 'cleanup-identity.json'), backendPath = join(directory, 'backend.json');
  const eventPath = join(root, 'event.json'), preloadPath = join(root, 'deny-network.mjs');
  const networkPath = join(root, 'network-attempts.json');
  await writeFile(eventPath, JSON.stringify({ repository: { full_name: 'RaviTejaKNTS/Bloxodes' },
    pull_request: { head: { sha: cliContext.sha, repo: { full_name: 'RaviTejaKNTS/Bloxodes' } },
      base: { repo: { full_name: 'RaviTejaKNTS/Bloxodes' } } } }));
  await writeFile(preloadPath, `
import { writeFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
const attempts = [];
const deny = () => { attempts.push('blocked'); throw new Error('test_network_forbidden'); };
const managementFailure = ${JSON.stringify(managementFailure)};
globalThis.fetch = (url, options) => {
  if (managementFailure !== null && url === 'https://api.supabase.com/v1/projects/bbtcaurrtyoukvjbxbbj/database/query' &&
    options?.method === 'POST' && options.redirect === 'error') {
    attempts.push('synthetic_management_failure');
    return Promise.resolve(new Response(JSON.stringify(managementFailure), { status: 400 }));
  }
  return deny();
};
http.request = http.get = https.request = https.get = deny;
net.connect = net.createConnection = net.Socket.prototype.connect = tls.connect = deny;
syncBuiltinESMExports();
process.on('exit', () => writeFileSync(new URL('./network-attempts.json', import.meta.url), JSON.stringify(attempts)));
`);
  const env = { ...gitEnv, GITHUB_ACTIONS: 'true', CODE_LOOKUPS_QA: '1',
    GITHUB_REPOSITORY: 'RaviTejaKNTS/Bloxodes', GITHUB_EVENT_NAME: 'pull_request', GITHUB_EVENT_PATH: eventPath,
    GITHUB_SHA: cliContext.sha, GITHUB_RUN_ID: cliContext.runId, GITHUB_RUN_ATTEMPT: cliContext.attempt,
    MANAGED_DEV_SUPABASE_URL: TARGET, MANAGED_DEV_SUPABASE_SERVICE_ROLE: 'synthetic-service-only',
    MANAGED_DEV_SUPABASE_ACCESS_TOKEN: 'synthetic-access-only', MANAGED_DEV_SUPABASE_ANON_KEY: 'synthetic-anon-only' };
  const pass = { ...passingBackend(owned), ...cliContext };
  const failed = structuredClone(pass);
  failed.status = 'fail'; failed.cleanup = { status: 'failed', attempts: 3 };
  failed.checks.push({ name: 'fixture_cleanup_failed', status: 'fail' });
  failed.sql.push({ name: 'cleanup_exact_owned_relations', httpCode: 500 });
  const evidence = [
    ['completed verification', Buffer.from(JSON.stringify(pass, null, 3) + '\n\n')],
    ['failed cleanup history', Buffer.from(JSON.stringify(failed, null, 3) + '\n\n')],
    ['corrupt backend evidence', Buffer.from('{ "status": "fail", "unreadable_history":\n')]
  ];
  async function expectPreserved(mode, backendBytes, overrides, reason) {
    const identityBytes = Buffer.from(JSON.stringify(owned, null, 3) + '\n\n');
    await writeFile(identityPath, identityBytes);
    await writeFile(backendPath, backendBytes);
    const before = await Promise.all([readFile(identityPath), readFile(backendPath)]);
    await rm(networkPath, { force: true });
    const childEnv = { ...env, ...overrides };
    for (const key of Object.keys(childEnv)) if (childEnv[key] === undefined) delete childEnv[key];
    const result = spawnSync(process.execPath, ['--import', preloadPath, join(root, 'scripts/ci/code-lookups-qa.mjs'),
      '--mode', mode, '--expected-sha', cliContext.sha], { cwd: root, env: childEnv,
      encoding: 'utf8', timeout: 10000, maxBuffer: 64 * 1024 });
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    assert.equal(result.status, 1);
    assert.equal(result.stderr, `code-lookups QA ${reason}\n`);
    assert.equal(result.stdout, `code-lookups backend QA ${mode}: fail\n`);
    assert.deepEqual(JSON.parse(await readFile(networkPath, 'utf8')), [], 'no REST/setup/cleanup request attempted');
    assert.deepEqual(await readFile(identityPath), before[0], 'durable identity bytes preserved');
    assert.deepEqual(await readFile(backendPath), before[1], 'complete prior backend bytes preserved');
  }
  async function expectCleanupFailure() {
    const identityBytes = Buffer.from(JSON.stringify(owned, null, 3) + '\n\n');
    await writeFile(identityPath, identityBytes);
    await writeFile(backendPath, JSON.stringify(failed, null, 3) + '\n\n');
    const result = spawnSync(process.execPath, ['--import', preloadPath, join(root, 'scripts/ci/code-lookups-qa.mjs'),
      '--mode', 'cleanup', '--expected-sha', cliContext.sha], { cwd: root, env,
      encoding: 'utf8', timeout: 10000, maxBuffer: 64 * 1024 });
    assert.equal(result.error, undefined); assert.equal(result.signal, null); assert.equal(result.status, 1);
    assert.equal(result.stderr, 'code-lookups QA fixture_cleanup_failed\n');
    assert.equal(result.stdout, 'code-lookups backend QA cleanup: fail\n');
    assert.deepEqual(JSON.parse(await readFile(networkPath, 'utf8')), Array(3).fill('synthetic_management_failure'));
    assert.deepEqual(await readFile(identityPath), identityBytes);
    const saved = JSON.parse(await readFile(backendPath, 'utf8'));
    assert.equal(saved.status, 'fail'); assert.deepEqual(saved.fixture, owned);
    assert.deepEqual(saved.requests, failed.requests);
    assert.deepEqual(saved.checks, [...failed.checks, { name: 'fixture_cleanup_failed', status: 'fail' }]);
    assert.deepEqual(saved.sql.slice(0, failed.sql.length), failed.sql);
    assert.equal(saved.sql.length, failed.sql.length + 3);
    for (const entry of saved.sql.slice(failed.sql.length)) {
      assert.equal(entry.name, 'cleanup_exact_owned_relations'); assert.equal(entry.httpCode, 400);
      assert.equal(entry.phase, 'cleanup_exact_owned_relations'); assert.equal(entry.sqlstate, '42601');
      assert.equal(entry.errorClass, 'syntax_error'); assert.equal(entry.reportedLine, 2);
      assert.ok(Number.isSafeInteger(entry.durationMs) && entry.durationMs >= 0);
      assert.deepEqual(Object.keys(entry).sort(), ['durationMs', 'errorClass', 'httpCode', 'name', 'phase', 'reportedLine', 'sqlstate']);
    }
    assert.deepEqual(saved.cleanup, { status: 'failed', attempts: 3 });
    assert.doesNotMatch(JSON.stringify(saved), /PRIVATE_SQL|SECRET|Failed to run sql query|ERROR:|LINE 2:/);
  }
  return { evidence, expectPreserved, expectCleanupFailure };
}

test('actual CLI credential-guard failures preserve both files before recovery in either mode',
  { skip: process.env.GITHUB_ACTIONS !== 'true' }, async t => {
    const fixture = await cliFixture(t);
    const failures = [
      ['wrong URL', { MANAGED_DEV_SUPABASE_URL: 'https://wrong-project.supabase.co' }],
      ...['MANAGED_DEV_SUPABASE_URL', 'MANAGED_DEV_SUPABASE_SERVICE_ROLE',
        'MANAGED_DEV_SUPABASE_ACCESS_TOKEN', 'MANAGED_DEV_SUPABASE_ANON_KEY']
        .map(key => [`missing ${key}`, { [key]: undefined }])
    ];
    for (const mode of ['cleanup', 'verify']) for (const [state, bytes] of fixture.evidence)
      for (const [failure, overrides] of failures) await t.test(`${mode}: ${state}: ${failure}`, () =>
        fixture.expectPreserved(mode, bytes, overrides, 'exact_managed_dev_credentials'));
  });

test('actual CLI second verify refuses exclusive identity creation without truncating prior backend evidence',
  { skip: process.env.GITHUB_ACTIONS !== 'true' }, async t => {
    const fixture = await cliFixture(t);
    for (const [state, bytes] of fixture.evidence) await t.test(state, () =>
      fixture.expectPreserved('verify', bytes, {}, 'fixture_identity_already_exists'));
  });

test('actual CLI appends sanitized wrapped SQL failures while retaining failed cleanup history',
  { skip: process.env.GITHUB_ACTIONS !== 'true' }, async t => {
    const fixture = await cliFixture(t, { error: { message:
      'Failed to run sql query: ERROR: 42601: syntax error at or near "PRIVATE_SQL"\nLINE 2: SECRET' } });
    await fixture.expectCleanupFailure();
  });
