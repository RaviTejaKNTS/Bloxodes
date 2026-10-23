import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SOURCE, APPLY_SELECTION, executionContext, validateProvenance, validateDocument,
  verifiedReceipt, cleanupSql, absenceSql, acquireSource, recover } from './stats-prepared-recover.mjs';

const REPO = 'RaviTejaKNTS/Bloxodes', ID = 1203603485;
const BRANCH = 'chore/audit-site-errors', WORKFLOW = '.github/workflows/pull-request.yml';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const clone = value => structuredClone(value);
const context = () => ({ args: ['--expected-sha', 'f'.repeat(40), '--apply-selection', APPLY_SELECTION],
  nodeVersion: '22.20.0', checkout: { root: ROOT, sha: 'f'.repeat(40), status: '' }, env: {
    GITHUB_ACTIONS: 'true', STATS_PREPARED_RECOVERY: '1', GITHUB_EVENT_NAME: 'workflow_dispatch',
    GITHUB_REPOSITORY: REPO, GITHUB_REPOSITORY_ID: String(ID), GITHUB_SHA: 'f'.repeat(40),
    GITHUB_WORKFLOW_SHA: 'f'.repeat(40), GITHUB_WORKSPACE: ROOT, GITHUB_REF_NAME: BRANCH,
    GITHUB_REF: `refs/heads/${BRANCH}`, GITHUB_WORKFLOW_REF: `${REPO}/${WORKFLOW}@refs/heads/${BRANCH}`,
    GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1', GITHUB_TOKEN: 'test',
    MANAGED_DEV_SUPABASE_URL: 'https://bbtcaurrtyoukvjbxbbj.supabase.co', MANAGED_DEV_SUPABASE_ACCESS_TOKEN: 'test' },
  event: { repository: { id: ID, full_name: REPO }, ref: `refs/heads/${BRANCH}`,
    inputs: { stats_prepared_recovery: APPLY_SELECTION } } });
const provenance = () => ({ workflow: { id: 123, path: WORKFLOW }, run: {
  id: Number(SOURCE.runId), run_attempt: 1, event: 'workflow_dispatch', status: 'completed', conclusion: 'failure',
  workflow_id: 123, path: WORKFLOW, head_sha: SOURCE.sha, head_branch: BRANCH,
  repository: { id: ID, full_name: REPO }, head_repository: { id: ID, full_name: REPO } }, artifact: {
  id: SOURCE.artifactId, size_in_bytes: SOURCE.size, name: SOURCE.artifactName,
  digest: `sha256:${SOURCE.zipSha256}`, expired: false,
  archive_download_url: `https://api.github.com/repos/${REPO}/actions/artifacts/${SOURCE.artifactId}/zip`,
  workflow_run: { id: Number(SOURCE.runId), repository_id: ID, head_repository_id: ID,
    head_sha: SOURCE.sha, head_branch: BRANCH } } });
const original = () => ({ project: 'bbtcaurrtyoukvjbxbbj', sha: SOURCE.sha, mode: 'benchmark',
  schema: SOURCE.schema, privateSchema: SOURCE.privateSchema, prefix: SOURCE.prefix,
  functions: ['get_sp_health_v1', 'get_sp_platform_chart_v1', 'get_sp_visit_share_v1', 'claim_sp_work_v1',
    'run_sp_step_v1', 'get_sp_receipt_v1', 'finish_sp_work_v1', 'timeout'].map(name => SOURCE.prefix + name),
  cleaned: false, completed: false, sqlFailure: { phase: 'fixture-checks', status: 400, sqlstate: '53100' },
  cleanupFailed: true, phases: Array.from({ length: 2 }, () => ({ phase: 'cleanup', status: 400, ok: false })) });

test('only the exact failed benchmark, artifact and manual selection are accepted', () => {
  assert.ok(Object.isFrozen(SOURCE)); assert.equal(SOURCE.artifactId, 12510770736);
  assert.equal(SOURCE.size, 1249); assert.equal(APPLY_SELECTION, 'reconcile-39973670048');
  assert.equal(executionContext(context()).sha, 'f'.repeat(40));
  const changes = [
    c => { c.args.push('--schema', 'public'); }, c => { c.args[3] = 'reconcile-39973670576'; },
    c => { c.env.GITHUB_EVENT_NAME = 'pull_request'; }, c => { c.env.STATS_PREPARED_RECOVERY = ''; },
    c => { c.env.GITHUB_REPOSITORY_ID = '1'; }, c => { c.event.repository.id = 1; },
    c => { c.env.GITHUB_SHA = SOURCE.sha; }, c => { c.env.GITHUB_WORKFLOW_SHA = SOURCE.sha; },
    c => { c.checkout.status = ' M unexpected'; }, c => { c.env.GITHUB_WORKSPACE = '/tmp'; },
    c => { c.env.GITHUB_REF_NAME = 'production'; }, c => { c.env.GITHUB_RUN_ID = '1\nSECRET'; },
    c => { c.env.SUPABASE_SERVICE_ROLE = 'unexpected'; }, c => { c.env.PRODUCTION_TOKEN = 'unexpected'; },
    c => { c.env.MANAGED_DEV_SUPABASE_URL = 'https://database.bloxodes.com'; },
    c => { c.event.inputs.stats_prepared_recovery = 'true'; }, c => { c.nodeVersion = '24.0.0'; }
  ];
  for (const change of changes) { const c = context(); change(c); assert.throws(() => executionContext(c)); }
});

test('source provenance binds dispatch event, repository, original head, attempt, artifact and digest', () => {
  const p = provenance(); validateProvenance(p.run, p.artifact, p.workflow);
  for (const [key, value] of Object.entries({ id: 1, run_attempt: 2, event: 'pull_request', status: 'in_progress',
    conclusion: 'success', head_sha: 'f'.repeat(40), head_branch: 'production', path: 'other.yml', workflow_id: 1 })) {
    assert.throws(() => validateProvenance({ ...p.run, [key]: value }, p.artifact, p.workflow));
  }
  for (const [key, value] of Object.entries({ id: 1, size_in_bytes: 1250, name: 'other', expired: true,
    digest: `sha256:${'f'.repeat(64)}`, archive_download_url: 'https://example.com' })) {
    assert.throws(() => validateProvenance(p.run, { ...p.artifact, [key]: value }, p.workflow));
  }
  const altered = clone(p.artifact); altered.workflow_run.head_repository_id = 1;
  assert.throws(() => validateProvenance(p.run, altered, p.workflow));
});

test('identity validation rejects the second absent run and preserves original failed state', () => {
  const value = original(), before = clone(value); validateDocument(value); assert.deepEqual(value, before);
  for (const change of [r => { r.schema = 'qa_stats_8d01a9f00c9e'; }, r => { r.completed = true; },
    r => { r.cleaned = true; }, r => { r.functions.push('unrelated'); }, r => { r.drives = []; },
    r => { r.sqlFailure.sqlstate = '25006'; }, r => { r.phases.pop(); }]) {
    const r = original(); change(r); assert.throws(() => validateDocument(r));
  }
  for (const bytes of [Buffer.alloc(0), Buffer.alloc(1249), Buffer.alloc(1250)]) {
    assert.throws(() => verifiedReceipt(bytes), /source_zip_digest_mismatch/);
  }
});

test('recovery refuses database access after acquisition, digest or persistence failure', async () => {
  for (const acquire of [async () => { throw Error('SECRET'); },
    async () => ({ zip: Buffer.alloc(1249), original: Buffer.from(JSON.stringify(original())) })]) {
    let calls = 0, saved = 0;
    const receipt = { status: 'not_started', sourceValidated: false, absenceProven: false };
    await recover({ receipt, acquire, persist: async () => { saved++; }, query: async () => { calls++; } });
    assert.equal(calls, 0); assert.equal(receipt.status, 'failed'); assert.equal(receipt.absenceProven, false);
    assert.equal(receipt.sourceValidated, false); assert.ok(saved >= 2);
    assert.doesNotMatch(JSON.stringify(receipt), /SECRET/);
  }
  let acquired = false;
  await assert.rejects(recover({ receipt: {}, acquire: async () => { acquired = true; },
    persist: async () => { throw Error('disk'); }, query: async () => assert.fail('no query') }));
  assert.equal(acquired, false);
});

test('untrusted archive redirects never receive the GitHub token or reach the database', async () => {
  const p = provenance(); let calls = 0;
  await assert.rejects(acquireSource('SECRET_TOKEN', async (url, options) => {
    calls++;
    assert.equal(options.headers.Authorization, 'Bearer SECRET_TOKEN');
    if (url.endsWith('/zip')) return new Response(null, { status: 302, headers: { location: 'https://attacker.example/archive' } });
    const data = url.endsWith('pull-request.yml') ? p.workflow : url.includes('/actions/runs/') ? p.run : p.artifact;
    return Response.json(data);
  }), /source_download_host/);
  assert.equal(calls, 4);
});

test('original evidence is durable before mutation and only independent absence permits reconciliation', async () => {
  for (const failure of [null, 'cleanup', 'bad-drop', 'absence', 'bad-absence', 'evidence']) {
    const order = [], bytes = Buffer.from(JSON.stringify(original())), frozen = Buffer.from(bytes);
    const receipt = { status: 'not_started', sourceValidated: false, absenceProven: false,
      historicalCompleted: false, historicalCleaned: false };
    await recover({ receipt, verify: () => bytes, acquire: async () => ({ zip: Buffer.from('test-seam'), original: bytes }),
      persist: async bundle => {
        if (bundle) { order.push('evidence'); if (failure === 'evidence') throw Error('SECRET'); }
      }, query: async (sql, phase) => {
        assert.equal(receipt.sourceValidated, true); assert.equal(order[0], 'evidence'); order.push(phase);
        if (phase === failure) throw Error('SECRET_SQL');
        return phase === 'absence' ? [{ absent: failure !== 'bad-absence' }] : [{ guardedDropCommitted: failure !== 'bad-drop' }];
      } });
    assert.deepEqual(bytes, frozen);
    assert.equal(receipt.historicalCompleted, false); assert.equal(receipt.historicalCleaned, false);
    assert.equal(receipt.absenceProven, failure === null);
    assert.equal(receipt.status, failure === null ? 'reconciled' : 'failed');
    assert.doesNotMatch(JSON.stringify(receipt), /SECRET/);
    if (['cleanup', 'bad-drop'].includes(failure)) assert.deepEqual(order, ['evidence', 'cleanup']);
    if (failure === 'evidence') assert.deepEqual(order, ['evidence']);
    if (failure === null) assert.deepEqual(order, ['evidence', 'cleanup', 'absence']);
  }
});

test('cleanup uses only exact names, transaction-only write access, guarded ownership and RESTRICT', () => {
  const sql = cleanupSql(), absence = absenceSql();
  assert.match(sql, /^begin;\nset transaction read write;/);
  assert.match(sql, /recovery_ownership_mismatch/); assert.match(sql, /recovery_external_relation_dependency/);
  assert.match(sql, /recovery_external_fk_dependency/);
  assert.match(sql, /execute 'drop table '\|\|table_list\|\|' restrict'/);
  assert.match(sql, /recovery_function_mismatch/); assert.match(sql, /dependent_objects_still_exist/);
  assert.match(sql, /drop schema if exists qa_stats_681b32f02ed9 restrict/);
  assert.match(sql, /drop schema if exists qa_stats_681b32f02ed9_p restrict/);
  assert.match(sql, /r\.args='uuid, bigint, uuid, jsonb'/);
  assert.doesNotMatch(sql, /\bcascade\b|alter\s+(?:database|role|system)|default_transaction_read_only|set session|\b(?:delete|truncate|vacuum)\b/i);
  assert.doesNotMatch(sql, /qa_stats_8d01a9f00c9e|database\.bloxodes\.com/);
  assert.match(absence, /^select not exists/); assert.match(absence, /pg_namespace/); assert.match(absence, /pg_proc/);
  assert.doesNotMatch(absence, /\b(?:drop|create|update|delete|set)\b/i);
});

// These are disposable PostgreSQL cleanup-contract tests, never managed-project
// recovery or benchmark substitutes. No subprocess/database call runs by default.
const CONTRACT_URL = 'postgresql://postgres:ci-only@localhost:5432/postgres';
function contractContext(env) {
  assert.equal(env.STATS_PREPARED_RECOVERY_CONTRACT, '1', 'contract requires explicit flag=1');
  assert.equal(env.GITHUB_ACTIONS, 'true', 'contract is GitHub-only');
  // Exact credentials, loopback host, port, database and no URL options. Avoid
  // libpq query/service/host overrides, alternate projects and live credentials.
  assert.equal(env.CI_TRANSACTION_DATABASE_URL, CONTRACT_URL, 'contract requires the exact disposable loopback URL');
  assert.ok(!Object.entries(env).some(([key, value]) => value &&
    (/SUPABASE/i.test(key) || /(?:PROD|PRODUCTION).*(?:TOKEN|KEY|SECRET|PASSWORD|URL)|(?:TOKEN|KEY|SECRET|PASSWORD).*PROD/i.test(key))),
  'contract must run before managed or production credentials are exposed');
  return CONTRACT_URL;
}

test('PostgreSQL contract refuses missing opt-in, non-GitHub, non-loopback and credential-bearing contexts', () => {
  const good = { GITHUB_ACTIONS: 'true', STATS_PREPARED_RECOVERY_CONTRACT: '1',
    CI_TRANSACTION_DATABASE_URL: CONTRACT_URL };
  assert.equal(contractContext(good), CONTRACT_URL);
  for (const patch of [
    { STATS_PREPARED_RECOVERY_CONTRACT: undefined }, { STATS_PREPARED_RECOVERY_CONTRACT: '' },
    { STATS_PREPARED_RECOVERY_CONTRACT: 'true' }, { GITHUB_ACTIONS: undefined },
    { GITHUB_ACTIONS: 'false' }, { CI_TRANSACTION_DATABASE_URL: undefined },
    { CI_TRANSACTION_DATABASE_URL: 'postgresql://postgres:ci-only@bbtcaurrtyoukvjbxbbj.supabase.co:5432/postgres' },
    { CI_TRANSACTION_DATABASE_URL: CONTRACT_URL + '?host=remote.example' },
    { CI_TRANSACTION_DATABASE_URL: CONTRACT_URL.replace(/\/postgres$/, '/production') },
    { MANAGED_DEV_SUPABASE_ACCESS_TOKEN: 'unexpected' }, { PRODUCTION_TOKEN: 'unexpected' },
    { TOKEN_PRODUCTION: 'unexpected' }
  ]) assert.throws(() => contractContext({ ...good, ...patch }));
});

test('GitHub PostgreSQL 17 executes the exact generated cleanup contract', {
  skip: !Object.hasOwn(process.env, 'STATS_PREPARED_RECOVERY_CONTRACT'), timeout: 180000
}, async t => {
  const adminUrl = contractContext(process.env); // Must precede every subprocess.
  const psql = (url, sql) => {
    const result = spawnSync('psql', [url, '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], {
      input: sql, encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024,
      // Do not inherit PGOPTIONS, PGSERVICE, credentials or provider env.
      env: { PATH: process.env.PATH, LANG: 'C', LC_ALL: 'C', PGCONNECT_TIMEOUT: '5',
        PGSSLMODE: 'disable', PGAPPNAME: 'stats-prepared-recovery-contract' }
    });
    assert.ifError(result.error);
    return result;
  };
  const query = (url, sql) => {
    const result = psql(url, sql);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  assert.equal(query(adminUrl, "select current_setting('server_version_num')::int / 10000;"), '17');
  const s = SOURCE.schema, p = SOURCE.privateSchema;
  // Deliberately independent signature manifest, checked by the real SQL guard.
  const aliases = [ ['get_sp_health_v1', ''], ['get_sp_platform_chart_v1', 'text,text,boolean'],
    ['get_sp_visit_share_v1', 'text'], ['claim_sp_work_v1', 'text,uuid'],
    ['run_sp_step_v1', 'uuid,bigint,uuid,jsonb'], ['get_sp_receipt_v1', 'uuid'],
    ['finish_sp_work_v1', 'uuid,bigint,jsonb'], ['timeout', ''] ];
  const fixture = `
    create schema ${s}; create schema ${p};
    create sequence public.recovery_contract_external_sequence;
    create table ${s}.stats_prepared_versions (
      id bigint generated always as identity primary key,
      source_id bigint default nextval('public.recovery_contract_external_sequence'::regclass), payload text);
    alter table ${s}.stats_prepared_versions alter column payload set storage external;
    create index recovery_contract_attached_index on ${s}.stats_prepared_versions(source_id);
    insert into ${s}.stats_prepared_versions(payload)
      select string_agg(md5(i::text),'') from generate_series(1,512) i;
    create table ${s}.stats_prepared_control (id bigint primary key,
      version_id bigint references ${s}.stats_prepared_versions(id));
    create function ${p}.stats_prepared_capture_v1() returns trigger language plpgsql
      as $$ begin return new; end; $$;
    create trigger recovery_contract_capture before insert on ${s}.stats_prepared_control
      for each row execute function ${p}.stats_prepared_capture_v1();
    create function ${p}.stats_prepared_row_v1(${s}.stats_prepared_versions) returns bigint
      language sql as $$ select ($1).id $$;
    ${aliases.map(([name, args]) => `create function public.${SOURCE.prefix}${name}(${args}) returns void
      language plpgsql as $$ begin return; end; $$;`).join('\n')}
  `;
  // OID and definition identity before/after failure proves the entire transaction
  // rolled back, including explicit trigger/function drops before final RESTRICT.
  const snapshot = `select json_build_object(
    'schemas',(select json_agg(row(oid,nspname,nspowner)::text order by oid) from pg_namespace
      where nspname in ('${s}','${p}')),
    'relations',(select json_agg(row(c.oid,c.relname,c.relkind,c.relowner,c.reltoastrelid)::text order by c.oid)
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('${s}','${p}','public')),
    'functions',(select json_agg(row(f.oid,f.proowner,pg_get_functiondef(f.oid))::text order by f.oid)
      from pg_proc f join pg_namespace n on n.oid=f.pronamespace where n.nspname in ('${s}','${p}','public')),
    'types',(select json_agg(row(y.oid,y.typname,y.typowner)::text order by y.oid)
      from pg_type y join pg_namespace n on n.oid=y.typnamespace where n.nspname in ('${s}','${p}','public')),
    'constraints',(select json_agg(row(c.oid,c.conrelid,c.confrelid,pg_get_constraintdef(c.oid))::text order by c.oid)
      from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname in ('${s}','${p}','public')),
    'triggers',(select json_agg(row(g.oid,g.tgrelid,g.tgfoid,g.tgconstraint,pg_get_triggerdef(g.oid))::text order by g.oid)
      from pg_trigger g join pg_class c on c.oid=g.tgrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname in ('${s}','${p}','public')))::text;`;
  let serial = 0;
  const withFixture = async run => {
    const database = `stats_prepared_recovery_contract_${++serial}`;
    // CREATE must fail on an existing database. Never adopt or reset one.
    query(adminUrl, `create database ${database};`);
    const url = adminUrl.replace(/\/postgres$/, `/${database}`);
    try {
      query(url, fixture);
      await run(url);
    } finally {
      query(adminUrl, `drop database ${database};`);
    }
  };
  const committedAndAbsent = url => {
    assert.equal(query(url, cleanupSql()), 't', 'generated SQL must acknowledge its committed drop');
    // New psql process/connection after committed DROP, never same-transaction proof.
    assert.equal(query(url, absenceSql()), 't');
  };
  const refusedWithoutMutation = (url, reason) => {
    const before = query(url, snapshot);
    const result = psql(url, cleanupSql());
    assert.notEqual(result.status, 0, 'cleanup must fail closed');
    assert.match(result.stderr, reason);
    assert.equal(result.stdout.trim(), '', 'failed cleanup cannot acknowledge commit');
    assert.equal(query(url, snapshot), before, 'constraints, triggers and all fixture objects must survive rollback');
    assert.equal(query(url, absenceSql()), 'f');
  };

  await t.test('acyclic FKs, all eight aliases, trigger/row type, TOAST, indexes and owned sequence', () =>
    withFixture(url => {
      const artifacts = JSON.parse(query(url, `select json_build_object(
        'toast',c.reltoastrelid,'toastBytes',pg_relation_size(c.reltoastrelid),
        'index',(select oid from pg_class where relnamespace='${s}'::regnamespace
          and relname='recovery_contract_attached_index'),
        'sequence',pg_get_serial_sequence('${s}.stats_prepared_versions','id')::regclass::oid,
        'rowType',c.reltype)::text from pg_class c where c.oid='${s}.stats_prepared_versions'::regclass;`));
      assert.ok(artifacts.toast > 0 && artifacts.toastBytes > 0 && artifacts.index > 0 && artifacts.sequence > 0);
      const externalSequence = query(url, `select 'public.recovery_contract_external_sequence'::regclass::oid,
        last_value from public.recovery_contract_external_sequence;`);
      committedAndAbsent(url);
      assert.equal(query(url, `select count(*) from pg_class where oid in
        (${artifacts.toast},${artifacts.index},${artifacts.sequence});`), '0');
      assert.equal(query(url, `select count(*) from pg_type where oid=${artifacts.rowType};`), '0');
      assert.equal(query(url, `select 'public.recovery_contract_external_sequence'::regclass::oid,
        last_value from public.recovery_contract_external_sequence;`), externalSequence);
      committedAndAbsent(url); // Complete absence is idempotent.
    }));

  await t.test('synthetic two-table FK cycle cleans atomically and remains idempotent', () =>
    withFixture(url => {
      query(url, `alter table ${s}.stats_prepared_versions add column control_id bigint;
        alter table ${s}.stats_prepared_versions add constraint recovery_contract_cycle
        foreign key(control_id) references ${s}.stats_prepared_control(id);`);
      assert.equal(query(url, `select count(*) from pg_constraint where contype='f'
        and connamespace='${s}'::regnamespace;`), '2');
      committedAndAbsent(url); committedAndAbsent(url);
    }));

  for (const direction of ['inbound', 'outbound']) {
    await t.test(`external ${direction} FK and its triggers survive refusal before mutation`, () =>
      withFixture(url => {
        query(url, `create table public.recovery_contract_external(id bigint primary key, version_id bigint);
          ${direction === 'inbound' ? `alter table public.recovery_contract_external add constraint recovery_contract_external_fk
            foreign key(version_id) references ${s}.stats_prepared_versions(id);` :
          `alter table ${s}.stats_prepared_control add constraint recovery_contract_external_fk
            foreign key(id) references public.recovery_contract_external(id);`}`);
        assert.equal(query(url, `select count(*) from pg_trigger t join pg_constraint c on c.oid=t.tgconstraint
          where c.conname='recovery_contract_external_fk';`), '4');
        refusedWithoutMutation(url, /recovery_external_fk_dependency/);
      }));
  }

  for (const [kind, object, reason] of [
    ['schema', s, /recovery_ownership_mismatch/],
    ['table', `${s}.stats_prepared_control`, /recovery_relation_mismatch/],
    ['function', `public.${SOURCE.prefix}get_sp_health_v1()`, /recovery_function_mismatch/]
  ]) {
    await t.test(`wrong ${kind} owner fails closed even for a superuser caller`, () => {
      const role = 'stats_prepared_recovery_contract_other_owner';
      query(adminUrl, `create role ${role} nologin;`);
      return withFixture(url => {
        query(url, `alter ${kind} ${object} owner to ${role};`);
        refusedWithoutMutation(url, reason);
      }).finally(() => query(adminUrl, `drop role ${role};`));
    });
  }

  const refusals = [
    ['unknown table', `create table ${s}.unexpected(id bigint);`, /recovery_relation_mismatch/],
    ['unknown standalone type', `create type ${s}.unexpected as enum ('keep');`, /depend/],
    ['unexpected public overload', `create function public.${SOURCE.prefix}get_sp_health_v1(text)
      returns void language plpgsql as $$ begin return; end; $$;`, /recovery_function_mismatch/],
    ['external view', `create view public.recovery_contract_view as select id from ${s}.stats_prepared_versions;`, /depend/],
    ['external row-type function', `create function public.recovery_contract_row(${s}.stats_prepared_versions)
      returns bigint language sql as $$ select ($1).id $$;`, /depend/],
    ['external trigger using owned function', `create table public.recovery_contract_trigger_table(id bigint);
      create trigger recovery_contract_external_capture before insert on public.recovery_contract_trigger_table
      for each row execute function ${p}.stats_prepared_capture_v1();`, /depend/]
  ];
  for (const [label, setup, reason] of refusals) {
    await t.test(`${label} prevents cleanup and rolls back all owned drops`, () =>
      withFixture(url => { query(url, setup); refusedWithoutMutation(url, reason); }));
  }

  await t.test('READ WRITE is transaction-only when the connection default is read-only', () =>
    withFixture(url => {
      // Test-session setup only. Generated recovery SQL is passed unchanged.
      assert.equal(query(url, `set default_transaction_read_only=on;
        ${cleanupSql()}
        show default_transaction_read_only; show transaction_read_only;`), 't\non\non');
      assert.equal(query(url, absenceSql()), 't');
      assert.equal(query(url, `set default_transaction_read_only=on;
        ${cleanupSql()}
        show default_transaction_read_only; show transaction_read_only;`), 't\non\non');
      assert.equal(query(url, absenceSql()), 't');
    }));
});
