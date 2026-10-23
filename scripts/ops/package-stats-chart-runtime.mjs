import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SourceTextModule } from 'node:vm';
import { builtinModules } from 'node:module';
import { spawnSync } from 'node:child_process';
import { packTar, unpackTar, hash } from './stats-chart-archive.mjs';
import { checkDeployed, checkSchema } from './stats-chart-runtime.mjs';
import { ENTRYPOINT, RUNTIME_CONTRACT, WORKER_TEST, OPS_FILES, REPOSITORY, WORKFLOW, TARGET,
  demand, validSha, canonical, validateContract, allowedPayload } from './stats-chart-contract.mjs';

// Parse without evaluating: all static source imports must be packaged or Node builtins.
// Dynamic import/require/code generation in worker sources are deliberately unsupported.
export function sourceClosure(root, entrypoint = ENTRYPOINT) {
  const found = new Set();
  function visit(name) {
    if (found.has(name)) return;
    demand(allowedPayload(name) && fs.lstatSync(path.join(root, name)).isFile(), 'unsupported-worker-source');
    found.add(name);
    const source = fs.readFileSync(path.join(root, name), 'utf8');
    demand(!/\b(?:import\s*\(|require\s*\(|createRequire\b|eval\s*\(|new\s+Function\b)/.test(source), 'unsupported-dynamic-worker-import');
    const parsed = new SourceTextModule(source, { identifier: name });
    for (const specifier of parsed.dependencySpecifiers) {
      if (specifier.startsWith('node:')) {
        demand(builtinModules.includes(specifier.slice(5)), 'unknown-node-builtin'); continue;
      }
      demand(specifier.startsWith('./') || specifier.startsWith('../'), 'external-worker-dependency');
      demand(!/[?#\\]/.test(specifier), 'unsupported-worker-import');
      visit(path.posix.normalize(path.posix.join(path.posix.dirname(name), specifier)));
    }
  }
  visit(entrypoint);
  return [...found].sort();
}
export function assertWorkerGuards(root, sha, authorizationFile) {
  const other = sha === 'a'.repeat(40) ? 'b'.repeat(40) : 'a'.repeat(40);
  const probes = [[], ['--apply'], ['--apply', '--allow-prod'],
    ['--apply', '--allow-prod', '--expected-sha', other]];
  const probeDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'stats-chart-guard-'));
  const preload = path.join(probeDirectory, 'deny-network.mjs');
  fs.writeFileSync(preload, `
    import http from 'node:http'; import https from 'node:https';
    import net from 'node:net'; import tls from 'node:tls'; import dgram from 'node:dgram';
    import child from 'node:child_process'; import { syncBuiltinESMExports } from 'node:module';
    const deny = () => process.exit(79);
    globalThis.fetch = deny;
    http.request = http.get = https.request = https.get = deny;
    net.connect = net.createConnection = net.Socket.prototype.connect = tls.connect = dgram.createSocket = deny;
    child.spawn = child.spawnSync = child.exec = child.execSync = child.execFile = child.execFileSync = child.fork = deny;
    syncBuiltinESMExports();
  `, { mode: 0o600 });
  try {
    for (const args of probes) {
      const result = spawnSync(process.execPath, ['--import', preload, path.join(root, ENTRYPOINT), ...args], {
        cwd: root, timeout: 5000, maxBuffer: 65536,
        env: { PATH: '/usr/bin:/bin', NODE_ENV: 'production', BLOXODES_ENV_PROFILE: 'process-only',
          BLOXODES_ENV_OVERLAYS: '', SUPABASE_URL: TARGET, SUPABASE_SERVICE_ROLE: 'CI-NOT-A-SECRET',
          BLOXODES_STATS_CHART_SHA: sha, BLOXODES_STATS_CHART_AUTHORIZATION: authorizationFile },
      });
      // EX_CONFIG contract: reject production CLI guards before any network access.
      demand(!result.error && result.status === 78, 'worker-cli-guard-proof-failed');
    }
  } finally {
    fs.rmSync(probeDirectory, { recursive: true, force: true });
  }
}
export function buildBundle(root, sha, runId, runAttempt, contract) {
  demand(validSha(sha) && /^[1-9][0-9]*$/.test(String(runId)) && Number.isSafeInteger(runAttempt) && runAttempt > 0,
    'invalid-build-identity');
  const closure = sourceClosure(root);
  const files = Object.fromEntries([...new Set([...OPS_FILES, ...closure])].sort().map(name => {
    demand(fs.lstatSync(path.join(root, name)).isFile(), 'package-source-not-regular');
    return [name, fs.readFileSync(path.join(root, name))];
  }));
  for (const [name, bytes] of Object.entries(files)) {
    if (!name.endsWith('.mjs')) continue;
    for (const specifier of new SourceTextModule(bytes.toString('utf8'), { identifier: name }).dependencySpecifiers) {
      if (specifier.startsWith('node:')) {
        demand(builtinModules.includes(specifier.slice(5)), 'unknown-node-builtin'); continue;
      }
      demand((specifier.startsWith('./') || specifier.startsWith('../')) &&
        Object.hasOwn(files, path.posix.normalize(path.posix.join(path.posix.dirname(name), specifier))), 'unshipped-runtime-import');
    }
  }
  const manifest = { format: 1, sha, nodeMajor: 22, platform: 'linux', arch: 'x64', target: TARGET,
    entrypoint: ENTRYPOINT, contract: validateContract(contract),
    files: Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, { size: bytes.length, sha256: hash(bytes) }])) };
  const archive = packTar(files);
  const auth = { format: 1, repository: REPOSITORY, workflow: WORKFLOW, sourceSha: sha,
    runId: String(runId), runAttempt, target: TARGET, entrypoint: ENTRYPOINT, mode: 'recurring-prepared-charts',
    archiveHash: hash(archive), manifestHash: hash(Buffer.from(canonical(manifest))), contract: manifest.contract,
    deployedSha: sha, deploymentVerifiedAt: new Date().toISOString() };
  return { archive, manifest, auth };
}
async function main() {
  const args = process.argv.slice(2);
  demand(args.length === 4 && args[0] === '--sha' && args[2] === '--out', 'invalid-package-cli');
  const sha = args[1], out = path.resolve(args[3]), root = process.cwd();
  demand(process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_EVENT_NAME === 'workflow_dispatch' &&
    process.env.GITHUB_REPOSITORY === REPOSITORY && process.env.GITHUB_SHA === sha &&
    process.env.GITHUB_REF === 'refs/heads/production' &&
    process.env.GITHUB_WORKFLOW_REF === `${REPOSITORY}/${WORKFLOW}@refs/heads/production` &&
    process.versions.node.split('.')[0] === '22' && process.platform === 'linux' && process.arch === 'x64',
  'trusted-production-action-required');
  demand(fs.existsSync(path.join(root, WORKER_TEST)), 'worker-integration-tests-missing');
  const bundle = buildBundle(root, sha, process.env.GITHUB_RUN_ID, Number(process.env.GITHUB_RUN_ATTEMPT), RUNTIME_CONTRACT);
  fs.mkdirSync(out, { recursive: true, mode: 0o700 });
  const authFile = path.join(out, 'release-authorization.json');
  fs.writeFileSync(authFile, JSON.stringify(bundle.auth) + '\n', { mode: 0o600 });
  try {
    const cold = fs.mkdtempSync(path.join(path.dirname(out), 'stats-chart-cold-'));
    try {
      for (const [name, bytes] of unpackTar(bundle.archive)) {
        const target = path.join(cold, name);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, bytes);
      }
      assertWorkerGuards(cold, sha, authFile);
    } finally { fs.rmSync(cold, { recursive: true, force: true }); }
    const credentials = { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE };
    demand(credentials.SUPABASE_URL?.replace(/\/$/, '') === TARGET && credentials.SUPABASE_SERVICE_ROLE, 'ci-production-target-required');
    credentials.SUPABASE_URL = TARGET;
    await checkDeployed(sha); await checkSchema(credentials, bundle.manifest.contract);
    bundle.auth.deploymentVerifiedAt = new Date().toISOString();
    fs.writeFileSync(authFile, JSON.stringify(bundle.auth) + '\n', { mode: 0o600 });
    fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(bundle.manifest) + '\n', { mode: 0o600 });
    fs.writeFileSync(path.join(out, 'runtime.tgz'), bundle.archive, { mode: 0o600 });
    console.log(JSON.stringify({ sha, archiveHash: bundle.auth.archiveHash, files: Object.keys(bundle.manifest.files) }));
  } catch (error) { fs.rmSync(out, { recursive: true, force: true }); throw error; }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('stats-chart-package-failed (worker, tests, deployment and schema contracts are mandatory)'); process.exitCode = 1; });
}
