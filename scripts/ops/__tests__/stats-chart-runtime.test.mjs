// Run on GitHub only: node --experimental-vm-modules --test <this file>
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { gzipSync, gunzipSync } from 'node:zlib';
import { packTar, unpackTar, unpackArtifactZip, hash } from '../stats-chart-archive.mjs';
import { buildBundle, sourceClosure, assertWorkerGuards } from '../package-stats-chart-runtime.mjs';
import { verifyBundle, validateProvenance, fetchPackage, narrowCredentials, workerEnv, checkSchema, checkDeployed, checkActivationDeployment,
  requireGuards, parseArgs, stagePackage, verifyInstalled, activate, rollbackCandidate, acquireInstallLock, resolvePointer, runChild, recordReceipt,
  installBudget, isCliEntry } from '../stats-chart-runtime.mjs';
import { ENTRYPOINT, RUNTIME_CONTRACT, OPS_FILES, SERVICE, TIMER, TARGET, REPOSITORY, WORKFLOW, DEADLINE_MS } from '../stats-chart-contract.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SHA = 'a'.repeat(40), OLD = 'b'.repeat(40), SECRET = 'DO-NOT-PRINT-THIS-PRIVATE-VALUE';
const contract = RUNTIME_CONTRACT;
function temporary(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stats-chart-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true })); return directory;
}
function source(t) {
  const root = temporary(t);
  for (const name of OPS_FILES) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true }); fs.copyFileSync(path.join(repo, name), path.join(root, name));
  }
  fs.mkdirSync(path.join(root, 'scripts/universes'), { recursive: true });
  fs.mkdirSync(path.join(root, 'scripts/shared'), { recursive: true });
  fs.writeFileSync(path.join(root, ENTRYPOINT), "import process from 'node:process';\nprocess.exit(78);\n");
  return root;
}
function identities(sha = SHA, runId = 123, artifactId = 456) {
  return { run: { id: runId, run_attempt: 1, head_sha: sha, head_branch: 'production', event: 'workflow_dispatch', path: WORKFLOW,
    status: 'completed', conclusion: 'success', repository: { full_name: REPOSITORY }, head_repository: { full_name: REPOSITORY } },
  artifact: { id: artifactId, name: `stats-chart-runtime-${sha}`, expired: false, digest: `sha256:${'0'.repeat(64)}`,
    workflow_run: { id: runId, head_sha: sha } } };
}
function bundle(t, sha = SHA, runId = 123) {
  const root = source(t), built = buildBundle(root, sha, String(runId), 1, contract);
  return { ...built, files: unpackTar(built.archive), provenance: identities(sha, runId) };
}
function identity(sha = SHA, runId = 123) { return { sha, runId: String(runId), runAttempt: 1 }; }
function runtimeRoot(t) {
  const root = temporary(t); fs.mkdirSync(path.join(root, 'releases')); fs.mkdirSync(path.join(root, 'state')); return root;
}
function mutateHeader(archive, mutation) {
  const tar = gunzipSync(archive); mutation(tar); tar.fill(32, 148, 156);
  const sum = tar.subarray(0, 512).reduce((total, byte) => total + byte, 0);
  tar.write(sum.toString(8).padStart(7, '0') + '\0', 148, 8, 'ascii'); return gzipSync(tar);
}
// Minimal stored ZIP fixture. Production parser must use central sizes and reject links/paths.
function zip(entries, mode = 0o100644) {
  let offset = 0; const locals = [], central = [];
  for (const [name, bytes] of Object.entries(entries)) {
    const filename = Buffer.from(name), local = Buffer.alloc(30), directory = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt32LE(bytes.length, 18);
    local.writeUInt32LE(bytes.length, 22); local.writeUInt16LE(filename.length, 26);
    directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(0x0314, 4); directory.writeUInt16LE(20, 6);
    directory.writeUInt32LE(bytes.length, 20); directory.writeUInt32LE(bytes.length, 24); directory.writeUInt16LE(filename.length, 28);
    directory.writeUInt32LE((mode * 65536) >>> 0, 38); directory.writeUInt32LE(offset, 42);
    locals.push(local, filename, bytes); central.push(directory, filename); offset += 30 + filename.length + bytes.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(Object.keys(entries).length, 8); end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

test('package is a complete dependency-free immutable worker bundle', t => {
  const root = source(t), built = buildBundle(root, SHA, '123', 1, contract);
  const files = verifyBundle(built.archive, built.manifest, built.auth, identity());
  assert.deepEqual([...files.keys()].sort(), Object.keys(built.manifest.files).sort());
  assert.ok(files.has(ENTRYPOINT));
  assert.ok([...files.keys()].every(name => !name.includes('node_modules') && !name.includes('article')));
  assertWorkerGuards(root, SHA, path.join(root, 'authorization-not-present.json'));
});

test('static import closure rejects missing sources, npm, dynamic imports and paths outside package', t => {
  const root = source(t), file = path.join(root, ENTRYPOINT);
  for (const code of ["import 'dotenv';", "import '../shared/not-shipped.mjs';", "import('./optional.mjs');", "import fs from 'node:not-real';"]) {
    fs.writeFileSync(file, code); assert.throws(() => sourceClosure(root));
  }
  fs.writeFileSync(file, "import '../shared/prepared-charts-data.mjs';");
  assert.throws(() => sourceClosure(root));
  fs.writeFileSync(path.join(root, 'scripts/shared/prepared-charts-data.mjs'), 'export const n = 1;');
  assert.ok(sourceClosure(root).includes('scripts/shared/prepared-charts-data.mjs'));
});

test('worker ignoring missing production flags fails CLI proof', t => {
  const root = source(t); fs.writeFileSync(path.join(root, ENTRYPOINT), 'process.exit(0);');
  assert.throws(() => assertWorkerGuards(root, SHA, 'unused'), /worker-cli-guard-proof-failed/);
});

test('tar rejects traversal, absolute paths, symlinks, hardlinks, duplicate entries and unchecked extension types', () => {
  const good = packTar({ 'scripts/test.mjs': Buffer.from('x') });
  for (const name of ['../../escape', '/absolute', 'scripts/../escape']) {
    assert.throws(() => unpackTar(mutateHeader(good, tar => { tar.fill(0, 0, 100); tar.write(name, 0); })), /unsafe-archive-path/);
  }
  for (const type of [49, 50, 53, 120, 76]) assert.throws(() => unpackTar(mutateHeader(good, tar => { tar[156] = type; })), /unsafe-tar-type/);
  const plain = gunzipSync(good);
  assert.throws(() => unpackTar(gzipSync(Buffer.concat([plain.subarray(0, 1024), plain]))), /duplicate-archive-path/);
  const corrupted = Buffer.from(plain); corrupted[0] ^= 1;
  assert.throws(() => unpackTar(gzipSync(corrupted)), /invalid-tar-checksum/);
  assert.throws(() => unpackTar(gzipSync(plain.subarray(0, 1024))), /invalid-tar-end/);
});

test('manifest, pin, authorization hashes and complete shipped file inventory fail closed', t => {
  const built = bundle(t);
  assert.throws(() => verifyBundle(built.archive, built.manifest, built.auth, identity(OLD)), /package-pin-mismatch/);
  assert.throws(() => verifyBundle(built.archive, { ...built.manifest, target: 'https://wrong.invalid' }, built.auth, identity()));
  assert.throws(() => verifyBundle(Buffer.concat([built.archive, Buffer.from('tamper')]), built.manifest, built.auth, identity()), /authorization-mismatch/);
  assert.throws(() => verifyBundle(built.archive, built.manifest, { ...built.auth, runId: '124' }, identity()), /authorization-mismatch/);
  const manifest = structuredClone(built.manifest); delete manifest.files[ENTRYPOINT];
  assert.throws(() => verifyBundle(built.archive, manifest, built.auth, identity()));
  const files = unpackTar(built.archive); files.set(ENTRYPOINT, Buffer.from('tampered'));
  const archive = packTar(Object.fromEntries(files));
  assert.throws(() => verifyBundle(archive, built.manifest, { ...built.auth, archiveHash: hash(archive) }, identity()), /payload-manifest-mismatch/);
});

test('trust requires exact repository, completed workflow_dispatch run, production SHA, attempt, artifact ID and digest', async t => {
  const { run, artifact } = identities();
  validateProvenance(run, artifact, SHA, '123', '456');
  for (const change of [{ head_sha: OLD }, { event: 'pull_request' }, { path: '.github/workflows/automation-runtime.yml' },
    { conclusion: 'failure' }, { status: 'in_progress' }, { head_repository: { full_name: 'attacker/fork' } }, { run_attempt: 0 }]) {
    assert.throws(() => validateProvenance({ ...run, ...change }, artifact, SHA, '123', '456'), /untrusted/);
  }
  for (const change of [{ id: 457 }, { expired: true }, { digest: null }, { workflow_run: { id: 124, head_sha: SHA } }]) {
    assert.throws(() => validateProvenance(run, { ...artifact, ...change }, SHA, '123', '456'), /untrusted/);
  }
  const built = bundle(t), bytes = zip({ 'runtime.tgz': built.archive, 'manifest.json': Buffer.from(JSON.stringify(built.manifest)),
    'release-authorization.json': Buffer.from(JSON.stringify(built.auth)) });
  const pinnedArtifact = { ...artifact, digest: `sha256:${hash(bytes)}` };
  const api = endpoint => endpoint.endsWith('/zip') ? bytes : endpoint.includes('/runs/') ? run : pinnedArtifact;
  assert.equal((await fetchPackage(SHA, '123', '456', api)).manifest.sha, SHA);
  await assert.rejects(fetchPackage(SHA, '123', '456', endpoint => endpoint.endsWith('/zip') ? Buffer.from('tamper') : api(endpoint)), /artifact-digest-mismatch/);
});

test('GitHub ZIP rejects path traversal and links before writing anything', () => {
  assert.throws(() => unpackArtifactZip(zip({ '../runtime.tgz': Buffer.from('x'), 'manifest.json': Buffer.from('{}'),
    'release-authorization.json': Buffer.from('{}') })), /unsafe-archive-path/);
  assert.throws(() => unpackArtifactZip(zip({ 'runtime.tgz': Buffer.from('x'), 'manifest.json': Buffer.from('{}'),
    'release-authorization.json': Buffer.from('{}') }, 0o120777)), /unsafe-artifact-zip/);
});

test('only approved CLI flags can produce an apply; expected pin and both production guards are mandatory', () => {
  const valid = parseArgs(['run', '--apply', '--allow-prod', '--expected-sha', SHA]);
  requireGuards(valid.options, SHA);
  for (const args of [['run'], ['run', '--apply'], ['run', '--apply', '--allow-prod', '--expected-sha', OLD]]) {
    assert.throws(() => requireGuards(parseArgs(args).options, SHA), /production-guards-required/);
  }
  for (const args of [['run', '--command', 'anything'], ['run', '--apply', '--apply'], ['run', '--expected-sha']]) assert.throws(() => parseArgs(args));
});

test('dotenv is parsed as data; broad overlays, inherited secrets, interpolation and credential-bearing errors never escape', () => {
  const parsed = narrowCredentials(`SUPABASE_URL='${TARGET}' # target\nexport SUPABASE_SERVICE_ROLE="${SECRET}"\nDB_PASSWORD=ignored\nNOTION_TOKEN=ignored\n`);
  assert.deepEqual(Object.keys(parsed).sort(), ['SUPABASE_SERVICE_ROLE', 'SUPABASE_URL']);
  const env = workerEnv(parsed, SHA, '/fixed/release-authorization.json');
  assert.equal(env.BLOXODES_ENV_PROFILE, 'process-only'); assert.equal(env.BLOXODES_ENV_OVERLAYS, '');
  assert.equal(env.HOME, undefined); assert.equal(env.DB_PASSWORD, undefined); assert.equal(env.NODE_OPTIONS, undefined);
  for (const text of [`SUPABASE_URL=${TARGET}\nSUPABASE_SERVICE_ROLE="${SECRET}\\nsecret"`,
    `SUPABASE_URL=https://attacker.invalid/${SECRET}\nSUPABASE_SERVICE_ROLE=x`,
    `SUPABASE_URL=${TARGET}\nSUPABASE_SERVICE_ROLE=x\nSUPABASE_SERVICE_ROLE=${SECRET}`]) {
    assert.throws(() => narrowCredentials(text), error => !error.message.includes(SECRET));
  }
  assert.throws(() => narrowCredentials(`SUPABASE_URL=${TARGET}\nSUPABASE_SERVICE_ROLE='\${TOKEN}'`));
});

test('schema allowlist/version and deployed SHA are independently checked; no mutable HEAD is used by installed runs', async () => {
  const credentials = { SUPABASE_URL: TARGET, SUPABASE_SERVICE_ROLE: SECRET };
  await checkSchema(credentials, contract, async (url, options) => {
    assert.equal(url, `${TARGET}/rest/v1/rpc/${contract.healthRpc}`); assert.equal(options.body, '{}');
    assert.equal(options.redirect, 'error'); assert.equal(options.headers.apikey, SECRET);
    return Response.json({ ok: true, ...contract });
  });
  for (const changed of [{ schemaVersion: 'other' }, { rpcAllowlist: ['arbitrary_sql'] }, { ok: false }]) {
    await assert.rejects(checkSchema(credentials, contract, async () => Response.json({ ok: true, target: TARGET, ...contract, ...changed })), /schema-contract-mismatch/);
  }
  await checkDeployed(SHA, async () => Response.json({ ok: true, scope: 'deploy', checks: { database: { ok: true } }, build: { sha: SHA } }));
  await assert.rejects(checkDeployed(SHA, async () => Response.json({ ok: true, scope: 'deploy', checks: { database: { ok: true } }, build: { sha: OLD } })), /deployed-sha-mismatch/);
});

test('promotion and SHA-aware reversal preserve previous verified package and every article file/unit', async t => {
  const root = runtimeRoot(t), units = temporary(t), commands = [];
  const article = path.join(units, 'bloxodes-article-discovery.timer'); fs.writeFileSync(article, 'existing article timer');
  const old = stagePackage(root, bundle(t, OLD, 122)), next = stagePackage(root, bundle(t));
  const control = args => { commands.push(args); return false; };
  await activate(root, old, OLD, units, control); await activate(root, next, SHA, units, control);
  assert.equal(resolvePointer(root, 'current'), next);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'state/previous.json'))).sha, OLD);
  // An intact old release fails the requested SHA at provenance, before its manifest.
  assert.throws(() => verifyInstalled(old, SHA), /^Error: untrusted-github-run$/);
  assert.throws(() => rollbackCandidate(root, OLD, OLD), /rollback-current-sha-mismatch/);
  assert.throws(() => rollbackCandidate(root, SHA, SHA), /rollback-target-mismatch/);
  await activate(root, rollbackCandidate(root, OLD, SHA), OLD, units, control);
  assert.equal(resolvePointer(root, 'current'), old);
  assert.equal(fs.readFileSync(article, 'utf8'), 'existing article timer');
  assert.ok(commands.flat().every(arg => !arg.includes('article')));
  assert.equal(fs.readFileSync(path.join(units, SERVICE), 'utf8').includes(OLD), true);
  fs.chmodSync(path.join(next, ENTRYPOINT), 0o644);
  fs.appendFileSync(path.join(next, ENTRYPOINT), 'tamper');
  assert.throws(() => verifyInstalled(next, SHA), /installed-file-tampered/);
});

test('failed activation restores pointer, chart units and prior timer state', async t => {
  const root = runtimeRoot(t), units = temporary(t), old = stagePackage(root, bundle(t, OLD, 122)), next = stagePackage(root, bundle(t));
  await activate(root, old, OLD, units, () => false);
  const before = fs.readFileSync(path.join(units, SERVICE));
  await assert.rejects(activate(root, next, SHA, units, args => {
    if (args[0] === 'enable' && args.includes('--now')) throw new Error('fixture systemd failure');
    return false;
  }), /chart-activation-failed/);
  assert.equal(resolvePointer(root, 'current'), old); assert.deepEqual(fs.readFileSync(path.join(units, SERVICE)), before);
});

test('shared flock excludes promotion while a chart invocation holds the lock', { timeout: 10_000 }, async t => {
  const root = runtimeRoot(t), lock = path.join(root, 'state/runtime.lock');
  const holder = spawn('/usr/bin/flock', ['--nonblock', lock, process.execPath, '-e', "process.stdout.write('ready');setTimeout(()=>{},30000)"], { detached: true, stdio: ['ignore', 'pipe', 'ignore'] });
  t.after(() => { try { process.kill(-holder.pid, 'SIGTERM'); } catch {} });
  await once(holder.stdout, 'data');
  const result = acquireInstallLock(['_install', '--apply', '--allow-prod', '--expected-sha', SHA], root);
  assert.equal(result.status, 75); assert.equal(fs.existsSync(path.join(root, 'current')), false);
  // Release child and parent; flock normally leaves the child alive if only its own PID is killed.
  holder.stdout.destroy(); try { process.kill(-holder.pid, 'SIGTERM'); } catch {}
});

test('installed manifest pin mismatch is rejected after matching GitHub provenance', t => {
  const root = runtimeRoot(t), directory = stagePackage(root, bundle(t));
  assert.equal(verifyInstalled(directory, SHA).manifest.sha, SHA);
  const file = path.join(directory, 'manifest.json'), manifest = JSON.parse(fs.readFileSync(file));
  fs.chmodSync(file, 0o644);
  fs.writeFileSync(file, JSON.stringify({ ...manifest, sha: OLD }));
  assert.throws(() => verifyInstalled(directory, SHA), /^Error: package-pin-mismatch$/);
});

test('deadline kills a started stuck worker and does not include private child output', { timeout: 10_000 }, async t => {
  const root = temporary(t), worker = path.join(root, 'hang.mjs'), ready = path.join(root, 'ready.json');
  fs.writeFileSync(worker, `
    import fs from 'node:fs';
    fs.writeSync(1, ${JSON.stringify(SECRET)});
    fs.writeSync(2, ${JSON.stringify(SECRET)});
    fs.writeFileSync(${JSON.stringify(ready)}, JSON.stringify({ pid: process.pid, node: process.versions.node }));
    setInterval(() => {}, 1000);
  `);
  const env = workerEnv({ SUPABASE_URL: TARGET, SUPABASE_SERVICE_ROLE: SECRET }, SHA, '/fixture/authorization.json');
  const args = ['--apply', '--allow-prod', '--expected-sha', SHA];
  let child;
  t.after(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} });
  const start = Date.now(), result = await runChild(worker, args, env, 1500, (binary, argv, options) => {
    assert.equal(binary, '/usr/bin/node');
    assert.deepEqual(argv, [worker, ...args]);
    assert.equal(options.cwd, root); assert.equal(options.env, env);
    assert.equal(options.detached, true); assert.equal(options.stdio, 'ignore');
    // setup-node's selected Node 22 need not exist at the production host path.
    assert.equal(process.versions.node.split('.')[0], '22');
    child = spawn(process.execPath, argv, options);
    assert.equal(child.stdout, null); assert.equal(child.stderr, null);
    return child;
  });
  const started = JSON.parse(fs.readFileSync(ready));
  assert.equal(started.pid, child.pid); assert.equal(started.node, process.versions.node);
  assert.equal(result.outcome, 'error'); assert.equal(result.code, 'deadline-exceeded');
  assert.equal(result.signal, 'SIGTERM'); assert.equal(result.exitStatus, null);
  assert.throws(() => process.kill(started.pid, 0), error => error.code === 'ESRCH');
  assert.ok(Date.now() - start >= 1000);
  assert.ok(Date.now() - start < 7000); assert.ok(!JSON.stringify(result).includes(SECRET));
  assert.ok(DEADLINE_MS < 240000);
  for (const timeout of [0, -1, NaN, Infinity, 300000]) {
    assert.throws(() => runChild(worker, [], {}, timeout, () => assert.fail('invalid deadline spawned a worker')), /invalid-worker-deadline/);
  }
});

test('worker spawn failure stays distinct from a deadline and suppresses private error text', { timeout: 10_000 }, async t => {
  const root = temporary(t), worker = path.join(root, 'unused.mjs');
  const result = await runChild(worker, [], {}, 1500, (binary, argv, options) => {
    assert.equal(binary, '/usr/bin/node'); assert.equal(options.stdio, 'ignore');
    return spawn(path.join(root, SECRET, 'missing-node'), argv, options);
  });
  assert.deepEqual(result, { outcome: 'error', code: 'worker-start-failed' });
  assert.ok(!JSON.stringify(result).includes(SECRET));
});

test('success, error and skipped receipts remain separate and retain attempts', t => {
  const root = runtimeRoot(t);
  for (const outcome of ['success', 'error', 'skipped']) recordReceipt(root, { sha: SHA, outcome, code: 'fixture', startedAt: new Date().toISOString() });
  for (const outcome of ['success', 'error', 'skipped']) assert.equal(JSON.parse(fs.readFileSync(path.join(root, `state/last-${outcome}.json`))).outcome, outcome);
  assert.equal(fs.readdirSync(path.join(root, 'state/runs')).length, 3);
});

test('an authorized package survives a later descendant web deploy while incompatible source fails', async () => {
  const health = async () => Response.json({ ok: true, scope: 'deploy', checks: { database: { ok: true } }, build: { sha: SHA } });
  const api = endpoint => {
    assert.ok(endpoint.endsWith(`/compare/${OLD}...${SHA}`));
    return { status: 'ahead', base_commit: { sha: OLD }, merge_base_commit: { sha: OLD } };
  };
  await checkActivationDeployment(OLD, api, health);
  await assert.rejects(checkActivationDeployment(OLD, () => ({ status: 'diverged', base_commit: { sha: OLD }, merge_base_commit: { sha: 'c'.repeat(40) } }), health), /deployed-source-incompatible/);
  await checkActivationDeployment(SHA, () => { throw new Error('same SHA must need no comparison'); }, health);
});

test('fixed units keep the overall deadline below cadence and expose no broad EnvironmentFile or command input', () => {
  const service = fs.readFileSync(path.join(repo, 'scripts/ops/systemd/user', SERVICE), 'utf8');
  const timer = fs.readFileSync(path.join(repo, 'scripts/ops/systemd/user', TIMER), 'utf8');
  const start = Number(service.match(/^TimeoutStartSec=(\d+)s$/m)?.[1]);
  const stop = Number(service.match(/^TimeoutStopSec=(\d+)s$/m)?.[1]);
  assert.ok(start + stop < 300 && start > DEADLINE_MS / 1000);
  assert.ok(service.includes('KillMode=control-group') && service.includes('MemoryMax=256M') && service.includes('CPUQuota=50%'));
  assert.ok(!service.includes('EnvironmentFile=') && !service.includes('STATS_WORKER_COMMAND'));
  assert.ok(timer.includes('OnCalendar=*-*-* *:0/5:20') && timer.includes('Persistent=true'));
});

test('operational helper static imports must also be completely shipped', t => {
  const root = source(t);
  fs.appendFileSync(path.join(root, 'scripts/ops/stats-chart-runtime.mjs'), "\nimport './unshipped-helper.mjs';\n");
  assert.throws(() => buildBundle(root, SHA, '123', 1, contract), /unshipped-runtime-import/);
});

test('private RPC transport and response errors cannot expose env values and response reads are bounded', async () => {
  const credentials = { SUPABASE_URL: TARGET, SUPABASE_SERVICE_ROLE: SECRET };
  for (const request of [async () => { throw new Error(SECRET); },
    async () => Response.json({ message: SECRET }, { status: 401 }),
    async () => new Response(SECRET), async () => new Response('x'.repeat(65537))]) {
    await assert.rejects(checkSchema(credentials, contract, request), error =>
      /^contract-health-[a-z-]+$/.test(error.message) && !error.message.includes(SECRET));
  }
});

function snapshots(root, units) {
  return new Map([path.join(units, SERVICE), path.join(units, TIMER),
    path.join(root, 'state/previous.json'), path.join(root, 'state/activation.json')].map(file =>
    [file, fs.existsSync(file) ? fs.readFileSync(file) : null]));
}
function assertSnapshots(before) {
  for (const [file, bytes] of before) {
    if (bytes === null) assert.equal(fs.existsSync(file), false, file);
    else assert.deepEqual(fs.readFileSync(file), bytes, file);
  }
}
function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    function abort() { clearTimeout(timer); reject(new Error('fixture control cancelled')); }
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
  });
}

test('activation refuses mutation after slow preflight consumes its remaining reserve', async t => {
  const root = runtimeRoot(t), units = temporary(t);
  const old = stagePackage(root, bundle(t, OLD, 122)), next = stagePackage(root, bundle(t));
  await activate(root, old, OLD, units, () => false);
  const before = snapshots(root, units), calls = []; let now = 0;
  const budget = installBudget({ totalMs: 1000, controlMs: 100, recoveryMs: 350, finalizeMs: 50, now: () => now });
  // Network/schema preflight and timer reads all spend the very same work budget.
  await budget.perform(async () => { now += 300; }, 300);
  await assert.rejects(activate(root, next, SHA, units, args => {
    calls.push(args); now += 60; return false;
  }, budget), /chart-install-recovery-reserve/);
  assert.equal(resolvePointer(root, 'current'), old); assertSnapshots(before);
  assert.deepEqual(calls, [['is-enabled', TIMER], ['is-active', TIMER]]);
  assert.equal(fs.existsSync(path.join(root, 'state/activation-pending.json')), false);
  now = 651;
  await assert.rejects(budget.perform(() => assert.fail('expired preflight was started'), 100), /chart-install-deadline/);
});

for (const enabled of [false, true]) for (const active of [false, true]) {
  test(`delayed activation failure restores exact bytes/state and timer enabled=${enabled}, active=${active}`, async t => {
    const root = runtimeRoot(t), units = temporary(t);
    const old = stagePackage(root, bundle(t, OLD, 122)), next = stagePackage(root, bundle(t));
    await activate(root, old, OLD, units, () => false);
    // Preserve byte identity, including noncanonical whitespace in retained state.
    fs.writeFileSync(path.join(root, 'state/previous.json'), '{ "retained": true }\n');
    const before = snapshots(root, units), calls = [];
    let timerEnabled = enabled, timerActive = active;
    const control = async (args, { signal, timeoutMs }) => {
      calls.push(args); assert.ok(timeoutMs > 0 && timeoutMs <= 80);
      if (args[0] === 'is-enabled') return timerEnabled;
      if (args[0] === 'is-active') return timerActive;
      const pending = JSON.parse(fs.readFileSync(path.join(root, 'state/activation-pending.json')));
      assert.equal(pending.status, 'needs-reconciliation');
      assert.equal(pending.units[SERVICE], before.get(path.join(units, SERVICE)).toString('base64'));
      if (args.includes('--now')) {
        timerEnabled = true; timerActive = true; // Simulate partial systemctl application.
        await delay(20, signal); throw new Error(SECRET);
      }
      await delay(10, signal);
      if (args[0] === 'enable' || args[0] === 'disable') timerEnabled = args[0] === 'enable';
      if (args[0] === 'start' || args[0] === 'stop') timerActive = args[0] === 'start';
    };
    const budget = installBudget({ totalMs: 2000, controlMs: 80, recoveryMs: 300, finalizeMs: 60 });
    await assert.rejects(activate(root, next, SHA, units, control, budget), /chart-activation-failed/);
    assert.equal(resolvePointer(root, 'current'), old); assertSnapshots(before);
    assert.equal(timerEnabled, enabled); assert.equal(timerActive, active);
    assert.deepEqual(calls.slice(-3), [['daemon-reload'], [enabled ? 'enable' : 'disable', TIMER], [active ? 'start' : 'stop', TIMER]]);
    const failure = fs.readFileSync(path.join(root, 'state/activation-failure.json'), 'utf8');
    assert.ok(!failure.includes(SECRET));
    assert.equal(JSON.parse(failure).needsReconciliation, false);
    assert.equal(JSON.parse(failure).restoredFiles, true); assert.equal(JSON.parse(failure).restoredSystemd, true);
    assert.equal(fs.existsSync(path.join(root, 'state/activation-pending.json')), false);
  });
}

test('bounded hanging activation control still attempts every restore when one restore fails', async t => {
  const root = runtimeRoot(t), units = temporary(t);
  const old = stagePackage(root, bundle(t, OLD, 122)), next = stagePackage(root, bundle(t));
  await activate(root, old, OLD, units, () => false);
  fs.writeFileSync(path.join(root, 'state/previous.json'), '{"keep":"old bytes"}\n');
  const before = snapshots(root, units), calls = []; let recovering = false;
  const budget = installBudget({ totalMs: 1500, controlMs: 80, recoveryMs: 300, finalizeMs: 60 });
  await assert.rejects(activate(root, next, SHA, units, async (args, { signal }) => {
    calls.push(args);
    if (args[0].startsWith('is-')) return false;
    if (args.includes('--now')) { recovering = true; await delay(1000, signal); assert.fail('control exceeded deadline'); }
    if (recovering && args[0] === 'daemon-reload') { await delay(10, signal); throw new Error('restore reload failed'); }
    await delay(10, signal);
  }, budget), /chart-activation-failed/);
  assert.equal(resolvePointer(root, 'current'), old); assertSnapshots(before);
  assert.deepEqual(calls.slice(-3), [['daemon-reload'], ['disable', TIMER], ['stop', TIMER]]);
  const failure = JSON.parse(fs.readFileSync(path.join(root, 'state/activation-failure.json')));
  assert.equal(failure.restoredFiles, true); assert.equal(failure.restoredSystemd, false);
  assert.equal(failure.needsReconciliation, true);
  assert.deepEqual(failure.restorationAttempts.map(attempt => attempt.ok), [false, true, true]);
  const pending = JSON.parse(fs.readFileSync(path.join(root, 'state/activation-pending.json')));
  assert.equal(pending.status, 'needs-reconciliation');
  assert.equal(pending.state['previous.json'], before.get(path.join(root, 'state/previous.json')).toString('base64'));
  await assert.rejects(activate(root, next, SHA, units, () => assert.fail('pending activation must block controls')), /chart-activation-needs-reconciliation/);
});

test('elapsed overall work deadline during mutation spends the reserved recovery budget', async t => {
  const root = runtimeRoot(t), units = temporary(t);
  const old = stagePackage(root, bundle(t, OLD, 122)), next = stagePackage(root, bundle(t));
  await activate(root, old, OLD, units, () => false);
  const before = snapshots(root, units), calls = []; let now = 0, recovering = false;
  const budget = installBudget({ totalMs: 1000, controlMs: 100, recoveryMs: 350, finalizeMs: 50, now: () => now });
  await budget.perform(async () => { now = 200; }, 300);
  await assert.rejects(activate(root, next, SHA, units, async args => {
    calls.push(args);
    if (args[0].startsWith('is-')) { now += 25; return false; }
    if (args.includes('--now')) {
      // Model resuming after a scheduler stall at the normal-work cutoff.
      recovering = true; now = 651; return;
    }
    now += recovering ? 80 : 25;
  }, budget), /chart-activation-failed/);
  assert.equal(resolvePointer(root, 'current'), old); assertSnapshots(before);
  assert.deepEqual(calls.slice(-3), [['daemon-reload'], ['disable', TIMER], ['stop', TIMER]]);
  assert.ok(now < 950, 'recovery must leave the final receipt reserve');
  const failure = JSON.parse(fs.readFileSync(path.join(root, 'state/activation-failure.json')));
  assert.equal(failure.cause, 'chart-install-deadline'); assert.equal(failure.needsReconciliation, false);
  assert.equal(failure.restoredFiles, true); assert.equal(failure.restoredSystemd, true);
});

// Runs unchanged runtime JS from an actually built and staged package via current.
// Only fixture contract paths and process boundaries are substituted. No host/HTTP
// operations are permitted, and the fixture worker deliberately exits 78.
async function stagedCli(t) {
  const root = runtimeRoot(t), units = temporary(t), fixture = source(t);
  const credentials = path.join(root, 'credentials.env');
  fs.writeFileSync(credentials, `SUPABASE_URL=${TARGET}\nSUPABASE_SERVICE_ROLE=${SECRET}\n`, { mode: 0o600 });
  const contractFile = path.join(fixture, 'scripts/ops/stats-chart-contract.mjs');
  fs.writeFileSync(contractFile, fs.readFileSync(contractFile, 'utf8')
    .replace("'/srv/data/bloxodes-stats-chart-runtime'", JSON.stringify(root))
    .replace("'/srv/data/projects/Bloxodes/.envs/targets/production.env'", JSON.stringify(credentials)));
  const releases = [];
  for (const [sha, runId] of [[OLD, 122], [SHA, 123]]) {
    const built = buildBundle(fixture, sha, String(runId), 1, contract);
    const directory = stagePackage(root, { ...built, files: unpackTar(built.archive), provenance: identities(sha, runId) });
    await activate(root, directory, sha, units, () => false); releases.push(directory);
  }
  const log = path.join(root, 'controls.jsonl'), settings = path.join(root, 'controls.json');
  fs.writeFileSync(settings, '{}');
  const controlProgram = path.join(root, 'fixture-systemctl.mjs');
  fs.writeFileSync(controlProgram, `
    import fs from 'node:fs';
    const args = process.argv.slice(2);
    fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(args) + '\\n');
    const settings = JSON.parse(fs.readFileSync(${JSON.stringify(settings)}));
    if (settings.hang && args.includes('--now')) setInterval(() => {}, 1000);
    else process.exit(args[0] === 'is-enabled' ? 1 : args[0] === 'is-active' ? 3 : 0);
  `);
  const preload = path.join(root, 'fixture-boundaries.mjs');
  fs.writeFileSync(preload, `
    import fs from 'node:fs'; import os from 'node:os'; import child from 'node:child_process';
    import http from 'node:http'; import https from 'node:https'; import net from 'node:net';
    import tls from 'node:tls'; import dgram from 'node:dgram'; import { syncBuiltinESMExports } from 'node:module';
    const userInfo = os.userInfo; os.userInfo = (...args) => ({ ...userInfo(...args), username: 'teja' });
    const map = value => typeof value === 'string' && value.startsWith('/home/teja/.config/systemd/user')
      ? ${JSON.stringify(units)} + value.slice('/home/teja/.config/systemd/user'.length) : value;
    for (const name of ['mkdirSync','existsSync','lstatSync','readFileSync','openSync','unlinkSync','rmSync']) {
      const original = fs[name]; fs[name] = (file, ...args) => original(map(file), ...args);
    }
    const rename = fs.renameSync; fs.renameSync = (from, to) => rename(map(from), map(to));
    const deny = () => { throw new Error('fixture-network-denied'); };
    globalThis.fetch = async (url, options) => {
      if (url !== ${JSON.stringify(`${TARGET}/rest/v1/rpc/${contract.healthRpc}`)} || options.method !== 'POST') return deny();
      return Response.json({ ok: true, ...${JSON.stringify(contract)} });
    };
    http.request = http.get = https.request = https.get = deny;
    net.connect = net.createConnection = net.Socket.prototype.connect = tls.connect = dgram.createSocket = deny;
    const spawn = child.spawn, spawnSync = child.spawnSync;
    child.spawn = (binary, args, options) => {
      if (binary === '/usr/bin/systemctl') {
        return spawn(process.execPath, [${JSON.stringify(controlProgram)}, ...args.slice(1)], options);
      }
      if (binary !== '/usr/bin/node') return deny();
      return spawn(process.execPath, args, options);
    };
    child.spawnSync = (binary, args, options) => {
      if (binary !== '/usr/bin/timeout') return deny();
      return spawnSync(binary, args.map(value => value === '/usr/bin/node' ? process.execPath : value), { ...options, env: { ...options.env,
        NODE_OPTIONS: ${JSON.stringify(`--import=${pathToFileURL(preload).href}`)} } });
    };
    child.exec = child.execSync = child.execFile = child.execFileSync = child.fork = deny;
    syncBuiltinESMExports();
  `);
  const entry = path.join(root, 'current/scripts/ops/stats-chart-runtime.mjs');
  function start(args, env = {}, script = entry) {
    const child = spawn(process.execPath, ['--import', preload, script, ...args], {
      detached: true, env: { HOME: '/home/teja', PATH: '/usr/bin:/bin', BLOXODES_STATS_CHART_LOCKED: '1',
        BLOXODES_STATS_CHART_INSTALL_DEADLINE: String(Date.now() + 260_000), ...env }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    t.after(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} });
    const stdout = [], stderr = [];
    child.stdout.on('data', chunk => stdout.push(chunk)); child.stderr.on('data', chunk => stderr.push(chunk));
    const result = once(child, 'close').then(([status, signal]) => ({ status, signal,
      stdout: Buffer.concat(stdout).toString(), stderr: Buffer.concat(stderr).toString() }));
    return { child, result };
  }
  return { root, units, entry, old: releases[0], next: releases[1], start, settings, log };
}
async function awaitMutation(fixture) {
  for (let attempt = 0; attempt < 250; attempt++) {
    if (fs.existsSync(fixture.log) && fs.readFileSync(fixture.log, 'utf8').includes('--now')) return;
    await delay(20);
  }
  assert.fail('staged CLI did not reach activation control in 5 seconds');
}

test('staged CLI through current executes run, skip, finalizer and full locked rollback; invalid CLI fails and import is safe', { timeout: 20_000 }, async t => {
  const fixture = await stagedCli(t), { root, entry, start, old } = fixture;
  assert.equal(isCliEntry(entry, fs.realpathSync(entry)), true);
  assert.equal(isCliEntry(path.join(root, 'missing'), entry), false);
  const invalid = await start(['invalid-command']).result;
  assert.equal(invalid.status, 1); assert.match(invalid.stderr, /unknown-runtime-command/);
  const skipped = await start(['record-skip', '--expected-sha', SHA]).result;
  assert.equal(skipped.status, 0);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'state/last-skipped.json'))).code, 'local-lock-held');
  const run = await start(['run', '--apply', '--allow-prod', '--expected-sha', SHA]).result;
  assert.equal(run.status, 1); // The deliberately negative fixture worker, not a production success claim.
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'state/last-error.json'))).code, 'worker-failed');
  fs.writeFileSync(path.join(root, 'state/active.json'), '{}');
  const finalized = await start(['finalize', '--expected-sha', SHA], { SERVICE_RESULT: 'timeout' }).result;
  assert.equal(finalized.status, 0); assert.equal(fs.existsSync(path.join(root, 'state/active.json')), false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'state/last-error.json'))).code, 'service-abnormal-exit');
  const runner = path.join(root, 'import-only.mjs');
  fs.writeFileSync(runner, `await import(${JSON.stringify(pathToFileURL(entry).href)});console.log('safe-import');`);
  const imported = await start([], {}, runner).result;
  assert.equal(imported.status, 0); assert.equal(imported.stdout.trim(), 'safe-import');
  const rollback = await start(['rollback', '--apply', '--allow-prod', '--expected-sha', OLD, '--from-sha', SHA]).result;
  assert.equal(rollback.status, 0, rollback.stderr); assert.match(rollback.stdout, /"outcome":"activated"/);
  assert.equal(resolvePointer(root, 'current'), old);
  assert.equal(fs.existsSync(path.join(root, 'state/activation-pending.json')), false);
});

test('TERM during real staged rollback mutation runs recovery and retains a failure receipt', { timeout: 15_000 }, async t => {
  const fixture = await stagedCli(t), before = snapshots(fixture.root, fixture.units);
  fs.writeFileSync(fixture.settings, '{"hang":true}');
  const invocation = fixture.start(['_rollback', '--apply', '--allow-prod', '--expected-sha', OLD, '--from-sha', SHA]);
  await awaitMutation(fixture); invocation.child.kill('SIGTERM');
  const result = await invocation.result;
  assert.equal(result.status, 1, result.stderr); assert.match(result.stderr, /chart-activation-failed/);
  assert.equal(resolvePointer(fixture.root, 'current'), fixture.next); assertSnapshots(before);
  const calls = fs.readFileSync(fixture.log, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(calls.slice(-3), [['daemon-reload'], ['disable', TIMER], ['stop', TIMER]]);
  const failure = JSON.parse(fs.readFileSync(path.join(fixture.root, 'state/activation-failure.json')));
  assert.equal(failure.restoredSystemd, true); assert.equal(failure.restoredFiles, true);
  assert.equal(failure.needsReconciliation, false);
});

test('KILL during staged mutation leaves durable recovery snapshot and blocks new activation and runs', { timeout: 15_000 }, async t => {
  const fixture = await stagedCli(t), before = snapshots(fixture.root, fixture.units);
  fs.writeFileSync(fixture.settings, '{"hang":true}');
  const invocation = fixture.start(['_rollback', '--apply', '--allow-prod', '--expected-sha', OLD, '--from-sha', SHA]);
  await awaitMutation(fixture); process.kill(-invocation.child.pid, 'SIGKILL');
  const result = await invocation.result; assert.equal(result.signal, 'SIGKILL');
  const pending = JSON.parse(fs.readFileSync(path.join(fixture.root, 'state/activation-pending.json')));
  assert.equal(pending.status, 'needs-reconciliation'); assert.equal(pending.oldRelease, path.basename(fixture.next));
  for (const [file, bytes] of before) {
    const group = file.startsWith(fixture.units + path.sep) ? pending.units : pending.state;
    assert.equal(group[path.basename(file)], bytes === null ? null : bytes.toString('base64'));
  }
  assert.deepEqual(fs.readFileSync(path.join(fixture.root, 'state/activation.json')), before.get(path.join(fixture.root, 'state/activation.json')));
  const retry = await fixture.start(['_rollback', '--apply', '--allow-prod', '--expected-sha', OLD, '--from-sha', SHA]).result;
  assert.equal(retry.status, 1); assert.match(retry.stderr, /chart-activation-needs-reconciliation/);
  const run = await fixture.start(['run', '--apply', '--allow-prod', '--expected-sha', OLD]).result;
  assert.equal(run.status, 1);
  assert.equal(JSON.parse(fs.readFileSync(path.join(fixture.root, 'state/last-error.json'))).code, 'chart-activation-needs-reconciliation');
  assert.equal(fs.existsSync(path.join(fixture.root, 'state/activation-pending.json')), true);
});

test('a worker making network calls before rejecting guards fails the cold proof', t => {
  const root = source(t); fs.writeFileSync(path.join(root, ENTRYPOINT), "fetch('https://invalid.example');process.exit(78);");
  assert.throws(() => assertWorkerGuards(root, SHA, 'unused'), /worker-cli-guard-proof-failed/);
});
