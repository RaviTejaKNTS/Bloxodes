import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validatePreparedSelection, main } from '../stats-prepared-selection.mjs';

const choices = [
  { stats_prepared_daily_diagnostic: 'true' }, { stats_prepared_reader_diagnostic: 'true' },
  { stats_prepared_benchmark: 'true' }, { stats_prepared_capacity_probe: 'true' },
  { stats_prepared_recovery: 'reconcile-39973670048' },
  { code_lookups_recovery: 'reconcile-39955744530-39956105978-39957597153-39958648149' },
  { selected_roblox_bundle_hash: 'a'.repeat(64) },
  { selected_franchise_bundle_hash: 'b'.repeat(64), selected_franchise_stage: 'true' },
];
test('all 256 manual purpose combinations admit only no selection or a single purpose', () => {
  for (let mask = 0; mask < 1 << choices.length; mask++) {
    const inputs = Object.assign({}, ...choices.filter((_, bit) => mask & 1 << bit));
    const run = () => validatePreparedSelection('workflow_dispatch', { inputs });
    if (mask && (mask & (mask - 1))) assert.throws(run, /selection-purposes-conflict/);
    else assert.ok(run().purpose);
  }
});
test('PR, omitted selections, native and event-string booleans preserve normal paths', () => {
  assert.deepEqual(validatePreparedSelection('pull_request', { inputs: { irrelevant: 'ignored' } }), { purpose: 'pull-request' });
  for (const inputs of [undefined, {}, { stats_prepared_daily_diagnostic: false, stats_prepared_benchmark: 'false' }]) {
    assert.deepEqual(validatePreparedSelection('workflow_dispatch', { inputs }), { purpose: 'fixture' });
  }
  for (const value of [true, 'true']) assert.equal(validatePreparedSelection('workflow_dispatch', {
    inputs: { stats_prepared_daily_diagnostic: value } }).purpose, 'stats_prepared_daily_diagnostic');
  assert.equal(validatePreparedSelection('workflow_dispatch', { inputs: {
    selected_franchise_bundle_hash: 'a'.repeat(64), selected_franchise_stage: false } }).purpose, 'selected_franchise_bundle_hash');
});
test('malformed, unknown and nonfinite input shapes fail with fixed errors', () => {
  for (const key of ['stats_prepared_daily_diagnostic', 'stats_prepared_reader_diagnostic',
    'stats_prepared_benchmark', 'stats_prepared_capacity_probe', 'selected_franchise_stage']) {
    for (const value of ['', 'TRUE', '0', '1', 0, 1, null, [], {}, NaN, Infinity]) {
      assert.throws(() => validatePreparedSelection('workflow_dispatch', { inputs: { [key]: value } }), /selection-boolean-invalid/);
    }
  }
  for (const inputs of [null, [], 'SECRET', { unknown: 'SECRET' }, { stats_prepared_recovery: 'SECRET' },
    { code_lookups_recovery: true }, { selected_roblox_bundle_hash: 'SECRET' },
    { selected_franchise_bundle_hash: null }, { selected_franchise_stage: true }]) {
    assert.throws(() => validatePreparedSelection('workflow_dispatch', { inputs }), /^Error: selection-[a-z-]+$/);
  }
  assert.throws(() => validatePreparedSelection('push', {}), /selection-event-invalid/);
});
test('CLI seam reads just the event file, emits fixed JSON and returns exit status', async () => {
  for (const [payload, expected] of [[{ inputs: {} }, 0], [{ inputs: { ...choices[0], ...choices[3] } }, 1],
    [{ inputs: { stats_prepared_recovery: 'SECRET' } }, 1], ['malformed', 1]]) {
    const output = [], reads = [];
    const env = { GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_EVENT_PATH: '/event.json' };
    const status = await main(env, { readFile: async (...args) => { reads.push(args); return payload === 'malformed' ? 'SECRET' : JSON.stringify(payload); },
      stdout: text => output.push(text), stderr: text => output.push(text) });
    assert.equal(status, expected); assert.deepEqual(reads, [['/event.json', 'utf8']]);
    assert.equal(output.length, 1); assert.doesNotMatch(output[0], /SECRET/);
    assert.equal(JSON.parse(output[0]).status, expected ? 'selection-invalid' : 'selection-valid');
  }
});

// Read job-level headers only. This deliberately needs no YAML package/install:
// scope runs these tests before dependencies or managed credentials are exposed.
function workflowJobs(source) {
  const headers = [...source.matchAll(/^  ([a-z][a-z0-9-]+):\s*$/gm)]
    .filter(match => match.index > source.indexOf('\njobs:\n'));
  return new Map(headers.map((header, index) => [header[1], source.slice(header.index,
    headers[index + 1]?.index ?? source.length)]));
}
function jobField(block, name) {
  const match = new RegExp(`^    ${name}:([^\\n]*)(?:\\n((?:      [^\\n]*(?:\\n|$))*))?`, 'm').exec(block);
  assert.ok(match, `missing job ${name}`);
  return /^[>|]/.test(match[1].trim()) ? match[2].trim().replaceAll(/\s+/g, ' ') : match[1].trim();
}
function dependencies(block) {
  const value = jobField(block, 'needs');
  return value.startsWith('[') ? value.slice(1, -1).split(',').map(item => item.trim()) : [value];
}

test('real selected workflow jobs depend on successful scope, including status-overriding conditions', async () => {
  const workflow = await readFile(new URL('../../../.github/workflows/pull-request.yml', import.meta.url), 'utf8');
  const jobs = workflowJobs(workflow);
  const selected = new Map([
    ['prepared-chart-capacity', 'stats_prepared_capacity_probe'],
    ['prepared-chart-recovery', 'stats_prepared_recovery'],
    ['code-lookups-recovery', 'code_lookups_recovery'],
    ['prepared-chart-database', 'stats_prepared_reader_diagnostic'],
    ['selected-franchise-development-qa', 'selected_franchise_bundle_hash'],
    ['selected-roblox-development-qa', 'selected_roblox_bundle_hash'],
  ]);
  const scope = jobs.get('scope'); assert.ok(scope);
  const validator = scope.indexOf('run: node scripts/ci/stats-prepared-selection.mjs');
  assert.ok(validator >= 0 && validator < scope.indexOf('run: node scripts/ci/change-scope.mjs'),
    'validate selections before scope outputs can permit selected actions');
  for (const [name, input] of selected) {
    const block = jobs.get(name); assert.ok(block, name);
    assert.ok(dependencies(block).includes('scope'), `${name} must wait for scope`);
    const condition = jobField(block, 'if');
    assert.ok(condition.includes(`inputs.${input}`), `${name} retains its selection`);
    // GitHub supplies an implicit success() unless a status check overrides it.
    // A dependency alone is insufficient for always()/cancelled()/failure().
    if (/\b(?:always|cancelled|failure)\s*\(/.test(condition)) {
      assert.match(condition, /needs[.]scope[.]result\s*==\s*'success'/, `${name} must explicitly require scope success`);
    }
  }
  // Assert the dependency contract against the concrete conflicts from review.
  // No action/content write needs to be run to prove a failed dependency blocks it.
  for (const inputs of [
    { ...choices[0], ...choices[6] }, { ...choices[0], ...choices[7] },
    { ...choices[6], ...choices[7] }, { ...choices[1], ...choices[7] },
    { ...choices[3], ...choices[4] }, { ...choices[4], ...choices[5] },
  ]) {
    assert.throws(() => validatePreparedSelection('workflow_dispatch', { inputs }), /selection-purposes-conflict/);
    for (const name of selected.keys()) assert.ok(dependencies(jobs.get(name)).includes('scope'));
  }
});

test('real workflow keeps each single bundle eligible and franchise stage grouped with its bundle', async () => {
  const jobs = workflowJobs(await readFile(new URL('../../../.github/workflows/pull-request.yml', import.meta.url), 'utf8'));
  for (const [name, key, extra] of [
    ['selected-roblox-development-qa', 'selected_roblox_bundle_hash', {}],
    ['selected-franchise-development-qa', 'selected_franchise_bundle_hash', {}],
    ['selected-franchise-development-qa', 'selected_franchise_bundle_hash', { selected_franchise_stage: false }],
    ['selected-franchise-development-qa', 'selected_franchise_bundle_hash', { selected_franchise_stage: true }],
    ['selected-franchise-development-qa', 'selected_franchise_bundle_hash', { selected_franchise_stage: 'true' }],
  ]) {
    assert.deepEqual(validatePreparedSelection('workflow_dispatch', { inputs: { [key]: 'a'.repeat(64), ...extra } }), { purpose: key });
    const block = jobs.get(name); assert.ok(block);
    assert.ok(dependencies(block).includes('scope'));
    const condition = jobField(block, 'if');
    assert.match(condition, /github[.]event_name\s*==\s*'workflow_dispatch'/);
    assert.ok(condition.includes(`inputs.${key} != ''`));
    assert.doesNotMatch(condition, /inputs[.]selected_franchise_stage/, 'stage is optional within the franchise purpose');
  }
  assert.throws(() => validatePreparedSelection('workflow_dispatch', { inputs: { selected_franchise_stage: true } }), /selection-stage-without-bundle/);
});
