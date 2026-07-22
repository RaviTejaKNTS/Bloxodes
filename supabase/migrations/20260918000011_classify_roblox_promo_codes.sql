-- Keep the public promo-code view focused on codes with a clear player-facing state.

update public.roblox_promo_rewards
set
  status = 'verified_claimable',
  status_reason = 'editorial_review_2026_07_22',
  verified_at = now(),
  updated_at = now()
where source_provider = 'robloxden'
  and promo_code_normalized = 'SPIDERCOLA'
  and status is distinct from 'verified_claimable';

update public.roblox_promo_rewards
set
  status = 'expired',
  status_reason = 'editorial_review_2026_07_22',
  updated_at = now()
where source_provider = 'robloxden'
  and promo_code_normalized in ('FREENGNBOI', 'FREENGNGON', 'TWEETROBLOX')
  and status is distinct from 'expired';
