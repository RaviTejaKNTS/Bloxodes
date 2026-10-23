/** Pure, fixed NONACCEPTANCE diagnostic descriptors. No environment, I/O or execution on import.
 * The GitHub QA driver owns target/run guards, installation, execution, receipts and cleanup.
 * Never use this as normal acceptance, a capacity benchmark, or original-input replay.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const READER_DIAGNOSTIC_MODE = 'reader-diagnostic';
export const READER_DIAGNOSTIC_LIMITS = Object.freeze({ statementMs: 2000, lockMs: 500,
  appReadMs: 3000, advanceMs: 6000, maxPayloadBytes: 16_777_216,
  maxPlanNodes: 128, maxPlanDepth: 16, maxProjectionBytes: 32_768 });
export const READER_DIAGNOSTIC_MIGRATIONS = Object.freeze([
  Object.freeze({ path: 'supabase/migrations/20261023100441_stats_prepared_charts_v1.sql',
    sha256: '286252e4620d906b21c2472a36773b45dbf3d6c42c6b5c44063e71ee65228fbd', bytes: 61043 }),
  Object.freeze({ path: 'supabase/migrations/20261023131347_stats_prepared_claim_membership_delete_predicate.sql',
    sha256: '4552eaf88221f394e8c3724b309bdec1104bd7a0335a9d196e050910f73adce1', bytes: 4361 }),
]);
export const READER_DIAGNOSTIC_CASE_IDS = Object.freeze(['cold-no-generation', 'daily-empty-181',
  'daily-one-observed', 'daily-observation-removed', 'daily-missing-selected-date',
  'combined-empty', 'long-hourly-mixture', 'combined-empty-fixed-repeat']);
const AS_OF = '2026-10-25T03:38:00.000Z';
const HOUR = 3_600_000, DAY = 24 * HOUR;
const AS_OF_MS = Date.parse(AS_OF);
const iso = ms => new Date(ms).toISOString();
const sha256 = value => createHash('sha256').update(value).digest('hex');
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function owned(schema, privateSchema) {
  assert.equal(typeof schema, 'string', 'invalid-reader-owned-schema');
  assert.match(schema, /^qa_stats_[a-f0-9]{12}$/, 'invalid-reader-owned-schema');
  assert.equal(privateSchema, `${schema}_p`, 'invalid-reader-owned-schema');
}

/** Derive the exact SQL-language body, then bind its five known parameter tokens.
 * A separate exposed parameterizedQuery is useful with a protocol-bind SQL seam.
 * Never EXPLAIN an IMMUTABLE helper with all literal arguments.
 */
export function extractReaderPeriodBaseline(migrationSources) {
  assert.ok(Array.isArray(migrationSources) && migrationSources.length === 2, 'invalid-reader-migrations');
  for (const [i, source] of migrationSources.entries()) {
    const frozen = READER_DIAGNOSTIC_MIGRATIONS[i];
    assert.ok(source?.path === frozen.path && Buffer.isBuffer(source.bytes)
      && source.bytes.length === frozen.bytes && sha256(source.bytes) === frozen.sha256,
    'reader-migration-bytes-not-frozen');
  }
  const source = migrationSources[0].bytes.toString('utf8');
  const marker = 'create function stats_prepared_private.stats_prepared_period_v1(';
  const start = source.indexOf(marker);
  assert.ok(start >= 0 && source.indexOf(marker, start + 1) === -1, 'invalid-reader-period-definition');
  const bodyStart = source.indexOf('as $$\n', start) + 'as $$\n'.length;
  const bodyEnd = source.indexOf('\n$$;', bodyStart);
  assert.ok(bodyStart > start && bodyEnd > bodyStart, 'invalid-reader-period-definition');
  const exactQuery = source.slice(bodyStart, bodyEnd);
  assert.ok(exactQuery.startsWith(' with selected as (') && exactQuery.endsWith('from coverage c;'),
    'invalid-reader-period-definition');
  const parameters = ['p_rows', 'p_start', 'p_end', 'p_hourly', 'p_as_of'];
  const parameterizedQuery = exactQuery.replace(/\bp_(rows|start|end|hourly|as_of)\b/g,
    name => `$${parameters.indexOf(name) + 1}`);
  return { source: 'frozen-migration-bytes', migrationSha256: READER_DIAGNOSTIC_MIGRATIONS[0].sha256,
    bodySha256: sha256(exactQuery), parameterTypes: ['jsonb', 'timestamptz', 'timestamptz', 'boolean', 'timestamptz'],
    exactQuery, parameterizedQuery };
}

function row(ms, hourly, observed = false, n = 1) {
  return { playing: observed ? '24' : '0', peak_players: observed ? '27' : '0',
    avg_players: observed ? '23.5' : '0', visits: observed ? '9007199254740993' : '0',
    favorites: observed ? '50' : '0', rating_percent: observed ? '90.2' : null,
    tracked_games: observed ? '1' : '0', samples: observed ? '2' : '0',
    recorded_at: observed ? iso(ms + 60_000) : null,
    [hourly ? 'hour_start' : 'stat_date']: hourly ? iso(ms) : iso(ms).slice(0, 10),
    _observed: observed ? 1 : 0, _first: observed ? iso(ms) : null,
    _finalized: hourly ? ms < Math.floor(AS_OF_MS / HOUR) * HOUR : ms < Math.floor(AS_OF_MS / DAY) * DAY,
    _changed: AS_OF, _version: uuid(10000 + n) };
}

function caseData(id) {
  assert.ok(READER_DIAGNOSTIC_CASE_IDS.includes(id), 'invalid-reader-case');
  const index = READER_DIAGNOSTIC_CASE_IDS.indexOf(id);
  const cold = index === 0, long = id === 'long-hourly-mixture';
  const hourly = [], daily = [];
  if (!cold) {
    const midnight = Math.floor(AS_OF_MS / DAY) * DAY;
    for (let i = 0; i <= 180; i++) {
      const ms = midnight - (180 - i) * DAY;
      if (id === 'daily-missing-selected-date' && i === 180) continue;
      daily.push(row(ms, false, id === 'daily-one-observed' && i === 179,
        id === 'daily-observation-removed' && i === 179 ? 20000 + i : i + 1));
    }
    if (long) {
      const end = Math.floor(AS_OF_MS / HOUR) * HOUR;
      for (let i = 0; i <= 4320; i++) hourly.push(row(end - (4320 - i) * HOUR, true, i % 2 === 0, 1000 + i));
    } else if (id === 'combined-empty' || id === 'combined-empty-fixed-repeat') {
      for (let i = 0; i < 2164; i++) hourly.push(row(midnight - 90 * DAY + i * HOUR, true, false, 1000 + i));
    }
  }
  return { id, index, generation: cold ? null : uuid(index + 1), cold,
    range: long ? '90d' : '1d', resolution: long ? 'hourly' : 'daily', days: long ? 90 : 1,
    payload: cold ? null : { hourly, daily } };
}

function periodExpected(data, previous) {
  if (data.cold) return { rows: 0, sourceUpdatedAt: null, coverage: { expectedBuckets: 0,
    processedBuckets: 0, observedBuckets: 0, missingBuckets: [], firstSourceAt: null,
    lastSourceAt: null, finalizedThrough: null, provisional: true, reason: 'not-built' } };
  const hourly = data.resolution === 'hourly', step = hourly ? HOUR : DAY;
  const end = AS_OF_MS - (previous ? data.days * DAY : 0), start = end - data.days * DAY;
  const lower = hourly ? start : Math.floor(start / DAY) * DAY;
  const upper = hourly ? end : Math.floor(end / DAY) * DAY;
  const first = Math.ceil(lower / step) * step, last = Math.floor(upper / step) * step;
  const input = data.payload[hourly ? 'hourly' : 'daily'];
  const selected = input.filter(r => {
    const time = Date.parse(r[hourly ? 'hour_start' : 'stat_date']);
    return time >= lower && time <= upper;
  });
  const observed = selected.filter(r => r._observed > 0);
  const observedTimes = new Set(observed.map(r => Date.parse(r[hourly ? 'hour_start' : 'stat_date'])));
  const missing = [];
  for (let t = first; t <= last; t += step) {
    if (!observedTimes.has(t)) missing.push(iso(t));
  }
  const finalized = observed.filter(r => hourly
    ? Date.parse(r.hour_start) < Math.floor(AS_OF_MS / HOUR) * HOUR : r._finalized);
  const expected = (last - first) / step + 1;
  return { rows: observed.length, sourceUpdatedAt: selected.length ? AS_OF : null,
    coverage: { expectedBuckets: expected, processedBuckets: selected.length,
      observedBuckets: observed.length, missingBuckets: missing,
      firstSourceAt: observed[0]?._first ?? null, lastSourceAt: observed.at(-1)?.recorded_at ?? null,
      finalizedThrough: finalized.length ? finalized.at(-1)[hourly ? 'hour_start' : 'stat_date'].slice(0, 10) : null,
      provisional: observed.length < expected || selected.some(r => !r._finalized),
      reason: previous && hourly && observed.length < expected && start < AS_OF_MS - 90 * DAY ? 'retention-gap'
        : !hourly && !observed.some(r => Date.parse(r.stat_date) === Math.floor(end / DAY) * DAY) ? 'producer-behind'
          : observed.length < expected ? 'source-gap' : 'complete' } };
}

export function readerDiagnosticExpected(caseId) {
  const data = caseData(caseId);
  return { current: periodExpected(data, false), previous: periodExpected(data, true) };
}

const measured = query => `begin read only;
set local statement_timeout='2s'; set local lock_timeout='500ms'; set local timezone='UTC';
set local role service_role;
${query}
rollback;`;
const setupTransaction = query => `begin;
set local statement_timeout='2s'; set local lock_timeout='500ms'; set local timezone='UTC';
set local role service_role;
${query}
commit;`;

/** No target, arbitrary SQL, captured payload, date, selection or timeout arguments.
 * Only the existing QA driver's validated run-owned identity and frozen bytes enter.
 * Descriptors are executable SQL, NEVER receipt fields; persist only safe projections.
 */
export function createReaderDiagnosticPlan(options) {
  assert.ok(object(options) && Object.keys(options).sort().join(',') === 'migrationSources,privateSchema,schema',
    'invalid-reader-plan-options');
  const { schema, privateSchema, migrationSources } = options;
  owned(schema, privateSchema);
  const baseline = extractReaderPeriodBaseline(migrationSources);
  const alias = `qa_${schema.slice('qa_stats_'.length)}_get_sp_platform_chart_v1`;
  const control = `${schema}.stats_prepared_control`, generations = `${schema}.stats_prepared_generations`;
  const preflightSql = measured(`select
    (select count(*)=1 and bool_and(active_platform is null and previous_platform is null
      and active_visit is null and previous_visit is null and lease_token is null) from ${control})
    and not exists(select 1 from ${generations})
    and not exists(select 1 from ${schema}.roblox_universes)
    and not exists(select 1 from ${schema}.stats_game_current_index)
    and not exists(select 1 from ${schema}.roblox_universe_stats_hourly)
    and not exists(select 1 from ${schema}.roblox_universe_stats_daily) as fresh_owned_fixture;`);
  const cases = READER_DIAGNOSTIC_CASE_IDS.map(id => {
    const data = caseData(id), payloadText = JSON.stringify(data.payload);
    assert.ok(Buffer.byteLength(payloadText) <= READER_DIAGNOSTIC_LIMITS.maxPayloadBytes, 'reader-payload-too-large');
    const gid = data.cold ? 'null::uuid' : `${literal(data.generation)}::uuid`;
    const setupSql = setupTransaction(`${data.cold ? '' : `insert into ${generations}
      (id,product,status,as_of,generated_at,published_at,membership,signature,source_updated_at,
       metadata_revision,manifest,payload,payload_hash)
      select ${gid},'platform','ready',${literal(AS_OF)}::timestamptz,${literal(AS_OF)}::timestamptz,
        ${literal(AS_OF)}::timestamptz,'reader-diagnostic',${literal(id)},${literal(AS_OF)}::timestamptz,0,
        jsonb_build_object('hourlySourceAsOf',(select max(r->>'recorded_at') from jsonb_array_elements(p->'hourly') r),
          'dailySourceAsOf',(select max(r->>'recorded_at') from jsonb_array_elements(p->'daily') r)),p,
        encode(sha256(convert_to(p::text,'UTF8')),'hex') from (select ${literal(payloadText)}::jsonb p) input;`}
      update ${control} set previous_platform=active_platform,active_platform=${gid},
        membership='reader-diagnostic',checked_at=${literal(AS_OF)}::timestamptz,
        error_code=null,outside_horizon_at=null where id;`);
    const selection = { p_range: data.range, p_resolution: data.resolution, p_include_previous: true };
    const profiles = [];
    for (const scope of data.cold ? ['wrapper'] : ['current', 'previous', 'wrapper']) {
      let query;
      if (scope === 'wrapper') query = `select ${schema}.get_stats_prepared_platform_chart_v1(${literal(data.range)},${literal(data.resolution)},true)`;
      else {
        // A MATERIALIZED owned-table input prevents constant folding. The five
        // bindings remain relation Vars inside the exact extracted body. This
        // freshly planned lateral query is not the RPC's cached SQL plan.
        const endDays = scope === 'previous' ? data.days : 0;
        const startDays = endDays + data.days;
        const inner = baseline.exactQuery.replace(/\bp_(rows|start|end|hourly|as_of)\b/g, name => `input.${name}`)
          .replace(/;$/, '');
        query = `with diagnostic_input as materialized (
          select payload->${literal(data.resolution)} p_rows,as_of-interval '${startDays} days' p_start,
            as_of-interval '${endDays} days' p_end,${data.resolution === 'hourly'} p_hourly,as_of p_as_of
          from ${generations} where id=${gid} and status='ready'
        ) select result.* from diagnostic_input input cross join lateral (${inner}) result`;
      }
      for (const analyze of [false, true]) profiles.push({ scope, analyze,
        planScope: scope === 'wrapper' ? 'opaque-plpgsql-wrapper' : 'extracted-body-owned-row-bindings-fresh-plan-not-cached-rpc',
        sql: measured(`explain (${analyze ? 'ANALYZE, BUFFERS, TIMING OFF, SUMMARY, FORMAT JSON' : 'VERBOSE, COSTS, SETTINGS, FORMAT JSON'}) ${query};`) });
    }
    // Fixed adjacent passing-shape control, on the SAME combined generation.
    const rest = [{ alias, body: selection, appReadMs: 3000, assertion: 'case-response',
      expected: readerDiagnosticExpected(id) }];
    if (id === 'combined-empty') rest.unshift({ alias,
      body: { p_range: '1d', p_resolution: 'hourly', p_include_previous: true }, appReadMs: 3000,
      assertion: 'same-generation-adjacent-hourly-control', expected: {
        current: periodExpected({ ...data, resolution: 'hourly' }, false),
        previous: periodExpected({ ...data, resolution: 'hourly' }, true) } });
    return { id, generation: data.generation, provenance: 'synthetic-non-equivalent-to-original',
      asOf: data.cold ? null : AS_OF, selection, setupSql,
      fixtureInput: { hourlyRows: data.payload?.hourly.length ?? 0, dailyRows: data.payload?.daily.length ?? 0,
        jsPayloadBytes: data.cold ? 0 : Buffer.byteLength(payloadText),
        jsPayloadSha256: data.cold ? null : sha256(payloadText), originalInput: 'unknown-not-captured' },
      expected: readerDiagnosticExpected(id),
      readbackSql: measured(`select g.id::text as generation, g.as_of as "asOf",
        pg_column_size(g.payload)::text as "payloadStorageBytes",octet_length(g.payload::text)::text as "payloadTextBytes",
        g.payload_hash as "payloadSha256",encode(sha256(convert_to(g.payload::text,'UTF8')),'hex') as "readbackSha256",
        jsonb_array_length(g.payload->'hourly') as "hourlyRows",jsonb_array_length(g.payload->'daily') as "dailyRows",
        ${['current', 'previous'].map((period, i) => `(select count(*)::integer
          from jsonb_array_elements(g.payload->${literal(data.resolution)}) r
          where (r->>${literal(data.resolution === 'hourly' ? 'hour_start' : 'stat_date')})::timestamptz
            between ${data.resolution === 'hourly' ? `g.as_of-interval '${(i + 1) * data.days} days'`
              : `date_trunc('day',g.as_of-interval '${(i + 1) * data.days} days')`}
              and ${data.resolution === 'hourly' ? `g.as_of-interval '${i * data.days} days'`
                : `date_trunc('day',g.as_of-interval '${i * data.days} days')`}) as "${period}SelectedRows"`).join(',\n')}
        from ${control} c left join ${generations} g on g.id=c.active_platform where c.id;`),
      profiles, rest, responseSql: measured(`select ${schema}.get_stats_prepared_platform_chart_v1(
        ${literal(data.range)},${literal(data.resolution)},true) as result;`),
      repeat: id === 'combined-empty-fixed-repeat' ? 'one-fixed-repeat-of-failing-shape' : null };
  });
  return { mode: READER_DIAGNOSTIC_MODE, acceptance: false, originalInput: 'unknown-not-captured',
    baseline, limits: READER_DIAGNOSTIC_LIMITS, preflightSql, cases,
    executionContract: 'assert-preflight-true; serial-case-setup/readback/profiles/response/rest; rollback-on-every-profile-error; no-retry' };
}

/** Only exact primary cancellation messages; 57014 alone does not prove timeout. */
export function readerCancellationDiagnostic(error) {
  const sqlstate = typeof error?.code === 'string' && /^[A-Z0-9]{5}$/.test(error.code) ? error.code : 'unknown';
  const labels = new Map([['canceling statement due to statement timeout', 'statement-timeout'],
    ['canceling statement due to user request', 'user-cancel']]);
  return { sqlstate, errorClass: sqlstate === '57014' ? labels.get(error?.message) ?? 'unknown' : 'unknown' };
}

const NODE_TYPES = new Set(['Result', 'ProjectSet', 'Append', 'Merge Append', 'Recursive Union',
  'BitmapAnd', 'BitmapOr', 'Nested Loop', 'Merge Join', 'Hash Join', 'Seq Scan', 'Sample Scan',
  'Gather', 'Gather Merge', 'Index Scan', 'Index Only Scan', 'Bitmap Index Scan', 'Bitmap Heap Scan',
  'Tid Scan', 'Tid Range Scan', 'Subquery Scan', 'Function Scan', 'Table Function Scan', 'Values Scan',
  'CTE Scan', 'Named Tuplestore Scan', 'WorkTable Scan', 'Materialize', 'Memoize', 'Sort',
  'Incremental Sort', 'Group', 'Aggregate', 'WindowAgg', 'Unique', 'SetOp', 'LockRows', 'Limit', 'Hash']);
const NUMERIC_FIELDS = ['Startup Cost', 'Total Cost', 'Plan Rows', 'Plan Width', 'Actual Rows', 'Actual Loops',
  'Rows Removed by Filter', 'Rows Removed by Join Filter', 'Rows Removed by Index Recheck',
  'Shared Hit Blocks', 'Shared Read Blocks', 'Shared Dirtied Blocks', 'Shared Written Blocks',
  'Local Hit Blocks', 'Local Read Blocks', 'Local Dirtied Blocks', 'Local Written Blocks',
  'Temp Read Blocks', 'Temp Written Blocks', 'Workers Planned', 'Workers Launched',
  'Hash Buckets', 'Original Hash Buckets', 'Hash Batches', 'Original Hash Batches',
  'Peak Memory Usage', 'Sort Space Used', 'Heap Fetches', 'Cache Hits', 'Cache Misses', 'Cache Evictions', 'Cache Overflows'];
const RELATIONS = new Set(['stats_prepared_control', 'stats_prepared_generations', 'stats_prepared_dirty']);
const INDEXES = new Set(['stats_prepared_control_pkey', 'stats_prepared_generations_pkey',
  'stats_prepared_dirty_pkey', 'stats_prepared_one_build']);
const ENUM_FIELDS = {
  'Join Type': new Set(['Inner', 'Left', 'Right', 'Full', 'Semi', 'Anti', 'Right Anti']),
  Strategy: new Set(['Plain', 'Sorted', 'Hashed', 'Mixed']),
  'Sort Method': new Set(['quicksort', 'top-N heapsort', 'external sort', 'external merge']),
  'Sort Space Type': new Set(['Memory', 'Disk']),
  'CTE Name': new Set(['selected', 'grid', 'windowed', 'coverage', 'diagnostic_input']),
  'Function Name': new Set(['generate_series', 'jsonb_array_elements']),
};
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1e15;

/** Project immediately; never persist raw plans, queries, filter strings or error bodies.
 * TIMING OFF: deliberately excludes all per-node Actual * Time fields.
 */
export function projectReaderDiagnosticPlan(value, schema) {
  owned(schema, `${schema}_p`);
  assert.ok(Array.isArray(value) && value.length === 1 && object(value[0]) && object(value[0].Plan),
    'invalid-reader-plan');
  let nodes = 0;
  const walk = (node, depth) => {
    assert.ok(object(node), 'invalid-reader-plan-node');
    assert.ok(++nodes <= READER_DIAGNOSTIC_LIMITS.maxPlanNodes
      && depth <= READER_DIAGNOSTIC_LIMITS.maxPlanDepth, 'reader-plan-too-large');
    const output = {};
    if (NODE_TYPES.has(node['Node Type'])) output['Node Type'] = node['Node Type'];
    for (const key of NUMERIC_FIELDS) if (finite(node[key])) output[key] = node[key];
    for (const [key, allowlist] of Object.entries(ENUM_FIELDS)) if (allowlist.has(node[key])) output[key] = node[key];
    if (node.Schema === undefined || node.Schema === schema || node.Schema === `${schema}_p`) {
      if (RELATIONS.has(node['Relation Name'])) output.relation = node['Relation Name'];
      if (INDEXES.has(node['Index Name'])) output.index = node['Index Name'];
      if (node.Schema === schema || node.Schema === `${schema}_p`) output.schema = 'owned';
    }
    if (own(node, 'Plans')) {
      assert.ok(Array.isArray(node.Plans) && node.Plans.length <= READER_DIAGNOSTIC_LIMITS.maxPlanNodes, 'invalid-reader-plan-children');
      output.plans = node.Plans.map(child => walk(child, depth + 1));
    }
    return output;
  };
  const root = value[0];
  const output = { plan: walk(root.Plan, 0), jitPresent: object(root.JIT) };
  for (const key of ['Planning Time', 'Execution Time']) if (finite(root[key])) output[key] = root[key];
  if (object(root.JIT) && finite(root.JIT.Functions)) output.jitFunctions = root.JIT.Functions;
  assert.ok(Buffer.byteLength(JSON.stringify(output)) <= READER_DIAGNOSTIC_LIMITS.maxProjectionBytes, 'reader-projection-too-large');
  return output;
}

/** Explicit, bounded owned readback. JS JSON digest and PostgreSQL jsonb digest differ. */
export function readerDiagnosticReadback(caseId, rows) {
  const data = caseData(caseId);
  assert.ok(Array.isArray(rows) && rows.length === 1 && object(rows[0]), 'invalid-reader-readback');
  const r = rows[0];
  if (data.cold) {
    for (const key of ['generation', 'asOf', 'payloadStorageBytes', 'payloadTextBytes', 'payloadSha256',
      'readbackSha256', 'hourlyRows', 'dailyRows']) assert.equal(r[key], null, 'invalid-reader-cold-readback');
    assert.equal(r.currentSelectedRows, 0, 'invalid-reader-cold-readback');
    assert.equal(r.previousSelectedRows, 0, 'invalid-reader-cold-readback');
    return { generation: null, originalInput: 'unknown-not-captured' };
  }
  assert.equal(r.generation, data.generation, 'invalid-reader-generation');
  assert.equal(Date.parse(r.asOf), AS_OF_MS, 'invalid-reader-as-of');
  for (const key of ['payloadStorageBytes', 'payloadTextBytes']) assert.ok(typeof r[key] === 'string'
    && /^[1-9][0-9]{0,7}$/.test(r[key]) && Number(r[key]) <= READER_DIAGNOSTIC_LIMITS.maxPayloadBytes, 'invalid-reader-payload-size');
  assert.ok(typeof r.payloadSha256 === 'string' && /^[a-f0-9]{64}$/.test(r.payloadSha256)
    && r.payloadSha256 === r.readbackSha256, 'invalid-reader-payload-digest');
  assert.equal(r.hourlyRows, data.payload.hourly.length, 'invalid-reader-hourly-count');
  assert.equal(r.dailyRows, data.payload.daily.length, 'invalid-reader-daily-count');
  const expected = readerDiagnosticExpected(caseId);
  assert.equal(r.currentSelectedRows, expected.current.coverage.processedBuckets, 'invalid-reader-selected-count');
  assert.equal(r.previousSelectedRows, expected.previous.coverage.processedBuckets, 'invalid-reader-selected-count');
  return { generation: data.generation, asOf: AS_OF, payloadStorageBytes: r.payloadStorageBytes,
    payloadTextBytes: r.payloadTextBytes, payloadSha256: r.payloadSha256,
    hourlyRows: r.hourlyRows, dailyRows: r.dailyRows,
    currentSelectedRows: r.currentSelectedRows, previousSelectedRows: r.previousSelectedRows,
    currentExpectedBuckets: expected.current.coverage.expectedBuckets,
    previousExpectedBuckets: expected.previous.coverage.expectedBuckets,
    provenance: 'synthetic-non-equivalent-to-original',
    originalInput: 'unknown-not-captured' };
}

/** Fail closed on coverage/row regressions; return counts only, never payloads. */
export function assertReaderDiagnosticResponse(caseId, value) {
  const data = caseData(caseId), expected = readerDiagnosticExpected(caseId);
  assert.ok(object(value) && value.contract === 'stats-prepared@1' && object(value.meta), 'invalid-reader-response');
  assert.equal(value.meta.generationId, data.generation, 'invalid-reader-response-generation');
  assert.equal(value.meta.state, expected.current.rows ? 'partial' : 'unavailable', 'invalid-reader-response-state');
  for (const [field, target] of Object.entries({ asOf: data.cold ? null : AS_OF,
    windowStart: data.cold ? null : iso(AS_OF_MS - data.days * DAY), windowEnd: data.cold ? null : AS_OF,
    sourceUpdatedAt: expected.current.sourceUpdatedAt })) {
    if (target === null) assert.equal(value.meta[field], null, 'invalid-reader-response-date');
    else assert.equal(Date.parse(value.meta[field]), Date.parse(target), 'invalid-reader-response-date');
  }
  for (const [period, key] of [['current', 'currentRows'], ['previous', 'previousRows']]) {
    const actual = value.meta[period], wanted = expected[period];
    assert.ok(object(actual) && Array.isArray(value[key]) && value[key].length === wanted.rows, 'invalid-reader-response-rows');
    for (const [field, target] of Object.entries(wanted.coverage)) {
      const received = actual[field];
      if (field === 'missingBuckets') {
        assert.ok(Array.isArray(received) && received.length === target.length, 'invalid-reader-missing-buckets');
        assert.deepEqual(received.map(t => iso(Date.parse(t))), target, 'invalid-reader-missing-buckets');
      } else if (['firstSourceAt', 'lastSourceAt'].includes(field) && target !== null) {
        assert.equal(Date.parse(received), Date.parse(target), 'invalid-reader-source-date');
      } else assert.deepEqual(received, target, 'invalid-reader-coverage');
    }
    const hourly = data.resolution === 'hourly';
    const end = AS_OF_MS - (period === 'previous' ? data.days * DAY : 0);
    const start = end - data.days * DAY;
    const observed = (data.payload?.[hourly ? 'hourly' : 'daily'] ?? []).filter(r => {
      const t = Date.parse(r[hourly ? 'hour_start' : 'stat_date']);
      return r._observed > 0 && t >= (hourly ? start : Math.floor(start / DAY) * DAY)
        && t <= (hourly ? end : Math.floor(end / DAY) * DAY);
    });
    for (const [index, row] of value[key].entries()) {
      assert.ok(object(row) && !Object.keys(row).some(k => k.startsWith('_')), 'invalid-reader-public-row');
      assert.equal(Date.parse(row[hourly ? 'hour_start' : 'stat_date']),
        Date.parse(observed[index][hourly ? 'hour_start' : 'stat_date']), 'invalid-reader-row-date');
      assert.equal(Date.parse(row.recorded_at), Date.parse(observed[index].recorded_at), 'invalid-reader-row-source-date');
      for (const [field, target] of Object.entries({ playing: '24', peak_players: '27', avg_players: '23.5',
        visits: '9007199254740993', favorites: '50', tracked_games: '1', samples: '2', rating_percent: '90.2' })) {
        assert.equal(row[field], target, 'invalid-reader-numeric-string');
      }
    }
  }
  return { currentRows: expected.current.rows, previousRows: expected.previous.rows, coverageVerified: true };
}

/** The combined case's fixed hourly control has different coverage from its daily selection. */
export function assertReaderDiagnosticRestResponse(caseId, assertion, value) {
  if (assertion === 'case-response') return assertReaderDiagnosticResponse(caseId, value);
  assert.equal(caseId, 'combined-empty', 'invalid-reader-control-case');
  assert.equal(assertion, 'same-generation-adjacent-hourly-control', 'invalid-reader-control');
  const data = caseData(caseId);
  assert.ok(object(value) && value.contract === 'stats-prepared@1' && object(value.meta), 'invalid-reader-control');
  assert.equal(value.meta.generationId, data.generation, 'invalid-reader-control-generation');
  assert.equal(value.meta.state, 'unavailable', 'invalid-reader-control-state');
  for (const [field, target] of Object.entries({ asOf: AS_OF, windowEnd: AS_OF,
    windowStart: iso(AS_OF_MS - DAY), sourceUpdatedAt: AS_OF })) {
    assert.equal(Date.parse(value.meta[field]), Date.parse(target), 'invalid-reader-control-date');
  }
  for (const [period, key] of [['current', 'currentRows'], ['previous', 'previousRows']]) {
    const expected = periodExpected({ ...data, resolution: 'hourly' }, period === 'previous');
    assert.ok(Array.isArray(value[key]) && value[key].length === 0 && object(value.meta[period]), 'invalid-reader-control-rows');
    for (const [field, target] of Object.entries(expected.coverage)) {
      if (field === 'missingBuckets') {
        assert.ok(Array.isArray(value.meta[period][field]), 'invalid-reader-control-coverage');
        assert.deepEqual(value.meta[period][field].map(t => iso(Date.parse(t))), target, 'invalid-reader-control-coverage');
      } else assert.deepEqual(value.meta[period][field], target, 'invalid-reader-control-coverage');
    }
  }
  return { currentRows: 0, previousRows: 0, coverageVerified: true, sameGenerationVerified: true };
}
