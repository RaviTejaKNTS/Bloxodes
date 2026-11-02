-- Link-only repairs must retain gameplay prose, JSON shape, pagination,
-- queries/fragments and the old namespace paths used by static map assets.
do $$
declare
  before_value jsonb := jsonb_build_object(
    'description', 'See [parts](/gta/wiki/gta-5/spaceship-parts/page/2?sort=name#map) and <https://bloxodes.com/red-dead/wiki/red-dead-redemption-2/cigarette-cards#locations>.',
    'assets', jsonb_build_array('/gta/maps/gta5/tiles/1/2/3.png', 'https://other.example/gta/wiki/gta-5/spaceship-parts'),
    'more', jsonb_build_array('/gta/wiki/gta-5/spaceship-parts-extra', '/minecraft/java/wiki/enchantments?edition=java#levels', null, 42)
  );
  expected jsonb;
  actual jsonb;
  mapping jsonb := '{"/gta/wiki/gta-5/spaceship-parts":"/wiki/gta-5/spaceship-parts","/red-dead/wiki/red-dead-redemption-2/cigarette-cards":"/wiki/red-dead-redemption-2/cigarette-cards","/minecraft/java/wiki/enchantments":"/wiki/minecraft-java/enchantments","/gta/maps/gta5":"/maps/gta5"}';
  collections jsonb := '["/gta/wiki/gta-5/spaceship-parts","/red-dead/wiki/red-dead-redemption-2/cigarette-cards"]';
begin
  expected := jsonb_set(before_value, '{description}', to_jsonb('See [parts](/wiki/gta-5/spaceship-parts/page/2?sort=name#map) and <https://bloxodes.com/wiki/red-dead-redemption-2/cigarette-cards#locations>.'::text));
  expected := jsonb_set(expected, '{more,1}', to_jsonb('/wiki/minecraft-java/enchantments?edition=java#levels'::text));
  actual := public.rewrite_game_url_links(before_value, mapping, collections);
  if actual is distinct from expected then
    raise exception 'Stored game link repair changed unrelated content or lost a URL suffix';
  end if;
  if public.rewrite_game_url_links(actual, mapping, collections) is distinct from actual then
    raise exception 'Stored game link repair must be idempotent';
  end if;
end $$;
