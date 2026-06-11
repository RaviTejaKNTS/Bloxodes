do $$
begin
  perform cron.unschedule('revalidate cron');
exception
  when others then
    null;
end;
$$;

select cron.schedule(
  'revalidate cron',
  '* * * * *',
  'select public.invoke_revalidation_worker();'
);
