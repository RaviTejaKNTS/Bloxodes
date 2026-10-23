// The only worker-specific integration points. Do not infer SQL names here.
export const ENTRYPOINT = 'scripts/universes/refresh-prepared-charts.mjs';
export const WORKER_TEST = 'scripts/universes/__tests__/prepared-charts-worker.test.mjs';
// Frozen with the DB/worker owner in tmp/site-issues-audit/stats-fix/contract-r1.md.
// Compatibility is separate from operational readiness; empty prepared tables may bootstrap.
export const RUNTIME_CONTRACT = Object.freeze({
  schemaVersion: 'stats-prepared@1',
  healthRpc: 'get_stats_prepared_health_v1',
  rpcAllowlist: Object.freeze([
    'claim_stats_prepared_work_v1',
    'finish_stats_prepared_work_v1',
    'get_stats_prepared_health_v1',
    'get_stats_prepared_receipt_v1',
    'run_stats_prepared_step_v1',
  ]),
});
export const ROOT = '/srv/data/bloxodes-stats-chart-runtime';
export const ENV_SOURCE = '/srv/data/projects/Bloxodes/.envs/targets/production.env';
export const TARGET = 'https://database.bloxodes.com';
export const REPOSITORY = 'RaviTejaKNTS/Bloxodes';
export const WORKFLOW = '.github/workflows/stats-chart-runtime.yml';
export const SERVICE = 'bloxodes-stats-chart-refresh.service';
export const TIMER = 'bloxodes-stats-chart-refresh.timer';
export const DEADLINE_MS = 230_000;
export const MAX_BYTES = 8 * 1024 * 1024;
export const OPS_FILES = [
  'scripts/ops/stats-chart-contract.mjs',
  'scripts/ops/stats-chart-archive.mjs',
  'scripts/ops/stats-chart-runtime.mjs',
  'scripts/ops/run-stats-chart-refresh.sh',
  `scripts/ops/systemd/user/${SERVICE}`,
  `scripts/ops/systemd/user/${TIMER}`,
];
export class RuntimeFault extends Error {}
export function demand(condition, code) {
  if (!condition) throw new RuntimeFault(code); // Codes only: never interpolate env/network/child output.
}
export function validSha(value) { return /^[a-f0-9]{40}$/.test(value ?? ''); }
export function canonical(value) {
  if (Array.isArray(value)) return JSON.stringify(value.map(item => JSON.parse(canonical(item))));
  if (value && typeof value === 'object') return JSON.stringify(Object.fromEntries(
    Object.keys(value).sort().map(key => [key, JSON.parse(canonical(value[key]))])));
  return JSON.stringify(value);
}
export function validateContract(value) {
  demand(value && /^[a-zA-Z0-9._@-]{1,80}$/.test(value.schemaVersion), 'invalid-schema-contract');
  demand(Array.isArray(value.rpcAllowlist) && value.rpcAllowlist.length > 0 && value.rpcAllowlist.length <= 16,
    'invalid-rpc-allowlist');
  demand(value.rpcAllowlist.every(name => /^[a-z][a-z0-9_]{0,62}$/.test(name)) &&
    new Set(value.rpcAllowlist).size === value.rpcAllowlist.length && value.rpcAllowlist.includes(value.healthRpc),
  'invalid-rpc-allowlist');
  return { schemaVersion: value.schemaVersion, healthRpc: value.healthRpc,
    rpcAllowlist: [...value.rpcAllowlist].sort() };
}
export function allowedPayload(name) {
  return OPS_FILES.includes(name) || name === ENTRYPOINT || /^scripts\/shared\/prepared-charts[a-z0-9-]*\.mjs$/.test(name);
}
