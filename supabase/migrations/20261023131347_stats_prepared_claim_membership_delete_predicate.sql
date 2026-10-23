-- Keep the complete membership reset compatible with HTTP pg-safeupdate.
-- universe_id is a primary key, so this predicate still removes every member.
-- CREATE OR REPLACE retains the existing function identity, owner and ACL.
create or replace function public.claim_stats_prepared_work_v1(p_worker_id text,p_request_id uuid) returns jsonb
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
   delete from public.stats_prepared_members where universe_id is not null;
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
