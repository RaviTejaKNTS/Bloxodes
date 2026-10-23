import assert from 'node:assert/strict';
import test from 'node:test';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TARGET, MIGRATION, CASES, PAGES, fixtureIdentity, validateIdentity, cleanupRecovery, oracleDefinition,
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

// GitHub-only subprocess regressions use the unchanged CLI, real Git guards, real
// filesystem writes and finalization. The throwaway checkout has no remote and
// receives only synthetic credentials. Never use the real receipt directory.
async function cliFixture(t) {
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
globalThis.fetch = deny;
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
  return { evidence, expectPreserved };
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
