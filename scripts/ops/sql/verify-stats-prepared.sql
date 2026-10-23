-- READ ONLY production/managed-development verification. Execute on GitHub only.
-- Metadata and prepared rows only; no source exact-counts/ANALYZE/writes.
begin read only;
set local statement_timeout='5s';
set local lock_timeout='500ms';
select public.get_stats_prepared_health_v1() as prepared_health;
select p.proname,p.provolatile,p.prosecdef,p.proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
 'get_stats_prepared_platform_chart_v1','get_stats_prepared_visit_share_v1',
 'get_stats_prepared_health_v1','claim_stats_prepared_work_v1','run_stats_prepared_step_v1',
 'get_stats_prepared_receipt_v1','finish_stats_prepared_work_v1') order by p.proname;
select tablename,rowsecurity from pg_tables
 where schemaname='public' and tablename like 'stats_prepared_%' order by tablename;
-- Whitelist only timeout/hoisting settings. Never dump complete rolconfig,
-- database settings, connection strings, JWT config or complete process env.
select r.rolname,s.setting from pg_roles r
cross join lateral unnest(coalesce(r.rolconfig,array[]::text[])) s(setting)
where r.rolname in ('authenticator','service_role') and
 s.setting ~ '^(statement_timeout|lock_timeout|pgrst.db_hoisted_tx_settings)=';
select r.rolname,d.datname,s.setting from pg_db_role_setting rs
left join pg_roles r on r.oid=rs.setrole left join pg_database d on d.oid=rs.setdatabase
cross join lateral unnest(rs.setconfig) s(setting)
where (r.rolname in ('authenticator','service_role') or rs.setrole=0)
 and s.setting ~ '^(statement_timeout|lock_timeout|pgrst.db_hoisted_tx_settings)=';
select g.product,g.id,g.as_of,g.generated_at,g.published_at,g.source_updated_at,g.signature,g.payload_hash,
 octet_length(g.payload::text) payload_bytes from public.stats_prepared_generations g
join public.stats_prepared_control c on g.id in (c.active_platform,c.active_visit)
order by g.product;
select range, jsonb_array_length(result->'currentRows') current_points,
 jsonb_array_length(result->'previousRows') previous_points,result->'meta' meta
from unnest(array['1d','7d','14d','30d','90d']) range
cross join lateral (select public.get_stats_prepared_platform_chart_v1(range,'hourly',true) result) r;
select range,jsonb_array_length(result#>'{chart,points}') points,
 jsonb_array_length(result#>'{chart,series}') series,result->'meta' meta
from unnest(array['1d','7d','14d','30d','90d']) range
cross join lateral (select public.get_stats_prepared_visit_share_v1(range) result) r;
-- EXPLAIN only. Real transport timing and negative cancellation tests are CI
-- fixture work; EXPLAIN cannot prove PostgREST timeout application.
explain (costs true,format json) select public.get_stats_prepared_platform_chart_v1('90d','hourly',true);
rollback;
