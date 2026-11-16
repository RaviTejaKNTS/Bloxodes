import fs from "node:fs";
import { addPublicSamples, addStatsSamples } from "./data-samples.mjs";
import { rowContract } from "./data-query.mjs";
import { defaultCatalogTables } from "./catalog-query-fixture.mjs";
const read = file => JSON.parse(fs.readFileSync(new URL(`./fixtures/${file}`, import.meta.url), "utf8"));
const timestamp = "2026-11-01T12:00:00Z";
const common = { seo_title: null, is_published: true, is_public: true, published_at: timestamp, created_at: timestamp, updated_at: timestamp, content_updated_at: timestamp,
  description_md: "Explore the map, collect useful items and plan the next route.", intro_md: "Find the items and routes for your next game.", meta_description: "Browse game items, locations and controls.", seo_description: "Browse game items, locations and controls.",
  faq_json: [], controls_json: [], description_json: {}, sources_json: [], tips_md: "Check your supplies before you leave.", cover_image: "/Bloxodes.png", hero_image: "/Bloxodes.png", thumb_url: "/Bloxodes.png", image: "/Bloxodes.png" };
const quizData = Object.fromEntries(["easy", "medium", "hard"].map(level => [level, [{ id: `${level}-1`, question: "Which supply restores health?", options: [{id:"a",text:"Medkit"},{id:"b",text:"Rope"},{id:"c",text:"Compass"},{id:"d",text:"Lantern"}], correctOptionId: "a" }]]));
export function seedTables() {
  const tables = Object.fromEntries(read("empty-tables.json").map(table => [table, []]));
  Object.assign(tables, defaultCatalogTables());
  const add = (table, row) => { (tables[table] ??= []).push(row); return row; };
  let serial = 0;
  const id = () => `00000000-0000-4000-8000-${String(++serial).padStart(12,"0")}`;
  const routes = [];
  const route = (page, source, kind) => routes.push({ path: page.canonical_path, source, page_type: kind, page_id: page.id, game_id: page.game_id ?? null,
    status: "live", match_type: "exact", match_self: true, tail_mode: "append", target_url: null, resolved_target: null, redirect_code: 301, origin: "page", created_at: timestamp, moved_at: timestamp });
  const alias = (path, page, kind = "wiki", match_type = "exact") => routes.push({ path, source: "game", page_type: kind, page_id: page.id, game_id: page.game_id,
    status: "old", match_type, match_self: true, tail_mode: "drop", target_url: page.canonical_path, resolved_target: page.canonical_path, redirect_code: 308, origin: "game-url-move", created_at: timestamp, moved_at: timestamp });
  const config = read("pages.json");
  for (const entry of config.games) {
    const parent = tables.games.find(game => game.namespace === entry.namespace && game.slug === entry.parent);
    add("games", { ...common, ...entry, id: id(), url_style: "page_type", parent_id: parent?.id ?? null, parent_game_id: parent?.id ?? null, content_kind: "game", status: "released", short_title: entry.title,
      platforms_json: ["PC"], release_dates_json: {}, official_url: "https://example.com/game", developer: "Game Studio", publisher: "Game Studio" });
  }
  for (const game of tables.games) {
    const path = game.parent_id ? `/wiki/${game.wikiSlug ?? game.slug}` : game.kind === "franchise" ? `/games/${game.namespace}` : `/wiki/${game.slug}`;
    const page = add("game_wiki_pages_view", { ...common, id: id(), game_id: game.id, namespace: game.namespace, slug: game.wikiSlug ?? game.slug, title: game.title,
      canonical_path: path, parent_id: game.parent_id, game_kind: game.kind, game_title: game.title, game_short_title: game.title, game_cover_image: game.cover_image, game_hero_image: game.hero_image,
      game_status: game.status, game_platforms_json: game.platforms_json, game_release_dates_json: {}, game_content_kind: "game" });
    route(page, "game", "wiki");
    if (!game.parent_id) {
      alias(`/${game.namespace}`, page);
      alias(`/${game.namespace}/wiki`, page);
    } else alias(`/${game.namespace}/${game.namespace === "minecraft" ? game.slug + "/wiki" : "wiki/" + game.slug}`, page);
  }
  function collection(entry, shared) {
    const game = shared && tables.games.find(game => game.namespace === entry.namespace && game.slug === entry.game);
    const wiki = shared ? tables.game_wiki_pages_view.find(page => page.game_id === game.id) : tables.wiki_pages.find(page => page.slug === entry.wiki);
    const slug = shared ? (game.wikiSlug ?? game.slug) : entry.wiki;
    const page = { ...common, id: id(), namespace: entry.namespace, game_id: game?.id, universe_id: wiki.universe_id, wiki_page_id: wiki.id, wiki_slug: slug, collection_slug: entry.slug, slug: entry.slug,
      canonical_path: `/wiki/${slug}/${entry.slug}`, code: `${slug}-${entry.slug}`, title: entry.title, display_name: entry.title, page_type: entry.page_type ?? "database", item_count: entry.paginated ? 90 : (entry.count ?? 3),
      how_it_works_md: "", game_title: game?.title, game_short_title: game?.title, game_cover_image: "/Bloxodes.png", game_hero_image: "/Bloxodes.png", published_dataset_id: id() };
    add(shared ? "game_collection_pages_view" : "wiki_collection_pages", page);
    add(shared ? "game_collection_datasets" : "wiki_collection_datasets", { id: page.published_dataset_id, namespace: page.namespace, collection_page_id: page.id, schema_version: 2, content_hash: "a".repeat(64), item_count: page.item_count,
      meta_json: { itemFields: ["name", "description"], display: { descriptionField: "description", tableFields: ["description"] } }, created_at: timestamp, updated_at: timestamp, validation_json: {}, source_manifest_json: {} });
    for (let index = 1; index <= page.item_count; index++) add(shared ? "game_collection_items" : "wiki_collection_items", { namespace: page.namespace, dataset_id: page.published_dataset_id, item_slug: `item-${index}`, item_name: `Trail supply ${index}`, section: index <= page.item_count / 2 ? "Supplies" : "Equipment", sort_order: index, image_key: null,
      fields_json: { ...entry.fields, description: entry.paginated ? "Carry supplies to recover health and reach the next climb. ".repeat(15) : "A supply found near the trail." } });
    route(page, shared ? "game" : "roblox", "collection");
    if (shared) alias(`/${page.namespace}/${page.namespace === "minecraft" ? game.slug + "/wiki" : "wiki/" + game.slug}/${entry.slug}`, page, "collection");
  }
  for (const entry of config.robloxWikis) {
    add("roblox_universes", { universe_id: entry.universe_id, name: entry.title.replace(/ wiki$/, ""), display_name: entry.title.replace(/ wiki$/, ""), slug: entry.slug, icon_url: "/Bloxodes.png", thumbnail_urls: [], genre_l1: "Adventure", playing: 1200, visits: 500000, root_place_id: 2753915549 });
    const page = add("wiki_pages", { ...common, ...entry, id: id(), canonical_path: `/wiki/${entry.slug}`, universe_name: entry.title.replace(/ wiki$/, ""), icon_url: "/Bloxodes.png", thumbnail_urls: [], social_links: [], universe_genre_l1:"Adventure", last_playing_refreshed_at:new Date().toISOString(), playing: 1200, visits: 500000, universe_root_place_id: 2753915549 });
    route(page, "roblox", "wiki");
  }
  config.collections.forEach(entry => collection(entry, true));
  config.robloxCollections.forEach(entry => collection(entry, false));
  for (const wiki of tables.wiki_pages) add("roblox_wiki_registry", { game_slug:wiki.slug,game_name:wiki.universe_name,universe_id:wiki.universe_id,universe_names:[wiki.universe_name],sort_order:1,
    collections:tables.wiki_collection_pages.filter(page=>page.wiki_slug===wiki.slug).map(page=>({slug:page.collection_slug,label:page.display_name,sortOrder:1,pageType:page.page_type})) });
  const peak = tables.games.find(game => game.namespace === "peak");
  for (const kind of ["code", "tool", "map", "quiz", "checklist", "catalog"]) {
    const path = `/${{code:"codes",tool:"tools",map:"maps",quiz:"quizzes",checklist:"checklists",catalog:"catalog"}[kind]}/peak-${kind}`;
    const page = add(`game_${kind}_pages_view`, { ...common, id: id(), game_id: peak.id, namespace: "peak", slug: `peak-${kind}`, code: `peak-${kind}`, title: `PEAK ${kind}`, canonical_path: path, game_title: "PEAK", renderer_key: "image-pins",
      tool_key: "resource-cost", rules_json: { unitCost: 10, resourceLabel: "coins" },
      map_data: { image: "/Bloxodes.png", width: 1024, height: 1024, attribution: "Game map", markers: [{id:"camp",title:"Camp",x:50,y:50}] }, quiz_data: quizData, catalog_data: { columns: [{key:"name",label:"Name"}], items: [{id:"rope",name:"Rope"}] }, sections_json: [{code:"1",title:"Trail"}], faq_json: [], render_config_json: {} });
    route(page, "game", kind);
    alias(`/peak/${{code:"codes",tool:"tools",map:"maps",quiz:"quizzes",checklist:"checklists",catalog:"catalog"}[kind]}`, page, kind);
    if (kind === "checklist") add("game_checklist_items", {id:id(),namespace:"peak",page_id:page.id,section_code:"1.1.1",title:"Reach the camp",description:"Follow the trail.",is_required:true});
  }
  const minecraft = tables.games.find(game => game.namespace === "minecraft" && !game.parent_id);
  const tool = add("game_tool_pages_view", { ...common, id:id(),game_id:minecraft.id,namespace:"minecraft",slug:"nether-coordinate-converter",code:"nether-coordinate-converter",title:"Minecraft Nether coordinate converter",canonical_path:"/tools/minecraft-nether-coordinate-converter",game_title:"Minecraft",tool_key:"nether-coordinate-converter",rules_json:{revision:"ci-1",editions:["java","bedrock"],versions:{java:"1.21",bedrock:"1.21"}} });
  route(tool,"game","tool");alias("/minecraft/tools/nether-coordinate-converter",tool,"tool");
  const gta = tables.games.find(game => game.slug === "gta-5");
  const map = add("game_map_pages_view", { ...common,id:id(),game_id:gta.id,namespace:"gta",slug:"gta5",title:"GTA 5 map",game_title:gta.title,canonical_path:"/maps/gta5",renderer_key:"gta5",map_data:{points:{},places:[],markerSnapshot:[{id:"camp",number:1,layer:"spaceship-parts",name:"Supply stop",area:"San Andreas",description:"Near the trail",facts:[],image:null,x:50,y:50,guideUrl:"/wiki/gta-5/spaceship-parts",collectionCode:null,walkthroughUrl:null}]} });
  route(map,"game","map");alias("/gta/maps/gta5",map,"map");
  const checklist = add("game_checklist_pages_view", {...common,id:id(),game_id:gta.id,namespace:"gta",slug:"gta-5",title:"GTA 5 checklist",game_title:gta.title,canonical_path:"/checklists/gta-5",sections_json:[{code:"1",title:"Story"}]});
  add("game_checklist_items", {id:id(),namespace:"gta",page_id:checklist.id,section_code:"1.1.1",title:"Finish the first mission",description:"Complete the prologue.",is_required:true});
  route(checklist,"game","checklist");alias("/gta/checklists/gta-5",checklist,"checklist");
  for (const [old,target] of [["/gta/checklists/page/2","/games/gta"],["/gta/maps","/games/gta"],["/minecraft/tools","/games/minecraft"],["/minecraft/wiki/legacy-minecraft","/games/minecraft"],["/minecraft/wiki/achievements","/wiki/minecraft-bedrock/achievements"],["/minecraft/wiki/enchantments","/wiki/minecraft-java/enchantments"],["/minecraft/wiki/mobs","/wiki/minecraft-java/mobs"]]) {
    const live=routes.find(row=>row.path===target && row.status==="live");alias(old,{id:live.page_id,game_id:live.game_id,canonical_path:target},live.page_type);
  }
  const author = add("authors", {...common,gravatar_email:null,twitter:null,youtube:null,website:null,facebook:null,linkedin:null,instagram:null,roblox:null,discord:null,id:id(),name:"Alex Rivers",slug:"alex-rivers",bio_md:"Game guides and item routes.",avatar_url:"/Bloxodes.png"});
  const universe=tables.roblox_universes[0];
  const article=add("articles", {...common,id:id(),slug:"blox-fruits-first-island",title:"Blox Fruits first island guide",content_md:"## Start at the docks\nTalk to the quest giver and defeat the nearby enemies.\n\n## Prepare for the next island\nBuy a boat after finishing the first quests.",author_id:author.id,author,universe_id:universe.universe_id,universe,tags:["Blox Fruits"],sources:[],word_count:38,canonical_path:"/articles/blox-fruits-first-island",namespace:null,game_id:null,source:"roblox",game_slug:"blox-fruits",game_title:"Blox Fruits"});
  route(article,"roblox","article");
  const codes=add("code_pages", {...common,id:id(),slug:"blox-fruits",name:"Blox Fruits",universe_id:universe.universe_id,universe,genre_l1:"Adventure",genre_l2:"Exploration",expired_codes:[],active_code_count:1,latest_code_first_seen_at:timestamp,roblox_link:"https://www.roblox.com/games/2753915549",canonical_path:"/codes/blox-fruits"});
  route(codes,"roblox","code");add("codes", {id:id(),code_page_id:codes.id,code:"TRAIL2026",reward:"20 minutes of double XP",status:"active",first_seen_at:timestamp,created_at:timestamp,updated_at:timestamp});
  const quiz=add("quiz_pages", {...common,id:id(),code:"blox-fruits",title:"Blox Fruits quiz",quiz_data:quizData,universe_id:universe.universe_id,universe,canonical_path:"/quizzes/blox-fruits"});route(quiz,"roblox","quiz");
  const event=add("events_pages",{...common,id:id(),slug:"blox-fruits",title:"Blox Fruits events",content_md:"## Island supply hunt\nCollect supplies around the island and start at the docks.",universe_id:universe.universe_id,universe,canonical_path:"/events/blox-fruits"});route(event,"roblox","event");
  add("roblox_universe_event_summary", {universe_id:universe.universe_id,current_event_count:0,upcoming_event_count:1,next_event_start_at:"2099-01-01T00:00:00Z"});
  const board=add("checklist_pages",{...common,id:id(),slug:"blox-fruits",title:"Blox Fruits checklist",universe_id:universe.universe_id,universe,sections_json:[{code:"1",title:"First island"}],canonical_path:"/checklists/blox-fruits",item_count:1,leaf_item_count:1});route(board,"roblox","checklist");
  add("checklist_items",{id:id(),page_id:board.id,section_code:"1.1.1",title:"Complete a quest",description:"Talk to the quest giver.",is_required:true});
  const robloxTool=add("tools",{...common,id:id(),code:"roblox-gamepass-calculator",title:"Roblox gamepass calculator",tool_key:"roblox-gamepass-calculator",canonical_path:"/tools/roblox-gamepass-calculator",universe_id:null});route(robloxTool,"roblox","tool");
  for (const [code,title] of [["roblox-music-ids","Roblox music IDs"],["roblox-decal-ids","Roblox decal IDs"],["roblox-mesh-ids","Roblox mesh IDs"],["roblox-items-and-bundles","Roblox Items and Bundles"],["admin-commands","Admin commands"],["roblox-music-ids/games/driving-empire","Driving Empire music IDs"]]) {
    const page=add("catalog_pages",{...common,id:id(),code,title,canonical_path:`/catalog/${code}`});route(page,"roblox","catalog");
  }
  tables.stats_game_current_index = tables.roblox_universes.map((game,index)=>({...game,global_playing_rank:index+1,rating_percent:95,likes:190,dislikes:10,favorites:12000,stats_tier:"HOT",last_playing_refreshed_at:timestamp,last_stats_refreshed_at:timestamp,indexed_at:timestamp,genre_l2:"Exploration",thumbnail_urls:[],desktop_enabled:true,mobile_enabled:true}));
  tables.stats_genre_current_index = [{genre_l1:"Adventure",game_count:3,playing:3600,visits:1500000}];
  for (const [index,category] of ["Accessories","Clothing","Body","AvatarAnimations","Makeup"].entries()) {
    const asset_id=7000+index;
    add("roblox_catalog_items",{asset_id,item_type:"Asset",asset_type_id:8,name:`Trail ${category}`,description:"A trail outfit item.",category,subcategory:"Hat",creator_name:"Roblox",creator_id:1,creator_target_id:1,creator_type:"User",creator_has_verified_badge:true,favorite_count:100,price_robux:index===0?0:50,price_status:"OnSale",lowest_price_robux:50,lowest_resale_price_robux:index===0?0:null,free_claimability:"direct",free_verification_source:"roblox",free_verified_at:new Date().toISOString(),is_deleted:false,is_for_sale:true,is_limited:false,is_limited_unique:false,has_resellers:false,total_quantity:null,remaining:null,last_seen_at:timestamp,created_at:timestamp,raw_catalog_json:{},thumbnail_url:"/Bloxodes.png"});
    add("roblox_catalog_item_images",{asset_id,size:"420x420",format:"Png",state:"Completed",image_url:"/Bloxodes.png"});
  }
  add("roblox_font_ids",{asset_id:12187365977,name:"Roboto",native_styles:["Regular"],faces:[{name:"Regular",weight:400,style:"Normal",assetId:12187365977}],designer:"Christian Robertson",creator_name:"Roblox",creator_store_url:"https://create.roblox.com/store/asset/12187365977",status:"active",thumbnail_state:"Completed",thumbnail_url:"/Bloxodes.png",vote_count:10});
  tables.roblox_music_genres_view = [{slug:"fixture-genre",label:"Fixture genre",item_count:98}];
  tables.roblox_music_artists_view = [{slug:"fixture-artist",label:"Fixture artist",item_count:98}];
  addPublicSamples(tables, { add, id, route, common, timestamp, author, article, peak, universe });
  addStatsSamples(tables, { add, timestamp, universe });
  // Views preserve their base-row relationships for embedded Supabase selects.
  for (const [view,base] of Object.entries({wiki_pages_view:"wiki_pages",wiki_collection_pages_view:"wiki_collection_pages",code_pages_index_view:"code_pages",quiz_pages_view:"quiz_pages",checklist_pages_view:"checklist_pages",events_pages_view:"events_pages",tools_view:"tools",catalog_pages_view:"catalog_pages"})) tables[view]=tables[base];
  for (const kind of ["wiki","collection","tool","map","quiz","checklist","catalog","code"]) tables[`game_${kind}_pages`]=tables[`game_${kind}_pages_view`]??=[];
  // Frozen migration backfill rows, independent of the browser expectations.
  const redirects = read("redirects.json").map(([path,target_url,origin,page_type,match_type,redirect_code,tail_mode,match_self]) => ({ path,target_url,resolved_target:target_url,origin,page_type,match_type,redirect_code,tail_mode,match_self,
    page_id:null,game_id:null,source:"roblox",status:"old",created_at:timestamp,moved_at:timestamp }));
  tables.site_routes=[...redirects,...routes];
  tables.site_route_redirects=tables.site_routes.filter(row=>row.status==="old");
  const defaults = read("column-defaults.json");
  for (const [table, columns] of Object.entries(defaults)) {
    for (const row of tables[table] ?? []) for (const column of columns) if (!Object.hasOwn(row, column)) row[column] = null;
  }
  return tables;
}
export function seedRpcs() {
  return {
    get_stats_platform_current_summary: [{live_players:1200,total_visits:500000,last_updated_at:timestamp}],
    get_stats_platform_ccu_trend: [], get_stats_subgenre_options: [],
    get_stats_visit_share_chart: [], search_site: [], get_roblox_universe_pipeline_health_v4: []
  };
}

// Contracts come from the complete seed inventory, never the filtered rows.
// Tables intentionally left empty declare their columns in the fixture schema.
export function seedContracts(tables) {
  const empty = read("empty-table-contracts.json"), defaults = read("column-defaults.json");
  const contracts = Object.fromEntries(Object.entries(tables).map(([table, rows]) => [table, rowContract(rows, [...(empty[table]?.columns ?? []), ...(defaults[table] ?? [])])]));
  for (const [table, relations] of Object.entries(read("relations.json"))) {
    for (const [target, key] of Object.entries(relations)) {
      contracts[table].relations[target] = { key, contract: contracts[target] };
    }
  }
  return contracts;
}
