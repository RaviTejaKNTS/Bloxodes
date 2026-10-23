#!/usr/bin/env node
/** Credential-free dispatch gate. Reads only the GitHub event name and file. */
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const BOOLEANS = Object.freeze(['stats_prepared_daily_diagnostic', 'stats_prepared_reader_diagnostic',
  'stats_prepared_benchmark', 'stats_prepared_capacity_probe', 'selected_franchise_stage']);
const STRINGS = Object.freeze(['stats_prepared_recovery', 'code_lookups_recovery',
  'selected_roblox_bundle_hash', 'selected_franchise_bundle_hash']);
const RECOVERY = Object.freeze({ stats_prepared_recovery: 'reconcile-39973670048',
  code_lookups_recovery: 'reconcile-39955744530-39956105978-39957597153-39958648149' });
class SelectionError extends Error {}
const reject = code => { throw new SelectionError(code); };

export function validatePreparedSelection(eventName, event) {
  // PR payloads do not carry dispatch selections. Keep ordinary scope unchanged.
  if (eventName === 'pull_request') return { purpose: 'pull-request' };
  if (eventName !== 'workflow_dispatch') reject('selection-event-invalid');
  if (!event || typeof event !== 'object' || Array.isArray(event)) reject('selection-event-invalid');
  const inputs = event.inputs === undefined ? {} : event.inputs;
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) reject('selection-inputs-invalid');
  const known = new Set([...BOOLEANS, ...STRINGS]);
  if (Object.keys(inputs).some(key => !known.has(key))) reject('selection-input-unknown');
  const selected = {};
  for (const key of BOOLEANS) {
    const value = inputs[key];
    if (value !== undefined && ![true, false, 'true', 'false'].includes(value)) reject('selection-boolean-invalid');
    selected[key] = value === true || value === 'true';
  }
  for (const key of STRINGS) {
    const value = inputs[key] ?? '';
    if (typeof value !== 'string' || (inputs[key] === null)) reject('selection-string-invalid');
    if (key.endsWith('_hash') && value !== '' && !/^[a-f0-9]{64}$/.test(value)) reject('selection-hash-invalid');
    if (Object.hasOwn(RECOVERY, key) && value !== '' && value !== RECOVERY[key]) reject('selection-recovery-invalid');
    selected[key] = value !== '';
  }
  if (selected.selected_franchise_stage && !selected.selected_franchise_bundle_hash) reject('selection-stage-without-bundle');
  const purposes = [...BOOLEANS.filter(key => key !== 'selected_franchise_stage'), ...STRINGS]
    .filter(key => selected[key]);
  if (purposes.length > 1) reject('selection-purposes-conflict');
  return { purpose: purposes[0] ?? 'fixture' };
}

export async function main(env = process.env, io = { readFile, stdout: text => console.log(text), stderr: text => console.error(text) }) {
  try {
    const event = JSON.parse(await io.readFile(env.GITHUB_EVENT_PATH, 'utf8'));
    const result = validatePreparedSelection(env.GITHUB_EVENT_NAME, event);
    io.stdout(JSON.stringify({ status: 'selection-valid', ...result }));
    return 0;
  } catch (error) {
    io.stderr(JSON.stringify({ status: 'selection-invalid', code: error instanceof SelectionError ? error.message : 'selection-event-unreadable' }));
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main();
