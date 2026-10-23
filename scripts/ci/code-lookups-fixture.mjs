/** Fixed, run-owned public relations for real PostgREST QA. No transport or env loading. */
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

export const PROJECT = 'bbtcaurrtyoukvjbxbbj';
export const TARGET = `https://${PROJECT}.supabase.co`;
export const MIGRATION = 'supabase/migrations/20260918000001_rename_games_to_code_pages.sql';
export const CASES = Object.freeze([999, 1000, 1001, 2000]);
export class QaFailure extends Error {}
export const need = (ok, name) => { if (!ok) throw new QaFailure(name); };
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
const hash = value => createHash('sha256').update(value).digest('hex');
const pageId = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const PAGES = Object.freeze({ sizes: CASES.map((count, i) => ({ count, id: pageId(i + 1) })),
  draft: pageId(5), empty: pageId(6), missing: pageId(7) });

export function fixtureIdentity({ sha, runId, attempt, nonce }) {
  need(/^[a-f0-9]{40}$/.test(sha) && /^\d{1,20}$/.test(runId) && /^\d{1,6}$/.test(attempt) &&
    /^[a-f0-9]{24}$/.test(nonce), 'fixture_identity_inputs');
  const prefix = `qa_cl_${hash(`${sha}:${runId}:${attempt}:${nonce}`).slice(0, 16)}`;
  return { version: 1, project: PROJECT, sha, runId, attempt, nonce, schema: 'public',
    names: { pages: `${prefix}_pages`, codes: `${prefix}_codes`, universes: `${prefix}_universes`, oracle: `${prefix}_oracle` } };
}
export function validateIdentity(value, context) {
  need(value && isDeepStrictEqual(value, fixtureIdentity({ ...context, nonce: value.nonce })), 'fixture_identity_allowlist');
  return value;
}
// File states distinguish ENOENT from an empty, corrupt, or unreadable recovery file.
// This is the cleanup CLI's actual decision path; it performs no I/O or guessed cleanup.
export function cleanupRecovery({ identityFile, backendFile, context }) {
  const decision = { identity: null, canSave: false, notStarted: false, failure: null,
    receipt: { version: 2, ...context, checks: [], requests: [], sql: [], status: 'running' } };
  const fail = name => {
    decision.failure = name;
    decision.receipt.checks.push({ name, status: 'fail' });
    decision.receipt.status = 'fail';
    return decision;
  };
  if (identityFile.state === 'missing') {
    if (backendFile.state !== 'missing') return fail('cleanup_identity_missing_with_backend_evidence');
    decision.notStarted = true; decision.receipt.status = 'not_started'; return decision;
  }
  if (identityFile.state !== 'present') return fail('cleanup_identity_unreadable');
  try { decision.identity = validateIdentity(JSON.parse(identityFile.text), context); }
  catch { return fail('cleanup_identity_invalid'); }
  decision.receipt.fixture = decision.identity;
  // Only the independently validated durable identity authorizes database cleanup.
  if (backendFile.state === 'missing') {
    decision.canSave = true; return fail('interrupted_or_missing_verification');
  }
  if (backendFile.state !== 'present') return fail('cleanup_backend_unreadable');
  let prior;
  try { prior = JSON.parse(backendFile.text); }
  catch { return fail('cleanup_backend_invalid'); }
  decision.canSave = true;
  if (!(prior?.version === 2 && prior.sha === context.sha && prior.runId === context.runId &&
    prior.attempt === context.attempt && Array.isArray(prior.checks) && Array.isArray(prior.sql) &&
    isDeepStrictEqual(prior.fixture, decision.identity))) {
    // Preserve the previous receipt as history, never as verification for this fixture.
    decision.receipt.recovery = { historicalBackend: prior };
    return fail('cleanup_backend_identity_mismatch');
  }
  decision.receipt = structuredClone(prior);
  const failed = prior.checks.some(check => check?.status === 'fail');
  const completed = prior.checks.some(check => check?.name === 'required_fixture_compatibility' && check.status === 'pass');
  if (!completed || (prior.status !== 'pass' && !failed)) return fail('verification_not_completed');
  decision.receipt.status = failed ? 'fail' : 'pass';
  return decision;
}
const marker = identity => `code-lookups-qa@1:${identity.sha}:${identity.runId}:${identity.attempt}:${identity.nonce}`;
const relations = identity => Object.values(identity.names).map(name => `public.${name}`);

const SQL_PHASES = new Set(['create_and_seed_owned_fixture', 'inspect_fixture_security_and_storage',
  'cleanup_exact_owned_relations']);
const SQL_CLASSES = Object.freeze({ '42601': 'syntax_error', '42501': 'insufficient_privilege',
  '2BP01': 'dependent_objects', '42P01': 'undefined_relation', '42809': 'wrong_object_type',
  '55P03': 'lock_unavailable', '57014': 'query_canceled', '40P01': 'deadlock', '25P02': 'transaction_aborted' });
// Management errors may wrap PostgreSQL's prefix in message/error objects or JSON
// strings. Inspect only bounded, known envelope fields; emit no source text.
export function sqlFailureDiagnostic({ phase, result, query }) {
  need(SQL_PHASES.has(phase) && typeof query === 'string', 'sql_diagnostic_inputs');
  const diagnostic = { phase, sqlstate: 'unknown', errorClass: 'unknown' };
  const states = new Set(), primaries = [], texts = [], positions = [];
  const state = value => { if (typeof value === 'string' && /^[A-Z0-9]{5}$/.test(value)) states.add(value); };
  const queue = [{ value: result, depth: 0 }];
  for (let i = 0; i < queue.length && i < 16; i++) {
    const { value, depth } = queue[i];
    if (typeof value === 'string') {
      if (value.length > 65536) continue;
      texts.push(value);
      const prefix = /^(?:Failed to run sql query: )?ERROR:[ \t]+([A-Z0-9]{5}):[ \t]*([^\r\n]*)/.exec(value);
      if (prefix) { state(prefix[1]); primaries.push(prefix[2]); }
      else primaries.push(value);
      if (depth < 3 && /^[\s]*[{"]/.test(value)) {
        try { queue.push({ value: JSON.parse(value), depth: depth + 1 }); } catch { /* unknown envelope */ }
      }
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      state(value.code); state(value.sqlstate);
      positions.push(value.position);
      // Context is inspected only for an anonymous block's bounded line number.
      for (const key of ['context', 'where']) if (typeof value[key] === 'string' && value[key].length <= 65536) texts.push(value[key]);
      if (depth < 3) for (const key of ['error', 'message', 'data']) queue.push({ value: value[key], depth: depth + 1 });
    }
  }
  // Conflicting envelopes must not misattribute a state or its message class.
  if (states.size !== 1) return diagnostic;
  diagnostic.sqlstate = [...states][0];
  diagnostic.errorClass = SQL_CLASSES[diagnostic.sqlstate] ?? 'unknown';
  if (diagnostic.sqlstate === 'P0001') {
    for (const message of ['fixture_cleanup_ownership_mismatch', 'fixture_name_collision']) {
      if (primaries.includes(message)) diagnostic.errorClass = message;
    }
  }
  const maxLine = query.split('\n').length;
  for (const text of texts) {
    const line = /^LINE ([1-9][0-9]{0,5}):/m.exec(text);
    if (line && Number(line[1]) <= maxLine) diagnostic.reportedLine ??= Number(line[1]);
    const frame = /^(?:CONTEXT:[ \t]*)?PL\/pgSQL function inline_code_block line ([1-9][0-9]{0,5}) at [^\r\n]+$/m.exec(text);
    if (frame && Number(frame[1]) <= maxLine) diagnostic.blockLine ??= Number(frame[1]);
  }
  for (const position of positions) {
    if ((typeof position === 'string' || Number.isSafeInteger(position)) &&
      /^[1-9][0-9]{0,8}$/.test(String(position)) && Number(position) <= query.length) {
      diagnostic.position = Number(position); break;
    }
  }
  return diagnostic;
}

export function oracleDefinition(source, identity) {
  const start = 'create or replace view public.code_pages_view with (security_invoker = true) as\n';
  const end = '\ncreate or replace view public.code_page_code_stats';
  need(source.split(start).length === 2 && source.includes(end), 'canonical_view_boundaries');
  const canonical = source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))).trim();
  need(canonical.endsWith(';') && canonical.split(';').length === 2 &&
    canonical.includes('jsonb_agg(c.* order by c.status, c.last_seen_at desc)') &&
    canonical.includes("count(*) filter (where c.status = 'active')"), 'canonical_view_shape');
  const map = { code_pages_view: identity.names.oracle, code_pages: identity.names.pages,
    codes: identity.names.codes, roblox_universes: identity.names.universes };
  const sql = canonical.replace('create or replace view', 'create view').replace(/public\.([a-z_]+)/g, (_, name) => {
    need(Object.hasOwn(map, name), 'canonical_view_dependency_allowlist'); return `public.${map[name]}`;
  });
  return { sql, sha256: hash(canonical) };
}
// All entry points accept only an identity reconstructed and validated by the caller.
const lock = identity => `select pg_advisory_xact_lock(hashtextextended(${literal(marker(identity))},0));`;

export function setupSql(identity, oracle) {
  const { pages, codes, universes, oracle: view } = identity.names;
  // Reset inherited default ACLs on owned objects, including any nonstandard role.
  const acl = name => `revoke all on public.${name} from public,anon,authenticated,service_role;
    do $qa$ declare r record; begin
      for r in select distinct a.grantee from pg_class c,
        lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
        where c.oid='public.${name}'::regclass and a.grantee not in (0,c.relowner) loop
        execute format('revoke all on public.%I from %I','${name}',(select rolname from pg_roles where oid=r.grantee));
      end loop;
    end $qa$;
    grant select on public.${name} to service_role;`;
  const clone = (name, source) => `create table public.${name} (like public.${source} including all);
    comment on table public.${name} is ${literal(marker(identity))};
    alter table public.${name} enable row level security;
    ${acl(name)}`;
  return `begin;
    ${lock(identity)}
    do $qa$ begin
      if exists(select 1 from pg_class where relnamespace='public'::regnamespace and relname in
        (${Object.values(identity.names).map(literal).join(',')})) then raise exception 'fixture_name_collision'; end if;
    end $qa$;
    ${clone(universes, 'roblox_universes')}
    ${clone(pages, 'code_pages')}
    ${clone(codes, 'codes')}
    alter table public.${pages} add foreign key(universe_id) references public.${universes}(universe_id);
    alter table public.${codes} add foreign key(code_page_id) references public.${pages}(id) on delete cascade;
    insert into public.${pages}(id,name,slug,is_published,updated_at) values
      ${[...PAGES.sizes.map(({ count, id }) => `('${id}','QA ${count}','qa-${count}',true,'2026-10-20T00:00:00Z')`),
        `('${PAGES.draft}','QA draft','qa-draft',false,'2026-10-20T00:00:00Z')`,
        `('${PAGES.empty}','QA empty','qa-empty',true,'2026-10-20T00:00:00Z')`].join(',')};
    ${PAGES.sizes.map(({ count, id }, i) => `insert into public.${codes}
      (id,code_page_id,code,status,rewards_text,level_requirement,is_new,first_seen_at,last_seen_at,posted_online,provider_priority)
      select ('00000000-0000-4000-8000-'||lpad((${(i + 1) * 10000}+n)::text,12,'0'))::uuid,'${id}',
        'QA_'||n,case when n=${count} then 'expired' when n=${count - 1} then 'check' else 'active' end,
        case when n%2=0 then null else 'QA reward' end,case when n%3=0 then null else n%10 end,
        case when n%5=0 then null else n%2=0 end,
        '2026-10-20T00:00:00.123456Z'::timestamptz+n*interval '1 second',
        '2026-10-23T00:00:00.654321Z'::timestamptz+(n%5=0)::integer*interval '1 second',n%2=0,n%3
      from generate_series(1,${count}) n;`).join('\n')}
    insert into public.${codes}(id,code_page_id,code,status)
      values('00000000-0000-4000-8000-000000050001','${PAGES.draft}','QA_DRAFT','active');
    ${[universes, pages, codes].map(name => `alter table public.${name} force row level security;`).join('\n')}
    ${oracle.sql}
    comment on view public.${view} is ${literal(marker(identity))};
    ${acl(view)}
    notify pgrst,'reload schema';
    commit;`;
}

export function inspectSql(identity) {
  const names = relations(identity).map(name => `${literal(name)}::regclass`).join(',');
  return `select c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,
    obj_description(c.oid,'pg_class')=${literal(marker(identity))} as owned,
    has_table_privilege('service_role',c.oid,'SELECT') as service_select,
    has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as anon_access,
    has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as user_access,
    exists(select 1 from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      where a.grantee not in (c.relowner,(select oid from pg_roles where rolname='service_role'))) as other_access,
    exists(select 1 from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal) as application_triggers,
    exists(select 1 from pg_attrdef d where d.adrelid=c.oid and pg_get_expr(d.adbin,d.adrelid) like '%nextval%') as shared_sequence_default,
    (select count(*)::integer from pg_constraint f where f.conrelid=c.oid and f.contype='f') as foreign_keys,
    (select count(*)=1 and bool_and(f.convalidated and
      f.conkey=array[(select attnum from pg_attribute where attrelid=f.conrelid and attname='code_page_id')] and
      f.confkey=array[(select attnum from pg_attribute where attrelid=f.confrelid and attname='id')])
      from pg_constraint f where f.conrelid='public.codes'::regclass and
        f.confrelid='public.code_pages'::regclass and f.contype='f') as source_fk_ok,
    exists(select 1 from pg_constraint f where f.conrelid=c.oid and f.contype='f' and f.confrelid not in (${names})) as external_fk,
    coalesce(c.reloptions,'{}') as options,
    case when c.relkind='r' then pg_total_relation_size(c.oid)::integer else 0 end as bytes
    from pg_class c where c.oid in (${names}) order by c.relname;`;
}

export function cleanupSql(identity) {
  const { oracle, codes, pages, universes } = identity.names;
  return `begin;
    ${lock(identity)}
    do $qa$ declare r record; begin
      for r in select c.oid,c.relname,c.relkind,c.relowner,obj_description(c.oid,'pg_class') as owner_marker
        from pg_class c where c.relnamespace='public'::regnamespace and c.relname in
        (${Object.values(identity.names).map(literal).join(',')}) loop
        if r.owner_marker is distinct from ${literal(marker(identity))}
          or r.relowner <> (select oid from pg_roles where rolname=current_user)
          or r.relkind <> case when r.relname=${literal(oracle)} then 'v'::"char" else 'r'::"char" end
        then raise exception 'fixture_cleanup_ownership_mismatch'; end if;
      end loop;
    end $qa$;
    drop view if exists public.${oracle};
    drop table if exists public.${codes};
    drop table if exists public.${pages};
    drop table if exists public.${universes};
    notify pgrst,'reload schema';
    commit;
    select ${relations(identity).map(name => `to_regclass(${literal(name)}) is null`).join(' and ')} as cleaned;`;
}
