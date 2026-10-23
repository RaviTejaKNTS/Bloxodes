import test from 'node:test';
import assert from 'node:assert/strict';
import { preparedChartsRuntimeContract as contract, PREPARED_LIMITS as limits } from '../../shared/prepared-charts-contract.mjs';
import { parseWorkerArgs, validateWorkerAuthorization, runPreparedWorker, createPreparedRpc,
  PreparedRpcError } from '../../shared/prepared-charts-worker.mjs';

const sha = 'a'.repeat(40);
const env = { SUPABASE_URL: 'https://database.bloxodes.com', SUPABASE_SERVICE_ROLE: 'not-a-real-key',
  BLOXODES_STATS_CHART_SHA: sha, BLOXODES_ENV_PROFILE: 'process-only', BLOXODES_ENV_OVERLAYS: '' };
const auth = { format: 1, repository: 'RaviTejaKNTS/Bloxodes', workflow: '.github/workflows/stats-chart-runtime.yml',
  sourceSha: sha, target: env.SUPABASE_URL, entrypoint: 'scripts/universes/refresh-prepared-charts.mjs',
  mode: 'recurring-prepared-charts', runId: '123', runAttempt: 1,
  archiveHash: 'b'.repeat(64), manifestHash: 'c'.repeat(64), contract };
const args = { '--apply': true, '--allow-prod': true, '--expected-sha': sha };
const health = { ok: true, schemaVersion: contract.schemaVersion, rpcAllowlist: contract.rpcAllowlist,
  operational: { platformGeneration: null, visitGeneration: null } };
const lease = { claimed: true, leaseToken: 'lease', epoch: '1' };

test('production guards bind authorization, environment, target and exact SHA', () => {
  assert.equal(validateWorkerAuthorization(args, env, auth).sha, sha);
  for (const changed of [{ '--apply': false }, { '--allow-prod': false }, { '--expected-sha': 'd'.repeat(40) }])
    assert.throws(() => validateWorkerAuthorization({ ...args, ...changed }, env, auth));
  for (const changed of [{ target: 'https://example.org' }, { sourceSha: 'd'.repeat(40) }, { mode: 'other' },
    { runId: null }, { archiveHash: '' }, { contract: { ...contract, rpcAllowlist: ['other'] } }])
    assert.throws(() => validateWorkerAuthorization(args, env, { ...auth, ...changed }));
  assert.throws(() => validateWorkerAuthorization(args, { ...env, SUPABASE_URL: 'https://bbtcaurrtyoukvjbxbbj.supabase.co' }, auth));
  assert.throws(() => validateWorkerAuthorization(args, { ...env, BLOXODES_ENV_PROFILE: 'production' }, auth));
  assert.throws(() => parseWorkerArgs(['--apply', '--apply']));
  assert.throws(() => parseWorkerArgs(['--sql', 'select 1']));
});

test('bootstrap compatibility is healthy even without ready generations or host claim', async () => {
  const calls = [];
  const result = await runPreparedWorker({ rpc: async (name, payload) => {
    calls.push([name, payload]);
    if (name === contract.healthRpc) return health;
    if (name === 'claim_stats_prepared_work_v1') return lease;
    if (name === 'run_stats_prepared_step_v1') return { phase: 'daily-start', more: true };
    return { status: 'yielded' };
  }, maxSteps: 1 });
  assert.equal(result.status, 'yielded');
  assert.equal(calls.filter(([name]) => name === 'run_stats_prepared_step_v1').length, 1);
  assert.deepEqual(calls.at(-1)[1].p_outcome, { status: 'yielded' });
});

test('lost step reply is recovered from receipt without applying twice', async () => {
  let applications = 0; let receipts = 0; const ids = []; let count = 0;
  const result = await runPreparedWorker({ uuid: () => `id-${++count}`, rpc: async (name, payload) => {
    if (name === contract.healthRpc) return health;
    if (name === 'claim_stats_prepared_work_v1') return lease;
    if (name === 'run_stats_prepared_step_v1') {
      applications++; ids.push(payload.p_step_id); throw new PreparedRpcError('rpc-transport-failed', { ambiguous: true });
    }
    if (name === 'get_stats_prepared_receipt_v1') { receipts++; return { found: true, outcome: { phase: 'unchanged', more: false } }; }
    return { status: 'completed' };
  } });
  assert.equal(result.status, 'completed'); assert.equal(applications, 1); assert.equal(receipts, 1);
});

test('receipt not yet committed replays the identical step ID and work once', async () => {
  const steps = [];
  const result = await runPreparedWorker({ rpc: async (name, payload) => {
    if (name === contract.healthRpc) return health;
    if (name === 'claim_stats_prepared_work_v1') return lease;
    if (name === 'get_stats_prepared_receipt_v1') return { found: false };
    if (name === 'run_stats_prepared_step_v1') {
      steps.push(payload);
      if (steps.length === 1) throw new PreparedRpcError('rpc-transport-failed', { ambiguous: true });
      return { phase: 'unchanged', more: false };
    }
    return {};
  } });
  assert.equal(result.status, 'completed'); assert.deepEqual(steps[0], steps[1]);
});

test('SQL timeout never retries or publishes and persists failure before exit', async () => {
  let attempts = 0; let finished;
  const result = await runPreparedWorker({ rpc: async (name, payload) => {
    if (name === contract.healthRpc) return health;
    if (name === 'claim_stats_prepared_work_v1') return lease;
    if (name === 'run_stats_prepared_step_v1') { attempts++; throw new PreparedRpcError('sql-timeout'); }
    finished = payload.p_outcome; return {};
  } });
  assert.equal(attempts, 1); assert.equal(result.status, 'error');
  assert.deepEqual(finished, { status: 'error', code: 'sql-timeout' });
});

test('overlap skip and incompatible schema never run a mutation step', async () => {
  for (const compatible of [false, true]) {
    const calls = [];
    const result = await runPreparedWorker({ rpc: async name => {
      calls.push(name);
      if (name === contract.healthRpc) return compatible ? health : { ...health, schemaVersion: 'other' };
      return { claimed: false, reason: 'leased' };
    } });
    assert.equal(result.status, compatible ? 'skipped' : 'error');
    assert.ok(!calls.includes('run_stats_prepared_step_v1'));
  }
});

test('transport permits exact RPC allowlist and redacts server credentials', async () => {
  const rpc = createPreparedRpc({ url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_ROLE }, {
    request: async () => new Response(JSON.stringify({ code: '57014', message: 'secret-token raw-sql' }), { status: 500 }),
  });
  await assert.rejects(rpc('refresh_roblox_platform_stats_hourly', {}), /rpc-not-allowlisted/);
  await assert.rejects(rpc('run_stats_prepared_step_v1', {}, { mutation: true }), /^Error: sql-timeout$/);
});


test('real CLI guard probes exit 78 before network/subprocess I/O', async () => {
  const { spawnSync } = await import('node:child_process');
  const deny = 'data:text/javascript,' + encodeURIComponent("globalThis.fetch=()=>process.exit(79);");
  const file = new URL('../refresh-prepared-charts.mjs', import.meta.url).pathname;
  for (const argv of [[], ['--apply'], ['--apply', '--allow-prod'], ['--apply', '--allow-prod', '--expected-sha', sha]]) {
    const result = spawnSync(process.execPath, ['--import', deny, file, ...argv], {
      env: { ...env, BLOXODES_STATS_CHART_AUTHORIZATION: '/definitely-absent-qa-authorization.json' }, timeout: 5000,
    });
    assert.equal(result.status, 78);
    assert.ok(!result.stderr.toString().includes(env.SUPABASE_SERVICE_ROLE));
  }
});

test('failed durable finish is an error, never a healthy invocation', async () => {
  const result = await runPreparedWorker({ rpc: async name => {
    if (name === contract.healthRpc) return health;
    if (name === 'claim_stats_prepared_work_v1') return lease;
    if (name === 'run_stats_prepared_step_v1') return { phase: 'unchanged', more: false };
    throw new PreparedRpcError('rpc-http-failed');
  } });
  assert.equal(result.status, 'error'); assert.equal(result.code, 'finish-receipt-failed');
});

test('worker yields within invocation budget without resetting durable bootstrap', async () => {
  let clock = 0; let calls = 0; let finish;
  const result = await runPreparedWorker({ now: () => clock, budgetMs: 60_000, rpc: async (name, payload) => {
    if (name === contract.healthRpc) return health;
    if (name === 'claim_stats_prepared_work_v1') return lease;
    if (name === 'run_stats_prepared_step_v1') { calls++; clock += 9000; return { phase: 'daily-batch', more: true }; }
    finish = payload; return {};
  } });
  assert.equal(calls, 1); assert.equal(result.status, 'yielded');
  assert.deepEqual(finish.p_outcome, { status: 'yielded' });
});

for (const scenario of [
  { name: 'committed advance receipt and committed finish receipt', stepReceipt: true, finishReceipt: true },
  { name: 'absent advance receipt, slow identical replay and absent finish receipt', stepReceipt: false, finishReceipt: false },
  { name: 'ambiguous slow identical replay and lost finish reply', stepReceipt: false, finishReceipt: false, lostReplay: true },
  { name: 'absent receipt followed by local delay that exhausts replay reserve', stepReceipt: false, finishReceipt: false, skipReplay: true },
]) test(`one absolute 210s budget covers near-deadline ${scenario.name}`, async () => {
  let clock = 0; let nextId = 0; let ambiguousStep; let finishPayload;
  const calls = []; const advances = new Map(); let finishes = 0;
  const result = await runPreparedWorker({ now: () => clock, uuid: () => `id-${++nextId}`,
    rpc: async (name, payload, options) => {
      const started = clock;
      const cap = name === 'run_stats_prepared_step_v1' ? limits.stepMs : limits.controlMs;
      assert.ok(options.timeoutMs > 0 && options.timeoutMs <= cap);
      assert.ok(started + options.timeoutMs <= limits.invocationMs, 'each call fits the absolute deadline');
      calls.push({ name, payload, started, timeoutMs: options.timeoutMs });
      // Deterministic transport uses its entire allotted time. No real sleeps.
      clock += options.timeoutMs;
      if (name === contract.healthRpc) return health;
      if (name === 'claim_stats_prepared_work_v1') return lease;
      if (name === 'run_stats_prepared_step_v1') {
        const prior = advances.get(payload.p_step_id);
        assert.ok(limits.invocationMs - started >= limits.stepMs + 3 * limits.controlMs + 1000,
          'even an identical replay leaves a usable finish reserve');
        if (prior) {
          assert.deepEqual(payload, prior, 'ambiguous work only replays the identical UUID and payload');
          if (scenario.lostReplay) throw new PreparedRpcError('rpc-transport-failed', { ambiguous: true });
          return { phase: 'daily-batch', more: true };
        }
        assert.ok(limits.invocationMs - started >= 2 * limits.stepMs + 4 * limits.controlMs + 1000,
          'a new step reserves receipt, replay and the complete finish recovery');
        advances.set(payload.p_step_id, payload);
        if (started >= 156_000) {
          ambiguousStep = payload.p_step_id;
          throw new PreparedRpcError('rpc-transport-failed', { ambiguous: true });
        }
        return { phase: 'daily-batch', more: true };
      }
      if (name === 'get_stats_prepared_receipt_v1') {
        assert.ok([ambiguousStep, lease.leaseToken].includes(payload.p_step_id));
        return payload.p_step_id === ambiguousStep
          ? { get found() {
            // Model local scheduling delay after the bounded receipt transport,
            // before deciding to replay. It must consume the SAME deadline.
            if (scenario.skipReplay) clock += 6000;
            return scenario.stepReceipt;
          }, outcome: { phase: 'daily-batch', more: true } }
          : { found: scenario.finishReceipt, outcome: { status: 'yielded' } };
      }
      assert.equal(name, 'finish_stats_prepared_work_v1');
      finishes++;
      if (finishPayload) assert.deepEqual(payload, finishPayload, 'finish replay retains token, epoch and outcome');
      finishPayload = payload;
      if (finishes === 1) throw new PreparedRpcError('rpc-transport-failed', { ambiguous: true });
      return { status: payload.p_outcome.status };
    } });
  assert.ok(ambiguousStep, 'the scenario must reach the final permitted advance');
  assert.equal(result.status, scenario.lostReplay || scenario.skipReplay ? 'error' : 'yielded');
  if (scenario.skipReplay) assert.equal(result.code, 'invocation-budget-exhausted');
  assert.equal(result.durationMs, clock);
  assert.ok(clock <= limits.invocationMs);
  if (!scenario.stepReceipt && !scenario.skipReplay) assert.equal(clock, 208_000, 'full lost-reply recovery stays below 210s');
  assert.equal(finishes, scenario.finishReceipt ? 1 : 2);
  assert.equal(calls.filter(c => c.name === 'run_stats_prepared_step_v1' && c.payload.p_step_id === ambiguousStep).length,
    scenario.stepReceipt || scenario.skipReplay ? 1 : 2);
  assert.ok(!calls.some(c => c.name === 'run_stats_prepared_step_v1' && c.started > 174_000));
  assert.equal(finishPayload.p_outcome.status, result.status);
});

test('small absolute budget clamps health and refuses a claim without durable finish reserve', async () => {
  let clock = 0; const calls = [];
  const result = await runPreparedWorker({ now: () => clock, budgetMs: 3000,
    rpc: async (name, payload, options) => {
      calls.push(name); assert.equal(options.timeoutMs, 3000); clock += options.timeoutMs; return health;
    } });
  assert.deepEqual(calls, [contract.healthRpc]);
  assert.equal(result.code, 'invocation-budget-exhausted'); assert.equal(result.durationMs, 3000);
});

test('ambiguous claim retry and finish recovery share the original invocation deadline and identity', async () => {
  let clock = 0; const claims = []; const finishes = []; let nextId = 0;
  const result = await runPreparedWorker({ now: () => clock, budgetMs: 80_000, maxSteps: 1,
    uuid: () => `id-${++nextId}`, rpc: async (name, payload, options) => {
      assert.ok(clock + options.timeoutMs <= 80_000); clock += options.timeoutMs;
      if (name === contract.healthRpc) return health;
      if (name === 'claim_stats_prepared_work_v1') {
        claims.push(payload);
        if (claims.length === 1) throw new PreparedRpcError('rpc-transport-failed', { ambiguous: true });
        return lease;
      }
      if (name === 'run_stats_prepared_step_v1') return { phase: 'unchanged', more: false };
      if (name === 'get_stats_prepared_receipt_v1') {
        assert.equal(payload.p_step_id, lease.leaseToken); return { found: false };
      }
      finishes.push(payload);
      if (finishes.length === 1) throw new PreparedRpcError('rpc-transport-failed', { ambiguous: true });
      return { status: 'completed' };
    } });
  assert.deepEqual(claims, [claims[0], claims[0]]); assert.equal(claims[0].p_request_id, 'id-1');
  assert.deepEqual(finishes, [finishes[0], finishes[0]]);
  assert.equal(result.status, 'completed'); assert.equal(result.durationMs, 58_000);
});

test('RPC transport honors remaining-time clamp without increasing fixed per-call caps', async t => {
  const timeouts = [];
  t.mock.method(AbortSignal, 'timeout', ms => { timeouts.push(ms); return new AbortController().signal; });
  const rpc = createPreparedRpc({ url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_ROLE }, {
    request: async () => new Response('{}'),
  });
  await rpc(contract.healthRpc, {}, { timeoutMs: 123 });
  await rpc('run_stats_prepared_step_v1', {}, { mutation: true, timeoutMs: 456 });
  await rpc('run_stats_prepared_step_v1', {}, { mutation: true, timeoutMs: 999_999 });
  await rpc('finish_stats_prepared_work_v1', {}, { mutation: true, timeoutMs: 999_999 });
  assert.deepEqual(timeouts, [123, 456, limits.stepMs, limits.controlMs]);
  await assert.rejects(rpc(contract.healthRpc, {}, { timeoutMs: 0 }), /invocation-budget-exhausted/);
});
