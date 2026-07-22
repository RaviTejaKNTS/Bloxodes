-- Source-backed Roblox-wide promo codes and promotional reward items.
-- The table stays service-role only because raw source evidence is retained for audits.

create table if not exists public.roblox_promo_rewards (
  id uuid primary key default gen_random_uuid(),
  source_provider text not null default 'robloxden',
  source_key text not null,
  source_list_url text not null,
  source_url text not null,
  asset_id bigint not null,
  roblox_item_type text not null default 'Asset',
  reward_name text not null,
  source_type text not null,
  claim_type text not null,
  promo_code text,
  promo_code_normalized text,
  event_name text,
  requirement_text text,
  claim_instructions text,
  destination_url text,
  roblox_item_url text,
  official_name text,
  asset_type_id integer,
  creator_id bigint,
  creator_name text,
  thumbnail_url text,
  thumbnail_state text,
  thumbnail_checked_at timestamptz,
  status text not null default 'source_listed_unverified',
  status_reason text,
  consecutive_misses integer not null default 0,
  sort_order integer not null default 0,
  source_hash text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_checked_at timestamptz not null default now(),
  verified_at timestamptz,
  retired_at timestamptz,
  raw_source_json jsonb not null default '{}'::jsonb,
  raw_roblox_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roblox_promo_rewards_source_unique unique (source_provider, source_key),
  constraint roblox_promo_rewards_item_type_check check (roblox_item_type in ('Asset', 'Bundle')),
  constraint roblox_promo_rewards_source_key_check check (length(btrim(source_key)) > 0),
  constraint roblox_promo_rewards_source_type_check check (
    source_type in ('code', 'event', 'creator-challenge', 'catalog-claim', 'collaboration')
  ),
  constraint roblox_promo_rewards_claim_type_check check (
    claim_type in (
      'web_promo_code',
      'experience_code',
      'event_task',
      'creator_challenge',
      'catalog_claim',
      'collaboration',
      'gift_card_promotion'
    )
  ),
  constraint roblox_promo_rewards_status_check check (
    status in (
      'source_listed_unverified',
      'verified_claimable',
      'unavailable',
      'expired',
      'inactive',
      'error'
    )
  ),
  constraint roblox_promo_rewards_code_check check (
    claim_type not in ('web_promo_code', 'experience_code')
    or (promo_code is not null and length(btrim(promo_code)) > 0)
  ),
  constraint roblox_promo_rewards_code_normalized_check check (
    (promo_code is null and promo_code_normalized is null)
    or (
      promo_code is not null
      and promo_code_normalized = upper(btrim(promo_code))
    )
  ),
  constraint roblox_promo_rewards_misses_check check (consecutive_misses >= 0),
  constraint roblox_promo_rewards_sort_order_check check (sort_order >= 0)
);

comment on table public.roblox_promo_rewards is
  'Roblox-wide promotional codes and reward offers discovered from RobloxDen and enriched with official Roblox asset metadata.';
comment on column public.roblox_promo_rewards.status is
  'Claimability state. Source listing alone is source_listed_unverified and must not be presented as official proof that an old reward is still earnable.';
comment on column public.roblox_promo_rewards.raw_source_json is
  'Private audit evidence from the discovery source. Never render this field publicly.';

create index if not exists idx_roblox_promo_rewards_status_type_seen
  on public.roblox_promo_rewards (status, claim_type, last_seen_at desc);

create index if not exists idx_roblox_promo_rewards_asset_id
  on public.roblox_promo_rewards (asset_id);

create index if not exists idx_roblox_promo_rewards_promo_code
  on public.roblox_promo_rewards (promo_code_normalized)
  where promo_code_normalized is not null;

create index if not exists idx_roblox_promo_rewards_sort_order
  on public.roblox_promo_rewards (sort_order, reward_name);

drop trigger if exists trg_roblox_promo_rewards_updated_at on public.roblox_promo_rewards;
create trigger trg_roblox_promo_rewards_updated_at
before update on public.roblox_promo_rewards
for each row execute function public.set_updated_at();

create or replace function public.trg_enqueue_revalidation_promo_rewards()
returns trigger
language plpgsql
as $$
begin
  perform public.enqueue_revalidation(
    'catalog',
    'roblox-promo-codes',
    'roblox_promo_rewards_' || lower(tg_op)
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_enqueue_revalidation_promo_rewards on public.roblox_promo_rewards;
create trigger trg_enqueue_revalidation_promo_rewards
after insert or update or delete on public.roblox_promo_rewards
for each row execute function public.trg_enqueue_revalidation_promo_rewards();

-- Apply one complete-source refresh atomically. The caller validates and enriches
-- the source before invoking this function; a failed/incomplete scrape never calls it.
create or replace function public.refresh_roblox_promo_rewards(
  p_seen_rows jsonb,
  p_checked_at timestamptz,
  p_retire_after_misses integer,
  p_touch_catalog boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_seen_count bigint := 0;
  v_missing_updated bigint := 0;
  v_retired bigint := 0;
  v_catalog_touched bigint := 0;
begin
  if jsonb_typeof(p_seen_rows) is distinct from 'array' then
    raise exception 'p_seen_rows must be a JSON array';
  end if;
  if p_checked_at is null then
    raise exception 'p_checked_at is required';
  end if;
  if p_retire_after_misses is null or p_retire_after_misses < 2 then
    raise exception 'p_retire_after_misses must be at least 2';
  end if;

  select jsonb_array_length(p_seen_rows) into v_seen_count;
  if v_seen_count = 0 then
    raise exception 'p_seen_rows must not be empty';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(73724570123456789);

  insert into public.roblox_promo_rewards (
    source_provider,
    source_key,
    source_list_url,
    source_url,
    asset_id,
    roblox_item_type,
    reward_name,
    source_type,
    claim_type,
    promo_code,
    promo_code_normalized,
    event_name,
    requirement_text,
    claim_instructions,
    destination_url,
    roblox_item_url,
    official_name,
    asset_type_id,
    creator_id,
    creator_name,
    thumbnail_url,
    thumbnail_state,
    thumbnail_checked_at,
    status,
    status_reason,
    consecutive_misses,
    sort_order,
    source_hash,
    last_seen_at,
    last_checked_at,
    verified_at,
    retired_at,
    raw_source_json,
    raw_roblox_json
  )
  select
    input_row.source_provider,
    input_row.source_key,
    input_row.source_list_url,
    input_row.source_url,
    input_row.asset_id,
    input_row.roblox_item_type,
    input_row.reward_name,
    input_row.source_type,
    input_row.claim_type,
    input_row.promo_code,
    input_row.promo_code_normalized,
    input_row.event_name,
    input_row.requirement_text,
    input_row.claim_instructions,
    input_row.destination_url,
    input_row.roblox_item_url,
    input_row.official_name,
    input_row.asset_type_id,
    input_row.creator_id,
    input_row.creator_name,
    input_row.thumbnail_url,
    input_row.thumbnail_state,
    input_row.thumbnail_checked_at,
    input_row.status,
    input_row.status_reason,
    input_row.consecutive_misses,
    input_row.sort_order,
    input_row.source_hash,
    input_row.last_seen_at,
    input_row.last_checked_at,
    input_row.verified_at,
    input_row.retired_at,
    input_row.raw_source_json,
    input_row.raw_roblox_json
  from jsonb_to_recordset(p_seen_rows) as input_row (
    source_provider text,
    source_key text,
    source_list_url text,
    source_url text,
    asset_id bigint,
    roblox_item_type text,
    reward_name text,
    source_type text,
    claim_type text,
    promo_code text,
    promo_code_normalized text,
    event_name text,
    requirement_text text,
    claim_instructions text,
    destination_url text,
    roblox_item_url text,
    official_name text,
    asset_type_id integer,
    creator_id bigint,
    creator_name text,
    thumbnail_url text,
    thumbnail_state text,
    thumbnail_checked_at timestamptz,
    status text,
    status_reason text,
    consecutive_misses integer,
    sort_order integer,
    source_hash text,
    last_seen_at timestamptz,
    last_checked_at timestamptz,
    verified_at timestamptz,
    retired_at timestamptz,
    raw_source_json jsonb,
    raw_roblox_json jsonb
  )
  on conflict (source_provider, source_key) do update set
    source_list_url = excluded.source_list_url,
    source_url = excluded.source_url,
    asset_id = excluded.asset_id,
    roblox_item_type = excluded.roblox_item_type,
    reward_name = excluded.reward_name,
    source_type = excluded.source_type,
    claim_type = excluded.claim_type,
    promo_code = excluded.promo_code,
    promo_code_normalized = excluded.promo_code_normalized,
    event_name = excluded.event_name,
    requirement_text = excluded.requirement_text,
    claim_instructions = excluded.claim_instructions,
    destination_url = excluded.destination_url,
    roblox_item_url = excluded.roblox_item_url,
    official_name = excluded.official_name,
    asset_type_id = excluded.asset_type_id,
    creator_id = excluded.creator_id,
    creator_name = excluded.creator_name,
    thumbnail_url = excluded.thumbnail_url,
    thumbnail_state = excluded.thumbnail_state,
    thumbnail_checked_at = excluded.thumbnail_checked_at,
    status = excluded.status,
    status_reason = excluded.status_reason,
    consecutive_misses = 0,
    sort_order = excluded.sort_order,
    source_hash = excluded.source_hash,
    last_seen_at = excluded.last_seen_at,
    last_checked_at = excluded.last_checked_at,
    verified_at = excluded.verified_at,
    retired_at = null,
    raw_source_json = excluded.raw_source_json,
    raw_roblox_json = excluded.raw_roblox_json;

  with seen_keys as (
    select value ->> 'source_key' as source_key
    from jsonb_array_elements(p_seen_rows)
  ),
  missing_candidates as (
    select
      reward.id,
      reward.consecutive_misses + 1 as next_misses,
      reward.consecutive_misses + 1 >= p_retire_after_misses as will_retire
    from public.roblox_promo_rewards as reward
    where reward.source_provider = 'robloxden'
      and reward.status <> 'inactive'
      and not exists (
        select 1 from seen_keys where seen_keys.source_key = reward.source_key
      )
  ),
  updated_missing as (
    update public.roblox_promo_rewards as reward
    set
      consecutive_misses = candidate.next_misses,
      last_checked_at = p_checked_at,
      status = case when candidate.will_retire then 'inactive' else reward.status end,
      status_reason = case
        when candidate.will_retire
          then 'missing_from_' || p_retire_after_misses::text || '_complete_source_refreshes'
        else reward.status_reason
      end,
      retired_at = case when candidate.will_retire then p_checked_at else reward.retired_at end
    from missing_candidates as candidate
    where reward.id = candidate.id
    returning candidate.will_retire
  )
  select count(*), count(*) filter (where will_retire)
  into v_missing_updated, v_retired
  from updated_missing;

  if p_touch_catalog then
    update public.catalog_pages
    set updated_at = p_checked_at
    where code = 'roblox-promo-codes';
    get diagnostics v_catalog_touched = row_count;
  end if;

  return jsonb_build_object(
    'seen_count', v_seen_count,
    'missing_updated', v_missing_updated,
    'retired', v_retired,
    'catalog_touched', v_catalog_touched
  );
end;
$$;

alter table public.roblox_promo_rewards enable row level security;

revoke all on table public.roblox_promo_rewards from public, anon, authenticated;
grant all on table public.roblox_promo_rewards to service_role;

revoke all on function public.trg_enqueue_revalidation_promo_rewards() from public, anon, authenticated;
grant execute on function public.trg_enqueue_revalidation_promo_rewards() to service_role;

revoke all on function public.refresh_roblox_promo_rewards(jsonb, timestamptz, integer, boolean)
  from public, anon, authenticated;
grant execute on function public.refresh_roblox_promo_rewards(jsonb, timestamptz, integer, boolean)
  to service_role;
