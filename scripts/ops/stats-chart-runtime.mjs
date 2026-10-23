import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { hash, safePath, unpackTar, unpackArtifactZip } from './stats-chart-archive.mjs';
import { ROOT, ENV_SOURCE, TARGET, REPOSITORY, WORKFLOW, SERVICE, TIMER, ENTRYPOINT, RUNTIME_CONTRACT,
  OPS_FILES, DEADLINE_MS, MAX_BYTES, RuntimeFault, demand, validSha, canonical, validateContract, allowedPayload } from './stats-chart-contract.mjs';

const SELF = fileURLToPath(import.meta.url);
const INSTALL_MS = 260_000, CONTROL_MS = 20_000, RECOVERY_MS = 65_000, FINALIZE_MS = 5_000;
const json = bytes => JSON.parse(bytes.toString('utf8'));
const readJson = file => json(fs.readFileSync(file));
export function atomicJson(file, value) {
  atomicBytes(file, JSON.stringify(value) + '\n');
}
function atomicBytes(file, bytes) {
  const temp = `${file}.${randomUUID()}.tmp`;
  const descriptor = fs.openSync(temp, 'wx', 0o600);
  try { fs.writeFileSync(descriptor, bytes); fs.fsyncSync(descriptor); }
  finally { fs.closeSync(descriptor); }
  fs.renameSync(temp, file);
  syncDirectory(path.dirname(file));
}
function syncDirectory(location) {
  const directory = fs.openSync(location, 'r');
  try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
}

// The inner deadline ends before timeout(270s). Normal work cannot spend recovery's
// three bounded systemctl attempts plus time to persist the result.
export function installBudget({ totalMs = INSTALL_MS, controlMs = CONTROL_MS, recoveryMs = RECOVERY_MS,
  finalizeMs = FINALIZE_MS, now = () => performance.now(), signal } = {}) {
  demand([totalMs, controlMs, recoveryMs, finalizeMs].every(value => Number.isFinite(value) && value > 0) &&
    totalMs <= INSTALL_MS && controlMs <= CONTROL_MS && recoveryMs >= 3 * controlMs + finalizeMs &&
    totalMs > recoveryMs + 2 * controlMs + finalizeMs, 'invalid-install-budget');
  const deadline = now() + totalMs;
  const remaining = recovery => deadline - now() - (recovery ? finalizeMs : recoveryMs);
  function check() {
    demand(!signal?.aborted, 'chart-install-cancelled');
    demand(remaining(false) > 0, 'chart-install-deadline');
  }
  return {
    check,
    beforeMutation() { check(); demand(remaining(false) >= 2 * controlMs + finalizeMs, 'chart-install-recovery-reserve'); },
    async perform(operation, limitMs, recovery = false) {
      if (!recovery) check();
      const timeoutMs = Math.floor(Math.min(limitMs, remaining(recovery)));
      demand(timeoutMs > 0, 'chart-install-deadline');
      const timer = new AbortController();
      const timeout = setTimeout(() => timer.abort(), timeoutMs);
      const operationSignal = !recovery && signal ? AbortSignal.any([signal, timer.signal]) : timer.signal;
      try {
        const value = await operation({ timeoutMs, signal: operationSignal });
        demand(!operationSignal.aborted, signal?.aborted && !recovery ? 'chart-install-cancelled' : 'chart-install-deadline');
        if (!recovery) check();
        return value;
      } catch (error) {
        if (operationSignal.aborted) demand(false, signal?.aborted && !recovery ? 'chart-install-cancelled' : 'chart-install-deadline');
        throw error;
      } finally { clearTimeout(timeout); }
    },
    controlMs,
  };
}
export function parseArgs(args) {
  const [command, ...rest] = args; const options = {};
  for (let index = 0; index < rest.length; index++) {
    const key = rest[index];
    demand(['--apply', '--allow-prod', '--expected-sha', '--run-id', '--artifact-id', '--from-sha'].includes(key) &&
      !(key in options), 'invalid-cli-arguments');
    options[key] = ['--apply', '--allow-prod'].includes(key) ? true : rest[++index];
    demand(options[key] !== undefined, 'missing-cli-value');
  }
  return { command, options };
}
export function requireGuards(options, sha) {
  demand(validSha(sha) && options['--expected-sha'] === sha && options['--apply'] === true && options['--allow-prod'] === true,
    'production-guards-required');
}
export function validateProvenance(run, artifact, sha, runId, artifactId) {
  demand(validSha(sha) && String(run.id) === String(runId) && run.head_sha === sha && run.head_branch === 'production' &&
    run.event === 'workflow_dispatch' && run.path === WORKFLOW && run.status === 'completed' && run.conclusion === 'success' &&
    run.repository?.full_name === REPOSITORY && run.head_repository?.full_name === REPOSITORY,
  'untrusted-github-run');
  demand(String(artifact.id) === String(artifactId) && artifact.name === `stats-chart-runtime-${sha}` &&
    artifact.expired === false && artifact.workflow_run?.id === run.id && artifact.workflow_run?.head_sha === sha &&
    /^sha256:[a-f0-9]{64}$/.test(artifact.digest ?? ''), 'untrusted-github-artifact');
  demand(Number.isSafeInteger(run.run_attempt) && run.run_attempt > 0, 'untrusted-run-attempt');
}
export function verifyBundle(archive, manifest, auth, identity) {
  demand(manifest.format === 1 && manifest.sha === identity.sha && validSha(manifest.sha) && manifest.nodeMajor === 22 &&
    manifest.platform === 'linux' && manifest.arch === 'x64' && manifest.entrypoint === ENTRYPOINT && manifest.target === TARGET,
  'package-pin-mismatch');
  const contract = validateContract(manifest.contract);
  demand(canonical(contract) === canonical(manifest.contract) && canonical(contract) === canonical(RUNTIME_CONTRACT), 'invalid-package-contract');
  demand(auth.format === 1 && auth.repository === REPOSITORY && auth.workflow === WORKFLOW &&
    auth.sourceSha === identity.sha && String(auth.runId) === String(identity.runId) && auth.runAttempt === identity.runAttempt &&
    auth.archiveHash === hash(archive) && auth.manifestHash === hash(Buffer.from(canonical(manifest))) &&
    auth.target === TARGET && auth.entrypoint === ENTRYPOINT && auth.mode === 'recurring-prepared-charts' &&
    auth.deployedSha === identity.sha && Number.isFinite(Date.parse(auth.deploymentVerifiedAt)) &&
    canonical(auth.contract) === canonical(contract), 'authorization-mismatch');
  const files = unpackTar(archive);
  demand(manifest.files && typeof manifest.files === 'object' && !Array.isArray(manifest.files) &&
    Object.keys(manifest.files).length === files.size && files.size <= 64 &&
    [...OPS_FILES, ENTRYPOINT].every(name => files.has(name)), 'incomplete-package-manifest');
  for (const [name, bytes] of files) {
    demand(allowedPayload(name) && manifest.files[name]?.sha256 === hash(bytes) &&
      manifest.files[name]?.size === bytes.length, 'payload-manifest-mismatch');
  }
  return files;
}
// This parser never executes shell syntax or interpolates variables. Unrelated keys are ignored.
// Only single-line dotenv values are supported for these two HTTP credentials.
export function narrowCredentials(text) {
  demand(Buffer.byteLength(text) <= 128 * 1024 && !text.includes('\0'), 'invalid-credential-file');
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?(SUPABASE_URL|SUPABASE_SERVICE_ROLE)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, raw] = match;
    demand(!(key in values), 'duplicate-credential-key');
    let value;
    if (raw.startsWith('"') || raw.startsWith("'")) {
      const quote = raw[0]; let end = 1;
      while (end < raw.length && (raw[end] !== quote || (quote === '"' && raw[end - 1] === '\\'))) end++;
      demand(end < raw.length && /^\s*(?:#.*)?$/.test(raw.slice(end + 1)), 'invalid-credential-value');
      value = raw.slice(1, end);
      if (quote === '"') value = value.replace(/\\([\\"nrt])/g, (_, escape) => ({'\\':'\\', '"':'"', n:'\n', r:'\r', t:'\t'})[escape]);
    } else value = raw.replace(/\s+#.*$/, '').trim();
    demand(value.length > 0 && value.length <= 8192 && !/[\r\n\0]/.test(value) && !value.includes('${'), 'invalid-credential-value');
    values[key] = value;
  }
  demand(values.SUPABASE_URL?.replace(/\/$/, '') === TARGET && values.SUPABASE_SERVICE_ROLE &&
    /^[A-Za-z0-9._~-]+$/.test(values.SUPABASE_SERVICE_ROLE), 'credential-target-mismatch');
  return { SUPABASE_URL: TARGET, SUPABASE_SERVICE_ROLE: values.SUPABASE_SERVICE_ROLE };
}
export function loadCredentials(source = ENV_SOURCE) {
  // Source .envs links stay untouched; resolve/read the homelab-owned file in place.
  const stat = fs.statSync(source);
  demand(stat.isFile() && stat.uid === process.getuid() && (stat.mode & 0o077) === 0 && stat.size <= 128 * 1024,
    'unsafe-credential-permissions');
  return narrowCredentials(fs.readFileSync(source, 'utf8'));
}
export function workerEnv(credentials, sha, authorization) {
  return { ...credentials, PATH: '/usr/bin:/bin', NODE_ENV: 'production', BLOXODES_ENV_PROFILE: 'process-only',
    BLOXODES_ENV_OVERLAYS: '', STATS_WORKER_ID: 'homelab-stats-chart', BLOXODES_STATS_CHART_SHA: sha,
    BLOXODES_STATS_CHART_AUTHORIZATION: authorization };
}
async function boundedJson(response) {
  demand(response.ok && response.body, 'contract-health-http-failed');
  const chunks = []; let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length; demand(length <= 65536, 'contract-health-too-large'); chunks.push(chunk);
  }
  return json(Buffer.concat(chunks));
}
export async function checkSchema(credentials, contract, request = fetch, signal) {
  try {
    demand(credentials.SUPABASE_URL === TARGET, 'credential-target-mismatch');
    const response = await request(`${TARGET}/rest/v1/rpc/${contract.healthRpc}`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(10_000), ...(signal ? [signal] : [])]),
      headers: { apikey: credentials.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${credentials.SUPABASE_SERVICE_ROLE}`,
        'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: '{}',
    });
    const health = await boundedJson(response);
    // The same RPC exists in managed development. It must never claim to be production.
    // Target identity is checked locally against credentials and the authorization.
    demand(health.ok === true && health.schemaVersion === contract.schemaVersion &&
      Array.isArray(health.rpcAllowlist) &&
      canonical([...health.rpcAllowlist].sort()) === canonical(contract.rpcAllowlist), 'schema-contract-mismatch');
  } catch (error) {
    if (error instanceof RuntimeFault) throw error;
    demand(false, 'contract-health-request-failed');
  }
}
export async function checkDeployed(sha, request = fetch) {
  const deployed = await deployedSha(request);
  demand(deployed === sha, 'deployed-sha-mismatch');
}
async function deployedSha(request, signal) {
  try {
    const health = await boundedJson(await request('https://bloxodes.com/api/health?scope=deploy', {
      redirect: 'error', cache: 'no-store', signal: AbortSignal.any([AbortSignal.timeout(15_000), ...(signal ? [signal] : [])]),
    }));
    demand(health.ok === true && health.scope === 'deploy' && health.checks?.database?.ok === true && validSha(health.build?.sha),
      'deployment-health-failed');
    return health.build.sha;
  } catch (error) {
    if (error instanceof RuntimeFault) throw error;
    demand(false, 'deployment-health-request-failed');
  }
}
export async function checkActivationDeployment(sha, api = gh, request = fetch, signal) {
  const live = await deployedSha(request, signal);
  if (live === sha) return;
  // A package may be installed after another production commit deploys. Its original
  // trusted authorization proves S was deployed; current schema must still match.
  const comparison = await api(`repos/${REPOSITORY}/compare/${sha}...${live}`);
  demand(comparison.status === 'ahead' && comparison.base_commit?.sha === sha &&
    comparison.merge_base_commit?.sha === sha, 'deployed-source-incompatible');
}
// Await close after cancellation, so no control process can race restoration.
function commandResult(binary, args, env, { timeoutMs, signal }, code, capture = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { env, stdio: ['ignore', capture ? 'pipe' : 'ignore', 'ignore'] });
    const chunks = []; let size = 0, failed = false;
    const stop = () => { failed = true; child.kill('SIGKILL'); };
    const timer = setTimeout(stop, timeoutMs);
    signal?.addEventListener('abort', stop, { once: true });
    if (signal?.aborted) stop();
    child.stdout?.on('data', chunk => { size += chunk.length; if (size > MAX_BYTES) stop(); else chunks.push(chunk); });
    child.once('error', () => { failed = true; });
    child.once('close', status => {
      clearTimeout(timer); signal?.removeEventListener('abort', stop);
      if (failed) reject(new RuntimeFault(code));
      else resolve({ status, stdout: Buffer.concat(chunks) });
    });
  });
}
async function gh(endpoint, binary = false, options = { timeoutMs: 30_000 }) {
  const result = await commandResult('/usr/bin/gh', ['api', endpoint],
    { HOME: '/home/teja', PATH: '/usr/bin:/bin', GH_HOST: 'github.com' }, options, 'github-api-failed', true);
  demand(result.status === 0, 'github-api-failed');
  return binary ? result.stdout : json(result.stdout);
}
export async function fetchPackage(sha, runId, artifactId, api = gh) {
  demand(validSha(sha) && /^[1-9][0-9]{0,17}$/.test(runId ?? '') && /^[1-9][0-9]{0,17}$/.test(artifactId ?? ''), 'invalid-release-identifiers');
  const base = `repos/${REPOSITORY}`;
  const run = await api(`${base}/actions/runs/${runId}`);
  const artifact = await api(`${base}/actions/artifacts/${artifactId}`);
  validateProvenance(run, artifact, sha, runId, artifactId);
  const zip = await api(`${base}/actions/artifacts/${artifactId}/zip`, true);
  demand(`sha256:${hash(zip)}` === artifact.digest, 'artifact-digest-mismatch');
  const entries = unpackArtifactZip(zip);
  const archive = entries.get('runtime.tgz'), manifest = json(entries.get('manifest.json')),
    auth = json(entries.get('release-authorization.json'));
  const files = verifyBundle(archive, manifest, auth, { sha, runId, runAttempt: run.run_attempt });
  return { archive, manifest, auth, files, provenance: { run, artifact, verifiedAt: new Date().toISOString() } };
}
function collectFiles(directory, prefix = '') {
  const names = [];
  for (const entry of fs.readdirSync(path.join(directory, prefix), { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    demand(!entry.isSymbolicLink(), 'installed-package-link');
    if (entry.isDirectory()) names.push(...collectFiles(directory, name));
    else { demand(entry.isFile(), 'installed-package-type'); names.push(name); }
    demand(names.length <= 70, 'installed-package-too-large');
  }
  return names.sort();
}
export function verifyInstalled(directory, sha) {
  const manifest = readJson(path.join(directory, 'manifest.json')), auth = readJson(path.join(directory, 'release-authorization.json'));
  const provenance = readJson(path.join(directory, 'provenance.json'));
  validateProvenance(provenance.run, provenance.artifact, sha, auth.runId, provenance.artifact.id);
  const files = verifyBundle(fs.readFileSync(path.join(directory, 'runtime.tgz')), manifest, auth,
    { sha, runId: auth.runId, runAttempt: provenance.run.run_attempt });
  const expected = [...files.keys(), 'manifest.json', 'release-authorization.json', 'provenance.json', 'runtime.tgz'].sort();
  demand(canonical(collectFiles(directory)) === canonical(expected), 'unexpected-installed-file');
  for (const [name, bytes] of files) demand(hash(fs.readFileSync(path.join(directory, name))) === hash(bytes), 'installed-file-tampered');
  return { manifest, auth, provenance };
}
function runtimeIdentity() {
  demand(process.platform === 'linux' && process.arch === 'x64' && process.versions.node.split('.')[0] === '22' &&
    os.userInfo().username === 'teja' && process.env.HOME === '/home/teja', 'unsupported-runtime-host');
}
export function resolvePointer(root, pointer) {
  const location = path.join(root, pointer);
  demand(fs.lstatSync(location).isSymbolicLink(), 'runtime-pointer-not-link');
  const directory = fs.realpathSync(location);
  demand(path.dirname(directory) === path.join(root, 'releases') &&
    /^[a-f0-9]{40}-[1-9][0-9]*-[1-9][0-9]*$/.test(path.basename(directory)), 'unsafe-runtime-pointer');
  return directory;
}
export function promotePointer(root, release) {
  demand(path.dirname(release) === path.join(root, 'releases'), 'unsafe-promotion-path');
  const temp = path.join(root, `.current-${randomUUID()}`);
  fs.symlinkSync(path.relative(root, release), temp); fs.renameSync(temp, path.join(root, 'current'));
  syncDirectory(root);
}
export function recordReceipt(root, receipt) {
  const directory = path.join(root, 'state', 'runs'); fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const record = { ...receipt, finishedAt: new Date().toISOString() };
  const name = `${Date.now()}-${randomUUID()}.json`;
  atomicJson(path.join(directory, name), record); atomicJson(path.join(root, 'state', 'latest.json'), record);
  atomicJson(path.join(root, 'state', `last-${receipt.outcome}.json`), record);
  // Keep at most 10,000 attempts and 30 days. This includes skipped/failed attempts.
  const retained = fs.readdirSync(directory).filter(value => /^[0-9]+-[a-f0-9-]+\.json$/.test(value)).sort();
  const cutoff = Date.now() - 30 * 86400_000;
  for (let index = 0; index < retained.length; index++) {
    if (index < retained.length - 10_000 || Number(retained[index].split('-')[0]) < cutoff) fs.unlinkSync(path.join(directory, retained[index]));
  }
  console.log(JSON.stringify(record)); // Contains codes, timestamps, SHA and exit status only.
}
export function runChild(entrypoint, args, env, timeoutMs = DEADLINE_MS) {
  demand(timeoutMs > 0 && timeoutMs <= DEADLINE_MS, 'invalid-worker-deadline');
  return new Promise(resolve => {
    const child = spawn('/usr/bin/node', [entrypoint, ...args], { cwd: path.dirname(entrypoint), env,
      detached: true, stdio: 'ignore' }); // Never echo credential-bearing worker errors.
    let expired = false, kill;
    const signalGroup = signal => { try { process.kill(-child.pid, signal); } catch {} };
    const stop = () => { expired = true; signalGroup('SIGTERM'); kill = setTimeout(() => signalGroup('SIGKILL'), 5000); };
    const timer = setTimeout(stop, timeoutMs);
    const cancel = () => stop(); process.once('SIGTERM', cancel); process.once('SIGINT', cancel);
    child.once('error', () => { clearTimeout(timer); clearTimeout(kill); process.removeListener('SIGTERM', cancel);
      process.removeListener('SIGINT', cancel); resolve({ outcome: 'error', code: 'worker-start-failed' }); });
    child.once('exit', (status, signal) => {
      clearTimeout(timer); clearTimeout(kill); process.removeListener('SIGTERM', cancel); process.removeListener('SIGINT', cancel);
      // Reap descendants as well: the worker contract must not leave background processes.
      signalGroup('SIGKILL');
      resolve({ outcome: !expired && status === 0 ? 'success' : 'error',
        code: expired ? 'deadline-exceeded' : status === 0 ? 'completed' : 'worker-failed', exitStatus: status, signal });
    });
  });
}
async function invoke(options) {
  const start = Date.now(), startedAt = new Date(start).toISOString(), sha = options['--expected-sha'];
  requireGuards(options, sha);
  atomicJson(path.join(ROOT, 'state/active.json'), { sha, startedAt });
  try {
    demand(!fs.existsSync(path.join(ROOT, 'state/activation-pending.json')), 'chart-activation-needs-reconciliation');
    const directory = resolvePointer(ROOT, 'current');
    demand(fs.realpathSync(SELF) === path.join(directory, 'scripts/ops/stats-chart-runtime.mjs'), 'running-package-pointer-mismatch');
    const { manifest } = verifyInstalled(directory, sha);
    const credentials = loadCredentials(); await checkSchema(credentials, manifest.contract);
    const result = await runChild(path.join(directory, ENTRYPOINT), ['--apply', '--allow-prod', '--expected-sha', sha],
      workerEnv(credentials, sha, path.join(directory, 'release-authorization.json')), DEADLINE_MS - (Date.now() - start));
    recordReceipt(ROOT, { sha, startedAt, durationMs: Date.now() - start, ...result });
    fs.unlinkSync(path.join(ROOT, 'state/active.json'));
    return result.outcome === 'success' ? 0 : 1;
  } catch (error) {
    recordReceipt(ROOT, { sha, startedAt, durationMs: Date.now() - start, outcome: 'error',
      code: error instanceof RuntimeFault ? error.message : 'runtime-validation-failed' });
    fs.rmSync(path.join(ROOT, 'state/active.json'), { force: true });
    return 1;
  }
}
async function systemctl(args, options) {
  const result = await commandResult('/usr/bin/systemctl', ['--user', ...args],
    { HOME: '/home/teja', PATH: '/usr/bin:/bin', XDG_RUNTIME_DIR: `/run/user/${process.getuid()}` },
    options, 'chart-systemctl-failed');
  if (['is-enabled', 'is-active'].includes(args[0])) {
    demand([0, 1, 3, 4].includes(result.status), 'chart-systemctl-failed');
    return result.status === 0;
  }
  demand(result.status === 0, 'chart-systemctl-failed');
}
function releaseDirectory(root, sha, auth) { return path.join(root, 'releases', `${sha}-${auth.runId}-${auth.runAttempt}`); }
export function stagePackage(root, bundle) {
  const final = releaseDirectory(root, bundle.manifest.sha, bundle.auth);
  if (fs.existsSync(final)) { verifyInstalled(final, bundle.manifest.sha); return final; }
  const candidate = path.join(root, 'releases', `.staging-${randomUUID()}`);
  fs.mkdirSync(candidate, { mode: 0o700 });
  try {
    for (const [name, bytes] of bundle.files) {
      safePath(name); fs.mkdirSync(path.dirname(path.join(candidate, name)), { recursive: true, mode: 0o755 });
      fs.writeFileSync(path.join(candidate, name), bytes, { flag: 'wx', mode: name.endsWith('.sh') ? 0o555 : 0o444 });
    }
    for (const [name, value] of [['manifest.json', bundle.manifest], ['release-authorization.json', bundle.auth], ['provenance.json', bundle.provenance]]) {
      fs.writeFileSync(path.join(candidate, name), JSON.stringify(value) + '\n', { flag: 'wx', mode: 0o444 });
    }
    fs.writeFileSync(path.join(candidate, 'runtime.tgz'), bundle.archive, { flag: 'wx', mode: 0o444 });
    verifyInstalled(candidate, bundle.manifest.sha);
    fs.renameSync(candidate, final); return final;
  } finally { if (fs.existsSync(candidate)) fs.rmSync(candidate, { recursive: true }); }
}
// Only these two unit names are writable; no unit name or command is supplied by the caller.
export async function activate(root, candidate, sha, unitDirectory, control = systemctl, budget = installBudget()) {
  const pendingFile = path.join(root, 'state/activation-pending.json');
  demand(!fs.existsSync(pendingFile), 'chart-activation-needs-reconciliation');
  budget.check();
  verifyInstalled(candidate, sha);
  const old = fs.existsSync(path.join(root, 'current')) ? resolvePointer(root, 'current') : null;
  if (old) verifyInstalled(old, readJson(path.join(old, 'manifest.json')).sha);
  const call = (args, recovery = false) => budget.perform(options => control(args, options), budget.controlMs, recovery);
  const oldEnabled = await call(['is-enabled', TIMER]), oldActive = await call(['is-active', TIMER]);
  const stateBackups = new Map(['previous.json', 'activation.json'].map(name => {
    const file = path.join(root, 'state', name);
    return [file, fs.existsSync(file) ? fs.readFileSync(file) : null];
  }));
  const backups = new Map();
  for (const name of [SERVICE, TIMER]) {
    const file = path.join(unitDirectory, name);
    demand(!fs.existsSync(file) || fs.lstatSync(file).isFile(), 'unsafe-existing-chart-unit');
    backups.set(name, fs.existsSync(file) ? fs.readFileSync(file) : null);
  }
  budget.beforeMutation();
  const encoded = entries => Object.fromEntries([...entries].map(([name, bytes]) => [path.basename(name), bytes === null ? null : bytes.toString('base64')]));
  const pending = { sha, release: path.basename(candidate), oldRelease: old ? path.basename(old) : null,
    status: 'needs-reconciliation', startedAt: new Date().toISOString(), oldEnabled, oldActive,
    units: encoded(backups), state: encoded(stateBackups), restorationAttempts: [] };
  // Persist and fsync the full restoration snapshot BEFORE changing units/pointer.
  // SIGKILL/power loss cannot turn an interrupted activation into apparent success.
  atomicJson(pendingFile, pending);
  try {
    budget.beforeMutation();
    fs.mkdirSync(unitDirectory, { recursive: true, mode: 0o700 });
    for (const name of [SERVICE, TIMER]) {
      budget.check();
      const bytes = fs.readFileSync(path.join(candidate, 'scripts/ops/systemd/user', name), 'utf8');
      const rendered = bytes.replaceAll('@SHA@', sha);
      demand(!rendered.includes('@SHA@'), 'unrendered-chart-unit');
      atomicBytes(path.join(unitDirectory, name), rendered);
    }
    budget.check();
    promotePointer(root, candidate); await call(['daemon-reload']); await call(['enable', '--now', TIMER]);
    budget.check();
    if (old && old !== candidate) atomicJson(path.join(root, 'state/previous.json'), { sha: readJson(path.join(old, 'manifest.json')).sha, release: path.basename(old) });
    atomicJson(path.join(root, 'state/activation.json'), { sha, release: path.basename(candidate), previous: old ? path.basename(old) : null,
      activatedAt: new Date().toISOString() });
    budget.check();
    // Last commit step: all activation bytes are durable before clearing the guard.
    fs.unlinkSync(pendingFile);
  } catch (error) {
    let restoredFiles = true;
    const restore = operation => { try { operation(); } catch { restoredFiles = false; } };
    restore(() => {
      if (old) promotePointer(root, old); else fs.rmSync(path.join(root, 'current'), { force: true });
    });
    for (const [name, bytes] of backups) {
      const file = path.join(unitDirectory, name);
      restore(() => { if (bytes !== null) atomicBytes(file, bytes); else fs.rmSync(file, { force: true }); });
    }
    for (const [file, bytes] of stateBackups) {
      restore(() => { if (bytes !== null) atomicBytes(file, bytes); else fs.rmSync(file, { force: true }); });
    }
    // Also persist removals when the prior installation had no pointer/unit/state.
    for (const directory of [root, unitDirectory, path.join(root, 'state')]) restore(() => syncDirectory(directory));
    let restoredSystemd = true;
    for (const args of [['daemon-reload'], [oldEnabled ? 'enable' : 'disable', TIMER], [oldActive ? 'start' : 'stop', TIMER]]) {
      let ok = false;
      try { await call(args, true); ok = true; } catch { restoredSystemd = false; }
      pending.restorationAttempts.push({ args, ok });
      try { atomicJson(pendingFile, { ...pending, restoredFiles, restoredSystemd }); } catch {}
    }
    try {
      atomicJson(path.join(root, 'state/activation-failure.json'), { sha, code: 'chart-activation-failed',
        cause: error instanceof RuntimeFault ? error.message : 'chart-control-or-filesystem-failed', restoredFiles, restoredSystemd,
        needsReconciliation: !restoredFiles || !restoredSystemd, restorationAttempts: pending.restorationAttempts,
        failedAt: new Date().toISOString() });
      if (restoredFiles && restoredSystemd) fs.unlinkSync(pendingFile);
    } catch {} // The already-durable pending snapshot remains the fallback receipt.
    demand(false, 'chart-activation-failed');
  }
}
export function rollbackCandidate(root, sha, fromSha) {
  demand(validSha(fromSha) && validSha(sha), 'rollback-from-sha-required');
  const current = resolvePointer(root, 'current');
  demand(readJson(path.join(current, 'manifest.json')).sha === fromSha, 'rollback-current-sha-mismatch');
  const previous = readJson(path.join(root, 'state/previous.json'));
  demand(previous.sha === sha && /^[a-f0-9]{40}-[1-9][0-9]*-[1-9][0-9]*$/.test(previous.release), 'rollback-target-mismatch');
  const candidate = path.join(root, 'releases', previous.release);
  verifyInstalled(candidate, sha);
  return candidate;
}
async function install(options, rollback = false) {
  const sha = options['--expected-sha']; requireGuards(options, sha);
  demand(!fs.existsSync(path.join(ROOT, 'state/activation-pending.json')), 'chart-activation-needs-reconciliation');
  const cancelled = new AbortController();
  const cancel = () => cancelled.abort();
  process.on('SIGTERM', cancel); process.on('SIGINT', cancel);
  try {
    const remaining = Number(process.env.BLOXODES_STATS_CHART_INSTALL_DEADLINE) - Date.now();
    demand(Number.isFinite(remaining) && remaining > RECOVERY_MS + 2 * CONTROL_MS + FINALIZE_MS, 'chart-install-deadline');
    const budget = installBudget({ totalMs: Math.min(INSTALL_MS, remaining), signal: cancelled.signal });
    const api = (endpoint, binary) => budget.perform(bounds => gh(endpoint, binary, bounds), 30_000);
    const schema = contract => budget.perform(({ signal }) => checkSchema(loadCredentials(), contract, fetch, signal), 10_000);
    let candidate;
    if (rollback) {
      candidate = rollbackCandidate(ROOT, sha, options['--from-sha']);
    } else {
      const bundle = await fetchPackage(sha, options['--run-id'], options['--artifact-id'], api);
      // Descendant comparison uses the same overall budget as deployment health.
      await budget.perform(({ signal }) => checkActivationDeployment(sha, api, fetch, signal), 45_000);
      await schema(bundle.manifest.contract);
      budget.check(); candidate = stagePackage(ROOT, bundle);
    }
    const { manifest } = verifyInstalled(candidate, sha);
    await schema(manifest.contract); // Rollback also requires current compatibility.
    await activate(ROOT, candidate, sha, '/home/teja/.config/systemd/user', systemctl, budget);
    console.log(JSON.stringify({ outcome: 'activated', sha, release: path.basename(candidate) }));
  } finally {
    process.removeListener('SIGTERM', cancel); process.removeListener('SIGINT', cancel);
  }
}
export function acquireInstallLock(args, root = ROOT) {
  return spawnSync('/usr/bin/timeout', ['--signal=TERM', '--kill-after=5s', '270s',
    '/usr/bin/flock', '--nonblock', '--conflict-exit-code', '75', path.join(root, 'state/runtime.lock'),
    '/usr/bin/node', SELF, ...args], {
    env: { HOME: '/home/teja', PATH: '/usr/bin:/bin', BLOXODES_STATS_CHART_LOCKED: '1',
      BLOXODES_STATS_CHART_INSTALL_DEADLINE: String(Date.now() + INSTALL_MS) },
    stdio: 'inherit', timeout: 280_000,
  });
}
function secureRoot() {
  fs.mkdirSync(ROOT, { recursive: true, mode: 0o700 });
  for (const directory of [ROOT, path.join(ROOT, 'state'), path.join(ROOT, 'releases')]) {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const stat = fs.lstatSync(directory);
    demand(stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === process.getuid() && !(stat.mode & 0o022), 'unsafe-runtime-directory');
  }
}
async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  runtimeIdentity();
  demand(['inspect', 'install', 'rollback', 'run', 'record-skip', 'finalize', '_install', '_rollback'].includes(command), 'unknown-runtime-command');
  if (command === 'inspect') {
    const bundle = await fetchPackage(options['--expected-sha'], options['--run-id'], options['--artifact-id']);
    console.log(JSON.stringify({ sha: bundle.manifest.sha, archiveHash: bundle.auth.archiveHash, contract: bundle.manifest.contract,
      root: ROOT, units: [SERVICE, TIMER], credentialSource: ENV_SOURCE, files: Object.keys(bundle.manifest.files) }, null, 2));
    return;
  }
  if (command === 'finalize') {
    demand(validSha(options['--expected-sha']), 'invalid-finalizer-sha');
    // systemd supplies SERVICE_RESULT. Do not include arbitrary process environment in receipts.
    if (process.env.SERVICE_RESULT !== 'success') {
      recordReceipt(ROOT, { sha: options['--expected-sha'], outcome: 'error', code: 'service-abnormal-exit',
        serviceResult: ['timeout', 'signal', 'core-dump', 'oom-kill', 'resources', 'exit-code', 'start-limit-hit'].includes(process.env.SERVICE_RESULT)
          ? process.env.SERVICE_RESULT : 'unknown', startedAt: new Date().toISOString() });
      fs.rmSync(path.join(ROOT, 'state/active.json'), { force: true });
    }
    return;
  }
  if (command === 'record-skip') {
    demand(validSha(options['--expected-sha']), 'invalid-skip-sha');
    recordReceipt(ROOT, { sha: options['--expected-sha'], outcome: 'skipped', code: 'local-lock-held', startedAt: new Date().toISOString() }); return;
  }
  requireGuards(options, options['--expected-sha']);
  if (command === 'install' || command === 'rollback') {
    secureRoot();
    const result = acquireInstallLock([`_${command}`, ...process.argv.slice(3)]);
    demand(result.status === 0 && !result.error, result.status === 75 ? 'chart-runtime-busy' : 'chart-install-failed'); return;
  }
  demand(process.env.BLOXODES_STATS_CHART_LOCKED === '1', 'chart-lock-required');
  if (command === 'run') process.exitCode = await invoke(options);
  else await install(options, command === '_rollback');
}
export function isCliEntry(argument = process.argv[1], moduleFile = SELF) {
  if (!argument) return false;
  try {
    const entry = fs.statSync(argument), module = fs.statSync(moduleFile);
    return entry.dev === module.dev && entry.ino === module.ino;
  } catch { return false; }
}
if (isCliEntry()) {
  main().catch(error => { console.error(error instanceof RuntimeFault ? error.message : 'stats-chart-runtime-failed'); process.exitCode = 1; });
}
