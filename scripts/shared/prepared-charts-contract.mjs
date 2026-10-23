/** Fixed package/database compatibility contract, independent of readiness/host. */
export const preparedChartsRuntimeContract = Object.freeze({
  schemaVersion: 'stats-prepared@1',
  healthRpc: 'get_stats_prepared_health_v1',
  rpcAllowlist: Object.freeze([
    'get_stats_prepared_health_v1',
    'claim_stats_prepared_work_v1',
    'run_stats_prepared_step_v1',
    'get_stats_prepared_receipt_v1',
    'finish_stats_prepared_work_v1',
  ].sort()),
});
export const PREPARED_RANGES = Object.freeze([1, 7, 14, 30, 90]);
export const PREPARED_LIMITS = Object.freeze({
  invocationMs: 210_000, stepMs: 10_000, controlMs: 8_000, maxSteps: 1000,
  responseBytes: 2 * 1024 * 1024, universeBatch: 256,
});
