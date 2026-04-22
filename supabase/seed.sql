-- Local-only seed data.
-- This file is run by `supabase db reset` after migrations.

insert into storage.buckets (id, name, public)
values ('bloxodes-media', 'bloxodes-media', true)
on conflict (id) do nothing;
