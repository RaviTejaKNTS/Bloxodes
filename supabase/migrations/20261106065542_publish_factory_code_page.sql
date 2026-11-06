-- Commit prepared factory content and link credits together. No intermediate unpublish.
CREATE FUNCTION public.publish_factory_code_page(
  p_page_id uuid, p_payload jsonb, p_bundle_hash text, p_linked_ids uuid[]
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  previous public.code_pages;
  prepared public.code_pages;
  credited jsonb;
  target uuid;
BEGIN
  IF p_bundle_hash !~ '^[a-f0-9]{64}$' OR p_bundle_hash IS NULL
     OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid factory publication payload';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_payload) AS k(key) WHERE key <> ALL (ARRAY[
    'name','slug','universe_id','roblox_link','source_url','source_url_2',
    'intro_md','redeem_md','troubleshoot_md','rewards_md','find_codes_md','seo_description',
    'cover_image','community_link','discord_link','twitter_link','youtube_link','interlinking_ai_copy_md'
  ])) THEN RAISE EXCEPTION 'Unexpected factory publication field'; END IF;
  -- All publishers lock shared targets in the same order before changing counts.
  PERFORM id FROM public.code_pages
    WHERE id = p_page_id OR id = ANY(coalesce(p_linked_ids, '{}'::uuid[])) ORDER BY id FOR UPDATE;
  SELECT * INTO STRICT previous FROM public.code_pages WHERE id = p_page_id;
  prepared := jsonb_populate_record(previous, p_payload);
  IF prepared.universe_id IS NULL OR prepared.universe_id <> previous.universe_id
     OR prepared.slug IS DISTINCT FROM previous.slug THEN
    RAISE EXCEPTION 'Factory publication identity mismatch';
  END IF;
  credited := coalesce(previous.interlinking_ai->'credited_page_ids', '[]'::jsonb);
  FOR target IN SELECT DISTINCT unnest(coalesce(p_linked_ids, '{}'::uuid[])) LOOP
    IF target = p_page_id THEN RAISE EXCEPTION 'Factory page cannot credit itself'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.code_pages WHERE id = target AND is_published) THEN
      RAISE EXCEPTION 'Linked page is absent or unpublished';
    END IF;
    IF NOT credited @> jsonb_build_array(target::text) THEN
      UPDATE public.code_pages SET internal_links = coalesce(internal_links, 0) + 1 WHERE id = target;
      credited := credited || jsonb_build_array(target::text);
    END IF;
  END LOOP;
  UPDATE public.code_pages SET
    name = prepared.name, roblox_link = prepared.roblox_link,
    source_url = prepared.source_url, source_url_2 = prepared.source_url_2,
    intro_md = prepared.intro_md, redeem_md = prepared.redeem_md,
    troubleshoot_md = prepared.troubleshoot_md, rewards_md = prepared.rewards_md,
    find_codes_md = prepared.find_codes_md, seo_description = prepared.seo_description,
    cover_image = prepared.cover_image, community_link = prepared.community_link, discord_link = prepared.discord_link,
    twitter_link = prepared.twitter_link, youtube_link = prepared.youtube_link,
    interlinking_ai_copy_md = prepared.interlinking_ai_copy_md,
    interlinking_ai = previous.interlinking_ai || jsonb_build_object(
      'generated_by', 'content-factory', 'version', 1, 'bundle_hash', p_bundle_hash, 'credited_page_ids', credited),
    is_published = true, published_at = coalesce(previous.published_at, now())
  WHERE id = p_page_id;
END;
$$;
REVOKE ALL ON FUNCTION public.publish_factory_code_page(uuid, jsonb, text, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_factory_code_page(uuid, jsonb, text, uuid[]) TO service_role;
