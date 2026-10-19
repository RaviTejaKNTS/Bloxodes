begin;

-- Event ingestion continues, but automated event guide generation is retired.
drop table if exists public.event_guide_generation_queue;

commit;
