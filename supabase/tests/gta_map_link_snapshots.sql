-- The harness loads the actual October guard, nine full importer snapshots and
-- the new prerequisite. No substitute constraint or renderer trigger is used.
select pg_temp.url_assert(count(*)=9 and bool_and(
 public.valid_gta_map_snapshot(slug,renderer,before) is true
 and public.valid_gta_map_snapshot(slug,renderer,after) is true
 and encode(extensions.digest(after::text,'sha256'),'hex')=after_hash
),'all old and exact canonical snapshots remain registered') from reviewed_maps;
select pg_temp.url_assert(
 not has_function_privilege('anon','public.valid_gta_map_snapshot(text,text,jsonb)','execute')
 and not has_function_privilege('authenticated','public.valid_gta_map_snapshot(text,text,jsonb)','execute')
 and has_function_privilege('service_role','public.valid_gta_map_snapshot(text,text,jsonb)','execute'),
 'snapshot function remains service-only');

do $fixture$
declare
 m record; data jsonb; changed jsonb; path text[]; variant integer;
 rejected boolean; failed_constraint text;
begin
 for m in select * from reviewed_maps loop
  -- Check mutations of BOTH accepted snapshots. Every mutation changes an
  -- existing real leaf, rather than adding an unrelated synthetic property.
  foreach data in array array[m.before,m.after] loop
   for variant in 1..4 loop
    path := case
     when m.slug='gta5' then case variant
      when 1 then array['markerSnapshot','0','image']
      when 2 then array['markerSnapshot','0','x']
      when 3 then array['markerSnapshot','0','description']
      else array['markerSnapshot','0','guideUrl'] end
     else case variant
      when 1 then array['definition','views','0','image']
      when 2 then array['points','0','x']
      when 3 then array['points','0','description']
      else array['definition','route'] end end;
    perform pg_temp.url_assert(data #> path is not null,'mutation target must exist');
    changed := jsonb_set(data,path,case when variant=2
     then to_jsonb((data #>> path)::numeric + 0.125)
     else to_jsonb((data #>> path)||'-unreviewed') end);
    perform pg_temp.url_assert(changed is distinct from data,'mutation must change the snapshot');
    perform pg_temp.url_assert(public.valid_gta_map_snapshot(m.slug,m.renderer,changed) is false,
     'unreviewed asset/coordinate/content/link accepted: '||m.slug);
    rejected:=false;
    begin
     update public.game_map_pages set map_data=changed where id=m.id;
    exception when check_violation then
     get stacked diagnostics failed_constraint = constraint_name;
     if failed_constraint <> 'game_registered_map_snapshot_check' then raise; end if;
     rejected:=true;
    end;
    perform pg_temp.url_assert(rejected,'real constraint accepted altered snapshot');
   end loop;
   perform pg_temp.url_assert(public.valid_gta_map_snapshot(m.slug,'image-pins',data) is false,
    'registered renderer identity was bypassed');
   perform pg_temp.url_assert(public.valid_gta_map_snapshot('unregistered',m.renderer,data) is not true,
    'unregistered slug accepted');
  end loop;
  rejected:=false;
  begin
   update public.game_map_pages set renderer_key='image-pins' where id=m.id;
  exception when raise_exception then
   if sqlerrm <> 'Map renderer identity is permanent; use a reviewed migration' then raise; end if;
   rejected:=true;
  end;
  perform pg_temp.url_assert(rejected,'real renderer trigger allowed replacement');
 end loop;
end $fixture$;
