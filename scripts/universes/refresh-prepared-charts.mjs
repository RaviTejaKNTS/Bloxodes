#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { parseWorkerArgs, validateWorkerAuthorization, loadWorkerAuthorization,
  createPreparedRpc, runPreparedWorker } from '../shared/prepared-charts-worker.mjs';

export async function main(args = process.argv.slice(2), env = process.env) {
  const options = parseWorkerArgs(args);
  const authorization = await loadWorkerAuthorization(env.BLOXODES_STATS_CHART_AUTHORIZATION);
  const credentials = validateWorkerAuthorization(options, env, authorization);
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGTERM', stop); process.once('SIGINT', stop);
  try {
    // stdout contains only bounded structured metadata. No credential, raw SQL,
    // server error body, auth receipt or environment dump is ever emitted.
    const result = await runPreparedWorker({ rpc: createPreparedRpc(credentials), signal: controller.signal,
      workerId: `homelab-stats-chart:${credentials.sha}`,
      log: event => process.stdout.write(JSON.stringify({ ...event, sha: credentials.sha,
        authorizationId: credentials.authorizationId }) + '\n') });
    return result.status === 'error' ? 1 : result.status === 'skipped' ? 75 : 0;
  } finally { process.removeListener('SIGTERM', stop); process.removeListener('SIGINT', stop); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(code => { process.exitCode = code; }).catch(() => {
    process.stderr.write('prepared-chart-worker-refused\n'); process.exitCode = 78;
  });
}
