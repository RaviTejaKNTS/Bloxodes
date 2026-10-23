import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { preparedChartsRuntimeContract as contract, PREPARED_LIMITS as limits } from './prepared-charts-contract.mjs';

const TARGET = 'https://database.bloxodes.com';
const REPOSITORY = 'RaviTejaKNTS/Bloxodes';
const WORKFLOW = '.github/workflows/stats-chart-runtime.yml';
const ENTRYPOINT = 'scripts/universes/refresh-prepared-charts.mjs';
const demand = (condition, code) => { if (!condition) throw new Error(code); };
const canonical = value => JSON.stringify(value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, JSON.parse(canonical(value[key]))]))
  : Array.isArray(value) ? value.map(item => JSON.parse(canonical(item))) : value);

export function parseWorkerArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    demand(['--apply', '--allow-prod', '--expected-sha'].includes(key) && !(key in result), 'invalid-worker-arguments');
    result[key] = key === '--expected-sha' ? args[++i] : true;
    demand(result[key] !== undefined, 'missing-worker-argument');
  }
  return result;
}
export function validateWorkerAuthorization(args, env, auth) {
  const sha = args['--expected-sha'];
  demand(args['--apply'] === true && /^[a-f0-9]{40}$/.test(sha ?? '') && sha === env.BLOXODES_STATS_CHART_SHA,
    'worker-sha-guards-required');
  const url = env.SUPABASE_URL;
  demand(typeof url === 'string' && url.replace(/\/$/, '') === TARGET && args['--allow-prod'] === true,
    'worker-production-guards-required');
  demand(typeof env.SUPABASE_SERVICE_ROLE === 'string' && /^[A-Za-z0-9._~-]+$/.test(env.SUPABASE_SERVICE_ROLE),
    'worker-credentials-required');
  demand(env.BLOXODES_ENV_PROFILE === 'process-only' && !env.BLOXODES_ENV_OVERLAYS, 'worker-process-env-required');
  demand(auth?.format === 1 && auth.repository === REPOSITORY && auth.workflow === WORKFLOW &&
    auth.sourceSha === sha && auth.target === url.replace(/\/$/, '') && auth.entrypoint === ENTRYPOINT &&
    auth.mode === 'recurring-prepared-charts' && /^\d+$/.test(String(auth.runId)) &&
    Number.isSafeInteger(auth.runAttempt) && auth.runAttempt > 0 &&
    /^[a-f0-9]{64}$/.test(auth.archiveHash ?? '') && /^[a-f0-9]{64}$/.test(auth.manifestHash ?? '') &&
    canonical(auth.contract) === canonical({ ...contract, rpcAllowlist: [...contract.rpcAllowlist].sort() }),
  'worker-authorization-mismatch');
  return { url: TARGET, key: env.SUPABASE_SERVICE_ROLE, sha, authorizationId: String(auth.runId) };
}
export async function loadWorkerAuthorization(file) {
  demand(typeof file === 'string' && file.length > 0, 'worker-authorization-required');
  let bytes;
  try { bytes = await readFile(file); } catch { throw new Error('worker-authorization-unreadable'); }
  demand(bytes.length <= 65536, 'worker-authorization-too-large');
  try { return JSON.parse(bytes.toString('utf8')); } catch { throw new Error('worker-authorization-invalid'); }
}

export class PreparedRpcError extends Error {
  constructor(code, { ambiguous = false } = {}) { super(code); this.ambiguous = ambiguous; }
}
export function createPreparedRpc(credentials, { request = fetch, signal } = {}) {
  return async function rpc(name, payload, { mutation = false, timeoutMs } = {}) {
    demand(contract.rpcAllowlist.includes(name), 'rpc-not-allowlisted');
    // SQL is capped at 6s before execution by PostgREST; HTTP allows pool/transport
    // overhead. A client abort alone never proves the server transaction stopped.
    const cap = name === 'run_stats_prepared_step_v1' ? limits.stepMs : limits.controlMs;
    const allotted = Math.floor(Math.min(timeoutMs ?? cap, cap));
    demand(Number.isFinite(allotted) && allotted > 0, 'invocation-budget-exhausted');
    const deadline = AbortSignal.timeout(allotted);
    let response;
    try {
      response = await request(`${credentials.url}/rest/v1/rpc/${name}`, {
        method: 'POST', redirect: 'error', signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
        headers: { apikey: credentials.key, Authorization: `Bearer ${credentials.key}`,
          'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(payload),
      });
      if (!response.ok) {
        let data;
        try { data = await readBoundedJson(response, 16384); } catch { /* never log transport body */ }
        const sqlCode = data?.code;
        const code = sqlCode === '57014' ? 'sql-timeout' : sqlCode === '55P03' ? 'sql-lock-timeout'
          : ['23514', '22003'].includes(sqlCode) ? 'sql-source-invalid'
          : sqlCode === '55000' ? 'stale-lease' : 'rpc-http-failed';
        throw new PreparedRpcError(code, { ambiguous: mutation && response.status >= 500 && !sqlCode });
      }
      return await readBoundedJson(response, limits.responseBytes);
    } catch (error) {
      if (error instanceof PreparedRpcError) throw error;
      throw new PreparedRpcError('rpc-transport-failed', { ambiguous: mutation });
    }
  };
}
export async function readBoundedJson(response, maxBytes) {
  demand(response.body, 'rpc-empty-body');
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > maxBytes) { await response.body.cancel?.().catch(() => {}); throw new Error('rpc-response-too-large'); }
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export async function runPreparedWorker({ rpc, now = () => performance.now(), uuid = randomUUID, log = () => {}, signal,
  budgetMs = limits.invocationMs, maxSteps = limits.maxSteps, workerId = 'homelab-stats-chart' } = {}) {
  const started = now(); const deadline = started + Math.min(budgetMs, limits.invocationMs);
  const runId = uuid(); let claim; let steps = 0; let more = true;
  let outcome = 'yielded'; let errorCode;
  const emit = event => log({ runId, ...event });
  // One monotonic deadline includes health, claim ambiguity, advance receipts /
  // identical replay and durable finish recovery. Leave a scheduling margin in
  // addition to three control calls (finish, receipt, identical finish replay).
  const marginMs = 1000;
  const finishReserve = 3 * limits.controlMs + marginMs;
  const advanceReserve = 2 * limits.stepMs + limits.controlMs + finishReserve;
  const remaining = () => Math.floor(deadline - now());
  const requireTime = ms => demand(remaining() >= ms, 'invocation-budget-exhausted');
  const invoke = (name, payload, { mutation = false, reserveMs = 0 } = {}) => {
    const cap = name === 'run_stats_prepared_step_v1' ? limits.stepMs : limits.controlMs;
    const timeoutMs = Math.min(cap, remaining() - reserveMs);
    demand(timeoutMs > 0, 'invocation-budget-exhausted');
    return rpc(name, payload, { mutation, timeoutMs });
  };
  const invokeClaim = () => invoke('claim_stats_prepared_work_v1',
    { p_worker_id: workerId, p_request_id: runId }, { mutation: true, reserveMs: finishReserve });
  try {
    const health = await invoke(contract.healthRpc, {});
    demand(health?.ok === true && health.schemaVersion === contract.schemaVersion &&
      canonical([...health.rpcAllowlist].sort()) === canonical([...contract.rpcAllowlist].sort()), 'schema-contract-mismatch');
    // Same request ID makes a lost claim response idempotent. No new lease is
    // invented after an ambiguous completion.
    requireTime(2 * limits.controlMs + finishReserve);
    try { claim = await invokeClaim(); } catch (error) {
      if (!error.ambiguous || signal?.aborted) throw error;
      requireTime(limits.controlMs + finishReserve);
      claim = await invokeClaim();
    }
    if (!claim.claimed) { emit({ status: 'skipped', reason: claim.reason }); return { status: 'skipped', steps: 0, reason: claim.reason }; }
    demand(typeof claim.leaseToken === 'string' && /^\d+$/.test(String(claim.epoch)), 'invalid-lease-response');
    emit({ status: 'running', epoch: claim.epoch });
    while (more && steps < maxSteps && remaining() >= advanceReserve && !signal?.aborted) {
      const stepId = uuid();
      const payload = { p_lease_token: claim.leaseToken, p_epoch: claim.epoch, p_step_id: stepId, p_work: { kind: 'advance' } };
      let result;
      try { result = await invoke('run_stats_prepared_step_v1', payload, { mutation: true, reserveMs: finishReserve }); }
      catch (error) {
        if (!error.ambiguous || signal?.aborted) throw error;
        // A receipt can be absent while SQL is still executing. Replay EXACTLY
        // the same step once; SQL serialization + receipt prevents double work.
        const receipt = await invoke('get_stats_prepared_receipt_v1', { p_step_id: stepId }, { reserveMs: finishReserve });
        if (receipt.found) result = receipt.outcome;
        else {
          requireTime(limits.stepMs + finishReserve);
          result = await invoke('run_stats_prepared_step_v1', payload, { mutation: true, reserveMs: finishReserve });
        }
      }
      demand(typeof result?.more === 'boolean' && /^[a-z0-9-]{1,64}$/.test(result.phase), 'invalid-step-response');
      more = result.more; steps++;
      emit({ status: 'step', stepId, phase: result.phase, steps,
        platformGeneration: result.platformGeneration, visitGeneration: result.visitGeneration });
    }
    outcome = !more ? 'completed' : 'yielded';
    if (signal?.aborted) { outcome = 'error'; errorCode = 'worker-interrupted'; }
  } catch (error) {
    outcome = 'error';
    errorCode = ['sql-timeout', 'sql-lock-timeout', 'sql-source-invalid', 'stale-lease', 'schema-contract-mismatch',
      'invalid-step-response', 'invalid-lease-response', 'rpc-transport-failed', 'rpc-http-failed',
      'invocation-budget-exhausted'].includes(error.message)
      ? error.message : 'worker-failed';
  }
  if (claim?.claimed) {
    const payload = { p_lease_token: claim.leaseToken, p_epoch: claim.epoch,
      p_outcome: { status: outcome, ...(errorCode ? { code: errorCode } : {}) } };
    try {
      try { await invoke('finish_stats_prepared_work_v1', payload,
        { mutation: true, reserveMs: 2 * limits.controlMs + marginMs }); }
      catch (error) {
        if (!error.ambiguous) throw error;
        const receipt = await invoke('get_stats_prepared_receipt_v1', { p_step_id: claim.leaseToken },
          { reserveMs: limits.controlMs + marginMs });
        if (!receipt.found) await invoke('finish_stats_prepared_work_v1', payload, { mutation: true, reserveMs: marginMs });
      }
    } catch { outcome = 'error'; errorCode = 'finish-receipt-failed'; }
  }
  const result = { status: outcome, steps, durationMs: Math.max(0, now() - started), ...(errorCode ? { code: errorCode } : {}) };
  emit(result);
  return result;
}
