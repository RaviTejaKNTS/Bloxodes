create schema stats_prepared_private;
revoke all on schema stats_prepared_private from public,anon,authenticated;
grant usage on schema stats_prepared_private to service_role;
-- Additive prepared charts. No source backfill, source index or producer changes.
-- All wall-clock boundaries are UTC. PostgREST reads proconfig BEFORE execution;
-- no mid-statement set_config is used to pretend to reset a statement deadline.
create table public.stats_prepared_control (
  id boolean primary key default true check (id),
  lease_token uuid, lease_epoch bigint not null default 0, lease_until timestamptz,
  lease_request uuid, worker_id text, checked_at timestamptz, success_at timestamptz,
  error_code text, failures integer not null default 0, retry_at timestamptz,
  membership text not null default '', daily_scan uuid, daily_after bigint not null default 0,
  active_platform uuid, previous_platform uuid, active_visit uuid, previous_visit uuid,
  platform_signature text, visit_signature text, steps integer not null default 0,
  metadata_revision bigint not null default 0, outside_horizon_at timestamptz
);
insert into public.stats_prepared_control(id) values (true);
create table public.stats_prepared_members (universe_id bigint primary key);
create table public.stats_prepared_dirty (
  kind text not null check (kind in ('h','d','m','x')),
  bucket timestamptz not null, revision bigint not null default 1,
  changed_at timestamptz not null default clock_timestamp(), primary key(kind,bucket)
);
create table public.stats_prepared_versions (
  id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('h','d')),
  bucket timestamptz not null, membership text not null, revision bigint not null,
  changed_at timestamptz, scan uuid, status text not null default 'building'
    check(status in ('building','ready','failed')),
  -- Unrounded accumulators, rounded once when a complete bucket becomes ready.
  player_sum numeric not null default 0, peak_sum numeric not null default 0,
  visits_sum numeric not null default 0, favorites_sum numeric not null default 0,
  rating_sum numeric not null default 0, rating_weight bigint not null default 0,
  samples bigint not null default 0, tracked integer not null default 0,
  observed integer not null default 0, first_source timestamptz, last_source timestamptz,
  all_first_source timestamptz, all_last_source timestamptz,
  visit_hash_a numeric not null default 0, visit_hash_b numeric not null default 0,
  finalized boolean not null default true, positive_visits numeric not null default 0,
  positive_games integer not null default 0, payload jsonb, created_at timestamptz not null default now(),
  constraint stats_prepared_finite_accumulators check(
    player_sum::text not in ('NaN','Infinity','-Infinity') and peak_sum::text not in ('NaN','Infinity','-Infinity')
    and visits_sum::text not in ('NaN','Infinity','-Infinity') and favorites_sum::text not in ('NaN','Infinity','-Infinity')
    and rating_sum::text not in ('NaN','Infinity','-Infinity'))
);
create index stats_prepared_versions_scan on public.stats_prepared_versions(scan) where status='building';
create table public.stats_prepared_buckets (
  kind text not null, bucket timestamptz not null, version uuid not null
    references public.stats_prepared_versions(id), primary key(kind,bucket)
);
-- Narrow positive visit contribution cache, not copied source rows. Immutable
-- day versions allow five separately bounded ranking steps to share one input.
create table public.stats_prepared_visits (
  version uuid not null references public.stats_prepared_versions(id),
  universe_id bigint not null, visits bigint not null check(visits>0),
  primary key(version,universe_id)
);
create table public.stats_prepared_generations (
  id uuid primary key default gen_random_uuid(), product text not null check(product in ('platform','visit')),
  status text not null default 'building' check(status in ('building','ready','failed')),
  as_of timestamptz not null, generated_at timestamptz, published_at timestamptz,
  membership text not null, signature text not null, source_updated_at timestamptz,
  metadata_revision bigint not null, manifest jsonb not null, payload jsonb, payload_hash text,
  after_id bigint not null default 0, totals_done boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.stats_prepared_visit_universes (universe_id bigint primary key);
create table public.stats_prepared_visit_totals (
 generation uuid not null references public.stats_prepared_generations(id),
 universe_id bigint not null, totals numeric[] not null check(array_length(totals,1)=5),
 primary key(generation,universe_id)
);
create unique index stats_prepared_one_build on public.stats_prepared_generations(product) where status='building';
create table public.stats_prepared_visit_ranges (
  generation uuid not null references public.stats_prepared_generations(id) on delete cascade,
  days integer not null check(days in (1,7,14,30,90)), chart jsonb not null,
  primary key(generation,days), check(octet_length(chart::text)<=2097152)
);
create table public.stats_prepared_receipts (
  step_id uuid primary key, lease_token uuid not null, epoch bigint not null,
  outcome jsonb not null, created_at timestamptz not null default now()
);
create index stats_prepared_receipts_time on public.stats_prepared_receipts(created_at);

create function stats_prepared_private.stats_prepared_row_v1(v public.stats_prepared_versions) returns jsonb
language sql immutable security invoker set search_path='' set timezone='UTC' as $$
 select jsonb_build_object(
  'playing',round(v.player_sum)::text,'peak_players',v.peak_sum::text,
  'avg_players',v.player_sum::text,'visits',v.visits_sum::text,'favorites',v.favorites_sum::text,
  'rating_percent',case when v.rating_weight>0 then round(v.rating_sum/v.rating_weight,1)::text end,
  'tracked_games',v.tracked::text,'samples',v.samples::text,'recorded_at',v.last_source)
 || case when v.kind='h' then jsonb_build_object('hour_start',v.bucket)
    else jsonb_build_object('stat_date',(v.bucket at time zone 'UTC')::date) end
 -- Internal coverage fields are removed by the public reader.
 || jsonb_build_object('_observed',v.tracked,'_first',v.first_source,'_finalized',v.finalized,
    '_changed',v.changed_at,'_version',v.id);
$$;

create function stats_prepared_private.stats_prepared_capture_v1() returns trigger
language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare k text:=tg_argv[0]; q text; relevant text;
begin
 -- Transition-table projection excludes bookkeeping/snapshots. EXCEPT compares
 -- actual relevant values and captures both former and replacement time keys.
 if tg_op='TRUNCATE' then
   insert into public.stats_prepared_dirty(kind,bucket)
   select k,b from generate_series(date_trunc('day',now())-case when k='h' then interval '90 days' else interval '180 days' end,
      date_trunc(case when k='h' then 'hour' else 'day' end,now()),
      case when k='h' then interval '1 hour' else interval '1 day' end) b
   order by b on conflict(kind,bucket) do update set revision=stats_prepared_dirty.revision+1,changed_at=clock_timestamp();
   -- TRUNCATE also removes source outside the reconstructible horizon. Retain
   -- old prepared values, but never certify that retained coverage as current.
   if k='h' then
     insert into public.stats_prepared_dirty(kind,bucket) values('x','epoch'::timestamptz)
     on conflict(kind,bucket) do update set changed_at=clock_timestamp();
   end if;
   return null;
 end if;
 if k='h' then
   relevant:='universe_id,hour_start as bucket,playing,avg_playing,peak_playing,visits_end,favorites_end,rating_percent,sample_count,first_sampled_at,last_sampled_at';
 elsif k='d' then
   relevant:='universe_id,stat_date::timestamptz as bucket,playing,avg_playing,peak_playing,visits,favorites,rating_end,sample_count,visit_delta,visits_start,visits_end,recorded_at,is_finalized,(snapshot->>''source'') as provenance';
 else
   relevant:='universe_id,name,display_name,slug,icon_url';
 end if;
 if tg_op='UPDATE' then
   q:=format('with delta as ((select %s from new_rows except select %s from old_rows) union (select %s from old_rows except select %s from new_rows)) ',relevant,relevant,relevant,relevant);
 else
   q:=format('with delta as (select %s from %s) ',relevant,case when tg_op='INSERT' then 'new_rows' else 'old_rows' end);
 end if;
 if k='m' then
   execute q || 'insert into public.stats_prepared_dirty(kind,bucket) select ''m'',''epoch''::timestamptz where exists(select 1 from delta) on conflict(kind,bucket) do update set revision=stats_prepared_dirty.revision+1,changed_at=clock_timestamp()';
 else
   -- Older source pruning must not destroy verified retained platform history.
   -- Unsupported edits are surfaced once; no unbounded historical rebuild.
   execute q || format('insert into public.stats_prepared_dirty(kind,bucket)
     select %L,bucket from delta where bucket >= date_trunc(''day'',now())-interval %L and bucket<=date_trunc(''hour'',now())
     and (%L<>''h'' or exists(select 1 from public.stats_game_current_index g where g.universe_id=delta.universe_id))
     group by bucket order by bucket on conflict(kind,bucket) do update set revision=stats_prepared_dirty.revision+1,changed_at=clock_timestamp()',k,case when k='h' then '90 days' else '180 days' end,k);
   execute q || format('insert into public.stats_prepared_dirty(kind,bucket)
     select ''x'',''epoch''::timestamptz where exists(select 1 from delta where bucket<date_trunc(''day'',now())-interval %L)
     on conflict(kind,bucket) do update set changed_at=clock_timestamp()',case when k='h' then '90 days' else '180 days' end);
 end if;
 return null;
end $$;
create trigger stats_prepared_insert after insert on public.roblox_universe_stats_hourly
 referencing new table as new_rows for each statement execute function stats_prepared_private.stats_prepared_capture_v1('h');
create trigger stats_prepared_update after update on public.roblox_universe_stats_hourly
 referencing old table as old_rows new table as new_rows for each statement execute function stats_prepared_private.stats_prepared_capture_v1('h');
create trigger stats_prepared_delete after delete on public.roblox_universe_stats_hourly
 referencing old table as old_rows for each statement execute function stats_prepared_private.stats_prepared_capture_v1('h');
create trigger stats_prepared_truncate after truncate on public.roblox_universe_stats_hourly
 for each statement execute function stats_prepared_private.stats_prepared_capture_v1('h');
create trigger stats_prepared_insert after insert on public.roblox_universe_stats_daily
 referencing new table as new_rows for each statement execute function stats_prepared_private.stats_prepared_capture_v1('d');
create trigger stats_prepared_update after update on public.roblox_universe_stats_daily
 referencing old table as old_rows new table as new_rows for each statement execute function stats_prepared_private.stats_prepared_capture_v1('d');
create trigger stats_prepared_delete after delete on public.roblox_universe_stats_daily
 referencing old table as old_rows for each statement execute function stats_prepared_private.stats_prepared_capture_v1('d');
create trigger stats_prepared_truncate after truncate on public.roblox_universe_stats_daily
 for each statement execute function stats_prepared_private.stats_prepared_capture_v1('d');
create trigger stats_prepared_insert after insert on public.roblox_universes
 referencing new table as new_rows for each statement execute function stats_prepared_private.stats_prepared_capture_v1('m');
create trigger stats_prepared_update after update on public.roblox_universes
 referencing old table as old_rows new table as new_rows for each statement execute function stats_prepared_private.stats_prepared_capture_v1('m');
create trigger stats_prepared_delete after delete on public.roblox_universes
 referencing old table as old_rows for each statement execute function stats_prepared_private.stats_prepared_capture_v1('m');

create function stats_prepared_private.stats_prepared_period_v1(p_rows jsonb,p_start timestamptz,p_end timestamptz,p_hourly boolean,p_as_of timestamptz default null)
returns jsonb language sql immutable security invoker set search_path='' set timezone='UTC' as $$
 with selected as (
   select value r,case when p_hourly then (value->>'hour_start')::timestamptz
     else (value->>'stat_date')::timestamptz end t,
     -- Hour closure is relative to the frozen generation, including previous
     -- periods. A cached open-hour flag must not stay false after rollover.
     case when p_hourly then (value->>'hour_start')::timestamptz < date_trunc('hour',coalesce(p_as_of,p_end))
       else (value->>'_finalized')::boolean end finalized
   from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb))
 ), grid as (
   select b from generate_series(
     case when p_hourly then date_trunc('hour',p_start)+case when p_start>date_trunc('hour',p_start) then interval '1 hour' else interval '0' end
       else date_trunc('day',p_start) end,
     case when p_hourly then date_trunc('hour',p_end) else date_trunc('day',p_end) end,
     case when p_hourly then interval '1 hour' else interval '1 day' end) b
 ), windowed as (select * from selected where t>=case when p_hourly then p_start else date_trunc('day',p_start) end
    and t<=case when p_hourly then p_end else date_trunc('day',p_end) end),
 coverage as (
   select count(*)::integer expected,count(w.t)::integer processed,
     count(*) filter(where coalesce((w.r->>'_observed')::integer,0)>0)::integer observed,
     coalesce(jsonb_agg(g.b order by g.b) filter(where coalesce((w.r->>'_observed')::integer,0)=0),'[]'::jsonb) missing
   from grid g left join windowed w on w.t=g.b
 )
 select jsonb_build_object('rows',coalesce((select jsonb_agg(r - array['_observed','_first','_finalized','_changed','_version'] order by t)
   from windowed where (r->>'_observed')::integer>0),'[]'::jsonb),
   'sourceUpdatedAt',(select max((r->>'_changed')::timestamptz) from windowed),
   'coverage',jsonb_build_object('expectedBuckets',c.expected,'processedBuckets',c.processed,
     'observedBuckets',c.observed,'missingBuckets',c.missing,
     'firstSourceAt',(select min((r->>'_first')::timestamptz) from windowed),
     'lastSourceAt',(select max((r->>'recorded_at')::timestamptz) from windowed),
     'finalizedThrough',(select max(t)::date from windowed where finalized and (r->>'_observed')::integer>0),
     'provisional',c.observed<c.expected or exists(select 1 from windowed where not finalized),
     'reason',case when p_start is null then 'not-built'
       when p_hourly and c.observed<c.expected and p_start<p_end-interval '90 days' then 'retention-gap'
       when not p_hourly and c.observed<c.expected and exists(
         select 1 from grid g left join windowed w on w.t=g.b
         where g.b=date_trunc('day',p_end) and coalesce((w.r->>'_observed')::integer,0)=0) then 'producer-behind'
       when c.observed<c.expected then 'source-gap' else 'complete' end)) from coverage c;
$$;
-- No clock dependence hidden behind IMMUTABLE (date-level producer reason uses
-- fixed selection endpoint, not the request date).
create or replace function stats_prepared_private.stats_prepared_empty_coverage_v1() returns jsonb
language sql immutable security invoker set search_path='' as $$
 select '{"expectedBuckets":0,"processedBuckets":0,"observedBuckets":0,"missingBuckets":[],"firstSourceAt":null,"lastSourceAt":null,"finalizedThrough":null,"provisional":true,"reason":"not-built"}'::jsonb;
$$;

create function public.get_stats_prepared_platform_chart_v1(p_range text,p_resolution text,p_include_previous boolean default false)
returns jsonb language plpgsql stable security invoker set search_path='' set timezone='UTC'
set statement_timeout='2s' set lock_timeout='500ms' as $$
declare n integer; c public.stats_prepared_control; g public.stats_prepared_generations;
 a jsonb; b jsonb; meta jsonb; start_at timestamptz; state text;
begin
 if p_range not in ('1d','7d','14d','30d','90d') or p_range is null
   or p_resolution not in ('hourly','daily','weekly','monthly') or p_resolution is null then raise exception 'invalid-selection' using errcode='22023'; end if;
 n:=rtrim(p_range,'d')::integer;
 select * into c from public.stats_prepared_control where id;
 select * into g from public.stats_prepared_generations where id=c.active_platform and status='ready';
 start_at:=g.as_of-make_interval(days=>n);
 a:=stats_prepared_private.stats_prepared_period_v1(g.payload->case when p_resolution='hourly' then 'hourly' else 'daily' end,start_at,g.as_of,p_resolution='hourly',g.as_of);
 if g.id is null then a:=jsonb_build_object('rows','[]'::jsonb,'coverage',stats_prepared_private.stats_prepared_empty_coverage_v1()); end if;
 state:=case when g.id is null or jsonb_array_length(a->'rows')=0 then 'unavailable'
   when c.error_code is not null or g.membership<>c.membership or (g.as_of<now()-interval '10 minutes'
     and exists(select 1 from public.stats_prepared_dirty d where d.kind=case when p_resolution='hourly' then 'h' else 'd' end
       and d.revision>0 and d.bucket>=date_trunc('day',start_at) and d.bucket<=g.as_of)) then 'last-good'
   when a#>>'{coverage,reason}'<>'complete' or (a#>>'{coverage,provisional}')::boolean then 'partial' else 'ready' end;
 meta:=jsonb_build_object('contract','stats-prepared@1','state',state,'generationId',g.id,
   'asOf',g.as_of,'windowStart',start_at,'windowEnd',g.as_of,
   'sourceAsOf',a#>'{coverage,lastSourceAt}','sourceUpdatedAt',a->'sourceUpdatedAt',
   'generatedAt',g.generated_at,'publishedAt',g.published_at,'checkedAt',c.checked_at,
   'sourceRevision',g.signature,'current',a->'coverage');
 if g.membership<>c.membership then
   meta:=jsonb_set(jsonb_set(meta,'{current,reason}','"membership-change"'),'{current,provisional}','true');
 end if;
 if p_include_previous then
   b:=stats_prepared_private.stats_prepared_period_v1(g.payload->case when p_resolution='hourly' then 'hourly' else 'daily' end,
     start_at-make_interval(days=>n),start_at,p_resolution='hourly',g.as_of);
   if g.id is null then b:=jsonb_build_object('rows','[]'::jsonb,'coverage',stats_prepared_private.stats_prepared_empty_coverage_v1()); end if;
   if p_resolution='hourly' and ((b#>>'{coverage,observedBuckets}')::integer<(b#>>'{coverage,expectedBuckets}')::integer or c.outside_horizon_at is not null) and start_at-make_interval(days=>n)<g.as_of-interval '90 days' then
     b:=jsonb_set(jsonb_set(b,'{coverage,reason}','"retention-gap"'),'{coverage,provisional}','true');
   end if;
   meta:=meta||jsonb_build_object('previous',b->'coverage');
 end if;
 return jsonb_build_object('contract','stats-prepared@1','meta',meta,'currentRows',a->'rows')
   ||case when p_include_previous then jsonb_build_object('previousRows',b->'rows') else '{}'::jsonb end;
end $$;

create function public.get_stats_prepared_visit_share_v1(p_range text) returns jsonb
language plpgsql stable security invoker set search_path='' set timezone='UTC'
set statement_timeout='2s' set lock_timeout='500ms' as $$
declare n integer; c public.stats_prepared_control; g public.stats_prepared_generations; chart jsonb; cov jsonb; state text; period jsonb;
begin
 if p_range not in ('1d','7d','14d','30d','90d') or p_range is null then raise exception 'invalid-selection' using errcode='22023'; end if;
 n:=rtrim(p_range,'d')::integer;
 select * into c from public.stats_prepared_control where id;
 select * into g from public.stats_prepared_generations where id=c.active_visit and status='ready';
 select r.chart into chart from public.stats_prepared_visit_ranges r where generation=g.id and days=n;
 period:=stats_prepared_private.stats_prepared_period_v1(g.manifest->'coverage',g.as_of-make_interval(days=>n),g.as_of,false);
 cov:=case when g.id is null then stats_prepared_private.stats_prepared_empty_coverage_v1() else period->'coverage' end;
 state:=case when g.id is null then 'unavailable'
   when c.error_code is not null or g.as_of::date<current_date then 'last-good'
   when (cov->>'observedBuckets')::integer=0 then 'unavailable'
   when chart->>'totalVisits'='0' and (cov->>'observedBuckets')::integer=(cov->>'expectedBuckets')::integer then 'empty'
   when cov->>'reason'<>'complete' or (cov->>'provisional')::boolean then 'partial' else 'ready' end;
 if state='empty' then cov:=jsonb_set(cov,'{reason}','"zero-denominator"'); end if;
 chart:=coalesce(chart,jsonb_build_object('range',p_range,'points','[]'::jsonb,'series','[]'::jsonb,
    'denominatorGameCount',0,'visibleGameCount',0,'totalVisits','0','generatedAt',null));
 return jsonb_build_object('contract','stats-prepared@1','chart',chart,'meta',jsonb_build_object(
   'contract','stats-prepared@1','state',state,'generationId',g.id,'asOf',g.as_of,
   'windowStart',g.as_of-make_interval(days=>n),'windowEnd',g.as_of,
   'sourceAsOf',cov->'lastSourceAt','sourceUpdatedAt',period->'sourceUpdatedAt',
   'generatedAt',g.generated_at,'publishedAt',g.published_at,'checkedAt',c.checked_at,
   'sourceRevision',g.signature,'current',cov));
end $$;

create function public.get_stats_prepared_health_v1() returns jsonb
language sql stable security invoker set search_path='' set statement_timeout='2s' set lock_timeout='500ms' as $$
 select jsonb_build_object('schemaVersion','stats-prepared@1','ok',true,
 'rpcAllowlist',jsonb_build_array('claim_stats_prepared_work_v1','finish_stats_prepared_work_v1',
   'get_stats_prepared_health_v1','get_stats_prepared_receipt_v1','run_stats_prepared_step_v1'),
 'operational',jsonb_build_object('checkedAt',c.checked_at,'successAt',c.success_at,
   'errorCode',c.error_code,'failures',c.failures,'retryAt',c.retry_at,
   'leaseUntil',c.lease_until,'epoch',c.lease_epoch::text,'workerId',c.worker_id,'leaseRequest',c.lease_request,'dailyScan',c.daily_scan,
   'dailyAfter',c.daily_after::text,'outsideHorizonAt',c.outside_horizon_at,
   'platformGeneration',c.active_platform,'visitGeneration',c.active_visit,
   'pendingBuckets',(select count(*) from public.stats_prepared_dirty),
   'pendingHours',(select count(*) from public.stats_prepared_dirty where kind='h'),
   'pendingDays',(select count(*) from public.stats_prepared_dirty where kind='d'),
   'oldestPendingAt',(select min(changed_at) from public.stats_prepared_dirty),
   'visitStage',(select jsonb_build_object('id',g.id,'asOf',g.as_of,'startedAt',g.created_at,
     'afterUniverseId',g.after_id::text,'totalsDone',g.totals_done,
     'rangesBuilt',(select count(*) from public.stats_prepared_visit_ranges r where r.generation=g.id))
     from public.stats_prepared_generations g where g.product='visit' and g.status='building'),
   'platformAsOf',(select as_of from public.stats_prepared_generations where id=c.active_platform),
   'visitAsOf',(select as_of from public.stats_prepared_generations where id=c.active_visit),
   'platform',(select jsonb_build_object('publishedAt',g.published_at,'generatedAt',g.generated_at,
     'sourceUpdatedAt',g.source_updated_at,'hourlySourceAsOf',g.manifest->'hourlySourceAsOf',
     'dailySourceAsOf',g.manifest->'dailySourceAsOf') from public.stats_prepared_generations g where g.id=c.active_platform),
   'visit',(select jsonb_build_object('publishedAt',g.published_at,'generatedAt',g.generated_at,
     'sourceUpdatedAt',g.source_updated_at,'sourceAsOf',g.manifest->'sourceAsOf')
     from public.stats_prepared_generations g where g.id=c.active_visit),
   'lastReceipt',(select jsonb_build_object('at',created_at,'outcome',outcome)
     from public.stats_prepared_receipts order by created_at desc limit 1)))
 from public.stats_prepared_control c where id;
$$;

create function public.claim_stats_prepared_work_v1(p_worker_id text,p_request_id uuid) returns jsonb
language plpgsql volatile security invoker set search_path='' set timezone='UTC'
set statement_timeout='5s' set lock_timeout='500ms' as $$
declare c public.stats_prepared_control; membership_hash text; frozen_ids bigint[]; token uuid;
begin
 if p_request_id is null or p_worker_id is null or length(p_worker_id) not between 1 and 80 then raise exception 'invalid-claim' using errcode='22023'; end if;
 select * into c from public.stats_prepared_control where id for update nowait;
 if c.lease_until>clock_timestamp() then
   if c.lease_request=p_request_id then
     return jsonb_build_object('claimed',true,'leaseToken',c.lease_token,'epoch',c.lease_epoch::text,'expiresAt',c.lease_until,'work',jsonb_build_array(jsonb_build_object('kind','advance')));
   end if;
   return jsonb_build_object('claimed',false,'reason','leased');
 end if;
 update public.stats_prepared_control set checked_at=clock_timestamp() where id;
 if c.retry_at>clock_timestamp() then return jsonb_build_object('claimed',false,'reason','backoff'); end if;
 -- Hash and IDs come from ONE source statement snapshot. A concurrent index
 -- rebuild cannot pair an old hash with a different freshly read member set.
 select md5(coalesce(string_agg(universe_id::text,',' order by universe_id),'')),array_agg(universe_id order by universe_id)
 into membership_hash,frozen_ids from public.stats_game_current_index;
 if membership_hash<>c.membership then
   delete from public.stats_prepared_members;
   insert into public.stats_prepared_members select unnest(frozen_ids);
   update public.stats_prepared_control set membership=membership_hash where id;
   -- Safe whole-bucket recomputation. Older unsupported hourly membership
   -- history is excluded rather than becoming an infinite rebuild prerequisite.
   insert into public.stats_prepared_dirty(kind,bucket)
   select 'h',b from generate_series(date_trunc('hour',now())-interval '90 days',date_trunc('hour',now()),interval '1 hour') b
   union all select 'd',b from generate_series(date_trunc('day',now())-interval '180 days',date_trunc('day',now()),interval '1 day') b
   order by 1,2 on conflict(kind,bucket) do update set revision=stats_prepared_dirty.revision+1,changed_at=clock_timestamp();
 end if;
 -- Bootstrap and UTC rollover enumeration is cheap and finite. Empty processed
 -- buckets are cached, so unchanged source never manufactures a new generation.
 insert into public.stats_prepared_dirty(kind,bucket,revision)
 select k,b,0 from (
   select 'h'::text k,b from generate_series(date_trunc('hour',now())-interval '90 days',date_trunc('hour',now()),interval '1 hour') b
   union all select 'd',b from generate_series(date_trunc('day',now())-interval '180 days',date_trunc('day',now()),interval '1 day') b
 ) required where not exists(select 1 from public.stats_prepared_buckets b where b.kind=k and b.bucket=required.b)
 order by k,b on conflict do nothing;
 if exists(select 1 from public.stats_prepared_dirty where kind='m') then
   update public.stats_prepared_control set metadata_revision=metadata_revision+1 where id;
   delete from public.stats_prepared_dirty where kind='m';
 end if;
 if exists(select 1 from public.stats_prepared_dirty where kind='x') then
   update public.stats_prepared_control set outside_horizon_at=(select max(changed_at) from public.stats_prepared_dirty where kind='x') where id;
   delete from public.stats_prepared_dirty where kind='x';
 end if;
 token:=gen_random_uuid();
 update public.stats_prepared_control set lease_token=token,lease_epoch=lease_epoch+1,
   lease_until=clock_timestamp()+interval '240 seconds',lease_request=p_request_id,worker_id=p_worker_id,
   checked_at=clock_timestamp() where id returning * into c;
 return jsonb_build_object('claimed',true,'leaseToken',token,'epoch',c.lease_epoch::text,'expiresAt',c.lease_until,
   'work',jsonb_build_array(jsonb_build_object('kind','advance')));
exception when lock_not_available then return jsonb_build_object('claimed',false,'reason','busy');
end $$;

create function stats_prepared_private.stats_prepared_publish_platform_v1() returns boolean
language plpgsql volatile security invoker set search_path='' set timezone='UTC' as $$
declare c public.stats_prepared_control; sig text; payload jsonb; gid uuid; changed timestamptz;
begin
 select * into c from public.stats_prepared_control where id;
 select md5(coalesce(string_agg(v.id::text,',' order by b.kind,b.bucket),'')),max(v.changed_at),
  jsonb_build_object('hourly',coalesce(jsonb_agg(v.payload order by b.bucket) filter(where b.kind='h'),'[]'::jsonb),
    'daily',coalesce(jsonb_agg(v.payload order by b.bucket) filter(where b.kind='d'),'[]'::jsonb))
 into sig,changed,payload from public.stats_prepared_buckets b join public.stats_prepared_versions v on v.id=b.version
 where v.membership=c.membership and b.bucket>=date_trunc('day',now())-interval '180 days' and v.status='ready';
 if sig=c.platform_signature then
   update public.stats_prepared_control set steps=0 where id; return false;
 end if;
 -- Cold empty work has nothing to publish. Once a platform generation exists,
 -- a changed empty payload must replace it too: successful source removal has
 -- already acknowledged its dirty keys, so the old points are no longer current.
 -- Keep processed-empty coverage; the reader omits those rows and reports
 -- unavailable without fabricating zero observations or mutating last-good.
 if c.active_platform is null
   and not exists(select 1 from jsonb_array_elements(payload->'hourly') r where (r->>'_observed')::integer>0)
   and not exists(select 1 from jsonb_array_elements(payload->'daily') r where (r->>'_observed')::integer>0) then
   update public.stats_prepared_control set steps=0 where id; return false;
 end if;
 if octet_length(payload::text)>16777216 then raise exception 'platform-payload-limit'; end if;
 insert into public.stats_prepared_generations(product,status,as_of,generated_at,published_at,membership,signature,
  source_updated_at,metadata_revision,manifest,payload,payload_hash)
 values('platform','ready',clock_timestamp(),clock_timestamp(),clock_timestamp(),c.membership,sig,changed,c.metadata_revision,
   jsonb_build_object('hourlySourceAsOf',(select max((r->>'recorded_at')::timestamptz) from jsonb_array_elements(payload->'hourly') r),
     'dailySourceAsOf',(select max((r->>'recorded_at')::timestamptz) from jsonb_array_elements(payload->'daily') r)),payload,
     encode(sha256(convert_to(payload::text,'UTF8')),'hex')) returning id into gid;
 update public.stats_prepared_control set previous_platform=active_platform,active_platform=gid,platform_signature=sig,steps=0 where id;
 -- The existing queue coalesces (type,slug). No API warm fan-out.
 insert into public.revalidation_events(entity_type,slug,source) values('stats','overview','prepared-charts')
 on conflict(entity_type,slug) do update set created_at=now(),source=excluded.source;
 return true;
end $$;

create function stats_prepared_private.stats_prepared_hour_v1() returns boolean
language plpgsql volatile security invoker set search_path='' set timezone='UTC' as $$
declare d public.stats_prepared_dirty; v public.stats_prepared_versions; membership_hash text;
begin
 select * into d from public.stats_prepared_dirty where kind='h' and bucket>=date_trunc('day',now())-interval '90 days'
   order by bucket desc limit 1 for update;
 if d.bucket is null then return false; end if;
 select membership into membership_hash from public.stats_prepared_control where id;
 insert into public.stats_prepared_versions(kind,bucket,membership,revision,changed_at,status,
   player_sum,peak_sum,visits_sum,favorites_sum,rating_sum,rating_weight,samples,tracked,observed,first_source,last_source,finalized)
 select 'h',d.bucket,membership_hash,d.revision,d.changed_at,'ready',
   coalesce(sum(coalesce(h.avg_playing,h.playing::numeric)),0),coalesce(sum(coalesce(h.peak_playing,h.playing,0)),0),
   coalesce(sum(coalesce(h.visits_end,0)),0),coalesce(sum(coalesce(h.favorites_end,0)),0),
   coalesce(sum(h.rating_percent*greatest(coalesce(h.sample_count,0),1)),0),
   coalesce(sum(greatest(coalesce(h.sample_count,0),1)) filter(where h.rating_percent is not null),0),
   coalesce(sum(greatest(coalesce(h.sample_count,0),1)),0),count(*)::integer,count(*)::integer,
   min(h.first_sampled_at),max(h.last_sampled_at),d.bucket<date_trunc('hour',now())
 from public.roblox_universe_stats_hourly h join public.stats_prepared_members m using(universe_id)
 where h.hour_start=d.bucket returning * into v;
 update public.stats_prepared_versions set payload=stats_prepared_private.stats_prepared_row_v1(v) where id=v.id;
 insert into public.stats_prepared_buckets(kind,bucket,version) values('h',d.bucket,v.id)
 on conflict(kind,bucket) do update set version=excluded.version;
 delete from public.stats_prepared_dirty where kind='h' and bucket=d.bucket and revision=d.revision;
 return true;
end $$;

create function stats_prepared_private.stats_prepared_daily_v1() returns text
language plpgsql volatile security invoker set search_path='' set timezone='UTC' as $$
declare c public.stats_prepared_control; ids bigint[]; last_id bigint; low_date date; high_date date; scan_id uuid;
begin
 select * into c from public.stats_prepared_control where id;
 if c.daily_scan is null then
   scan_id:=gen_random_uuid();
   insert into public.stats_prepared_versions(kind,bucket,membership,revision,changed_at,scan)
   select 'd',bucket,c.membership,revision,changed_at,scan_id from public.stats_prepared_dirty where kind='d'
     and bucket>=date_trunc('day',now())-interval '180 days'
     and (select count(*) from public.stats_prepared_versions v where v.kind='d' and v.bucket=stats_prepared_dirty.bucket)<6
     order by bucket;
   if not found then return 'daily-cleanup-wait'; end if;
   update public.stats_prepared_control set daily_scan=scan_id,daily_after=0 where id;
   return 'daily-start';
 end if;
 -- Membership change during a paused scan invalidates only that finite scan.
 if exists(select 1 from public.stats_prepared_versions where scan=c.daily_scan and status='building' and membership<>c.membership) then
   update public.stats_prepared_versions set status='failed' where scan=c.daily_scan and status='building';
   update public.stats_prepared_control set daily_scan=null,daily_after=0 where id;
   return 'daily-membership-restart';
 end if;
 select array_agg(universe_id),max(universe_id) into ids,last_id from
   (select universe_id from public.roblox_universes where universe_id>c.daily_after order by universe_id limit 256) u;
 if ids is null then
   -- Lock dirty keys in the same order used by statement triggers. A date whose
   -- revision changed mid-scan is never marked ready or acknowledged.
   perform 1 from public.stats_prepared_dirty d join public.stats_prepared_versions v
     on v.kind=d.kind and v.bucket=d.bucket where v.scan=c.daily_scan and v.status='building'
     order by d.kind,d.bucket for update of d;
   update public.stats_prepared_versions v set status=case when d.revision=v.revision then 'ready' else 'failed' end
   from public.stats_prepared_dirty d where v.scan=c.daily_scan and v.status='building' and d.kind='d' and d.bucket=v.bucket;
   update public.stats_prepared_versions v set payload=stats_prepared_private.stats_prepared_row_v1(v)
     where v.scan=c.daily_scan and v.status='ready';
   insert into public.stats_prepared_buckets(kind,bucket,version)
   select 'd',bucket,id from public.stats_prepared_versions where scan=c.daily_scan and status='ready'
   on conflict(kind,bucket) do update set version=excluded.version;
   delete from public.stats_prepared_dirty d using public.stats_prepared_versions v
     where v.scan=c.daily_scan and v.status='ready' and d.kind='d' and d.bucket=v.bucket and d.revision=v.revision;
   update public.stats_prepared_control set daily_scan=null,daily_after=0 where id;
   return 'daily-complete';
 end if;
 select min(bucket)::date,max(bucket)::date into low_date,high_date from public.stats_prepared_versions where scan=c.daily_scan and status='building';
 -- LATERAL + OFFSET 0 keeps source access universe-leading. No date-leading
 -- source index, sequential full-table date scan or unbounded source query.
 with source as materialized (
   select d.*,v.id version,m.universe_id is not null member
   from unnest(ids) u(id) cross join lateral (
     select s.universe_id,s.stat_date,s.playing,s.avg_playing,s.peak_playing,s.visits,s.favorites,
       s.rating_end,s.sample_count,s.visit_delta,s.visits_start,s.visits_end,s.recorded_at,s.is_finalized,
       s.snapshot->>'source' provenance,
       md5(jsonb_build_array(s.universe_id,greatest(coalesce(s.visit_delta,s.visits_end-s.visits_start,0),0),
         s.recorded_at,s.is_finalized,s.snapshot->>'source')::text) visit_fingerprint
     from public.roblox_universe_stats_daily s where s.universe_id=u.id
       and s.stat_date between low_date and high_date offset 0
   ) d join public.stats_prepared_versions v on v.scan=c.daily_scan and v.status='building' and v.bucket=d.stat_date::timestamptz
   left join public.stats_prepared_members m on m.universe_id=d.universe_id
 ), contributions as (
   insert into public.stats_prepared_visits(version,universe_id,visits)
   select version,universe_id,greatest(coalesce(visit_delta,visits_end-visits_start,0),0)::bigint from source
   where stat_date>=(now() at time zone 'UTC')::date-90 and greatest(coalesce(visit_delta,visits_end-visits_start,0),0)>0
   returning version
 ), universe_registry as (
   insert into public.stats_prepared_visit_universes(universe_id)
   select distinct universe_id from source where greatest(coalesce(visit_delta,visits_end-visits_start,0),0)>0
   on conflict do nothing returning universe_id
 ), sums as (
   select version,
    coalesce(sum(coalesce(avg_playing,playing::numeric)) filter(where member),0) players,
    coalesce(sum(coalesce(peak_playing,playing,0)) filter(where member),0) peak,
    coalesce(sum(coalesce(visits,0)) filter(where member),0) visits,
    coalesce(sum(coalesce(favorites,0)) filter(where member),0) favorites,
    coalesce(sum(rating_end*greatest(coalesce(sample_count,0),1)) filter(where member),0) rating,
    coalesce(sum(greatest(coalesce(sample_count,0),1)) filter(where member and rating_end is not null),0) weight,
    coalesce(sum(greatest(coalesce(sample_count,0),1)) filter(where member),0) samples,
    count(*) filter(where member)::integer tracked,count(*)::integer observed,
    min(recorded_at) filter(where member and provenance='roblox_universe_stats_hourly') first_source,
    max(recorded_at) filter(where member and provenance='roblox_universe_stats_hourly') last_source,
    min(recorded_at) filter(where provenance='roblox_universe_stats_hourly') all_first_source,
    max(recorded_at) filter(where provenance='roblox_universe_stats_hourly') all_last_source,
    bool_and(is_finalized) finalized,
    coalesce(sum(greatest(coalesce(visit_delta,visits_end-visits_start,0),0)),0) positive_visits,
    count(*) filter(where greatest(coalesce(visit_delta,visits_end-visits_start,0),0)>0)::integer positive_games,
    sum(('x'||substr(visit_fingerprint,1,16))::bit(64)::bigint) hash_a,
    sum(('x'||substr(visit_fingerprint,17,16))::bit(64)::bigint) hash_b
    from source group by version
 )
 update public.stats_prepared_versions v set player_sum=v.player_sum+s.players,peak_sum=v.peak_sum+s.peak,
   visits_sum=v.visits_sum+s.visits,favorites_sum=v.favorites_sum+s.favorites,
   rating_sum=v.rating_sum+s.rating,rating_weight=v.rating_weight+s.weight,samples=v.samples+s.samples,
   tracked=v.tracked+s.tracked,observed=v.observed+s.observed,
   first_source=least(v.first_source,s.first_source),last_source=greatest(v.last_source,s.last_source),finalized=v.finalized and s.finalized,
   all_first_source=least(v.all_first_source,s.all_first_source),all_last_source=greatest(v.all_last_source,s.all_last_source),
   positive_visits=v.positive_visits+s.positive_visits,positive_games=v.positive_games+s.positive_games,
   visit_hash_a=v.visit_hash_a+s.hash_a,visit_hash_b=v.visit_hash_b+s.hash_b
 from sums s where v.id=s.version;
 update public.stats_prepared_control set daily_after=last_id where id;
 return 'daily-batch';
end $$;

create function stats_prepared_private.stats_prepared_visit_start_v1() returns boolean
language plpgsql volatile security invoker set search_path='' set timezone='UTC' as $$
declare c public.stats_prepared_control; manifest jsonb; sig text; changed timestamptz;
begin
 select * into c from public.stats_prepared_control where id;
 if exists(select 1 from public.stats_prepared_generations where product='visit' and status='building') then return true; end if;
 select jsonb_build_object('sourceAsOf',max(v.all_last_source),'days',coalesce(jsonb_agg(jsonb_build_object('day',b.bucket::date,'version',v.id) order by b.bucket),'[]'),
   'coverage',coalesce(jsonb_agg(v.payload||jsonb_build_object('_observed',v.observed,'_first',v.all_first_source,'recorded_at',v.all_last_source) order by b.bucket),'[]')),
   -- Order-independent paired 64-bit source fingerprints avoid rebuilding or
   -- relabeling unchanged visit data after platform-only membership rebuilds.
   -- This is change detection, not authorization; payloads have SHA-256 hashes.
   md5(coalesce(string_agg(v.bucket::text||':'||v.visit_hash_a::text||':'||v.visit_hash_b::text||':'||v.observed::text,',' order by b.bucket),'')||current_date::text||c.metadata_revision::text),max(v.changed_at)
 into manifest,sig,changed from public.stats_prepared_buckets b join public.stats_prepared_versions v on v.id=b.version
 where b.kind='d' and b.bucket>=date_trunc('day',now())-interval '90 days' and b.bucket<=date_trunc('day',now()) and v.status='ready';
 if sig=c.visit_signature or jsonb_array_length(manifest->'days')=0 then return false; end if;
 insert into public.stats_prepared_generations(product,as_of,membership,signature,source_updated_at,metadata_revision,manifest)
 values('visit',clock_timestamp(),c.membership,sig,changed,c.metadata_revision,manifest);
 return true;
end $$;

create function stats_prepared_private.stats_prepared_visit_totals_v1(p_generation uuid) returns boolean
language plpgsql volatile security invoker set search_path='' set timezone='UTC' as $$
declare g public.stats_prepared_generations; ids bigint[]; last_id bigint;
begin
 select * into strict g from public.stats_prepared_generations where id=p_generation and status='building';
 if g.totals_done then return false; end if;
 select array_agg(universe_id),max(universe_id) into ids,last_id from (
   select universe_id from public.stats_prepared_visit_universes where universe_id>g.after_id order by universe_id limit 512
 ) u;
 if ids is null then update public.stats_prepared_generations set totals_done=true where id=g.id; return false; end if;
 insert into public.stats_prepared_visit_totals(generation,universe_id,totals)
 select g.id,u.id,array[
   coalesce(sum(v.visits) filter(where d.day>=g.as_of::date-1),0),
   coalesce(sum(v.visits) filter(where d.day>=g.as_of::date-7),0),
   coalesce(sum(v.visits) filter(where d.day>=g.as_of::date-14),0),
   coalesce(sum(v.visits) filter(where d.day>=g.as_of::date-30),0),coalesce(sum(v.visits),0)]
 from unnest(ids) u(id) cross join jsonb_to_recordset(g.manifest->'days') d(day date,version uuid)
 cross join lateral (select visits from public.stats_prepared_visits s where s.version=d.version and s.universe_id=u.id offset 0) v
 group by u.id;
 update public.stats_prepared_generations set after_id=last_id where id=g.id;
 return true;
end $$;

create function stats_prepared_private.stats_prepared_visit_range_v1(p_generation uuid,p_days integer) returns void
language plpgsql volatile security invoker set search_path='' set timezone='UTC' as $$
declare g public.stats_prepared_generations; idx integer; result jsonb;
begin
 select * into strict g from public.stats_prepared_generations where id=p_generation and status='building' and totals_done;
 idx:=array_position(array[1,7,14,30,90],p_days);
 if idx is null then raise exception 'invalid-range'; end if;
 with days as materialized (
   select d.day,d.version,v.positive_visits total,v.positive_games games
   from jsonb_to_recordset(g.manifest->'days') d(day date,version uuid)
   join public.stats_prepared_versions v on v.id=d.version where d.day>=g.as_of::date-p_days
 ), ranked as materialized (
   select universe_id,totals[idx] total,row_number() over(order by totals[idx] desc,universe_id)::integer rank
   from public.stats_prepared_visit_totals where generation=g.id and totals[idx]>0
 ), top_daily as (
   select d.day,r.universe_id,r.rank,v.visits,
     case when r.rank<=8 then 'g'||r.universe_id::text when r.rank<=100 then 'rank_9_100' else 'rank_101_1000' end key
   from ranked r cross join days d cross join lateral (
     select visits from public.stats_prepared_visits s where s.version=d.version and s.universe_id=r.universe_id offset 0
   ) v where r.rank<=1000
 ), bucketed as (
   select t.day,t.key,sum(t.visits) visits,
     case when min(t.rank)<=8 then min(t.universe_id) end universe_id,
     case when min(t.rank)<=8 then min(t.rank) when min(t.rank)<=100 then 9 else 101 end rank_start,
     case when min(t.rank)<=8 then min(t.rank) when min(t.rank)<=100 then 100 else 1000 end rank_end
   from top_daily t group by t.day,t.key
   union all
   select d.day,'other_tracked',d.total-coalesce(s.total,0),null::bigint,1001,d.games
   from days d left join (select day,sum(visits) total from top_daily group by day) s using(day)
   where d.total>coalesce(s.total,0)
 ), descriptors as (
   select distinct on(b.key) b.key,b.universe_id,b.rank_start,b.rank_end,
     case when b.rank_start<=8 then coalesce(nullif(u.display_name,''),u.name,b.universe_id::text)
       when b.key='rank_9_100' then 'Ranks 9-100' when b.key='rank_101_1000' then 'Ranks 101-1000' else 'Other tracked games' end name,
     case when b.rank_start<=8 then u.slug end slug,case when b.rank_start<=8 then u.icon_url end icon
   from bucketed b left join public.roblox_universes u on u.universe_id=b.universe_id
   where b.visits>0 order by b.key,b.day
 ), series as (
   select d.*,s.total,row_number() over(order by d.rank_start,d.key)::integer ordinal
   from descriptors d join (select key,sum(visits) total from bucketed group by key) s using(key)
 ), denominator as (select coalesce(sum(total),0) total,coalesce(max(games),0) games from days),
 points as (
   select d.day,d.total,
     jsonb_object_agg(s.key,coalesce(b.visits,0)::text order by s.ordinal) visits,
     jsonb_object_agg(s.key,case when d.total>0 then round(coalesce(b.visits,0)*100/d.total,2) else 0 end order by s.ordinal) shares
   from days d cross join series s left join bucketed b on b.day=d.day and b.key=s.key
   where d.total>0 group by d.day,d.total
 )
 select jsonb_build_object('range',p_days::text||'d','generatedAt',null,'totalVisits',den.total::text,
   'denominatorGameCount',den.games,'visibleGameCount',(select count(*) from series where rank_start<=8),
   'series',coalesce((select jsonb_agg(jsonb_build_object('key',s.key,'universeId',s.universe_id::text,
     'name',s.name,'slug',s.slug,'iconUrl',s.icon,'color',(array['#45d3c2','#56bde8','#ff9f8f','#7897f2','#f8d66d','#a78bfa','#34d399','#f472b6','#60a5fa','#64748b','#94a3b8','#cbd5e1'])[s.ordinal],
     'totalVisits',s.total::text,'sharePercent',case when den.total>0 then round(s.total*100/den.total,2) else 0 end,
     'isOther',s.key='other_tracked','isGroup',s.rank_start>8,'rankStart',s.rank_start,'rankEnd',s.rank_end) order by s.ordinal) from series s),'[]'),
   'points',coalesce((select jsonb_agg(jsonb_build_object(
     'label',to_char(p.day,'Mon FMDD'),'tooltipLabel',to_char(p.day,'Mon FMDD, YYYY'),
     'sampledAt',p.day::timestamptz,'totalVisits',p.total::text,'shares',p.shares,'visits',p.visits) order by p.day) from points p),'[]'))
 into result from denominator den;
 insert into public.stats_prepared_visit_ranges(generation,days,chart) values(g.id,p_days,result);
end $$;

create function stats_prepared_private.stats_prepared_visit_publish_v1(p_generation uuid) returns boolean
language plpgsql volatile security invoker set search_path='' set timezone='UTC' as $$
declare c public.stats_prepared_control; g public.stats_prepared_generations; built_at timestamptz:=clock_timestamp();
begin
 select * into c from public.stats_prepared_control where id;
 select * into strict g from public.stats_prepared_generations where id=p_generation and status='building';
 if not g.totals_done or (select count(*) from public.stats_prepared_visit_ranges where generation=g.id)<>5 then raise exception 'incomplete-visit-bundle'; end if;
 if c.metadata_revision<>g.metadata_revision or exists(select 1 from public.stats_prepared_dirty where kind='m') then
   update public.stats_prepared_generations set status='failed' where id=g.id; return false;
 end if;
 if (select sum(octet_length(chart::text)) from public.stats_prepared_visit_ranges where generation=g.id)>16777216 then raise exception 'visit-payload-limit'; end if;
 update public.stats_prepared_visit_ranges set chart=jsonb_set(chart,'{generatedAt}',to_jsonb(built_at)) where generation=g.id;
 update public.stats_prepared_generations set status='ready',generated_at=built_at,published_at=built_at,
   payload_hash=(select encode(sha256(convert_to(jsonb_object_agg(days::text,chart order by days)::text,'UTF8')),'hex') from public.stats_prepared_visit_ranges where generation=g.id) where id=g.id;
 update public.stats_prepared_control set previous_visit=active_visit,active_visit=g.id,visit_signature=g.signature where id;
 insert into public.revalidation_events(entity_type,slug,source) values('stats','overview','prepared-charts')
 on conflict(entity_type,slug) do update set created_at=now(),source=excluded.source;
 return true;
end $$;

create function stats_prepared_private.stats_prepared_cleanup_v1() returns boolean
language plpgsql volatile security invoker set search_path='' set timezone='UTC' as $$
declare c public.stats_prepared_control; gid uuid; vid uuid;
begin
 select * into c from public.stats_prepared_control where id;
 select id into gid from public.stats_prepared_generations
 where status<>'building' and id<>all(array_remove(array[c.active_platform,c.previous_platform,c.active_visit,c.previous_visit],null))
 order by created_at limit 1;
 if gid is not null then
   delete from public.stats_prepared_visit_totals where (generation,universe_id) in
     (select generation,universe_id from public.stats_prepared_visit_totals where generation=gid limit 1000);
   if not exists(select 1 from public.stats_prepared_visit_totals where generation=gid) then
     delete from public.stats_prepared_generations where id=gid;
   end if;
 end if;
 -- Cache retention is 180 days. Ready generation payloads contain their own
 -- platform rows; visit manifests explicitly protect immutable day versions.
 delete from public.stats_prepared_buckets where (kind,bucket) in
   (select kind,bucket from public.stats_prepared_buckets where bucket<date_trunc('day',now())-interval '180 days' limit 1000);
 select v.id into vid from public.stats_prepared_versions v
 where v.status<>'building' and not exists(select 1 from public.stats_prepared_buckets b where b.version=v.id)
 and not exists(select 1 from public.stats_prepared_generations g where g.product='visit'
   and g.manifest->'days' @> jsonb_build_array(jsonb_build_object('version',v.id)))
 order by v.created_at limit 1;
 if vid is not null then
   delete from public.stats_prepared_visits where (version,universe_id) in
     (select version,universe_id from public.stats_prepared_visits where version=vid limit 1000);
   if not exists(select 1 from public.stats_prepared_visits where version=vid) then delete from public.stats_prepared_versions where id=vid; end if;
 end if;
 delete from public.stats_prepared_dirty where (kind,bucket) in
   (select kind,bucket from public.stats_prepared_dirty where kind in ('h','d') and bucket<date_trunc('day',now())-interval '180 days' limit 1000);
 delete from public.stats_prepared_receipts where step_id in
   (select step_id from public.stats_prepared_receipts where created_at<now()-interval '1 day' order by created_at limit 1000);
 return gid is not null or vid is not null;
end $$;

create function public.run_stats_prepared_step_v1(p_lease_token uuid,p_epoch bigint,p_step_id uuid,p_work jsonb) returns jsonb
language plpgsql volatile security invoker set search_path='' set timezone='UTC'
set statement_timeout='6s' set lock_timeout='500ms' as $$
declare c public.stats_prepared_control; receipt public.stats_prepared_receipts;
 phase text; gid uuid; n integer; result jsonb; more boolean:=true; cleaned boolean;
begin
 if p_step_id is null or p_step_id=p_lease_token or p_work is distinct from '{"kind":"advance"}'::jsonb then raise exception 'invalid-step' using errcode='22023'; end if;
 select * into c from public.stats_prepared_control where id for update;
 select * into receipt from public.stats_prepared_receipts where step_id=p_step_id;
 if receipt.step_id is not null then
   if receipt.lease_token is distinct from p_lease_token or receipt.epoch is distinct from p_epoch then raise exception 'receipt-owner-mismatch'; end if;
   return receipt.outcome;
 end if;
 if p_lease_token is null or p_epoch is null or c.lease_until is null or c.lease_token is distinct from p_lease_token or c.lease_epoch is distinct from p_epoch or c.lease_until<=clock_timestamp() then raise exception 'stale-lease' using errcode='55000'; end if;
 -- Every mutator is serialized by this fenced row lock. No pooled session lock.
 update public.stats_prepared_control set lease_until=clock_timestamp()+interval '240 seconds',steps=steps+1 where id;
 if c.steps>=24 and stats_prepared_private.stats_prepared_publish_platform_v1() then phase:='platform-publish';
 elsif exists(select 1 from public.stats_prepared_dirty where kind='h' and bucket>=now()-interval '48 hours')
   and ((c.daily_scan is null and (c.active_platform is null or not exists(select 1 from public.stats_prepared_dirty where kind='d'))) or c.steps%4=0) then
   perform stats_prepared_private.stats_prepared_hour_v1(); phase:='hour';
 elsif c.daily_scan is not null or exists(select 1 from public.stats_prepared_dirty where kind='d') then
   phase:=stats_prepared_private.stats_prepared_daily_v1();
 else
   select id into gid from public.stats_prepared_generations where product='visit' and status='building';
   if gid is null and stats_prepared_private.stats_prepared_visit_start_v1() then
     select id into gid from public.stats_prepared_generations where product='visit' and status='building';
   end if;
   if gid is not null then
     if stats_prepared_private.stats_prepared_visit_totals_v1(gid) then phase:='visit-totals';
     else
       select d into n from unnest(array[1,7,14,30,90]) d where not exists(
         select 1 from public.stats_prepared_visit_ranges r where r.generation=gid and r.days=d) order by d limit 1;
       if n is not null then perform stats_prepared_private.stats_prepared_visit_range_v1(gid,n); phase:='visit-range-'||n;
       else perform stats_prepared_private.stats_prepared_visit_publish_v1(gid); phase:='visit-publish'; end if;
     end if;
   elsif stats_prepared_private.stats_prepared_hour_v1() then phase:='hour-backfill';
   elsif stats_prepared_private.stats_prepared_publish_platform_v1() then phase:='platform-publish';
   else phase:='unchanged'; more:=false;
   end if;
 end if;
 cleaned:=stats_prepared_private.stats_prepared_cleanup_v1();
 if phase='unchanged' and cleaned then phase:='cleanup'; more:=true; end if;
 result:=jsonb_build_object('phase',phase,'more',more,'platformGeneration',
   (select active_platform from public.stats_prepared_control where id),'visitGeneration',
   (select active_visit from public.stats_prepared_control where id));
 insert into public.stats_prepared_receipts(step_id,lease_token,epoch,outcome) values(p_step_id,p_lease_token,p_epoch,result);
 return result;
end $$;

create function public.get_stats_prepared_receipt_v1(p_step_id uuid) returns jsonb
language sql stable security invoker set search_path='' set statement_timeout='2s' set lock_timeout='500ms' as $$
 select jsonb_build_object('found',exists(select 1 from public.stats_prepared_receipts where step_id=p_step_id),
   'outcome',(select outcome from public.stats_prepared_receipts where step_id=p_step_id));
$$;

create function public.finish_stats_prepared_work_v1(p_lease_token uuid,p_epoch bigint,p_outcome jsonb) returns jsonb
language plpgsql volatile security invoker set search_path='' set timezone='UTC'
set statement_timeout='3s' set lock_timeout='500ms' as $$
declare c public.stats_prepared_control; result jsonb; state text:=p_outcome->>'status'; code text:=p_outcome->>'code';
begin
 select * into c from public.stats_prepared_control where id for update;
 select outcome into result from public.stats_prepared_receipts where step_id=p_lease_token and lease_token=p_lease_token and epoch=p_epoch;
 if found then return result; end if;
 if p_lease_token is null or p_epoch is null or c.lease_until is null or c.lease_token is distinct from p_lease_token or c.lease_epoch is distinct from p_epoch or c.lease_until<=clock_timestamp() then raise exception 'stale-lease' using errcode='55000'; end if;
 if state is null or state not in ('completed','yielded','error') or (code is not null and code !~ '^[a-z0-9-]{1,64}$')
   or p_outcome-array['status','code']<>'{}'::jsonb then raise exception 'invalid-outcome' using errcode='22023'; end if;
 update public.stats_prepared_control set checked_at=clock_timestamp(),lease_token=null,lease_until=null,
   error_code=case when state='error' then coalesce(code,'worker-failed') end,
   failures=case when state='error' then failures+1 else 0 end,
   retry_at=case when state='error' then clock_timestamp()+make_interval(mins=>least(30,5*(2^least(failures,3))::integer)) end,
   success_at=case when state<>'error' then clock_timestamp() else success_at end where id;
 result:=jsonb_build_object('status',state,'code',code,'remainingBuckets',(select count(*) from public.stats_prepared_dirty),
   'dailyScan',c.daily_scan,'dailyAfter',c.daily_after::text,'steps',c.steps,
   'visitStage',(select id from public.stats_prepared_generations where product='visit' and status='building'));
 insert into public.stats_prepared_receipts(step_id,lease_token,epoch,outcome) values(p_lease_token,p_lease_token,p_epoch,result);
 return result;
end $$;

-- Ready generations and their range payloads are immutable. Cleanup may
-- delete only generations that no longer own either retained public pointer.
create function stats_prepared_private.stats_prepared_immutable_v1() returns trigger
language plpgsql volatile security invoker set search_path='' as $$
begin
 if tg_table_name='stats_prepared_generations' then
   if tg_op='UPDATE' and old.status='ready' and new is distinct from old then
     raise exception 'ready-generation-immutable' using errcode='55000';
   elsif tg_op='DELETE' and exists(select 1 from public.stats_prepared_control c
     where old.id in (c.active_platform,c.previous_platform,c.active_visit,c.previous_visit)) then
     raise exception 'retained-generation-protected' using errcode='55000';
   end if;
 else
   if exists(select 1 from public.stats_prepared_generations where id=old.generation and status='ready') then
     raise exception 'ready-range-immutable' using errcode='55000';
   end if;
 end if;
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
create trigger stats_prepared_immutable before update or delete on public.stats_prepared_generations
 for each row execute function stats_prepared_private.stats_prepared_immutable_v1();
create trigger stats_prepared_immutable before update or delete on public.stats_prepared_visit_ranges
 for each row execute function stats_prepared_private.stats_prepared_immutable_v1();

-- No public SELECT policies, no exposed mutation primitives. Internal helpers
-- remain service-only as they are called by SECURITY INVOKER worker RPCs.
do $$
declare obj record;
begin
 for obj in select tablename from pg_tables where schemaname='public' and tablename like 'stats_prepared_%' loop
   execute format('alter table public.%I enable row level security',obj.tablename);
   execute format('revoke all on table public.%I from public,anon,authenticated',obj.tablename);
   execute format('grant select,insert,update,delete on table public.%I to service_role',obj.tablename);
 end loop;
 for obj in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','stats_prepared_private') and (p.proname like 'stats_prepared_%_v1' or p.proname in (
 'claim_stats_prepared_work_v1','run_stats_prepared_step_v1','get_stats_prepared_receipt_v1',
 'finish_stats_prepared_work_v1','get_stats_prepared_health_v1','get_stats_prepared_platform_chart_v1','get_stats_prepared_visit_share_v1')) loop
   execute format('revoke all on function %s from public,anon,authenticated',obj.signature);
   execute format('grant execute on function %s to service_role',obj.signature);
 end loop;
end $$;
notify pgrst,'reload schema';
