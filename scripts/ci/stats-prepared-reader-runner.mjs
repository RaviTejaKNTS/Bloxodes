/** Explicit NONACCEPTANCE orchestration. Import performs no I/O, env or clock reads.
 * Caller owns exact target/run/SHA guards, frozen clones/aliases and finally cleanup.
 * Descriptors and provider values never enter persisted receipts.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReaderDiagnosticPlan, projectReaderDiagnosticPlan, readerDiagnosticReadback,
  assertReaderDiagnosticResponse, assertReaderDiagnosticRestResponse,
  READER_DIAGNOSTIC_CASE_IDS, READER_DIAGNOSTIC_MIGRATIONS, READER_DIAGNOSTIC_LIMITS } from './stats-prepared-reader-diagnostic.mjs';

export const READER_DIAGNOSTIC_PHASES = Object.freeze(['reader-diagnostic-preflight',
  'reader-diagnostic-install', 'reader-diagnostic-setup', 'reader-diagnostic-readback',
  'reader-diagnostic-profile', 'reader-diagnostic-response', 'reader-diagnostic-rest']);
const literal = value => `'${value.replaceAll("'", "''")}'`;
const hash = value => createHash('sha256').update(value).digest('hex');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const status = value => Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
const state = value => typeof value === 'string' && /^[A-Z0-9]{5}$/.test(value) ? value : 'unknown';
const classes = new Set(['statement-timeout', 'user-cancel', 'unknown']);
const failureKinds = new Set(['rest-deadline', 'rest-http-failed', 'rest-invalid-body',
  'rest-body-too-large', 'rest-request-failed']);
const invalidKinds = Object.freeze({ 'reader-diagnostic-preflight': 'preflight-rejected',
  'reader-diagnostic-install': 'profiler-install-rejected', 'reader-diagnostic-setup': 'setup-response-invalid',
  'reader-diagnostic-readback': 'readback-invalid', 'reader-diagnostic-profile': 'plan-projection-failed',
  'reader-diagnostic-response': 'response-invalid', 'reader-diagnostic-rest': 'rest-response-invalid' });
const measuredPrefix = "begin read only;\nset local statement_timeout='2s'; set local lock_timeout='500ms'; set local timezone='UTC';\nset local role service_role;\n";
const measured = query => `${measuredPrefix}${query}\nrollback;`;
const inner = sql => {
  assert.ok(sql.startsWith(measuredPrefix) && sql.endsWith('\nrollback;'), 'reader-invalid-fixed-descriptor');
  return sql.slice(measuredPrefix.length, -'\nrollback;'.length);
};

/** Finite fixed switch, never a SQL argument. EXPLAIN still profiles the exact
 * extracted SELECT with owned-row Vars, using a freshly planned EXECUTE. The
 * exception subtransaction is instrumentation, not original/cached-RPC equivalence.
 * No timeout proconfig: the TOP LEVEL SELECT retains the effective 2s deadline.
 */
function profiler(plan, schema, privateSchema) {
  const name = `${privateSchema}.reader_diagnostic_probe_v1`;
  const queries = plan.cases.flatMap(c => [...c.profiles.map(p => inner(p.sql)), inner(c.responseSql)]);
  assert.equal(queries.length, 52, 'reader-invalid-fixed-probes');
  const body = `declare v jsonb; m text;
begin
  if current_user <> 'service_role' or current_setting('statement_timeout') <> '2s'
    or current_setting('lock_timeout') <> '500ms' or current_setting('transaction_read_only') <> 'on'
    or current_setting('TimeZone') <> 'UTC' then
    return jsonb_build_object('outcome','settings-rejected');
  end if;
  begin
    case p_probe
${queries.map((query, i) => `      when ${i + 1} then execute ${literal(query)} into v;`).join('\n')}
      else return jsonb_build_object('outcome','probe-rejected');
    end case;
    return jsonb_build_object('outcome','ok','settingsVerified',true,'value',v);
  exception when query_canceled then
    get stacked diagnostics m = message_text;
    return jsonb_build_object('outcome','cancelled','settingsVerified',true,'sqlstate',SQLSTATE,
      'errorClass',case m when 'canceling statement due to statement timeout' then 'statement-timeout'
        when 'canceling statement due to user request' then 'user-cancel' else 'unknown' end);
  end;
end;`;
  const definition = `create function ${name}(p_probe integer) returns jsonb
language plpgsql volatile security invoker
set search_path=pg_catalog,${schema},${privateSchema} set timezone='UTC'
as $reader_profiler$${body}$reader_profiler$;`;
  // Installation is owner work; all measured calls below SET LOCAL ROLE service_role.
  // CREATE (not REPLACE) rejects collisions. Existing private-schema cleanup owns it.
  // Prove settings and definition before LOCAL settings expire at COMMIT. The
  // caller must return this request's last nonempty rowset after COMMIT completes.
  const installSql = `begin;
set local statement_timeout='2s'; set local lock_timeout='500ms'; set local timezone='UTC';
${definition}
alter function ${name}(integer) owner to postgres;
revoke all on function ${name}(integer) from public,anon,authenticated;
grant execute on function ${name}(integer) to service_role;
select p.proowner='postgres'::regrole and not p.prosecdef and p.provolatile='v'
  and p.prosrc=${literal(body)} and cardinality(p.proconfig)=2
  and p.proconfig @> array['search_path=pg_catalog, ${schema}, ${privateSchema}','TimeZone=UTC']
  and has_function_privilege('service_role',p.oid,'execute')
  and not has_function_privilege('anon',p.oid,'execute')
  and not has_function_privilege('authenticated',p.oid,'execute')
  and not exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    where a.grantee not in (p.proowner,'service_role'::regrole)) as installed,
  current_setting('statement_timeout')='2s' and current_setting('lock_timeout')='500ms'
    and current_setting('TimeZone')='UTC' as "proofSettingsVerified"
from pg_proc p where p.oid='${name}(integer)'::regprocedure;
commit;`;
  return { installSql, definitionSha256: hash(definition), query: n => measured(`select ${name}(${n}) as probe;`) };
}

/**
 * sql(query, phase) -> {ok:true,status:200,rows,requestComplete:true}, only AFTER
 * the complete successful Management response body for THIS request; or
 * {ok:false,status,failure:{sqlstate,errorClass}}. Throws are unknown failures.
 * rest({caseId,assertion,alias,body,appReadMs}) -> createReaderDiagnosticRest result.
 * persist(snapshot) must durably replace the parent receipt BEFORE resolving.
 * now() is a real request clock in epoch milliseconds; frozen asOf is never a timer.
 * Any persistence failure throws a fixed Error and prevents the next request.
 */
export async function runReaderDiagnostic({ schema, privateSchema, migrationSources,
  sql, rest, persist, now = Date.now }) {
  for (const seam of [sql, rest, persist, now]) assert.equal(typeof seam, 'function', 'reader-missing-seam');
  const plan = createReaderDiagnosticPlan({ schema, privateSchema, migrationSources });
  assert.ok(plan.cases.length === 8 && plan.cases.reduce((n, c) => n + c.profiles.length, 0) === 44
    && plan.cases.reduce((n, c) => n + c.rest.length, 0) === 9, 'reader-fixed-plan-changed');
  const probe = profiler(plan, schema, privateSchema);
  const definitionHashes = { migrations: READER_DIAGNOSTIC_MIGRATIONS.map(m => ({ ...m })),
    periodBodySha256: plan.baseline.bodySha256, profilerDefinitionSha256: probe.definitionSha256 };
  const receipt = { mode: plan.mode, completed: false, acceptance: false,
    originalInput: 'unknown-not-captured', provenance: 'synthetic-non-equivalent-to-original',
    instrumentation: 'private-fixed-switch-exception-subtransaction-fresh-execute',
    definitionHashes, limits: { ...READER_DIAGNOSTIC_LIMITS },
    diagnostic: { status: 'incomplete', preflightVerified: false, casesValidated: 0,
      sqlDeadline: 'incomplete', restDeadline: 'incomplete' }, attempts: [], cases: [] };
  const save = async () => {
    try { await persist(JSON.parse(JSON.stringify(receipt))); }
    catch { throw new Error('reader-diagnostic-persistence-failed'); }
  };
  const clock = () => {
    const value = now();
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('reader-diagnostic-invalid-clock');
    return value;
  };
  let stop = false, probeNumber = 0;
  let sqlPass = true, restPass = true;
  const request = async (phase, c, details, call, validate) => {
    assert.ok(receipt.attempts.length < 79, 'reader-fixed-attempt-limit');
    const attempt = { attempt: receipt.attempts.length + 1, phase,
      caseId: c?.id ?? null, generation: c?.generation ?? null, asOf: c?.asOf ?? null,
      selection: c ? { ...c.selection } : null, definitionHashes,
      ...details, status: 'pending', startedAtMs: clock(), elapsedScope: 'attempt-including-pending-persistence' };
    // The caller can recover this pending attempt even if the process is killed
    // during a request. Save rejection happens outside the transport catch.
    receipt.attempts.push(attempt);
    await save();
    let response;
    try { response = await call(); }
    catch { response = undefined; }
    const endedAtMs = clock();
    attempt.elapsedMs = Math.max(0, endedAtMs - attempt.startedAtMs);
    attempt.httpStatus = status(response?.status);
    let isolated = false;
    if (response?.ok === true && response.requestComplete === true
      && attempt.httpStatus >= 200 && attempt.httpStatus <= 299) {
      try {
        const validated = validate(response);
        isolated = validated.isolated === true;
        if (validated.failure) attempt.failure = validated.failure;
        else { attempt.summary = validated.summary; attempt.status = 'validated'; }
      } catch { attempt.failure = { kind: invalidKinds[phase], sqlstate: 'unknown', errorClass: 'unknown' }; }
      // Only this successful, fully received fixed wrapper request with its
      // recognized envelope proves the caught subtransaction can reach ROLLBACK.
      if (phase === 'reader-diagnostic-profile' || phase === 'reader-diagnostic-response') {
        const envelope = response.rows?.length === 1 ? response.rows[0]?.probe : null;
        isolated = object(envelope) && envelope.settingsVerified === true
          && (envelope.outcome === 'ok' || (envelope.outcome === 'cancelled'
            && envelope.sqlstate === '57014' && classes.has(envelope.errorClass)));
        if (isolated) attempt.settingsVerified = true;
      }
    } else {
      attempt.failure = { kind: response?.ok === false
        ? failureKinds.has(response?.failure?.kind) ? response.failure.kind : 'request-failed' : 'request-unknown',
        sqlstate: state(response?.failure?.sqlstate),
        errorClass: classes.has(response?.failure?.errorClass) ? response.failure.errorClass : 'unknown' };
    }
    if (endedAtMs < attempt.startedAtMs) {
      attempt.failure = { kind: 'clock-invalid', sqlstate: 'unknown', errorClass: 'unknown' };
      isolated = false;
    }
    if (attempt.failure) {
      attempt.status = 'incomplete';
      attempt.isolation = isolated ? 'caught-wrapper-request-complete-rollback' : 'unknown';
      if (phase === 'reader-diagnostic-rest') restPass = false;
      else sqlPass = false;
      // Preflight/readback/setup/install validation failures also stop: their
      // inputs or mutation outcome have not passed the required hard gates.
      if (!isolated || !['reader-diagnostic-profile', 'reader-diagnostic-response'].includes(phase)) stop = true;
    }
    await save(); // includes response/REST failure, BEFORE caller finally cleanup
    return attempt;
  };
  const sqlRequest = (phase, c, query, details, validate) => request(phase, c, details,
    () => sql(query, phase), validate);
  const oneRow = response => {
    assert.ok(Array.isArray(response.rows) && response.rows.length === 1 && object(response.rows[0]), 'reader-invalid-envelope');
    return response.rows[0];
  };
  await sqlRequest('reader-diagnostic-preflight', null, plan.preflightSql, {}, response => {
    assert.equal(oneRow(response).fresh_owned_fixture, true, 'reader-preflight-rejected');
    receipt.diagnostic.preflightVerified = true;
    return { summary: { freshOwnedFixture: true } };
  });
  if (stop) return receipt;
  await sqlRequest('reader-diagnostic-install', null, probe.installSql, {}, response => {
    const proof = oneRow(response);
    assert.equal(proof.installed, true, 'reader-profiler-install-rejected');
    assert.equal(proof.proofSettingsVerified, true, 'reader-profiler-install-settings-rejected');
    return { summary: { profilerInstalled: true, ownerInvokerAclSettingsVerified: true, proofSettingsVerified: true } };
  });
  if (stop) return receipt;
  for (const c of plan.cases) {
    const result = { caseId: c.id, status: 'incomplete', fixtureInput: { ...c.fixtureInput } };
    receipt.cases.push(result);
    const firstAttempt = receipt.attempts.length;
    await sqlRequest('reader-diagnostic-setup', c, c.setupSql, {}, response => {
      assert.ok(Array.isArray(response.rows), 'reader-invalid-setup-response');
      return { summary: { setupRequestComplete: true } };
    });
    if (stop) break;
    await sqlRequest('reader-diagnostic-readback', c, c.readbackSql, {}, response => {
      const summary = readerDiagnosticReadback(c.id, response.rows);
      result.readback = summary;
      return { summary };
    });
    if (stop) break;
    const unwrap = response => {
      const envelope = oneRow(response).probe;
      assert.ok(object(envelope) && envelope.settingsVerified === true, 'reader-invalid-probe-envelope');
      if (envelope.outcome === 'cancelled') {
        assert.equal(envelope.sqlstate, '57014', 'reader-invalid-cancellation');
        assert.ok(classes.has(envelope.errorClass), 'reader-invalid-cancellation');
        return { isolated: true, failure: { kind: 'sql-cancelled', sqlstate: '57014',
          errorClass: envelope.errorClass } };
      }
      assert.equal(envelope.outcome, 'ok', 'reader-invalid-probe-envelope');
      return { value: envelope.value };
    };
    for (const profile of c.profiles) {
      await sqlRequest('reader-diagnostic-profile', c, probe.query(++probeNumber),
        { scope: profile.scope, analyze: profile.analyze, planScope: profile.planScope, probe: probeNumber }, response => {
          const envelope = unwrap(response);
          if (envelope.failure) return envelope;
          const summary = projectReaderDiagnosticPlan(envelope.value, schema);
          assert.equal(typeof summary.plan['Node Type'], 'string', 'reader-invalid-plan-root');
          if (profile.analyze) for (const field of ['Planning Time', 'Execution Time']) {
            assert.equal(typeof summary[field], 'number', 'reader-incomplete-analyzed-plan');
          }
          if (profile.analyze) for (const field of ['Actual Rows', 'Actual Loops']) {
            assert.equal(typeof summary.plan[field], 'number', 'reader-incomplete-analyzed-plan');
          }
          if (profile.analyze) assert.ok(summary['Planning Time'] + summary['Execution Time'] < 2000,
            'reader-analyzed-deadline-exceeded');
          return { isolated: true, summary };
        });
      if (stop) break;
    }
    if (stop) break;
    await sqlRequest('reader-diagnostic-response', c, probe.query(++probeNumber), { probe: probeNumber }, response => {
      const envelope = unwrap(response);
      if (envelope.failure) return envelope;
      return { isolated: true, summary: assertReaderDiagnosticResponse(c.id, envelope.value) };
    });
    if (stop) break;
    for (const descriptor of c.rest) {
      const fixed = { caseId: c.id, assertion: descriptor.assertion, alias: descriptor.alias,
        body: { ...descriptor.body }, appReadMs: 3000 };
      await request('reader-diagnostic-rest', c,
        { assertion: fixed.assertion, alias: fixed.alias, selection: fixed.body, appReadMs: 3000 },
        () => rest(fixed), response => {
          assert.equal(response.appReadMs, 3000, 'reader-invalid-rest-deadline');
          assert.equal(response.bodyComplete, true, 'reader-incomplete-rest-body');
          assert.ok(typeof response.elapsedMs === 'number' && Number.isFinite(response.elapsedMs)
            && response.elapsedMs >= 0 && response.elapsedMs < 3000, 'reader-rest-deadline-exceeded');
          return { summary: { ...assertReaderDiagnosticRestResponse(c.id, fixed.assertion, response.value),
            elapsedMs: response.elapsedMs, bodyComplete: true, appReadMs: 3000 } };
        });
      if (stop) break;
    }
    if (stop) break;
    if (receipt.attempts.slice(firstAttempt).every(a => a.status === 'validated')) {
      result.status = 'validated';
      receipt.diagnostic.casesValidated++;
    }
    await save();
  }
  const sqlAttempts = receipt.attempts.filter(a => a.phase !== 'reader-diagnostic-rest');
  const restAttempts = receipt.attempts.filter(a => a.phase === 'reader-diagnostic-rest');
  receipt.diagnostic.sqlDeadline = sqlPass && sqlAttempts.length === 70 ? 'passed' : 'incomplete';
  receipt.diagnostic.restDeadline = restPass && restAttempts.length === 9 ? 'passed' : 'incomplete';
  if (receipt.diagnostic.casesValidated === 8 && receipt.diagnostic.sqlDeadline === 'passed'
    && receipt.diagnostic.restDeadline === 'passed') receipt.diagnostic.status = 'profiled';
  await save();
  return receipt;
}

/** One fixed owned-alias REST call. Deadline includes body read, UTF-8 decode and
 * JSON parse; no retry or schema-cache warmup. The race also handles an unhelpful
 * fetch seam that ignores AbortSignal. No env/credential/response logging.
 */
export function createReaderDiagnosticRest({ managedUrl, serviceKey, schema,
  fetchImpl = globalThis.fetch, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout }) {
  assert.equal(managedUrl, 'https://bbtcaurrtyoukvjbxbbj.supabase.co', 'reader-invalid-managed-target');
  assert.match(schema, /^qa_stats_[a-f0-9]{12}$/, 'reader-invalid-owned-schema');
  assert.ok(typeof serviceKey === 'string' && serviceKey.length > 0, 'reader-missing-service-key');
  const alias = `qa_${schema.slice('qa_stats_'.length)}_get_sp_platform_chart_v1`;
  return async request => {
    assert.ok(object(request) && Object.keys(request).sort().join(',') === 'alias,appReadMs,assertion,body,caseId', 'reader-invalid-rest-request');
    assert.ok(READER_DIAGNOSTIC_CASE_IDS.includes(request.caseId), 'reader-invalid-rest-case');
    assert.equal(request.alias, alias, 'reader-invalid-rest-alias');
    assert.equal(request.appReadMs, 3000, 'reader-invalid-rest-budget');
    const control = request.assertion === 'same-generation-adjacent-hourly-control';
    assert.ok(request.assertion === 'case-response' || (control && request.caseId === 'combined-empty'), 'reader-invalid-rest-selection');
    const long = request.caseId === 'long-hourly-mixture';
    const body = { p_range: long ? '90d' : '1d', p_resolution: long || control ? 'hourly' : 'daily', p_include_previous: true };
    assert.deepEqual(request.body, body, 'reader-invalid-rest-selection');
    const started = now(), controller = new AbortController();
    let timer, httpStatus = null;
    const failure = kind => ({ ok: false, status: httpStatus, appReadMs: 3000,
      requestComplete: false, failure: { kind, sqlstate: 'unknown', errorClass: 'unknown' } });
    const deadline = new Promise(resolve => {
      timer = setTimer(() => { controller.abort(); resolve(failure('rest-deadline')); }, 3000);
    });
    const operation = async () => {
      try {
        const response = await fetchImpl(`${managedUrl}/rest/v1/rpc/${alias}`, {
          method: 'POST', redirect: 'error', signal: controller.signal,
          headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        httpStatus = status(response.status);
        if (!response.ok) return failure('rest-http-failed');
        // Bound bytes while streaming instead of retaining an unbounded body.
        const reader = response.body?.getReader();
        if (!reader) return failure('rest-invalid-body');
        const chunks = []; let bytes = 0;
        while (true) {
          const chunk = await reader.read();
          const elapsed = now() - started;
          if (controller.signal.aborted || !Number.isFinite(elapsed) || elapsed < 0 || elapsed >= 3000) {
            controller.abort(); return failure('rest-deadline');
          }
          if (chunk.done) break;
          if (!(chunk.value instanceof Uint8Array)) return failure('rest-invalid-body');
          bytes += chunk.value.byteLength;
          if (bytes > READER_DIAGNOSTIC_LIMITS.maxPayloadBytes) {
            controller.abort(); void reader.cancel().catch(() => {});
            return failure('rest-body-too-large');
          }
          chunks.push(chunk.value);
        }
        const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const elapsedMs = now() - started;
        if (controller.signal.aborted || !Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs >= 3000) return failure('rest-deadline');
        return { ok: true, status: httpStatus, requestComplete: true, bodyComplete: true,
          appReadMs: 3000, elapsedMs, value };
      } catch { return failure(controller.signal.aborted ? 'rest-deadline' : 'rest-request-failed'); }
    };
    try { return await Promise.race([operation(), deadline]); }
    finally { clearTimer(timer); controller.abort(); }
  };
}
