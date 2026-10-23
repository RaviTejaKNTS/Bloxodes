-- Isolated QA schema only. __SCHEMA__ is replaced by a validated generated name.
-- Deterministic ranks, null slugs/outside-index games, zero/reset precedence,
-- inclusive dates, decimal weighting and >1000 hourly points.
insert into __SCHEMA__.roblox_universes(universe_id,root_place_id,name,slug)
 select n,n,'Fixture '||n,case when n%5=0 then null else 'fixture-'||n end from generate_series(1,__GAMES__) n;
insert into __SCHEMA__.stats_game_current_index(universe_id,slug,name)
 select n,'fixture-'||n,'Fixture '||n from generate_series(1,2) n;
insert into __SCHEMA__.roblox_universe_stats_daily(
 universe_id,stat_date,playing,avg_playing,peak_playing,visits,favorites,rating_end,
 sample_count,visit_delta,visits_start,visits_end,recorded_at,is_finalized,snapshot)
 select n,current_date-offset_days,6,6.2,7,1000,50,60,1,
   case when n=1 and offset_days=0 then 0 when n=2 and offset_days=0 then -9
     when n in (3,4) then (__GAMES__-3+1)*100+offset_days
     else (__GAMES__-n+1)*100+offset_days end,
   0,999999,least(now(),(current_date-offset_days)::timestamptz+interval '12 hours'),offset_days>0,
   '{"source":"roblox_universe_stats_hourly"}'::jsonb
 from generate_series(__START_ID__,__END_ID__) n cross join generate_series(0,90) offset_days;
-- Raw history extends beyond the supported hourly 90 days to prove that old
-- membership history is honestly partial, rather than blocking all new work.
insert into __SCHEMA__.roblox_universe_stats_hourly(
 universe_id,hour_start,playing,avg_playing,peak_playing,visits_end,favorites_end,
 rating_percent,sample_count,first_sampled_at,last_sampled_at)
 select n,h,case when n=1 then 24 else 6 end,case when n=1 then 23.5 else 6.2 end,
   case when n=1 then 27 else 7 end,1000,50,case when n=1 then 90.15 else 60 end,
   case when n=1 then 2 else 1 end,h,h+interval '1 minute'
 from generate_series(1,2) n cross join generate_series(date_trunc('hour',now())-interval '180 days',date_trunc('hour',now())-interval '1 hour',interval '1 hour') h;
