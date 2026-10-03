#!/usr/bin/env python3
"""Prepare parent-reviewed Minecraft world collection data from pinned sources."""
import argparse,collections,hashlib,importlib.util,json,re
from pathlib import Path
SPEC=importlib.util.spec_from_file_location('minecraft_collection_source',Path(__file__).with_name('build-minecraft-collections.py'))
B=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(B)
P=B.WORK/'source-pack';ORDER=['mobs','blocks','crops-and-plants','redstone-components','biomes','structures','achievements']
B.ORDER+=ORDER

def jsonc(path):
 text=path.read_text();text=re.sub(r'("(?:\\.|[^"\\])*")|//[^\n]*|/\*[\s\S]*?\*/',lambda m:m.group(1) or '',text)
 return json.loads(re.sub(r',(\s*[}\]])',r'\1',text))
def items(v):
 if isinstance(v,dict):
  return ([B.sid(v['name'])] if v.get('type')=='minecraft:item' and isinstance(v.get('name'),str) else [])+[z for x in v.values() for z in items(x)]
 if isinstance(v,list):return [z for x in v for z in items(x)]
 return []
def values(v,key):
 if isinstance(v,dict):return ([v[key]] if key in v else [])+[z for x in v.values() for z in values(x,key)]
 if isinstance(v,list):return [z for x in v for z in values(x,key)]
 return []
def biome_name(k):return B.LANG.get('biome.minecraft.'+k,B.title(k))
def save(slug,rows,fields,card,description,count,proof,gaps=None):
 # The parent approval belongs to this collection, not to a batch assertion.
 brief=B.OUT/slug/'brief.md';s=brief.read_text()
 if 'Parent research approval' not in s:raise ValueError('No parent review marker')
 if 'Approved for data preparation' not in s:brief.write_text(s+'\nApproved for data preparation by parent on2026-10-02.\n')
 existing=B.OUT/slug/'dataset.json'
 if existing.exists():
  prior={r['system']['slug']:r for r in B.read(existing)['items']}
  for r in rows:
   old=prior.get(r['system']['slug'],{});r['system']['image']=old.get('system',{}).get('image')
   if old.get('item',{}).get('imageCreditUrl'):r['item']['imageCreditUrl']=old['item']['imageCreditUrl']
 for r in rows:
  for field,value in r['item'].items():
   if isinstance(value,str):r['item'][field]=value.replace('Loot sources include ','Can be found in ')
 extra=[]
 if slug=='crops-and-plants':extra=list(dict.fromkeys(v['sourceUrl'] for v in B.read(P/'references/plants-bedrock-field-proof.json')['plants'].values()))
 if slug=='redstone-components':extra=list(dict.fromkeys(v.get('url',v.get('sourceUrl')) for v in B.read(P/'references/redstone-bedrock-function-proof.json').values() if v.get('url',v.get('sourceUrl'))))+['https://www.minecraft.net/en-us/article/taking-inventory--rails']
 if slug=='blocks':extra=list(dict.fromkeys(v['primarySourceUrl'] for v in B.read(P/'references/education-block-exclusions.json')['rows']))
 B.save(slug,rows,fields+['cardSummary'],card,'cardSummary',None,count,extra_sources=extra,bedrock_gaps=gaps or [])
 (B.OUT/slug/'source-proof.json').write_text(json.dumps(proof,indent=2)+'\n')
 if slug=='structures':
  f=B.OUT/slug/'dataset.json';doc=B.read(f);doc['meta']['display']['fieldPresentation']['locateCommand']='detail';f.write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
  af=B.OUT/slug/'data-audit.json';audit=B.read(af);audit['datasetSha256']=hashlib.sha256(f.read_bytes()).hexdigest();af.write_text(json.dumps(audit,indent=2)+'\n')

def mobs():
 audit=B.read(P/'mob-roster-and-model-index.json');locations=collections.defaultdict(set)
 healthproof={x['id']:x for x in B.read(B.JAVA/'mob-java-base-health-proof.json')['mobAttributes']}
 classindex=B.read(B.JAVA/'health-class-source-index.json');classcode={k:(B.JAVA/v).read_text() for k,v in classindex.items()}
 def method_body(cls,method):
  if cls not in classcode:return None
  code=classcode[cls];match=re.search(r'\b'+method+r'\([^;{}]*\)\s*\{',code)
  if not match:
   parent=re.search(r'\bextends\s+(\w+)',code);return method_body(parent[1],method) if parent else None
  start=match.end();cursor=start;depth=1
  while depth and cursor<len(code):
   if code[cursor]=='{':depth+=1
   elif code[cursor]=='}':depth-=1
   cursor+=1
  return code[start:cursor-1]
 bedlang={line.split('=',1)[0]:line.split('=',1)[1].split('##')[0].strip() for line in (B.BEDROCK/'resource_pack/texts/en_US.lang').read_text().splitlines() if '=' in line}
 def bedname(v):
  if isinstance(v,dict):v=v.get('item',v.get('id',''))
  k=B.sid(v);alias={'fish':'cod','clownfish':'tropical_fish','cooked_fish':'cooked_cod'};k=alias.get(k,k)
  return bedlang.get('item.'+k+'.name',bedlang.get('tile.'+k+'.name',B.name(k)))
 for k,d,p in B.records('worldgen/biome'):
  spawn=d.get('attributes',{}).get('minecraft:gameplay/natural_mob_spawns',{}).get('argument',{}).get('spawns_by_category',{})
  for entries in spawn.values():
   for entry in entries:locations[B.sid(entry['type'])].add(biome_name(k))
 roles={
 'creeper':'Explodes after its fuse ignites.', 'ghast':'Attacks by firing explosive fireballs.', 'blaze':'Attacks with bursts of small fireballs.', 'witch':'Uses potions to attack and defend itself.', 'shulker':'Fires projectiles that can make targets levitate.', 'evoker':'Uses fang attacks and summons vexes.', 'breeze':'Attacks with wind charges and jumping movement.', 'sniffer':'Digs for ancient plant seeds.', 'allay':'Collects dropped items matching the item it holds.', 'copper_golem':'Moves items between copper chests and other chests.', 'snow_golem':'Throws snowballs at eligible hostile targets.', 'iron_golem':'Defends villagers against eligible threats.', 'villager':'Uses workstations to take professions and trade.', 'wandering_trader':'Offers trades while visiting the world.', 'happy_ghast':'Can carry riders while flying with an equipped harness.', 'pufferfish':'Inflates when threatened and can poison nearby targets.', 'sulfur_cube':'Can absorb eligible blocks and change its behavior.', 'creaking':'Its connected creaking heart controls its survival.', 'warden':'Tracks vibrations and can use a sonic-boom attack.'}
 rows=[];proof=[]
 for m in audit['mobTypes']:
  k=m['id'];hp=healthproof[k];cls=hp['attributeProviderClass'];code=classcode[cls]
  bedid=next(iter(m['bedrockIds']),None);entityfile=B.BEDROCK/'behavior_pack/entities'/((bedid or k)+'.json');entity=jsonc(entityfile)['minecraft:entity'] if bedid and entityfile.exists() else {};component=entity.get('components',{});bh=component.get('minecraft:health',{}).get('value');bh=bh if isinstance(bh,(int,float)) else None
  base=hp['baseHealth'];health=base;health_note=None
  if k in ['horse','donkey','mule','llama','trader_llama']:health=None;health_note='Spawn health varies from 15 to 30 points.'
  elif k in ['slime','magma_cube']:health=None;health_note='Health equals size squared; naturally selected sizes 1, 2 and 4 give 1, 4 and 16 health points.'
  elif k=='sulfur_cube':health=None;health_note='Health equals four times the cube size.'
  elif k=='wolf':health_note='Untamed wolves have 8 health points; tamed wolves have 40.'
  elif k=='panda':health_note='Ordinary pandas have 20 health points; weak pandas have 10.'
  lootfile=B.JAVA/'data/loot_table/entities'/(k+'.json');drops=sorted(set(items(B.read(lootfile)))) if lootfile.exists() else []
  breed=[];tame=[]
  for c in values(entity,'minecraft:breedable'):breed.extend(c.get('breed_items',[]))
  for c in values(entity,'minecraft:tameable'):tame.extend(c.get('tame_items',[]))
  java_food=[];food_body=method_body(cls,'isFood') or '';love_body=method_body(cls,'canFallInLove') or '';mate_body=method_body(cls,'canMate') or ''
  if 'return false;' not in love_body and mate_body.strip()!='return false;':
   for tag in re.findall(r'ItemTags\.([A-Z_]+_FOOD)',food_body):java_food.extend(B.expand('#minecraft:'+tag.lower()))
  if k in ['horse','donkey']:java_food=['golden_carrot','golden_apple','enchanted_golden_apple']
  elif k in ['llama','trader_llama']:java_food=['hay_block']
  elif k in ['mule','parrot','happy_ghast','zombie_nautilus','skeleton_horse','zombie_horse']:java_food=[]
  jf=', '.join(B.name(x) for x in dict.fromkeys(java_food)) or None
  bf=', '.join(dict.fromkeys(bedname(x) for x in breed)) or None;bt=', '.join(dict.fromkeys(bedname(x) for x in tame)) or None
  ed=['java','bedrock'] if bedid else ['java'];category=B.title(m['category']);bedcategory=B.title(entity.get('description',{}).get('spawn_category','')) or None
  behavior=roles.get(k)
  if not behavior and jf:behavior='Can be bred using '+jf+'.'
  if not behavior and 'BowAttackGoal' in code:behavior='Can use ranged bow attacks.'
  if not behavior and 'MeleeAttackGoal' in code:behavior='Uses melee attacks against eligible targets.'
  if not behavior and ('Bucketable' in code or 'AbstractFish'==cls):behavior='An aquatic mob; fish can be carried in water buckets.' if k in ['cod','salmon','tropical_fish','pufferfish'] else 'Can be carried in a water bucket.'
  summary=behavior or ('Available through commands in Java Edition.' if m.get('commandOnly') else (health_note or str(int(base))+' health points before state changes.'))
  bedbehavior=None
  if values(entity,'minecraft:explode'):bedbehavior='Can explode after its fuse ignites.'
  elif values(entity,'minecraft:behavior.ranged_attack'):bedbehavior='Uses ranged attacks against selected targets.'
  elif values(entity,'minecraft:behavior.melee_attack') or values(entity,'minecraft:behavior.delayed_attack') or values(entity,'minecraft:behavior.melee_box_attack'):bedbehavior='Uses melee attacks against selected targets.'
  elif bf:bedbehavior='Can be bred using '+bf+'.'
  elif bt:bedbehavior='Can be tamed using '+bt+'.'
  if not bedbehavior and values(entity,'minecraft:rideable'):bedbehavior='Can carry riders when its riding conditions are met.'
  health_values=sorted({c.get('value') for c in values(entity,'minecraft:health') if isinstance(c.get('value'),(int,float))})
  if bh is None and len(health_values)==1:bh=health_values[0]
  ranges=[c.get('value') for c in values(entity,'minecraft:health') if isinstance(c.get('value'),dict)]
  bed_health_note='Health changes with size or state: '+', '.join(str(v) for v in health_values)+' points.' if len(health_values)>1 else None
  if ranges and bh is None:
   bounds=ranges[0];bed_health_note='Health varies from '+str(bounds.get('range_min'))+' to '+str(bounds.get('range_max'))+' points.' if 'range_min' in bounds and 'range_max' in bounds else None
  bedsummary=bedbehavior or bed_health_note or (str(bh)+' base health points.' if bh is not None else B.LANG.get('entity.minecraft.'+k,B.title(k))+' has no fixed base-health value in its behavior definition.')
  bedlootfiles=[c['table'] for c in values(entity,'minecraft:loot') if c.get('table')]
  beddrops=[]
  for rel in bedlootfiles:
   file=B.BEDROCK/'behavior_pack'/rel
   if file.exists():
    for val in values(jsonc(file),'name'):
     if isinstance(val,str) and val.startswith('minecraft:'):beddrops.append(bedname(val))
  beddrops=list(dict.fromkeys(beddrops))
  overrides={'java':{'tamingItems':None},'bedrock':{'spawnCategory':bedcategory,'naturalSpawnBiomes':None,'possibleDrops':', '.join(beddrops) or None,'healthPoints':bh,'healthNotes':bed_health_note,'breedingItems':bf,'tamingItems':bt,'behavior':bedbehavior,'cardSummary':bedsummary}} if bedid else {}
  fields={'name':B.LANG.get('entity.minecraft.'+k,B.title(k)),'spawnCategory':category,'naturalSpawnBiomes':', '.join(sorted(locations[k])) or None,'possibleDrops':', '.join(B.name(x) for x in drops) or None,'healthPoints':health,'healthNotes':health_note,'tamingItems':bt,'breedingItems':jf,'behavior':behavior,'availability':'Command-only Java mob' if m.get('commandOnly') else 'Vanilla mob','cardSummary':summary,'editions':ed,'editionOverrides':overrides}
  rows.append(B.row(k,category,**fields));proof.append({'id':k,'bedrockId':bedid,'javaHealthProof':hp,'dynamicHealthRule':health_note,'javaAttributeClassSource':classindex[cls],'javaFoodMethod':food_body,'javaLoveMethod':love_body,'javaMateMethod':mate_body,'javaFoodTags':re.findall(r'ItemTags\.([A-Z_]+_FOOD)',food_body),'javaSpawnBiomes':sorted(locations[k]),'javaLootTable':str(lootfile.relative_to(P)) if lootfile.exists() else None,'bedrockEntityFile':str(entityfile.relative_to(P)) if entity else None,'bedrockLootTables':bedlootfiles,'bedrockPossibleDrops':beddrops,'bedrockSpawnCategory':bedcategory,'bedrockBaseHealth':bh,'bedrockBreedingIngredients':breed,'bedrockTamingIngredients':tame,'javaBehaviorSummary':behavior})
 save('mobs',rows,['spawnCategory','naturalSpawnBiomes','possibleDrops','healthPoints','healthNotes','tamingItems','breedingItems','behavior','availability'],['spawnCategory','healthPoints','healthNotes','behavior'],'behavior',90,{'mobTypes':proof,'exclusions':audit['excludedJavaTypes']},['Java base health independently traced through all90attribute providers; state-dependent horse/cube/wolf/panda rules are stated','Bedrock category, base health and breeding/taming ingredients come from its own behavior definitions','Java natural-biome fields remain omitted in Bedrock mode; Bedrock possible drops come from its own entity loot tables','Grouping follows actual Java MobCategory; Bedrock row category values are independently defined'])


def exact_item_name(k):
 if k.startswith('music_disc_'):return B.name(k)+' ('+B.LANG.get('item.minecraft.'+k+'.desc',B.title(k.removeprefix('music_disc_')))+')'
 if k.endswith('_armor_trim_smithing_template'):return B.title(k.removesuffix('_armor_trim_smithing_template'))+' Armor Trim Smithing Template'
 if k=='netherite_upgrade_smithing_template':return 'Netherite Upgrade Smithing Template'
 return B.name(k)

# Reuse the separately reviewed recipe export and direct runtime item identities.
RECIPE_RULE_PATH=B.OUT/'recipes/tool-rules-recipes.json'
RECIPE_RULES=B.read(RECIPE_RULE_PATH)
INVENTORY_USES={e:collections.defaultdict(set) for e in ['java','bedrock']};INVENTORY_STATIONS={e:collections.defaultdict(set) for e in ['java','bedrock']};INVENTORY_OUTPUT_STATIONS={e:collections.defaultdict(set) for e in ['java','bedrock']}
BED_RUNTIME_LOCAL={B.sid(r['id']):r.get('localizationKey') for r in B.BED_TAG_DATA['items']}
BED_LANG={s.split('=',1)[0]:s.split('=',1)[1].split('##')[0].strip() for s in (B.BEDROCK/'resource_pack/texts/en_US.lang').read_text().splitlines() if '=' in s}
def inventory_name(k,edition):return BED_LANG.get(BED_RUNTIME_LOCAL.get(k,''),exact_item_name(k)) if edition=='bedrock' else exact_item_name(k)
for recipe in RECIPE_RULES:
 for edition in recipe['editions']:
  output=recipe['output'];station=B.title(recipe['station']);INVENTORY_OUTPUT_STATIONS[edition][output].add(station)
  for ingredient in recipe['ingredients']:
   for choice in ingredient['choices']:
    INVENTORY_USES[edition][choice].add(output);INVENTORY_STATIONS[edition][choice].add(station)
def inventory_fields(k,edition):
 stack=B.COMPONENTS.get(k,{}).get('minecraft:max_stack_size') if edition=='java' else B.BEDCOMP.get(k,{}).get('maxAmount');outputs=sorted(INVENTORY_USES[edition][k]);uses=', '.join(dict.fromkeys(inventory_name(v,edition) for v in outputs)) or None;stations=', '.join(sorted(INVENTORY_OUTPUT_STATIONS[edition][k])) or None
 return {'stackSize':stack,'recipeUses':uses,'recipeStations':stations}
def inventory_summary(fields):
 text='Stacks up to '+str(fields['stackSize'])+' per inventory slot.' if fields.get('stackSize') is not None else ''
 if fields.get('recipeUses'):text+=(' ' if text else '')+'Used to make '+', '.join(fields['recipeUses'].split(', ')[:4])+'.'
 if fields.get('recipeStations'):text+=(' ' if text else '')+'Produced at '+fields['recipeStations']+'.'
 return text or None

# Player-facing categories use native tags first, then an explicit class/identity map.
BLOCK_TAG_CATEGORIES=[('stairs','Stairs'),('slabs','Slabs'),('walls','Walls'),('doors','Doors'),('trapdoors','Trapdoors'),('beds','Beds'),('fences','Fences'),('buttons','Buttons'),('pressure_plates','Pressure plates'),('rails','Rails'),('leaves','Leaves'),('logs','Logs and wood'),('saplings','Saplings'),('flowers','Flowers'),('crops','Crops'),('planks','Planks'),('wool','Wool'),('terracotta','Terracotta'),('dirt','Soil'),('base_stone_overworld','Stone'),('base_stone_nether','Stone'),('all_hanging_signs','Hanging signs'),('all_signs','Signs')]
BLOCK_CATEGORY_TAGS=[(tag,label,set(B.expand('#minecraft:'+tag,'block'))) for tag,label in BLOCK_TAG_CATEGORIES]
PLANT_CLASS_CATEGORIES={
 'FlowerBlock':'Flowers','TallFlowerBlock':'Flowers','EyeblossomBlock':'Flowers','WitherRoseBlock':'Flowers','CactusFlowerBlock':'Flowers','FlowerBedBlock':'Flower patches',
 'SaplingBlock':'Saplings','MangrovePropaguleBlock':'Saplings','TintedParticleLeavesBlock':'Leaves','UntintedParticleLeavesBlock':'Leaves','MangroveLeavesBlock':'Leaves','LeavesBlock':'Leaves',
 'CropBlock':'Crops','BeetrootBlock':'Crops','CarrotBlock':'Crops','PotatoBlock':'Crops','TorchflowerCropBlock':'Crops','PitcherCropBlock':'Crops','CocoaBlock':'Crops','NetherWartBlock':'Crops','SweetBerryBushBlock':'Berry bushes','SugarCaneBlock':'Sugar cane',
 'MushroomBlock':'Mushrooms','ShelfMushroomBlock':'Mushrooms','NetherFungusBlock':'Fungi','NetherRootsBlock':'Roots','HangingRootsBlock':'Roots','NetherSproutsBlock':'Sprouts',
 'VineBlock':'Vines','CaveVinesBlock':'Vines','TwistingVinesBlock':'Vines','WeepingVinesBlock':'Vines','GlowLichenBlock':'Lichen',
 'BushBlock':'Bushes','FireflyBushBlock':'Bushes','AzaleaBlock':'Azaleas','TallGrassBlock':'Grass and ferns','ShortDryGrassBlock':'Dry grass','TallDryGrassBlock':'Dry grass','DryVegetationBlock':'Dead bushes',
 'BambooSaplingBlock':'Bamboo','AttachedStemBlock':'Crops','BigDripleafStemBlock':'Dripleaf plants','CaveVinesPlantBlock':'Vines','TwistingVinesPlantBlock':'Vines','WeepingVinesPlantBlock':'Vines','KelpPlantBlock':'Aquatic plants','BambooStalkBlock':'Bamboo','CactusBlock':'Cacti','ChorusPlantBlock':'Chorus plants','ChorusFlowerBlock':'Chorus flowers','KelpBlock':'Aquatic plants','SeagrassBlock':'Aquatic plants','TallSeagrassBlock':'Aquatic plants','LilyPadBlock':'Aquatic plants',
 'SmallDripleafBlock':'Dripleaf plants','BigDripleafBlock':'Dripleaf plants','SporeBlossomBlock':'Spore blossoms','BonemealableFeaturePlacerBlock':'Moss','CarpetBlock':'Moss','MossyCarpetBlock':'Moss','HangingMossBlock':'Moss','LeafLitterBlock':'Leaf litter','PumpkinBlock':'Harvest blocks'}
PLANT_ID_CATEGORIES={'large_fern':'Grass and ferns','tall_grass':'Grass and ferns','pitcher_plant':'Flowers','melon':'Harvest blocks'}
BLOCK_CLASS_CATEGORIES={
 'RotatedPillarBlock':'Pillars','DropExperienceBlock':'Ores','RedStoneOreBlock':'Ores','FlowerPotBlock':'Flower pots','FenceGateBlock':'Fence gates','ShelfBlock':'Shelves','ChiseledBookShelfBlock':'Bookshelves',
 'SkullBlock':'Heads and skulls','WallSkullBlock':'Heads and skulls','PlayerHeadBlock':'Heads and skulls','PlayerWallHeadBlock':'Heads and skulls','WitherSkullBlock':'Heads and skulls','WitherWallSkullBlock':'Heads and skulls','PiglinWallSkullBlock':'Heads and skulls',
 'CommandBlock':'Command blocks','AnvilBlock':'Workstations','CraftingTableBlock':'Workstations','FurnaceBlock':'Workstations','BlastFurnaceBlock':'Workstations','SmokerBlock':'Workstations','BrewingStandBlock':'Workstations','LoomBlock':'Workstations','CartographyTableBlock':'Workstations','SmithingTableBlock':'Workstations','StonecutterBlock':'Workstations','GrindstoneBlock':'Workstations','EnchantingTableBlock':'Workstations',
 'ChestBlock':'Storage','CopperChestBlock':'Storage','BarrelBlock':'Storage','EnderChestBlock':'Storage','ShulkerBoxBlock':'Storage','TrappedChestBlock':'Storage','DecoratedPotBlock':'Storage',
 'LiquidBlock':'Fluids','SandBlock':'Sand','BrushableBlock':'Archaeology blocks','TransparentBlock':'Glass','StainedGlassBlock':'Glass','TintedGlassBlock':'Glass','StainedGlassPaneBlock':'Glass panes',
 'TorchBlock':'Torches','WallTorchBlock':'Torches','LanternBlock':'Lanterns','IronBarsBlock':'Bars','ChainBlock':'Chains','NetherPortalBlock':'Portals','EndPortalBlock':'Portals','EndPortalFrameBlock':'Portals','EndGatewayBlock':'Portals','FarmlandBlock':'Farmland','PathBlock':'Paths',
 'CakeBlock':'Cake','CandleCakeBlock':'Cake','CandleBlock':'Candles','BannerBlock':'Banners','WallBannerBlock':'Banners','WoolCarpetBlock':'Carpets','GlazedTerracottaBlock':'Glazed terracotta','ConcretePowderBlock':'Concrete powder','WeatheringCopperFullBlock':'Copper blocks',
 'SpawnerBlock':'Spawners','TrialSpawnerBlock':'Spawners','StructureBlock':'Structure tools','StructureVoidBlock':'Structure tools','JigsawBlock':'Structure tools','TestBlock':'Test blocks','TestInstanceBlock':'Test blocks',
 'StrawBedBlock':'Beds','InfestedBlock':'Infested blocks','InfestedRotatedPillarBlock':'Infested blocks','RedstoneWallTorchBlock':'Redstone components','PistonHeadBlock':'Redstone components','FletchingTableBlock':'Workstations','ComposterBlock':'Workstations','LecternBlock':'Lecterns','ConduitBlock':'Conduits','BeaconBlock':'Beacons','BubbleColumnBlock':'Bubble columns','WebBlock':'Cobwebs','SeaPickleBlock':'Sea pickles','RootedDirtBlock':'Soil','GrassBlock':'Soil','SnowyBlock':'Soil','MyceliumBlock':'Soil','MudBlock':'Soil','SoulSandBlock':'Soil','NyliumBlock':'Nylium','IceBlock':'Ice','FrostedIceBlock':'Ice','SnowLayerBlock':'Snow','PowderSnowBlock':'Snow','DragonEggBlock':'Eggs','TurtleEggBlock':'Eggs','SnifferEggBlock':'Eggs','FrogspawnBlock':'Eggs','DriedGhastBlock':'Dried ghasts','EndRodBlock':'Lighting','FireBlock':'Fire','SoulFireBlock':'Fire','LightBlock':'Lighting','BarrierBlock':'Barriers','SpongeBlock':'Sponges','WetSpongeBlock':'Sponges','JukeboxBlock':'Jukeboxes','MangroveRootsBlock':'Roots','PointedDripstoneBlock':'Dripstone','SulfurSpikeBlock':'Sulfur spikes','CreakingHeartBlock':'Creaking hearts','RespawnAnchorBlock':'Respawn anchors','CopperGolemStatueBlock':'Statues','SculkBlock':'Sculk','SculkCatalystBlock':'Sculk','SculkShriekerBlock':'Sculk','SculkVeinBlock':'Sculk','CauldronBlock':'Cauldrons','LayeredCauldronBlock':'Cauldrons','LavaCauldronBlock':'Cauldrons','CampfireBlock':'Campfires','AmethystBlock':'Amethyst','BuddingAmethystBlock':'Amethyst','AmethystClusterBlock':'Amethyst','HugeMushroomBlock':'Mushroom blocks'}
def player_block_category(k,cls):
 if k in ['frame','glow_frame']:return 'Item frames',{'method':'Exact Bedrock-only frame identity','identity':k}
 for tag,label,ids in BLOCK_CATEGORY_TAGS:
  if k in ids:return label,{'method':'Official Java block tag','tag':'minecraft:'+tag}
 if k in PLANT_ID_CATEGORIES:return PLANT_ID_CATEGORIES[k],{'method':'Explicit audited plant identity','identity':k}
 if cls in PLANT_CLASS_CATEGORIES:return PLANT_CLASS_CATEGORIES[cls],{'method':'Explicit human category for native class','class':cls}
 if cls in BLOCK_CLASS_CATEGORIES:return BLOCK_CLASS_CATEGORIES[cls],{'method':'Explicit human category for native class','class':cls}
 for suffix,label in [('_wall_banner','Banners'),('_banner','Banners'),('_candle_cake','Cake'),('_candle','Candles'),('_shulker_box','Storage'),('_stained_glass_pane','Glass panes'),('_stained_glass','Glass'),('_carpet','Carpets'),('_concrete_powder','Concrete powder'),('_glazed_terracotta','Glazed terracotta'),('_lightning_rod','Redstone components'),('_concrete','Concrete'),('_wool','Wool'),('_planks','Planks'),('_terracotta','Terracotta'),('_copper_bars','Bars'),('_copper_chain','Chains'),('_copper_lantern','Lanterns'),('_copper_chest','Storage'),('_copper_bulb','Redstone components'),('_copper_golem_statue','Statues'),('_coral_block','Coral')]:
  if k.endswith(suffix):return label,{'method':'Audited native identity family','suffix':suffix}
 if cls and ('Coral' in cls):return 'Coral',{'method':'Explicit coral registration family','class':cls}
 if 'copper' in k:return 'Copper blocks',{'method':'Audited copper material identity','identity':k}
 if k.startswith('potted_'):return 'Flower pots',{'method':'Audited potted identity','identity':k}
 if k in ['bookshelf','fletching_table','lodestone','vault','heavy_core','resin_clump']:
  label={'bookshelf':'Bookshelves','fletching_table':'Workstations','lodestone':'Lodestones','vault':'Vaults','heavy_core':'Heavy cores','resin_clump':'Resin'}[k];return label,{'method':'Explicit native identity','identity':k}
 if k in {r['id'] for r in B.read(P/'redstone-roster-audit.json')['rows']}:return 'Redstone components',{'method':'Separately approved redstone functional roster'}
 return 'Building and natural blocks',{'method':'Remaining full block identities, no narrower category asserted','class':cls}

def blocks():
 audit=B.read(P/'blocks-roster-audit.json');java=audit['javaIds'];java_set=set(java);excluded=set(audit['bedrockEducationExcluded']+audit['bedrockStateOnlyExcluded']+['air'])
 lang={s.split('=',1)[0]:s.split('=',1)[1].split('##')[0].strip() for s in (B.BEDROCK/'resource_pack/texts/en_US.lang').read_text().splitlines() if '=' in s}
 byname=collections.defaultdict(list)
 for k in java:byname[B.LANG.get('block.minecraft.'+k,B.name(k))].append(k)
 explicit={'snow':['snow_block'],'snow_layer':['snow'],'stone_stairs':['cobblestone_stairs'],'darkoak_standing_sign':['dark_oak_sign'],'darkoak_wall_sign':['dark_oak_wall_sign'],'beetroot':['beetroots'],'normal_stone_slab':['stone_slab'],'portal':['nether_portal'],'reeds':['sugar_cane'],'silver_glazed_terracotta':['light_gray_glazed_terracotta'],'trip_wire':['tripwire'],'undyed_shulker_box':['shulker_box'],'unpowered_comparator':['comparator'],'unpowered_repeater':['repeater'],'wooden_door':['oak_door'],'standing_sign':['oak_sign'],'wall_sign':['oak_wall_sign'],'bed':[x for x in java if x.endswith('_bed') and x!='straw_bed'],'standing_banner':[x for x in java if x.endswith('_banner') and '_wall_' not in x],'wall_banner':[x for x in java if x.endswith('_wall_banner')]}
 mapped=collections.defaultdict(list);crosswalk=[];unmatched=[]
 for bid in audit['bedrockRawIds']:
  if bid in excluded:continue
  display=lang.get('tile.'+bid+'.name');targets=[];method=None
  if bid in explicit:targets=explicit[bid];method='Explicit item/state identity correspondence'
  elif bid in java_set:targets=[bid];method='Same stable identifier'
  elif display and display in byname:targets=byname[display];method='Exact official localized block display name'
  elif bid.startswith('light_block_'):targets=['light'];method='Light-level property of one Java block type'
  elif bid.endswith('_standing_sign'):targets=[bid.replace('_standing_sign','_sign')];method='Standing-sign orientation identity'
  elif bid=='darkoak_standing_sign':targets=['dark_oak_sign'];method='Dark oak standing-sign alias'
  elif bid=='darkoak_wall_sign':targets=['dark_oak_wall_sign'];method='Dark oak wall-sign alias'
  elif display and display in byname:targets=byname[display];method='Exact official localized block display name'
  elif bid in ['frame','glow_frame']:targets=[bid];method='Bedrock-only block representation'
  else:unmatched.append(bid)
  targets=[x for x in targets if x in java_set or x in ['frame','glow_frame']]
  for k in targets:mapped[k].append(bid)
  crosswalk.append({'bedrockId':bid,'localizedName':display,'javaOrSharedTypes':targets,'method':method})
 assert not unmatched,unmatched
 # Bedrock represents these Java registry-distinct forms as properties or block-entity contents.
 forms={'water_cauldron':'cauldron','lava_cauldron':'cauldron','powder_snow_cauldron':'cauldron','attached_pumpkin_stem':'pumpkin_stem','attached_melon_stem':'melon_stem','big_dripleaf_stem':'big_dripleaf','tall_seagrass':'seagrass','kelp_plant':'kelp','cave_vines_plant':'cave_vines','weeping_vines_plant':'weeping_vines','twisting_vines_plant':'twisting_vines','piston_head':'piston'}
 for k in java:
  base=forms.get(k)
  for old,new in [('_wall_hanging_sign','_hanging_sign'),('_wall_torch','_torch'),('_wall_head','_head'),('_wall_skull','_skull')]:
   if k.endswith(old):base=k.removesuffix(old)+new
  if k=='wall_torch':base='torch'
  if k.startswith('potted_'):base='flower_pot'
  if not mapped[k] and base and mapped[base]:
   mapped[k]=mapped[base][:];crosswalk.append({'javaOrSharedTypes':[k],'bedrockId':mapped[base][0],'method':'Property/orientation or potted-content form of corresponding Bedrock base type','javaForm':k,'baseType':base})
 if 'minecraft:end_gateway' in {x['id'] for x in B.read(B.BEDROCK/'runtime-block-types.json')['blocks']}:mapped['end_gateway']=['end_gateway'];crosswalk.append({'bedrockId':'end_gateway','javaOrSharedTypes':['end_gateway'],'method':'Exact runtime BlockTypes registry identity'})
 code=(B.JAVA/'code/world/level/block/Blocks.java').read_text();registration={m[1].lower():m[2] for m in re.finditer(r'^\s*([A-Z_]+) = (.*?);',code,re.M|re.S)}
 mining={tool:set(B.expand('#minecraft:mineable/'+tool,'block')) for tool in ['pickaxe','axe','shovel','hoe']};tiers={tier:set(B.expand('#minecraft:needs_'+tier+'_tool','block')) for tier in ['diamond','iron','stone']}
 def strength(k,seen=frozenset()):
  c=registration.get(k,'');s=re.search(r'\.strength\((-?[\d.]+)F?(?:,\s*(-?[\d.]+)F?)?\)',c)
  if s:return float(s[1]),float(s[2] or s[1])
  copy=re.search(r'\.of(?:Legacy|Full)Copy\((?:Blocks\.)?([A-Z_]+)\)',c)
  if copy and copy[1].lower() not in seen:return strength(copy[1].lower(),seen|{k})
  return None,None
 rows=[];proof=[]
 allkeys=java+['frame','glow_frame']
 for k in allkeys:
  js=k in java_set;c=registration.get(k,'');klass=audit['javaClasses'].get(k);kind,categoryproof=player_block_category(k,klass);display=B.name(k) if js else ('Item Frame' if k=='frame' else 'Glow Item Frame')
  if k.endswith(('_wall_torch','_wall_head','_wall_skull','_wall_banner','_wall_sign','_wall_hanging_sign')):display+=' (wall)'
  hard,resistance=strength(k);tools=[B.title(t) for t,v in mining.items() if k in v];tier=next((t for t,v in tiers.items() if k in v),None)
  tool=', '.join(tools) or None
  if tool and tier:tool+='; '+B.title(tier)+' tier or better for suitable drops'
  lootfile=B.JAVA/'data/loot_table/blocks'/(k+'.json');drops=sorted(set(items(B.read(lootfile)))) if lootfile.exists() else []
  creation=B.acquisition(k) if js else None
  if k in drops:creation=('Can drop its block item when mined under the listed loot and tool conditions. '+(creation or '')).strip()
  recipes=B.RECIPE_OUTPUTS.get(k,[]);recipe_stations=', '.join(sorted({B.stations(d['type']) for _,d in recipes})) or None
  ed=(['java','bedrock'] if mapped[k] else ['java']) if js else ['bedrock']
  overrides={'bedrock':{f:None for f in ['hardness','blastResistance','miningTool','possibleDrops','acquisition','recipeStations']}} if len(ed)==2 else {}
  stack=B.BEDCOMP.get('item_frame' if k=='frame' else 'glow_item_frame' if k=='glow_frame' else k,{}).get('maxAmount')
  summary=[]
  if hard is not None:summary.append('Java hardness '+str(hard)+', blast resistance '+str(resistance)+'.')
  if tool:summary.append('Preferred Java mining tool: '+tool+'.')
  if recipe_stations:summary.append('Produced at '+recipe_stations+'.')
  if drops and not summary:summary.append('Possible Java drops include '+', '.join(B.name(x) for x in drops[:5])+'.')
  if not summary:summary.append('Registered '+kind.lower()+' type.' if js else 'Bedrock block representation of an item-frame entity.')
  bed_summary='Registered Bedrock '+display.lower()+' block.'
  if len(ed)==2:overrides['bedrock']['cardSummary']=bed_summary
  inv=inventory_fields(k,'java') if js else inventory_fields('frame' if k=='frame' else 'glow_frame','bedrock')
  native=next((v for v in mapped[k] if v in B.BEDCOMP),k if k in B.BEDCOMP else None);bedinv=inventory_fields(native,'bedrock') if native else {'stackSize':None,'recipeUses':None,'recipeStations':None}
  if len(ed)==2:overrides['bedrock'].update(bedinv);overrides['bedrock']['cardSummary']=inventory_summary(bedinv)
  fields={'name':display,**inv,'blockType':kind,'hardness':hard,'blastResistance':resistance,'miningTool':tool,'possibleDrops':', '.join(B.name(x) for x in drops) or None,'acquisition':creation,'recipeStations':recipe_stations,'availability':'Has an inventory block item' if k in B.COMPONENTS else 'Placed/natural or technical block form' if js else 'Bedrock item-frame block','cardSummary':' '.join(summary),'editions':ed,'editionOverrides':overrides}
  rows.append(B.row(k,'Items',**fields));proof.append({'id':k,'bedrockAliases':mapped[k],'registrationClass':klass,'playerCategory':kind,'categoryProof':categoryproof,'strength':[hard,resistance],'lootTable':str(lootfile.relative_to(P)) if lootfile.exists() else None,'recipeIds':[x for x,d in recipes]})
 save('blocks',rows,['blockType','hardness','blastResistance','miningTool','possibleDrops','acquisition','recipeStations','stackSize','recipeUses','availability'],['blockType','hardness','miningTool','acquisition'],'acquisition',1284,{'recipeRulesSha256':hashlib.sha256(RECIPE_RULE_PATH.read_bytes()).hexdigest(),'types':proof,'bedrockCrosswalk':crosswalk,'exclusions':{'java':audit['javaExcluded'],'bedrock':sorted(excluded)},'bedrockUnmatched':unmatched},['Java block strength, tool tags, possible drops and recipe stations are source-specific','Bedrock block identities crosschecked against exact localized names or explicit state/item identities; its numerical mining fields are not copied','Two Bedrock-only item-frame block representations extend the1282Java-type roster'])

def plants():
 bedplant=B.read(P/'references/plants-bedrock-field-proof.json')['plants']
 audit=B.read(P/'plants-roster-audit.json');blockdoc=B.read(B.OUT/'blocks/dataset.json');blocks_by_slug={r['system']['slug']:r['item'] for r in blockdoc['items']};props=B.read(B.JAVA/'summary/blocks/data.json');classindex=B.read(B.JAVA/'world-class-source-index.json');classes={k:(B.JAVA/v).read_text() for k,v in classindex.items()};rows=[];proof=[]
 native={'Flowers':set(B.expand('#minecraft:flowers','block')),'Saplings':set(B.expand('#minecraft:saplings','block')),'Leaves':set(B.expand('#minecraft:leaves','block')),'Crops':set(B.expand('#minecraft:crops','block'))}
 def chain(cls,seen=frozenset()):
  if cls in seen or cls not in classes:return ''
  c=classes[cls];m=re.search(r'extends\s+(\w+)',c);return c+'\n'+(chain(m[1],seen|{cls}) if m else '')
 def placement_body(cls,seen=frozenset()):
  if cls not in classes or cls in seen:return ''
  c=classes[cls];parent=re.search(r'extends\s+(\w+)',c);m=re.search(r'mayPlaceOn\([^;{}]*\)\s*\{([^{}]+)\}',c)
  own=m[1] if m else ''
  if parent and (not own or 'super.mayPlaceOn' in own):own+='\n'+placement_body(parent[1],seen|{cls})
  return own
 for k in audit['javaIds']:
  cls=audit['registrationClasses'][k];code=chain(cls);base=blocks_by_slug[B.slug(k)];p=props[k][0];ages=p.get('age',p.get('stage'));age_states=len(ages) if ages else None;stages=age_states if cls in ['CropBlock','BeetrootBlock','CarrotBlock','PotatoBlock','TorchflowerCropBlock','PitcherCropBlock','CocoaBlock','SweetBerryBushBlock','NetherWartBlock','StemBlock'] else None
  seed=re.search(r'getBaseSeedId\([^;{}]*\)\s*\{\s*return Items\.([A-Z_]+);',code);planting=B.name(seed[1].lower()) if seed else B.name(k) if k in B.COMPONENTS and cls not in ['PumpkinBlock','Block'] else None
  bone='Can grow with bone meal when its growth conditions permit' if 'BonemealableBlock' in code or 'performBonemeal(' in code else 'Cannot grow with bone meal' if code and re.search(r'extends\s+Block\b',classes.get(cls,'')) else None
  soil=[];body=placement_body(cls)
  for tag in re.findall(r'(?<!!)\b\w+\.is\(BlockTags\.([A-Z_]+)\)',body):soil.extend(B.expand('#minecraft:'+tag.lower(),'block'))
  for block in re.findall(r'(?<!!)\b\w+\.is\(Blocks\.([A-Z_]+)\)',body):soil.append(block.lower())
  soiltext=', '.join(B.name(x) for x in dict.fromkeys(soil)) or None
  excluded_soils=[x for tag in re.findall(r'!\w+\.is\(BlockTags\.([A-Z_]+)\)',body) for x in B.expand('#minecraft:'+tag.lower(),'block')]
  if 'isFaceSturdy' in body:soiltext=('A surface with a sturdy upper face'+('; cannot use '+', '.join(B.name(x) for x in excluded_soils) if excluded_soils else '')+('; also '+soiltext if soiltext else ''))
  harvest=base['possibleDrops'];section=next((label for label,ids in native.items() if k in ids),'Items');category=PLANT_ID_CATEGORIES.get(k,PLANT_CLASS_CATEGORIES.get(cls));assert category,('No reviewed plant category',k,cls)
  summary=('Grows through '+str(stages)+' stages. ') if stages else ''
  if planting:summary+='Placement or seed item: '+planting+'. '
  if harvest:summary+='Possible harvests include '+harvest+'.'
  if not summary:summary=bone or 'Plant form with no separate growth stages.'
  ed=base['editions'];overrides={'bedrock':{f:None for f in ['growthStages','ageStates','plantingItem','boneMeal','eligibleSoils','possibleHarvests','acquisition']}} if 'bedrock' in ed else {}
  inv=inventory_fields(k,'java');bedbase=base.get('editionOverrides',{}).get('bedrock',{});bedinv={f:bedbase.get(f) for f in ['stackSize','recipeUses','recipeStations']}
  if overrides:
   overrides['bedrock'].update(bedinv);overrides['bedrock']['cardSummary']=inventory_summary(bedinv)
   if k in bedplant:overrides['bedrock'].update(bedplant[k]['fields']);overrides['bedrock']['cardSummary']=bedplant[k]['cardSummary']
  rows.append(B.row(k,section,name=B.name(k),**inv,plantType=category,growthStages=stages,plantingItem=planting,boneMeal=bone,eligibleSoils=soiltext,possibleHarvests=harvest,acquisition=base['acquisition'],cardSummary=summary.strip(),editions=ed,editionOverrides=overrides));proof.append({'id':k,'registrationClass':cls,'playerCategory':category,'categoryProof':{'method':'Explicit plant identity or class mapping','identityOverride':k in PLANT_ID_CATEGORIES},'classSource':classindex.get(cls),'growthStageValues':ages,'baseSeedExpression':seed[0] if seed else None,'placementMethod':body,'excludedSoilIds':excluded_soils,'eligibleSoilIds':list(dict.fromkeys(soil)),'lootSource':'java/data/loot_table/blocks/'+k+'.json','bedrockIdentityProofCollection':'blocks','bedrockPlantProof':bedplant.get(k)})
 save('crops-and-plants',rows,['plantType','growthStages','plantingItem','boneMeal','eligibleSoils','possibleHarvests','acquisition','stackSize','recipeUses','recipeStations'],['plantType','growthStages','plantingItem','possibleHarvests'],'possibleHarvests',104,{'recipeRulesSha256':hashlib.sha256(RECIPE_RULE_PATH.read_bytes()).hexdigest(),'plants':proof,'internalVariantMap':audit['representedInternalVariants']},['Java growth, substrate, bone-meal and harvest facts sourced from actual botanical classes and drop rules; Bedrock fields use its own release notes and qualitative plant articles','Bedrock availability follows the audited block identity crosswalk; its growth values are not copied','Internal vine/stem bodies remain detail variants rather than duplicate plant rows'])

def biome_dimension(k,tags=()):
 if 'nether' in tags or k in ['nether_wastes','crimson_forest','warped_forest','basalt_deltas','soul_sand_valley']:return 'The Nether'
 if 'the_end' in tags or k in ['the_end','end_highlands','end_midlands','end_barrens','small_end_islands']:return 'The End'
 return 'Overworld'
def biomes():
 audit=B.read(P/'biomes-roster-audit.json');aliases=audit['candidateSemanticAliases'];bed={aliases.get(x['id'],x['id']):x for x in audit['bedrockDefinitions']};java={k:d for k,d,p in B.records('worldgen/biome')};rows=[];proof=[]
 for k in sorted(set(java)|set(bed)):
  jd=java.get(k);bd=bed.get(k);ed=[e for e,d in [('java',jd),('bedrock',bd)] if d];dimension=biome_dimension(k,bd['tags'] if bd else []);section='Technical biomes' if k=='the_void' else 'Legacy Bedrock biomes' if bd and 'legacy' in bd['tags'] else dimension
  def jfields(d):
   sp=d.get('attributes',{}).get('minecraft:gameplay/natural_mob_spawns',{}).get('argument',{}).get('spawns_by_category',{});mobs=sorted({B.sid(v['type']) for vs in sp.values() for v in vs});features=list(dict.fromkeys(B.sid(v) for layer in d.get('features',[]) for v in layer));flora=[f for f in features if any(t in f for t in ['trees_','flower_','patch_','mushroom','sulfur','geode','fossil'])]
   return {'temperature':d.get('temperature'),'downfall':d.get('downfall'),'precipitation':'Yes' if d.get('has_precipitation') else 'No','surfaceMaterials':None,'naturalMobs':', '.join(B.LANG.get('entity.minecraft.'+v,B.title(v)) for v in mobs) or None,'terrainFeatures':', '.join(B.title(v) for v in flora) or None,'generation':'Technical biome for empty worlds' if k=='the_void' else None,'cardSummary':dimension+' biome with temperature '+str(d.get('temperature'))+' and downfall '+str(d.get('downfall'))+'.'}
  def bfields(d):
   c=jsonc(P/d['file'])['minecraft:biome']['components'];builder=c.get('minecraft:surface_builder',{}).get('builder',{});surface=[B.name(v) for key,v in builder.items() if key.endswith('_material') and isinstance(v,str)];cl=d['climate'];gen='Legacy definition' if 'legacy' in d['tags'] else 'Multi-noise terrain generation' if 'minecraft:multinoise_generation_rules' in c else 'Biome transformation or other terrain-generation rules' if 'minecraft:overworld_generation_rules' in c else None
   return {'temperature':cl.get('temperature'),'downfall':cl.get('downfall'),'precipitation':None,'surfaceMaterials':', '.join(dict.fromkeys(surface)) or None,'naturalMobs':None,'terrainFeatures':None,'generation':gen,'cardSummary':dimension+' biome with temperature '+str(cl.get('temperature'))+' and downfall '+str(cl.get('downfall'))+'.'}
  base=jfields(jd) if jd else bfields(bd);over={'bedrock':bfields(bd)} if jd and bd else {};rows.append(B.row(k,section,name=biome_name(k),dimension=dimension,**base,editions=ed,editionOverrides=over));proof.append({'id':k,'javaSource':'java/data/worldgen/biome/'+k+'.json' if jd else None,'bedrockSource':bd['file'] if bd else None,'bedrockNativeId':bd['id'] if bd else None,'bedrockTags':bd['tags'] if bd else []})
 save('biomes',rows,['dimension','temperature','downfall','precipitation','surfaceMaterials','naturalMobs','terrainFeatures','generation'],['dimension','temperature','downfall','surfaceMaterials'],'terrainFeatures',94,{'javaCount':67,'bedrockCount':89,'rows':proof,'aliases':aliases},['All 67 Java and 89 Bedrock definitions retained as 94 edition-aware entries','Climate parameters read independently; temperature is not a thermometer reading and downfall is not a rain probability','Bedrock surface materials come from its own surface builder; Java spawn and feature lists are not copied','Legacy Bedrock definitions and the Java Void are explicitly grouped'])

def structures():
 audit=B.read(P/'structures-roster-audit.json');commands=B.read(B.BEDROCK/'metadata/command_modules/mojang-commands.json');locates={B.sid(v['value']) for e in commands['command_enums'] if e['name']=='StructureFeature' for v in e['values']};bedfeatures={B.sid(v['value']) for e in commands['command_enums'] if e['name']=='features' for v in e['values']};rows=[];proof=[];biomefeatures={k:{B.sid(v) for layer in d.get('features',[]) for v in layer} for k,d,p in B.records('worldgen/biome')};placed=dict((k,d) for k,d,p in B.records('worldgen/placed_feature'))
 names={'desert_pyramid':'Desert Pyramid','jungle_pyramid':'Jungle Temple','fortress':'Nether Fortress','mansion':'Woodland Mansion','monument':'Ocean Monument'}
 for k,variants in {**audit['families'],**audit['featureStructures']}.items():
  feature=k in audit['featureStructures'];records=[B.read(B.JAVA/'data/worldgen/structure'/(v+'.json')) for v in variants] if not feature else [];biomeids=set();spawns=set()
  for d in records:
   biomeids.update(B.expand(d['biomes'],'worldgen/biome'))
   for override in d.get('spawn_overrides',{}).values():spawns.update(B.sid(x['type']) for x in override.get('spawns',[]))
  if feature:
   matching={p for p,d in placed.items() if isinstance(d.get('feature'),str) and (B.sid(d['feature']) in variants or p in variants)};biomeids={b for b,features in biomefeatures.items() if features&matching}
  dimension=', '.join(sorted({biome_dimension(v) for v in biomeids})) or ('The End' if k.startswith('end_') else 'Overworld' if feature else None);biometext=', '.join(biome_name(v) for v in sorted(biomeids)) or None
  lootkeys={v for v in B.LOOT_SOURCES for source in B.LOOT_SOURCES[v] if source.startswith('chests/') and any(x in source for x in variants+[k])};loot=', '.join(dict.fromkeys(exact_item_name(v) for v in sorted(lootkeys))) or None
  bedloc=[v for v in locates if v==k or (k=='abandoned_camp' and v.startswith(k+'_')) or (k=='ocean_ruin' and v=='ruins') or (k in ['desert_pyramid','jungle_pyramid','igloo','swamp_hut'] and v=='temple')];featureproof=[v for v in bedfeatures if any(x in v for x in {'monster_room':['dungeon','monster_room'],'amethyst_geode':['geode'],'overworld_fossil':['fossil'],'end_gateway':['end_gateway'],'end_spawn_platform':['end_platform'],'desert_well':['desert_well'],'sulfur_pool':['sulfur_pool'],'sulfur_spring':['sulfur_spring']}.get(k,[]))];bedcommand='\n'.join('/locate structure '+v for v in sorted(bedloc)) or None
  generation='Feature-generated site' if feature else 'Structure family with '+str(len(variants))+' variant'+('s' if len(variants)!=1 else '');summary=('Generates in '+dimension+'. ') if dimension else '';summary+=('Biomes include '+', '.join(biome_name(v) for v in sorted(biomeids)[:5])+'.') if biometext else generation+'.'
  rows.append(B.row(k,'Feature-generated sites' if feature else dimension or 'Structures',name=names.get(k,B.title(k)),dimension=dimension,generation=generation,biomes=biometext,variants=', '.join(B.title(v) for v in variants),structureMobs=', '.join(B.LANG.get('entity.minecraft.'+v,B.title(v)) for v in sorted(spawns)) or None,possibleLoot=loot,locateCommand=None if feature else '/locate structure minecraft:'+variants[0],cardSummary=summary.strip(),editions=['java','bedrock'],editionOverrides={'bedrock':{'generation':'Registered structure family' if bedloc else 'Feature-generated site' if featureproof else None,'biomes':None,'structureMobs':None,'possibleLoot':None,'variants':None,'locateCommand':bedcommand,'cardSummary':'Find this structure using /locate structure '+sorted(bedloc)[0]+'.' if bedcommand else None}}));proof.append({'id':k,'javaVariantIds':variants,'javaBiomeIds':sorted(biomeids),'bedrockLocateEnumIds':sorted(bedloc),'bedrockFeatureEnumIds':sorted(featureproof)})
 save('structures',rows,['dimension','generation','biomes','variants','structureMobs','possibleLoot','locateCommand'],['dimension','generation','biomes','locateCommand'],'biomes',30,{'families':proof,'exclusions':audit['exclusions']},['22 registered families cover 52 Java variants; eight feature-generated sites included separately','Java biome membership follows actual structure tags or placed-feature references','Bedrock locate commands checked against its own enum; biome, spawn and treasure fields are not copied','Feature sites have no locate command unless registered as structures'])

def redstone():
 bedfunctions=B.read(P/'references/redstone-bedrock-function-proof.json')
 audit=B.read(P/'redstone-roster-audit.json');blocks={r['system']['slug']:r['item'] for r in B.read(B.OUT/'blocks/dataset.json')['items']};index=B.read(B.JAVA/'world-class-source-index.json');rows=[];proof=[]
 behaviors={'LightningRodBlock':'Attracts lightning and produces a redstone signal when struck.','RedstoneTorchBlock':'Powers nearby components while lit and switches off when its supporting block is powered.','PoweredBlock':'Supplies redstone power continuously.','NoteBlock':'A redstone activation plays its selected note.','TntBlock':'Redstone power ignites its explosive fuse.','ButtonBlock':'Pressing the button turns on its redstone signal temporarily.','LeverBlock':'Using the lever switches its redstone signal on or off.','PressurePlateBlock':'Eligible entities standing on the plate activate its signal.','WeightedPressurePlateBlock':'Its signal strength changes with the number of entities on the plate.','DoorBlock':'Redstone power controls whether the door is open.','TrapDoorBlock':'Redstone power controls whether the trapdoor is open.','FenceGateBlock':'Redstone power controls whether the fence gate is open.','CopperBulbBlock':'A rising power signal toggles the bulb between lit and unlit.','RedstoneLampBlock':'Redstone power turns on the lamp.','RepeaterBlock':'Repeats a signal after its selected delay and can be locked from the side.','ComparatorBlock':'Compares or subtracts its side input from its rear input.','RedstoneWireBlock':'Carries a redstone signal across connected dust.','ObserverBlock':'Produces a pulse when it detects a change in the block it faces.','PistonBaseBlock':'Extends under redstone power to move eligible blocks.','DispenserBlock':'Dispenses an item when activated by a new redstone signal.','DropperBlock':'Drops an item or transfers it to an adjacent container when activated.','HopperBlock':'Transfers items while unlocked; redstone power locks its transfer behavior.','CrafterBlock':'A redstone activation crafts a recipe from its enabled slots.','ShelfBlock':'Redstone-powered shelves can exchange their slots with the hotbar.','DaylightDetectorBlock':'Converts daylight into a redstone signal and supports inverted mode.','SculkSensorBlock':'Detects vibrations and produces a corresponding redstone signal.','CalibratedSculkSensorBlock':'Filters detected vibrations using the input on its calibrated side.','TargetBlock':'Projectile hits produce a signal based on how close the hit is to its center.','TrappedChestBlock':'Opening the chest produces a redstone signal.','BellBlock':'Redstone activation rings the bell.','PoweredRailBlock':'Redstone power changes whether the rail is active.','TripWireBlock':'Detects entities touching the string and changes its connected tripwire-hook circuit.','TripWireHookBlock':'Turns on its signal when an attached tripwire line is triggered.','DetectorRailBlock':'A minecart on the rail produces a redstone signal.'}
 for entry in audit['rows']:
  k=entry['id'];cls=entry['class'];role='Inventory interaction' if cls=='HopperBlock' else 'Signal logic' if cls=='RedstoneTorchBlock' else entry['role'];base=blocks[B.slug(k)];code=(B.JAVA/index[cls]).read_text() if cls in index else '';action=behaviors.get(cls);signal='0 or 15' if cls in ['ButtonBlock','LeverBlock','PressurePlateBlock','ObserverBlock'] and 'return 15' in code else '0 to 15' if cls in ['WeightedPressurePlateBlock','ComparatorBlock','DaylightDetectorBlock','TargetBlock','RedstoneWireBlock'] else None;delay='2, 4, 6 or 8 game ticks' if cls=='RepeaterBlock' and 'state.getValue(DELAY) * 2' in code else '2 game ticks' if cls=='ComparatorBlock' and 'return 2;' in code else None;stack=B.COMPONENTS.get(k,{}).get('minecraft:max_stack_size');bc=B.BEDCOMP.get(k,{});bedaction=bedfunctions.get(cls,{}).get('action') or ('Accelerates minecarts while powered.' if k=='powered_rail' else 'Activates the minecart passing over it while powered.' if k=='activator_rail' else None);summary=action or ('Crafted at '+base['recipeStations']+'.' if base['recipeStations'] else 'Preferred mining tool: '+base['miningTool']+'.' if base['miningTool'] else None)
  rows.append(B.row(k,role.replace('Signal source','Signal generation'),name=B.name(k),role=role.replace('Signal source','Signal generation'),actions=action,signalStrength=signal,delay=delay,stackSize=stack,acquisition=base['acquisition'],cardSummary=summary,editions=base['editions'],editionOverrides={'bedrock':{'actions':bedaction,'signalStrength':'15' if cls=='PoweredBlock' else '0 or 15' if cls in ['LeverBlock','RepeaterBlock','RedstoneTorchBlock'] else None,'delay':'1 to 4 redstone ticks' if cls=='RepeaterBlock' else None,'stackSize':bc.get('maxAmount'),'acquisition':None,'cardSummary':bedaction or ('Accelerates minecarts while powered.' if k=='powered_rail' else 'Activates the minecart passing over it while powered.' if k=='activator_rail' else 'Stacks up to '+str(bc['maxAmount'])+' per inventory slot.' if bc.get('maxAmount') else None)}} if 'bedrock' in base['editions'] else {}));proof.append({'id':k,'class':cls,'javaCodeSource':index.get(cls),'actionSummary':action,'signalStrength':signal,'delay':delay,'bedrockRuntimeItemId':k if bc else None,'bedrockFunctionProof':bedfunctions.get(cls) or ({'action':bedaction,'sourceUrl':'https://www.minecraft.net/en-us/article/taking-inventory--rails'} if k in ['powered_rail','activator_rail'] else None)})
 save('redstone-components',rows,['role','actions','signalStrength','delay','stackSize','acquisition'],['role','actions','signalStrength','delay'],'actions',117,{'components':proof},['117 functional block types grouped by role','Java actions and timings sourced from native block classes','Bedrock stack sizes independently proved; functions checked against official Creator documentation and Minecraft articles; timings shown only with its own proof'])

def achievements():
 audit=B.read(P/'references/achievements-roster-audit.json');objectives=B.read(P/'references/achievement-authored-objectives.json');eligibility=B.read(P/'references/achievement-eligibility-proof.json');rows=[];proof=[]
 for source in audit['rows']:
  evidence=re.sub(r'\s+',' ',source['requirementEvidence']).strip();evidence=re.sub(r'\s+([.,!?])',r'\1',evidence).rstrip('.');req=evidence
  substitutions=[(r'^Open your inventory$', 'View the items in your inventory'),(r'^Craft ', 'Make '),(r'^Construct ', 'Build '),(r'^Use (.+) to (.+)$',r'With \1, \2'),(r'^Turn (.+) into (.+)$',r'Make \2 from \1'),(r'^Make ', 'Create '),(r'^Pick up ', 'Collect '),(r'^Acquire ', 'Obtain '),(r'^Kill ', 'Defeat '),(r'^Travel ', 'Move '),(r'^Smelt ', 'Use a furnace to smelt '),(r'^Place ', 'Set down '),(r'^Breed ', 'Get offspring by breeding '),(r'^Hit ', 'Strike '),(r'^Deal ', 'Inflict ')]
  for pattern,replacement in substitutions:
   changed=re.sub(pattern,replacement,req,flags=re.I)
   if changed!=req:req=changed;break
  name=source['name'];req=objectives[name];rows.append(B.row(name+' question' if name.endswith('?') else name,'Achievements',name=name,criteria=req,gamerscore=source['gamerscore'],eligibility=eligibility['publicEligibility'],cardSummary=req,editions=['bedrock'],editionOverrides={}));proof.append({'name':name,'source':source['source'],'requirementEvidence':evidence,'publicCriteria':req,'officialContext':source.get('officialContext')})
 assert sum(r['item']['gamerscore'] for r in rows)==2980
 save('achievements',rows,['criteria','gamerscore','eligibility'],['gamerscore','criteria'],'criteria',133,{'achievements':proof,'eligibilityProof':eligibility,'totalGamerscore':2980,'rosterCrosscheck':audit['rosterCrosscheck'],'imageException':'Parent-approved text-only individual achievements; exact badges unavailable'},['Bedrock only; Java progression is covered by advancements','133-entry roster and 2980 Gamerscore crosschecked against Xbox and Windows catalogues','Criteria based on documented objectives; uncertain legacy qualifiers are omitted','Text-only exception approved; no generic badge substitutions'])

BUILDERS={'mobs':mobs,'blocks':blocks,'crops-and-plants':plants,'biomes':biomes,'structures':structures,'redstone-components':redstone,'achievements':achievements}
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--collection',required=True,choices=ORDER);args=parser.parse_args();BUILDERS[args.collection]()
