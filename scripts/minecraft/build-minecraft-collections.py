#!/usr/bin/env python3
"""Prepare reviewed Minecraft reference data from pinned official resources."""
import argparse, collections, hashlib, json, re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
WORK=ROOT/'tmp/content-workspace/minecraft'
JAVA=WORK/'source-pack/java'; BEDROCK=WORK/'source-pack/bedrock'
OUT=WORK/'minecraft/collections'
SOURCES=['https://www.minecraft.net/en-us/article/minecraft-java-edition-26-3','https://github.com/misode/mcmeta/tree/26.3-summary','https://github.com/Mojang/bedrock-samples/tree/v1.26.50.4']
VERSION={'java':'26.3','bedrock':'26.52'}
def read(p): return json.loads(p.read_text())
def sid(v): return v.removeprefix('minecraft:')
def title(v): return sid(v).replace('_',' ').replace('/',' / ').title()
LANG=read(JAVA/'assets/lang/en_us.json'); COMPONENTS=read(JAVA/'summary/item_components/data.json'); REG=read(JAVA/'summary/registries/data.json')
def name(v):
 v=sid(v); c=COMPONENTS.get(v,{}); translation=c.get('minecraft:item_name',{}).get('translate','')
 base=LANG.get(translation,LANG.get('block.minecraft.'+v,LANG.get('item.minecraft.'+v,title(v))))
 if base=='Music Disc' and translation+'.desc' in LANG:return 'Music Disc: '+LANG[translation+'.desc'].split(' - ',1)[-1]
 if base=='Banner Pattern' and translation+'.desc' in LANG:return LANG[translation+'.desc']+' Banner Pattern'
 if base=='Smithing Template' and translation+'.new' in LANG:return LANG[translation+'.new']+' Smithing Template'
 return base
def local(v):
 if isinstance(v,str): return LANG.get(v,v)
 if isinstance(v,dict): return LANG.get(v.get('translate',''),v.get('text',''))
 return ''
def expand(v,kind='item',seen=frozenset()):
 if isinstance(v,list): return list(dict.fromkeys(x for y in v for x in expand(y,kind,seen)))
 if isinstance(v,dict): return expand(v.get('id',v.get('item','#minecraft:'+v.get('tag',''))),kind,seen)
 if not isinstance(v,str): return []
 if not v.startswith('#'): return [sid(v)]
 k=sid(v[1:]);p=JAVA/'data/tags'/kind/(k+'.json')
 if k in seen or not p.exists(): return []
 return expand(read(p).get('values',[]),kind,seen|{k})
def bedregistry(k): return {sid(x.get('command_name',x['name'])) for x in read(BEDROCK/f'metadata/vanilladata_modules/mojang-{k}.json')['data_items']}
BEDITEMS=bedregistry('items')
BEDRUNTIME=read(BEDROCK/'runtime-item-components.frozen.json')
assert len(BEDRUNTIME['items'])==1623 and len(BEDRUNTIME['enchantments'])==42, 'Complete frozen Bedrock runtime proof is required'
BEDCOMP={sid(x['id']):x for x in BEDRUNTIME['items']}
BEDENCHALIAS={'binding':'binding_curse','vanishing':'vanishing_curse','bow_infinity':'infinity'}
BED_VARIANT_DATA=read(BEDROCK/'runtime-legacy-item-variants.json')
BED_VARIANTS={(v['id'].lower(),v['aux']):v for v in BED_VARIANT_DATA['cases']}
LEGACY_DYES=['ink_sac','red_dye','green_dye','cocoa_beans','lapis_lazuli','purple_dye','cyan_dye','light_gray_dye','gray_dye','pink_dye','lime_dye','yellow_dye','light_blue_dye','magenta_dye','orange_dye','bone_meal','black_dye','brown_dye','blue_dye','white_dye']
LEGACY_BANNER_COLORS=['black','red','green','brown','blue','purple','cyan','light_gray','gray','pink','lime','yellow','light_blue','magenta','orange','white']
BED_RECIPE_ALIASES={'carrotonastick':'carrot_on_a_stick','chorus_fruit_popped':'popped_chorus_fruit','horsearmorleather':'leather_horse_armor','chain':'iron_chain','sealantern':'sea_lantern','darkoak_sign':'dark_oak_sign','sign':'oak_sign','appleenchanted':'enchanted_golden_apple','rabbitfoot':'rabbit_foot','turtle_shell_piece':'turtle_scute','muttonraw':'mutton','muttoncooked':'cooked_mutton','fireball':'fire_charge','reeds':'sugar_cane','speckled_melon':'glistering_melon_slice','fish':'cod','cooked_fish':'cooked_cod','nether_wart_block':'nether_wart_block','wood':'oak_log','log':'oak_log','log2':'acacia_log','planks':'oak_planks','wooden_slab':'oak_slab','double_plant':'sunflower','stonebrick':'stone_bricks','stone_slab':'smooth_stone_slab','red_flower':'poppy','yellow_flower':'dandelion','tallgrass':'short_grass','sponge':'sponge','mycelium':'mycelium','seagrass':'seagrass','sugarcane':'sugar_cane','silver_dye':'light_gray_dye','boat':'oak_boat','chest_boat':'oak_chest_boat'}
BED_LEGACY={('dye',i):v for i,v in enumerate(LEGACY_DYES)}
BED_LEGACY.update({('banner',i):color+'_banner' for i,color in enumerate(LEGACY_BANNER_COLORS)})
BED_LEGACY.update({('carpet',5):'lime_carpet',('carpet',8):'light_gray_carpet',('coal',1):'charcoal',('bucket',1):'milk_bucket',('bucket',2):'cod_bucket',('bucket',10):'lava_bucket',('quartz_block',2):'quartz_pillar',('purpur_block',2):'purpur_pillar',('sandstone',3):'smooth_sandstone',('skull',1):'wither_skeleton_skull',('skull',4):'creeper_head',('emptymap',0):'empty_map',('emptymap',1):'empty_map',('emptymap',2):'empty_map'})
BED_LEGACY.update({('banner_pattern',i):v+'_banner_pattern' for i,v in enumerate(['creeper','skull','flower','mojang','field_masoned','bordure_indented'])})
for _i,_wood in enumerate(['oak','spruce','birch','jungle','acacia','dark_oak','mangrove','cherry']):
 BED_LEGACY['boat',_i]=_wood+'_boat';BED_LEGACY['chest_boat',_i]=_wood+'_chest_boat'
def bed_identifier(v):
 if isinstance(v,dict):
  if 'tag' in v:return '#'+sid(v['tag'])
  k=sid(v.get('item',v.get('id','')));data=v.get('data',0);parts=k.split(':')
  if len(parts)>1 and parts[-1].lstrip('-').isdigit():k=':'.join(parts[:-1]);data=int(parts[-1])
 else:
  k=sid(v);parts=k.split(':');data=int(parts[-1]) if len(parts)>1 and parts[-1].lstrip('-').isdigit() else 0;k=':'.join(parts[:-1]) if len(parts)>1 and parts[-1].lstrip('-').isdigit() else k
 if (k.lower(),data) in BED_VARIANTS and k not in ['banner','suspicious_stew','potion','emptymap']:return sid(BED_VARIANTS[k.lower(),data]['typeId'])
 if (k,data) in BED_LEGACY:return BED_LEGACY[k,data]
 if k in ['suspicious_stew','potion']:return k
 if data not in [0,None] and k not in ['dispenser','dropper','piston','sticky_piston','bamboo_planks','mangrove_planks','birch_log','spruce_log','jungle_log','dark_oak_log']:raise ValueError(f'Unmapped Bedrock variant {k}:{data}')
 k=k.lower()
 if k.startswith('record_'):return 'music_disc_'+k.removeprefix('record_')
 return BED_RECIPE_ALIASES.get(k,k)
TAG_LABELS={'planks':'Any planks','logs':'Any log','logs_that_burn':'Any burnable log','wooden_slabs':'Any wooden slab','wool':'Any wool','coals':'Coal or Charcoal','egg':'Egg','mushrooms_for_stew':'Red or Brown Mushroom','soul_fire_base_blocks':'Soul Sand or Soul Soil','stone_crafting_materials':'A supported stone crafting material','stone_tool_materials':'A supported stone tool material','metal_nuggets':'A supported metal nugget','is_pickaxe':'A pickaxe','trim_templates':'An armor trim template','trim_materials':'An armor trim material','trimmable_armors':'An armor piece that supports trims'}
BED_TAG_DATA=read(BEDROCK/'runtime-item-tags.json');assert BED_TAG_DATA['itemCount']==1623
BED_TAGS=collections.defaultdict(list)
for _row in BED_TAG_DATA['items']:
 for _tag in _row['tags']:BED_TAGS[sid(_tag)].append(sid(_row['id']))
CRAFT_REMAINDERS={k.lower():v.lower() for k,v in re.findall(r'^\s*(\w+) = registerItem[^\n]*\.craftRemainder\((\w+)\)',(JAVA/'code/world/item/Items.java').read_text(),re.M)}
def human_ingredient(v):
 if isinstance(v,list):return ' or '.join(human_ingredient(x) for x in v)
 if isinstance(v,dict):
  if 'tag' in v:return TAG_LABELS.get(sid(v['tag']),'Any '+sid(v['tag']).replace('_',' '))
  k=bed_identifier(v);raw=sid(v.get('item',v.get('id','')));parts=raw.split(':');aux=v.get('data',int(parts[-1]) if len(parts)>1 and parts[-1].lstrip('-').isdigit() else 0);raw=':'.join(parts[:-1]) if len(parts)>1 and parts[-1].lstrip('-').isdigit() else raw
  if k in COMPONENTS and COMPONENTS[k].get('minecraft:item_name',{}).get('translate','') in LANG and LANG[COMPONENTS[k]['minecraft:item_name']['translate']] in ['Music Disc','Banner Pattern','Smithing Template']:return name(k)
  if (raw.lower(),aux) in BED_VARIANTS:return BED_VARIANTS[raw.lower(),aux]['localizedName']
  if sid(v.get('item',''))=='emptymap':return 'Empty Locator Map' if v.get('data')==2 else 'Empty Map'
  return name(BED_ALIASES.get(k,k))
 if not isinstance(v,str):return None
 if v.startswith('#'):
  k=sid(v[1:]);return TAG_LABELS.get(k,' or '.join(name(x) for x in expand(v))) or 'Any '+k.replace('_',' ')
 if v.startswith('minecraft:') and ':' in sid(v):return human_ingredient({'item':v})
 return name(v)

def slug(k): return re.sub('[^a-z0-9]+','-',k.lower()).strip('-')
def row(k,section,**fields): return {'item':fields,'system':{'slug':slug(k),'section':section,'sortOrder':0,'image':None}}
def availability(editions): return 'Java and Bedrock' if len(editions)==2 else ('Java only' if editions==['java'] else 'Bedrock only')
def edition(k): return ['java','bedrock'] if k in BEDITEMS or any(BED_ALIASES.get(x,x)==k for x in BEDITEMS) else ['java']
def records(directory): return [(str(p.relative_to(JAVA/'data'/directory)).removesuffix('.json'),read(p),p) for p in sorted((JAVA/'data'/directory).rglob('*.json'))]
RECIPE_DATA=records('recipe')
RECIPE_OUTPUTS=collections.defaultdict(list)
LOOT_SOURCES=collections.defaultdict(set)
def walk_loot(v,path):
 if isinstance(v,dict):
  if v.get('type')=='minecraft:item' and isinstance(v.get('name'),str): LOOT_SOURCES[sid(v['name'])].add(path)
  for x in v.values(): walk_loot(x,path)
 elif isinstance(v,list):
  for x in v: walk_loot(x,path)
for k,d,p in records('loot_table'): walk_loot(d,k)
for k,d,p in RECIPE_DATA:
 result=d.get('result',d.get('output',{}))
 if isinstance(result,str): result={'id':result}
 if isinstance(result,dict) and result.get('id'): RECIPE_OUTPUTS[sid(result['id'])].append((k,d))
def stations(k): return {'crafting_shaped':'Crafting table','crafting_shapeless':'Crafting table','smelting':'Furnace','blasting':'Blast furnace','smoking':'Smoker','campfire_cooking':'Campfire','stonecutting':'Stonecutter','smithing_transform':'Smithing table','smithing_trim':'Smithing table','brewing':'Brewing stand','soul_campfire':'Soul campfire','cartography_table':'Cartography table'}.get(sid(k),'Crafting table')
def acquisition(k):
 parts=[]
 if k in RECIPE_OUTPUTS: parts.append('Produced at '+', '.join(sorted({stations(d['type']) for _,d in RECIPE_OUTPUTS[k]}))+'.')
 if k in LOOT_SOURCES:
  locations=[loot_location(x) for x in sorted(LOOT_SOURCES[k]) if x.startswith(('chests/','archaeology/','entities/'))]
  if locations: parts.append('Found in '+', '.join(locations[:12])+'.')
 blocks=sorted({name(x.removeprefix('blocks/')) for x in LOOT_SOURCES[k] if x.startswith('blocks/')})
 if blocks:parts.append('Possible block drops: '+', '.join(blocks[:12])+'.')
 return ' '.join(parts) or None

def save(collection,rows,fields,card,description=None,tooldata=None,expected=None,exclusions=None,extra_sources=None,bedrock_gaps=None):
 directory=OUT/collection;brief=directory/'brief.md'
 if not brief.exists() or 'Approved for data preparation' not in brief.read_text(): raise ValueError(f'{collection} has no parent-approved research brief')
 if expected is not None and len(rows)!=expected: raise ValueError(f'{collection} roster {len(rows)} != proved source count {expected}')
 ids=[r['system']['slug'] for r in rows]
 if len(ids)!=len(set(ids)): raise ValueError(f'{collection} has duplicate stable slugs')
 sections=list(dict.fromkeys(r['system']['section'] for r in rows))
 rows.sort(key=lambda r:(sections.index(r['system']['section']),r['item']['name'].casefold(),r['system']['slug']))
 for i,r in enumerate(rows):
  r['system']['sortOrder']=i+1
  for f in fields: r['item'].setdefault(f,None)
  if set(r['system'])!={'slug','section','sortOrder','image'}: raise ValueError('Unexpected system field')
 for f in fields:
  if not any(r['item'].get(f) is not None for r in rows) and f not in ['remainder','example']: raise ValueError(f'{collection}: {f} has no source-backed values')
 description=description or card[-1]
 display={'groupLabel':'Category','sectionOrder':sections,'tableFields':fields,'cardFields':card,'subtitleFields':[],'descriptionField':description,'cardDescriptionField':description,'fieldPresentation':{f:('chip' if f in ['maxLevel','outputCount','burnTicks','processingCapacity','durability','armor','toughness','stackSize','attackDamage','attackSpeed','hunger','saturation','duration','comparatorOutput'] else 'detail' if f in ['effect','criteria','actions','conditions','acquisition','brewingSequence','miningSuitability','jobConditions','uses','generation','syntax'] else 'normal') for f in fields}}
 meta={'schemaVersion':2,'gameSlug':'minecraft','collection':collection,'title':title(collection),'updatedAt':'2026-10-02','editionReleases':VERSION,'itemFields':['name',*fields],'columns':['name',*fields],'display':display,'sources':[{'url':u,'label':'Minecraft Wiki reference' if 'minecraft.wiki' in u else 'Official/pinned reference','accessed':'2026-10-02'} for u in SOURCES+(extra_sources or [])]}
 if tooldata is not None:
  (directory/'tool-source-data.json').write_text(json.dumps(tooldata,indent=2)+'\n')
 document={'meta':meta,'items':rows};(directory/'dataset.json').write_text(json.dumps(document,ensure_ascii=False,indent=2)+'\n')
 manifest={'schemaVersion':1,'namespace':'minecraft','game':{'slug':'minecraft','name':'Minecraft'},'collection':{'slug':collection,'label':title(collection),'sortOrder':list(ORDER).index(collection)*10+10,'pageType':'database'},'route':'/minecraft/wiki/'+collection,'dataset':'dataset.json','finalJson':'final.json','mediaRoot':'media','sourceUrls':SOURCES+(extra_sources or [])}
 (directory/'runtime-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');(directory/'media').mkdir(exist_ok=True)
 proof={'collection':collection,'sourceReleases':VERSION,'sourceCount':expected or len(rows),'rowCount':len(rows),'sections':dict(collections.Counter(r['system']['section'] for r in rows)),'exclusions':exclusions or [],'bedrockFieldGaps':bedrock_gaps or [],'fieldCoverage':{f:sum(r['item'].get(f) is not None for r in rows) for f in fields},'datasetSha256':hashlib.sha256((directory/'dataset.json').read_bytes()).hexdigest(),'imageStage':'Pending parent data review','publicSourceFields':False,'bedrockRuntimeSha256':hashlib.sha256((BEDROCK/'runtime-item-components.frozen.json').read_bytes()).hexdigest()}
 (directory/'data-audit.json').write_text(json.dumps(proof,indent=2)+'\n')
 text=brief.read_text();marker='\n## Data preparation readiness\n';text=text.split(marker)[0]
 text+=marker+f'\nDataset: dataset.json. Runtime manifest: runtime-manifest.json. Page type: database.\n\nComplete source-backed roster: {len(rows)} rows. Shape: v2 wrapped. Stable slugs, deterministic sorting, field consistency and display-field coverage passed the builder audit. Sections: '+', '.join(f'{k} ({v})' for k,v in proof['sections'].items())+'.\n\nPublic fields: '+', '.join(fields)+'. Source paths, raw conditions and source proof remain in private data-audit.json or the pinned source pack. Images use only system.image, currently null pending the separate image stage.\n\nBedrock boundaries: '+('; '.join(bedrock_gaps) if bedrock_gaps else 'Edition-specific data resolved from each source independently.')+'.\n\nRuntime sync dry plan must pass before parent data approval. No final copy, images or database publication was performed by this data worker.\n'
 brief.write_text(text);print(json.dumps({'collection':collection,'rows':len(rows),'fields':proof['fieldCoverage'],'bedrockGaps':bedrock_gaps or []}))

EFFECT_TEXT={
'aqua_affinity':'Removes the usual underwater mining-speed penalty.', 'bane_of_arthropods':'Adds damage against arthropods and slows them after a successful hit.', 'binding_curse':'Prevents removing equipped cursed armor through normal equipment changes.', 'blast_protection':'Reduces explosion damage and explosion knockback.', 'breach':'Reduces how much an enemy\'s armor protects against mace attacks.', 'channeling':'Can summon lightning when a thrown trident hits an eligible target during a thunderstorm.', 'density':'Adds mace smash damage for each block fallen.', 'depth_strider':'Improves movement speed while submerged.', 'efficiency':'Increases mining speed with compatible equipment.', 'feather_falling':'Reduces fall damage.', 'fire_aspect':'Sets eligible melee targets on fire.', 'fire_protection':'Reduces fire damage and time spent burning.', 'flame':'Makes bow-fired arrows ignite targets.', 'fortune':'Changes eligible block loot rolls to increase resource drops.', 'frost_walker':'Creates temporary frosted ice beneath a walking player and protects against magma-block stepping damage.', 'impaling':'Adds trident damage against targets in the enchantment\'s aquatic damage-target group.', 'infinity':'Prevents consumption of ordinary arrows when firing a bow.', 'knockback':'Adds knockback to melee attacks.', 'looting':'Changes eligible equipment and mob-loot drop rolls.', 'loyalty':'Returns a thrown trident to its owner more quickly.', 'luck_of_the_sea':'Improves the fishing luck value used by fishing loot rolls.', 'lunge':'Propels the player forward during a spear jab, consuming hunger and durability under its activation conditions.', 'lure':'Reduces the waiting time for a fishing bite.', 'mending':'Uses collected experience to repair compatible damaged equipment.', 'multishot':'Makes a crossbow fire additional projectiles in a spread.', 'piercing':'Allows crossbow projectiles to pierce additional targets.', 'power':'Increases damage from bow-fired arrows.', 'projectile_protection':'Reduces damage from eligible projectile damage types.', 'protection':'Reduces damage from eligible damage types.', 'punch':'Increases knockback from bow-fired arrows.', 'quick_charge':'Reduces the time needed to charge a crossbow.', 'respiration':'Increases the oxygen bonus used while underwater.', 'riptide':'Propels the player with the trident when the activation conditions are met.', 'sharpness':'Adds damage to compatible melee attacks.', 'silk_touch':'Makes eligible mined blocks drop their intact form and suppresses their block experience.', 'smite':'Adds melee damage against undead targets.', 'soul_speed':'Increases movement speed on soul sand and soul soil, with durability costs.', 'sweeping_edge':'Increases the sweeping damage ratio of sword sweep attacks.', 'swift_sneak':'Increases movement speed while sneaking.', 'thorns':'Can damage an attacker after the wearer is hit, at a durability cost.', 'unbreaking':'Can prevent durability loss when equipment takes item damage.', 'vanishing_curse':'Prevents cursed equipment from dropping through the affected equipment-drop rules.', 'wind_burst':'Launches the attacker upward after an eligible mace smash attack.'}


def grants_enchantment(v,k):
 if isinstance(v,dict):
  if v.get('type') in ['minecraft:enchant_randomly','minecraft:enchant_with_levels'] and 'minecraft:'+k in expand(v.get('options',[]),'enchantment'):return True
  if v.get('type')=='minecraft:set_enchantments' and 'minecraft:'+k in v.get('enchantments',{}):return True
  if v.get('type') in ['minecraft:enchant_randomly','minecraft:enchant_with_levels'] and k in expand(v.get('options',[]),'enchantment'):return True
  return any(grants_enchantment(x,k) for x in v.values())
 if isinstance(v,list):return any(grants_enchantment(x,k) for x in v)
 return False

def enchantments():
 defs={k:d for k,d,p in records('enchantment')};tags={p.stem:expand(read(p)['values'],'enchantment') for p in (JAVA/'data/tags/enchantment').glob('*.json')}
 bed=bedregistry('enchantments');aliases={'binding':'binding_curse','vanishing':'vanishing_curse','bow_infinity':'infinity'};bed={aliases.get(x,x) for x in bed}
 maxlevels={BEDENCHALIAS.get(x['id'],x['id']):x['maxLevel'] for x in BEDRUNTIME['enchantments']}
 pairs=read(BEDROCK/'runtime-enchantment-pairs-staged.json')['pairs'];bedconflicts=collections.defaultdict(set)
 for pair in pairs:
  if any(t.get('canAddSecond') is False or (t.get('firstBaseline') and t.get('secondBaseline') and t.get('firstApplied') and t.get('secondCallError')) for t in pair['tested']):
   a=BEDENCHALIAS.get(pair['first'],pair['first']);b=BEDENCHALIAS.get(pair['second'],pair['second']);bedconflicts[a].add(b);bedconflicts[b].add(a)
 rows=[];typed=[]
 for k,d in defs.items():
  conflicts=set(expand(d.get('exclusive_set',[]),'enchantment'))-{k}
  conflicts|={other for other,value in defs.items() if k in expand(value.get('exclusive_set',[]),'enchantment') and other!=k}
  equipment=expand(d['supported_items']);ed=['java','bedrock'] if k in bed else ['java'];methods=[]
  if k in tags.get('in_enchanting_table',[]):methods.append('Enchanting table')
  if k in tags.get('tradeable',[]):methods.append('Librarian enchanted-book trades')
  if k in tags.get('on_random_loot',[]):methods.append('Random enchanted loot')
  if k in tags.get('on_traded_equipment',[]):methods.append('Enchanted equipment trades')
  direct=[]
  for lootkey,lootvalue,lootfile in records('loot_table'):
   if grants_enchantment(lootvalue,k): direct.append(loot_location(lootkey))
  if direct: methods.append('Specific loot sources: '+', '.join(dict.fromkeys(direct)))
  section={'head':'Head equipment','feet':'Foot equipment','legs':'Leg equipment','armor':'Armor','hand':'Held equipment','mainhand':'Held equipment','any':'Equipment'}.get(d['slots'][0],'Equipment')
  bedoverride={'maxLevel':maxlevels.get(k),'compatibleEquipment':', '.join(name(item) for item,data in BEDCOMP.items() if k in [BEDENCHALIAS.get(x,x) for x in data['enchantments']]),'effect':None,'conflicts':', '.join(local(defs[x]['description']) for x in sorted(bedconflicts[k])) or 'No conflict in tested compatible equipment pairs','acquisition':None,'ruleScope':'Bedrock maximum level, equipment and compatibility shown; effect and acquisition details are Java-specific.'} if 'bedrock' in ed else None
  rows.append(row(k,section,name=local(d['description']),maxLevel=d['max_level'],compatibleEquipment=', '.join(name(x) for x in equipment),effect=EFFECT_TEXT[k],conflicts=', '.join(local(defs[x]['description']) for x in sorted(conflicts)) or 'None in the enchantment compatibility rules',acquisition='; '.join(methods) or None,ruleScope='Java Edition rules',editions=ed,editionOverrides={'bedrock':bedoverride} if bedoverride else {}))
  typed.append({'id':k,'maxLevel':d['max_level'],'anvilCost':d['anvil_cost'],'compatibleEquipment':equipment,'conflicts':sorted(conflicts),'effects':d.get('effects',{})})
 save('enchantments',rows,['maxLevel','compatibleEquipment','effect','conflicts','acquisition','ruleScope'],['maxLevel','compatibleEquipment','conflicts','acquisition'],'effect',{'java':typed,'bedrockCompatibilityPairs':pairs},43,extra_sources=['https://learn.microsoft.com/en-us/minecraft/creator/commands/commands/enchant?view=minecraft-bedrock-stable'],bedrock_gaps=['42 Bedrock IDs independently normalized','42 maximum levels and compatible equipment verified in official Bedrock Dedicated Server 26.52.3','Bedrock conflicts independently tested for all 245 pairs with compatible non-book equipment; acquisition and effects remain Java-specific'])

def provider(v,folder,fast=False):
 if isinstance(v,(int,float)):return v
 if isinstance(v,str):return provider(read(JAVA/'data'/folder/(sid(v)+'.json')),folder,fast)
 if not isinstance(v,dict):raise ValueError(f'Unsupported provider {v}')
 t=sid(v['type'])
 if t=='div':return int(provider(v['left'],folder,fast)//provider(v['right'],folder,fast))
 if t=='conditional':return provider(v['on_true'] if fast else v['on_false'],folder,fast)
 raise ValueError(f'Provider {t} needs verified evaluation')
def fuels():
 rows=[];typed=[];bedsource=read(BEDROCK/'runtime-furnace-fuels.json');assert bedsource['testedItems']==1623 and bedsource['fuelCount']==268
 bed={BED_ALIASES.get(sid(d['id']),sid(d['id'])):d for d in bedsource['items'] if d['burnTicks']>0};java={k:d for k,d in COMPONENTS.items() if d.get('minecraft:cooking_fuel')}
 for k in sorted(set(java)|set(bed)):
  d=java.get(k);bd=bed.get(k);ed=[e for e,yes in [('java',bool(d)),('bedrock',bool(bd))] if yes]
  if d:
   f=d['minecraft:cooking_fuel'];ticks=provider(f['burn_time'],'context_int_provider');fast=provider(f['burn_time'],'context_int_provider',True);speed=provider(f['speed_multiplier'],'context_float_provider');fastspeed=provider(f['speed_multiplier'],'context_float_provider',True)
   typed.append({'id':k,'normalBurnTicks':ticks,'fastBurnTicks':fast,'normalSpeedMultiplier':speed,'fastSpeedMultiplier':fastspeed})
  else:ticks=bd['burnTicks'];speed=1
  remainder='Bucket' if k=='lava_bucket' else None
  bedrem=', '.join(name(x['Name']) for x in bd['fuelSlotAfterIgnition']) if bd and bd['fuelSlotAfterIgnition'] else None
  fields={'name':name(k),'burnTicks':ticks,'processingCapacity':round(ticks*speed/200,4) if d else round(ticks/200,4),'stations':'Furnace, blast furnace and smoker; only processable inputs can be cooked' if d else 'Furnace, blast furnace and smoker','acquisition':acquisition(k) if d else None,'remainder':remainder if d else bedrem,'ruleScope':'Java furnace, blast furnace and smoker fuel rules' if d else 'Bedrock furnace, blast furnace and smoker fuel rules'}
  overrides={'bedrock':{'burnTicks':bd['burnTicks'],'processingCapacity':round(bd['burnTicks']/200,4),'stations':'Furnace, blast furnace and smoker','remainder':bedrem,'acquisition':None,'ruleScope':'Bedrock burn duration, processing capacity and remaining container shown'}} if d and bd else {}
  rows.append(row(k,'Items',**fields,editions=ed,editionOverrides=overrides))
 save('fuels',rows,['burnTicks','processingCapacity','stations','acquisition','remainder','ruleScope'],['burnTicks','processingCapacity','remainder','stations'],'stations',{'java':typed,'bedrock':bedsource},len(set(java)|set(bed)),bedrock_gaps=['All 1,623 Bedrock runtime item types tested; 268 positive fuels','Bedrock furnace burn duration and container remainder independently measured','Processing speed and burn-time scaling measured independently for furnace, blast furnace and smoker'])

UTILITY_TOOLS=['shears','brush','flint_and_steel','fishing_rod','carrot_on_a_stick','warped_fungus_on_a_stick','compass','recovery_compass','clock','map','filled_map','spyglass','elytra']
def equipment(collection):
 enchantdefs={k:d for k,d,p in records('enchantment')}
 if collection=='tools':keys=[k for k in COMPONENTS if re.fullmatch(r'(wooden|stone|copper|iron|golden|diamond|netherite)_(axe|pickaxe|shovel|hoe)',k)]+UTILITY_TOOLS;expected=41
 elif collection=='weapons':keys=[k for k in COMPONENTS if re.fullmatch(r'(wooden|stone|copper|iron|golden|diamond|netherite)_(sword|axe|spear)',k)]+['bow','crossbow','trident','mace'];expected=25
 else:keys=[k for k,d in COMPONENTS.items() if any(a['type']=='minecraft:armor' for a in d['minecraft:attribute_modifiers'])];expected=41
 if any(k not in COMPONENTS for k in keys):raise ValueError('Utility/equipment roster includes absent source identifier')
 rows=[];typed=[]
 for k in keys:
  d=COMPONENTS[k];attrs={sid(a['type']):a['amount'] for a in d.get('minecraft:attribute_modifiers',[]) if a.get('operation')=='add_value'}
  compatible=[local(v['description']) for e,v in enchantdefs.items() if k in expand(v['supported_items'])]
  repair=', '.join(name(x) for x in expand(d.get('minecraft:repairable',{}).get('items',[]))) or None
  material=title(k.split('_')[0]) if k.split('_')[0] in ['wooden','stone','copper','iron','golden','diamond','netherite','leather','chainmail'] else None
  bd=BEDCOMP.get(k);ed=edition(k);fields={'durability':d.get('minecraft:max_damage'),'repair':repair,'enchantments':', '.join(compatible) or 'Cannot be enchanted','material':material,'ruleScope':'Java repair and equipment details; Bedrock durability and compatible enchantments shown'}
  bedoverride={'durability':bd.get('maxDurability') if bd else None,'repair':None,'enchantments':', '.join(local(enchantdefs[BEDENCHALIAS.get(x,x)]['description']) for x in bd['enchantments'] if BEDENCHALIAS.get(x,x) in enchantdefs) if bd and bd['enchantments'] else 'Cannot be enchanted','ruleScope':'Bedrock durability and compatible enchantments; Java combat, mining and repair details omitted'}
  if collection=='tools':
   kind=k.split('_')[-1] if k not in UTILITY_TOOLS else 'utility'
   rules=d.get('minecraft:tool',{}).get('rules',[])
   speeds=[r['speed'] for r in rules if 'speed' in r and r['speed']<1000000]
   mine=('Mines blocks suited to '+{'pickaxe':'pickaxes','axe':'axes','shovel':'shovels','hoe':'hoes'}.get(kind,kind)+'. Harvesting some blocks requires a stronger material tier.') if kind!='utility' else 'Utility equipment; no material mining-speed multiplier'
   fields.update(toolType=title(kind),miningSpeed=max(speeds) if speeds else None,miningSuitability=mine);bedoverride.update(miningSpeed=None,miningSuitability=None)
   section=title(kind)
  elif collection=='weapons':
   kind=k.split('_')[-1];fields.update(weaponType=title(kind),attackDamage=round(1+attrs['attack_damage'],4) if 'attack_damage' in attrs else None,attackSpeed=round(4+attrs['attack_speed'],4) if 'attack_speed' in attrs else None,attackMode='Listed damage is the ordinary melee/jab attribute; spear charge damage also depends on movement' if 'minecraft:kinetic_weapon' in d else 'Listed damage is the ordinary melee attribute; ranged damage depends on projectile and charge' if k in ['bow','crossbow','trident'] else 'Listed damage is the ordinary melee attribute; mace smash damage also depends on falling' if k=='mace' else 'Ordinary melee attack')
   bedoverride.update(attackDamage=None,attackSpeed=None,attackMode='Bedrock does not use Java melee attack cooldowns');section=title(kind)
  else:
   e=d['minecraft:equippable'];wearer=', '.join(LANG.get('entity.minecraft.'+entity,title(entity)) for entity in expand(e['allowed_entities'],'entity_type')) if e.get('allowed_entities') else 'Player';slot=title(e['slot'])
   fields.update(slot=slot,wearer=wearer,armor=attrs['armor'],toughness=attrs.get('armor_toughness',0),knockbackResistance=attrs.get('knockback_resistance',0));bedoverride.update(armor=None,toughness=None,knockbackResistance=None)
   section=wearer
  rows.append(row(k,section,name=name(k),**fields,editions=ed,editionOverrides={'bedrock':bedoverride} if 'bedrock' in ed else {}));typed.append({'id':k,'components':d})
 fields={'tools':['toolType','material','durability','miningSpeed','repair','miningSuitability','enchantments','ruleScope'],'weapons':['weaponType','material','durability','attackDamage','attackSpeed','attackMode','repair','enchantments','ruleScope'],'armor':['slot','wearer','material','armor','durability','toughness','knockbackResistance','repair','enchantments','ruleScope']}[collection]
 card={'tools':['toolType','durability','repair','enchantments'],'weapons':['weaponType','durability','attackDamage','attackSpeed'],'armor':['slot','armor','durability','repair']}[collection]
 save(collection,rows,fields,card,'miningSuitability' if collection=='tools' else 'attackMode' if collection=='weapons' else 'wearer',{'java':typed},expected,exclusions=['Utility roster explicitly contains '+', '.join(UTILITY_TOOLS)] if collection=='tools' else None,bedrock_gaps=['Durability and compatible enchantments independently queried in Bedrock 26.52.3','Repair, mining and combat attributes remain Java-scoped'])


def potion_id(v):
 v=sid(v);v=v.removeprefix('potion_type:').lower();return {'nightvision':'night_vision','long_nightvision':'long_night_vision','longnightvision':'long_night_vision','wither':'decay'}.get(v,v)
def potion_title(k):
 base=k.removeprefix('long_').removeprefix('strong_');n=LANG.get('item.minecraft.potion.effect.'+base,'Potion of '+title(base))
 if k.startswith('long_'):n+=' (extended)'
 if k.startswith('strong_'):n+=' (strong)'
 return n

def brewing_edges(which):
 edges=[]
 if which=='java':
  for k,d,p in RECIPE_DATA:
   if d['type']!='minecraft:brewing':continue
   i=d['input'];o=d['output'];a=i.get('potion_contents',{}).get('potions');b=o.get('components',{}).get('minecraft:potion_contents',{}).get('potion');reagent=d.get('reagent',{}).get('item')
   if i.get('item')=='minecraft:potion' and o.get('id')=='minecraft:potion' and isinstance(a,str) and isinstance(b,str) and isinstance(reagent,str):edges.append((potion_id(a),potion_id(b),sid(reagent)))
 else:
  for p in (BEDROCK/'behavior_pack/recipes').glob('*.json'):
   d=read(p).get('minecraft:recipe_brewing_mix')
   if d:edges.append((potion_id(d['input']),potion_id(d['output']),BED_ALIASES.get(bed_identifier(d['reagent']),bed_identifier(d['reagent']))))
 return edges

def brewing_paths(which):
 edges=brewing_edges(which);paths={'water':[]};queue=collections.deque(['water'])
 while queue:
  a=queue.popleft()
  for start,end,reagent in edges:
   if start==a and end not in paths:paths[end]=paths[a]+[(reagent,end)];queue.append(end)
 return paths

def potions():
 text=(JAVA/'code/world/item/alchemy/Potions.java').read_text();java={}
 for identifier,body in re.findall(r'^\s*(\w+) = register\(PotionIds\.\w+, new Potion\((.*?)\)\);',text,re.M):
  effects=[{'effect':e.lower(),'ticks':int(t),'amplifier':int(a or 0)} for e,t,a in re.findall(r'new MobEffectInstance\(MobEffects\.(\w+), (\d+)(?:, (\d+))?\)',body)]
  java[identifier.lower()]=effects
 if set(java)!=set(REG['potion']):raise ValueError('Potion code extraction does not match all Java registry IDs')
 bed={potion_id(k) for k in bedregistry('potion-effects')};paths={e:brewing_paths(e) for e in ['java','bedrock']};rows=[]
 def steps(e,k):return '; '.join(f'{i+1}. Add {name(reagent)} to produce {potion_title(result)}' for i,(reagent,result) in enumerate(paths[e].get(k,[]))) or ('Fill a glass bottle with water' if k=='water' else None)
 for k in sorted(set(java)|bed):
  ed=[e for e,present in [('java',k in java),('bedrock',k in bed)] if present];fx=java.get(k)
  effect=', '.join(LANG.get('effect.minecraft.'+x['effect'],title(x['effect'])) for x in fx) if fx else ('No status effect' if fx==[] else 'Wither' if k=='decay' else None)
  duration=', '.join(('Instant' if x['ticks']==1 else f'{x["ticks"]/20:g} seconds') for x in fx) if fx else ('No timed effect' if fx==[] else None)
  strength=', '.join(str(x['amplifier']+1) for x in fx) if fx else None
  default='java' if k in java else 'bedrock';brew=k in paths[default]
  fields={'name':potion_title(k),'effect':effect,'duration':duration,'potency':strength,'ingredients':', '.join(name(x[0]) for x in paths[default].get(k,[])) or ('Glass bottle and water' if k=='water' else None),'brewingSequence':steps(default,k),'forms':'Drinkable, splash and lingering','brewable':'Yes' if brew else 'No stable brewing recipe','ruleScope':'Duration and potency shown for Java; splash delivery can reduce applied duration' if default=='java' else 'Bedrock-exclusive potion; effect duration and potency are not included'}
  overrides={}
  if 'bedrock' in ed and default=='java':overrides['bedrock']={'duration':None,'potency':None,'ingredients':', '.join(name(x[0]) for x in paths['bedrock'].get(k,[])) or ('Glass bottle and water' if k=='water' else None),'brewingSequence':steps('bedrock',k),'brewable':'Yes' if k in paths['bedrock'] else 'No stable brewing recipe','ruleScope':'Bedrock brewing sequence shown; Java duration and potency values are omitted'}
  rows.append(row(k,'Base potions' if k in ['water','awkward','mundane','long_mundane','thick'] else title(k.removeprefix('long_').removeprefix('strong_')),**fields,editions=ed,editionOverrides=overrides))
 save('potions',rows,['effect','duration','potency','ingredients','brewingSequence','forms','brewable','ruleScope'],['duration','potency','brewable','ingredients'],'effect',{'javaEffects':java,'brewingEdges':{e:brewing_edges(e) for e in ['java','bedrock']}},len(set(java)|bed),bedrock_gaps=['Potion roster and brewing transformations checked independently','Bedrock duration/potency not exposed by the official sample or current runtime export'])

def recipe_ingredients(d):
 t=sid(d['type']);values=[];pattern=None
 if t=='crafting_shaped':
  counts=collections.Counter(''.join(d['pattern']));values=[(d['key'][x],n) for x,n in counts.items() if x!=' '];pattern=' / '.join(d['pattern'])+'; '+', '.join(x+' = '+human_ingredient(v) for x,v in d['key'].items())
 elif t=='crafting_shapeless':values=[(v,n) for v,n in collections.Counter(json.dumps(x) for x in d['ingredients']).items()];values=[(json.loads(v),n) for v,n in values]
 elif t in ['smelting','blasting','smoking','campfire_cooking','stonecutting']:values=[(d['ingredient'],1)]
 elif t=='brewing':
  i=d['input'];pot=i.get('potion_contents',{}).get('potions');values=[(potion_title(potion_id(pot)) if isinstance(pot,str) else i.get('item','minecraft:potion'),1),(d['reagent'].get('item',d['reagent']),1)]
 else:
  keys=['template','base','addition','input','material','source','target','banner','dye','fuel','shell','star','back','front','left','right']
  values=[(d[k],1) for k in keys if k in d]
 return values,pattern


def export_tool_recipes(proof):
 result=[];skipped=[];supported={'crafting_shaped':'crafting_table','crafting_shapeless':'crafting_table','smelting':'furnace','blasting':'blast_furnace','smoking':'smoker','campfire_cooking':'campfire','stonecutting':'stonecutter'}
 def native(k):
  if k in BEDCOMP:return k
  candidates=[v for v in BEDCOMP if BED_ALIASES.get(v,v)==k]
  return candidates[0] if len(candidates)==1 else None
 for record in proof:
  id=record['id'];ed=record['edition'];outer=record['definition'];ingredients=[];station=None;reason=None
  if ed=='java':
   d=outer;t=sid(d['type']);station=supported.get(t);out=d.get('result',{});out={'id':out} if isinstance(out,str) else out
   if not station:reason='Dynamic, brewing or smithing recipe'
   elif out.get('components'):reason='Component-specific output'
   else:
    vals,_=recipe_ingredients(d);output=sid(out['id']);count=out.get('count',1)
    for v,n in vals:
     choices=expand(v)
     if not choices or any(k not in COMPONENTS for k in choices):reason='Unresolved Java ingredient';break
     ingredients.append({'choices':choices,'count':n,**({'remainder':CRAFT_REMAINDERS[choices[0]]} if t.startswith('crafting_') and len(choices)==1 and choices[0] in CRAFT_REMAINDERS else {})})
  else:
   kind=next(k for k in outer if k.startswith('minecraft:recipe'));d=outer[kind];tags=d.get('tags',['crafting_table']);station=tags[0]
   if kind not in ['minecraft:recipe_shaped','minecraft:recipe_shapeless','minecraft:recipe_furnace'] or station not in ['crafting_table','stonecutter','furnace','blast_furnace','smoker','campfire']:reason='Dynamic, brewing, smithing or unsupported workstation'
   else:
    rawout=d.get('result',d.get('output'));rawout={'item':rawout} if isinstance(rawout,str) else rawout;byproducts=rawout[1:] if isinstance(rawout,list) else [];rawout=rawout[0] if isinstance(rawout,list) and rawout else rawout
    if not isinstance(rawout,dict):reason='Multiple/component-dependent outputs'
    else:
     output=native(bed_identifier(rawout));count=rawout.get('count',1)
     if output is None or sid(rawout.get('item','')) in ['suspicious_stew','banner','emptymap']:reason='Component-specific or unresolved Bedrock output'
     else:
      vals=[]
      if kind=='minecraft:recipe_shaped':vals=[d['key'][c] for c in ''.join(d['pattern']) if c!=' ']
      elif kind=='minecraft:recipe_shapeless':vals=d.get('ingredients',[])
      else:vals=[d['input']]
      for encoded,n in collections.Counter(json.dumps(v,sort_keys=True) for v in vals).items():
       v=json.loads(encoded);k=bed_identifier(v);item=k if k.startswith('#') else native(k)
       rawid=sid(v.get('item','')) if isinstance(v,dict) else sid(v).split(':')[0]
       if item is None or rawid in ['suspicious_stew','potion','banner','emptymap']:reason='Component-specific or unresolved Bedrock ingredient';break
       choices=BED_TAGS.get(item[1:],[item]) if item.startswith('#') else [item]
       ingredients.append({'choices':choices,'count':n*(v.get('count',1) if isinstance(v,dict) else 1)})
      if not reason and byproducts:
       expected=collections.Counter()
       for product in byproducts:expected[native(bed_identifier(product))]+=product.get('count',1)
       containers=[ingredient for ingredient in ingredients if len(ingredient['choices'])==1 and ingredient['choices'][0] in ['milk_bucket','water_bucket','lava_bucket','honey_bottle','dragon_breath']]
       for ingredient in containers:
        remainder='bucket' if ingredient['choices'][0].endswith('_bucket') else 'glass_bottle'
        if expected[remainder]>=ingredient['count']:ingredient['remainder']=remainder;expected[remainder]-=ingredient['count']
       if any(expected.values()):reason='Multiple outputs not explained by verified ingredient containers'
  if reason:skipped.append({'id':id,'edition':ed,'reason':reason});continue
  stationlist=[tag for tag in d.get('tags',[station]) if tag in ['crafting_table','stonecutter','furnace','blast_furnace','smoker','campfire']] if ed=='bedrock' else [station]
  for selected in stationlist:result.append({'id':ed+'/'+id+('/'+selected if len(stationlist)>1 else ''),'output':output,'count':count,'ingredients':ingredients,'station':selected,'editions':[ed]})
 target=OUT/'recipes';(target/'tool-rules-recipes.json').write_text(json.dumps(result,indent=2)+'\n');(target/'tool-rules-recipes-audit.json').write_text(json.dumps({'sourceActiveRows':len(proof),'exportCounts':dict(collections.Counter(x['editions'][0] for x in result)),'excluded':skipped,'bedrockLegacyCrosswalk':BED_VARIANT_DATA,'bedrockTagPolicy':'Actual Bedrock ItemStack.getTags memberships expanded; missing groups remain explicit #group','bedrockTagSource':BED_TAG_DATA['source'],'remainders':'Java Item.Properties.craftRemainder via CraftingRecipe.getRemainingItems and ResultSlot; Bedrock explicit recipe byproduct arrays','javaCraftRemainders':CRAFT_REMAINDERS},indent=2)+'\n')
 print(json.dumps({'toolRecipeExports':len(result),'skipped':len(skipped)}))

def recipes():
 rows=[];proof=[];unresolved=collections.Counter()
 for k,d,p in RECIPE_DATA:
  t=sid(d['type']);vals,pattern=recipe_ingredients(d);result=d.get('result',d.get('output',{}));result={'id':result} if isinstance(result,str) else result
  output=name(result['id']) if result.get('id') else ('Repaired equipment' if t=='crafting_special_repairitem' else 'Enlarged map' if t=='crafting_special_mapextending' else title(k));count=result.get('count',1) if result.get('id') else None
  if t=='brewing':
   pt=result.get('components',{}).get('minecraft:potion_contents',{}).get('potion');output=potion_title(potion_id(pt))+' ('+name(result['id'])+')' if pt else output
  instructions='Ingredients can match any listed alternative.'
  if t.startswith('crafting_special') or t in ['crafting_dye','crafting_transmute','crafting_imbue','crafting_decorated_pot','smithing_trim']:instructions='Special recipe: the selected inputs determine retained components or the output variant; the ingredient list is not a fixed material-planner recipe.'
  ingredients='; '.join(f'{n} × {v if isinstance(v,str) and not v.startswith(("minecraft:","#")) else human_ingredient(v)}' for v,n in vals) or ('Two damaged items of the same equipment type' if t=='crafting_special_repairitem' else 'Inputs chosen for this component-dependent recipe')
  station=stations(d['type']);label=output+' · '+station
  rows.append(row('java-'+k,station,name=label,station=station,recipeType=title(t),ingredients=ingredients,pattern=pattern or 'No shaped grid',output=output,outputCount=count,remainder='; '.join(str(n)+' × '+name(CRAFT_REMAINDERS[expand(v)[0]]) for v,n in vals if t in ['crafting_shaped','crafting_shapeless'] and len(expand(v))==1 and expand(v)[0] in CRAFT_REMAINDERS) or None,conditions=instructions,editions=['java']))
  proof.append({'id':k,'edition':'java','definition':d})
 rawbedfiles=sorted((BEDROCK/'behavior_pack/recipes').glob('*.json'));excluded=[];groups=collections.defaultdict(list)
 for file in rawbedfiles:
  outer=read(file);kind=next(key for key in outer if key.startswith('minecraft:recipe'));identifier=outer[kind]['description']['identifier'];groups[identifier].append(file)
 def legacy_count(file): return len(re.findall(r'\"data\"\s*:',file.read_text()))
 bedfiles=[]
 for identifier,files in groups.items():
  keep=min(files,key=lambda file:(legacy_count(file),file.name));bedfiles.append(keep)
  excluded.extend({'file':file.name,'reason':'Duplicate recipe identifier; kept modern '+keep.name} for file in files if file!=keep)
 for p in bedfiles:
  outer=read(p);kind=next(k for k in outer if k.startswith('minecraft:recipe'));d=outer[kind];tags=d.get('tags',['crafting_table'])
  if 'deprecated' in tags:excluded.append({'file':p.name,'reason':'Explicit deprecated recipe tag; active named-item counterpart retained'});continue
  if any(x in tags for x in ['chemistry_table','lab_table','material_reducer','compound_creator']):excluded.append({'file':p.name,'reason':'Education workstation'});continue
  vals=[];pattern=None
  if kind.endswith('shaped') and not kind.endswith('shapeless'):
   counts=collections.Counter(''.join(d['pattern']));vals=[(d['key'][x],n) for x,n in counts.items() if x!=' '];pattern=' / '.join(d['pattern'])+'; '+', '.join(x+' = '+human_ingredient(v) for x,v in d['key'].items())
  elif kind.endswith('shapeless'):vals=[(x,x.get('count',1) if isinstance(x,dict) else 1) for x in d.get('ingredients',[])]
  elif kind.endswith('furnace'):vals=[(d['input'],1)]
  elif 'brewing' in kind:vals=[(d['input'],1),(d['reagent'],1)]
  else:vals=[(d[x],1) for x in ['template','base','addition'] if x in d]
  results=d.get('result',d.get('output'));results=results if isinstance(results,list) else [results] if results else []
  output=(potion_title(potion_id(results[0])) if isinstance(results[0],str) and 'potion_type:' in results[0] else human_ingredient(results[0])) if results else 'Armor selected for the trim recipe';count=(results[0].get('count',1) if isinstance(results[0],dict) else 1) if results else None;remainder='; '.join(str(x.get('count',1))+' × '+human_ingredient(x) for x in results[1:]) or None
  def ingredient(v):
   if isinstance(v,str) and 'potion_type:' in v:return potion_title(potion_id(v))
   return human_ingredient(v)
  ingredients='; '.join(f'{n} × {ingredient(v)}' for v,n in vals);station=', '.join(stations({'crafting_table':'crafting_shaped','furnace':'smelting','blast_furnace':'blasting','smoker':'smoking','campfire':'campfire_cooking','stonecutter':'stonecutting','smithing_table':'smithing_transform','brewing_stand':'brewing','soul_campfire':'soul_campfire','cartography_table':'cartography_table'}.get(x,x)) for x in tags)
  legacy=sum(isinstance(v,dict) and v.get('data') not in [None,0] for v,n in vals)+sum(isinstance(v,dict) and v.get('data') not in [None,0] for v in results)
  if legacy:unresolved['bedrockLegacyVariants']+=1
  label=output+' · '+station
  rows.append(row('bedrock-'+p.stem,station,name=label,station=station,recipeType=title(kind.removeprefix('minecraft:recipe_')),ingredients=ingredients,pattern=pattern or 'No shaped grid',output=output,outputCount=count,remainder=remainder,conditions='Ingredients and outputs use the listed named variants.',editions=['bedrock']))
  proof.append({'id':p.stem,'edition':'bedrock','definition':outer})
 save('recipes',rows,['station','recipeType','ingredients','pattern','output','outputCount','remainder','conditions'],['recipeType','ingredients','output','outputCount'],'ingredients',{'definitions':proof},len(RECIPE_DATA)+len(rawbedfiles)-len(excluded),exclusions=excluded,bedrock_gaps=['Legacy recipe variants normalized to player names from the pinned recipe definitions; orientation data omitted from item names'])
 if not SKIP_TOOL_EXPORT:export_tool_recipes(proof)

STATUS_TEXT={'speed':'Increases movement speed.','slowness':'Reduces movement speed.','haste':'Increases attack speed and mining speed.','mining_fatigue':'Reduces attack speed and mining speed.','strength':'Adds melee attack damage.','instant_health':'Applies an immediate healing or undead-damage effect.','instant_damage':'Applies an immediate damage or undead-healing effect.','jump_boost':'Increases jumping ability and safe fall distance.','nausea':'Distorts the affected player\'s view.','regeneration':'Restores health over time.','resistance':'Reduces eligible incoming damage.','fire_resistance':'Protects against eligible fire and lava damage.','water_breathing':'Prevents the usual underwater air loss.','invisibility':'Hides the affected entity; worn equipment can remain visible.','blindness':'Limits vision.','night_vision':'Improves visibility in dark environments.','hunger':'Increases hunger exhaustion over time.','weakness':'Reduces melee attack damage.','poison':'Deals periodic poison damage.','wither':'Deals periodic wither damage.','health_boost':'Raises maximum health.','absorption':'Adds temporary absorption health.','saturation':'Restores hunger and saturation.','glowing':'Gives the affected entity a visible outline.','levitation':'Moves the affected entity upward.','luck':'Raises the luck attribute used by applicable loot rolls.','unluck':'Lowers the luck attribute used by applicable loot rolls.','slow_falling':'Slows falling and prevents normal fall damage.','conduit_power':'Applies the underwater benefits of conduit power.','dolphins_grace':'Improves swimming speed.','bad_omen':'Can convert into an omen when entering an applicable village or trial-chamber situation.','hero_of_the_village':'Applies Hero of the Village benefits after a successful raid.','darkness':'Dims the affected player\'s view.','trial_omen':'Affects eligible trial spawners.','raid_omen':'Precedes an eligible raid.','wind_charged':'Creates a wind burst when the affected entity dies.','weaving':'Creates cobwebs when the affected entity dies.','oozing':'Creates slimes when the affected entity dies.','infested':'Can release silverfish when the affected entity takes damage.','breath_of_the_nautilus':'Preserves underwater air while riding a nautilus.'}
STATUS_BED={'absorption':'Adds temporary absorption health.','bad_omen':'Can trigger ominous events.','blindness':'Restricts vision and sprinting.','breath_of_the_nautilus':'Preserves underwater air.','conduit_power':'Adds underwater vision, mining and breathing.','darkness':'Darkens vision in pulses.','fatal_poison':'Deals potentially lethal periodic damage.','fire_resistance':'Prevents fire and lava damage.','haste':'Speeds up mining and attacks.','health_boost':'Raises maximum health.','hero_of_the_village':'Discounts villager trades.','hunger':'Increases hunger exhaustion.','infested':'Can release silverfish when hurt.','instant_damage':'Damages living entities, heals undead.','instant_health':'Heals living entities, damages undead.','invisibility':'Hides entities, leaves equipment visible.','jump_boost':'Improves jumping and fall tolerance.','levitation':'Moves entities upward.','mining_fatigue':'Slows mining and attacks.','nausea':'Warps the view.','night_vision':'Improves dark and underwater visibility.','oozing':'Creates slimes on death.','poison':'Deals nonlethal periodic damage.','raid_omen':'Precedes a village raid.','regeneration':'Restores health over time.','resistance':'Reduces incoming damage.','saturation':'Restores hunger and saturation.','slowness':'Reduces movement speed.','slow_falling':'Slows falling, prevents fall damage.','speed':'Increases movement speed.','strength':'Adds melee damage.','trial_omen':'Makes trial spawners ominous.','water_breathing':'Prevents underwater air loss.','weakness':'Reduces melee damage.','weaving':'Changes cobweb movement and death drops.','wind_charged':'Creates a wind burst on death.','wither':'Deals periodic wither damage.'}
STATUS_NATURAL={
 'speed':['Beacon'], 'haste':['Beacon'], 'resistance':['Beacon'], 'jump_boost':['Beacon'], 'strength':['Beacon'], 'regeneration':['Beacon'],
 'conduit_power':['Activated conduit while in water or rain'], 'dolphins_grace':['Sprint-swimming near a dolphin'],
 'bad_omen':['Drinking an Ominous Bottle'], 'mining_fatigue':['Being near an elder guardian'],
 'levitation':['Being hit by a shulker bullet'], 'hunger':['Unarmed husk attacks'], 'slowness':['Stray arrows'],
 'poison':['Cave spider bites on Normal or Hard difficulty'], 'wither':['Wither skeleton attacks','Touching a Wither Rose outside Peaceful difficulty'],
 'darkness':['Being near a warden']}
STATUS_CAUSE_URLS=['https://minecraft.wiki/w/'+v for v in ['Beacon','Conduit','Dolphin','Ominous_Bottle','Elder_Guardian','Shulker','Husk','Stray','Cave_Spider','Wither_Skeleton','Warden','Wither_Rose']]
def status_effects():
 milk=COMPONENTS['milk_bucket']['minecraft:consumable']['on_consume_effects'];assert any(e['type']=='minecraft:clear_all_effects' for e in milk)
 text=(JAVA/'code/world/effect/MobEffects.java').read_text();java=set(REG['mob_effect']);bed={('hero_of_the_village' if x=='village_hero' else x) for x in bedregistry('effects')};rows=[];attrs={}
 for k in sorted(java|bed):
  match=re.search(r'register\("'+k+r'",(.*?);',text,re.S);definition=match.group(1) if match else '';cat=re.search('MobEffectCategory.(\\w+)',definition)
  modifiers=re.findall(r'addAttributeModifier\(Attributes\.(\w+),.*?, (-?[\d.]+), AttributeModifier.Operation.(\w+)\)',definition)
  amplifier='; '.join(f'{title(a)}: {float(value):g} '+('per level' if op=='ADD_VALUE' else 'fraction of the attribute per level') for a,value,op in modifiers) or None
  sources=[]
  potiontext=(JAVA/'code/world/item/alchemy/Potions.java').read_text()
  for line in potiontext.splitlines():
   if 'MobEffects.'+k.upper()+',' in line:sources.append(potion_title(line.strip().split(' = ')[0].lower()))
  for item,c in COMPONENTS.items():
   for effect in c.get('minecraft:consumable',{}).get('on_consume_effects',[]):
    if effect.get('type')=='minecraft:apply_effects' and any(sid(v['id'])==k for v in effect.get('effects',[])):sources.append(name(item))
  sources=list(dict.fromkeys(sources+STATUS_NATURAL.get(k,[])));ed=[e for e,yes in [('java',k in java),('bedrock',k in bed)] if yes]
  instant=k in ['instant_health','instant_damage'];counter='Milk removes active status effects' if k in java and not instant else None
  if k=='poison':counter+='; honey bottles remove Poison'
  fields={'name':LANG.get('effect.minecraft.'+k,title(k)),'effect':STATUS_TEXT.get(k),'sources':'Common causes include '+', '.join(sources) if sources else 'Can be applied with the effect command','amplifierBehavior':amplifier if k in java else None,'durationBehavior':'Applies its healing or damage immediately' if instant else 'Effect expires after its applied duration','counters':counter,'ruleScope':'Java mechanics shown; edition availability is indicated'}
  if k=='fatal_poison':fields.update(effect=STATUS_BED[k],durationBehavior=None,sources='Bedrock effect command',ruleScope='Bedrock effect description shown; detailed timing is not included')
  rows.append(row(k,title(cat.group(1).lower()) if cat else 'Bedrock effects',**fields,editions=ed,editionOverrides={'bedrock':{'effect':STATUS_BED[k],'sources':'Common causes include '+', '.join(STATUS_NATURAL[k]) if k in STATUS_NATURAL and k!='dolphins_grace' else None,'amplifierBehavior':None,'durationBehavior':'Applies its healing or damage immediately' if instant else None,'counters':None if instant else 'Milk removes active status effects','ruleScope':'Bedrock effect description shown; detailed level and timing rules are omitted'}} if 'java' in ed and 'bedrock' in ed else {}));attrs[k]=modifiers
 save('status-effects',rows,['effect','sources','amplifierBehavior','durationBehavior','counters','ruleScope'],['sources','amplifierBehavior','counters'],'effect',{'javaAttributeModifiers':attrs},len(java|bed),extra_sources=['https://minecraft.wiki/w/Status_effect','https://minecraft.wiki/w/Milk_Bucket']+STATUS_CAUSE_URLS,bedrock_gaps=['All 37 Bedrock descriptions independently checked against the edition-annotated status table','Only 12 Java attribute-based level rules are quantified; other level formulas remain null','Milk clear-all behavior proved by Java consumable and the shared milk article'])

def food():
 nutritionproof=read(OUT/'food/nutrition-proof.json')['values']
 keys=[k for k,d in COMPONENTS.items() if 'minecraft:food' in d and 'minecraft:consumable' in d];rows=[]
 for k in keys:
  d=COMPONENTS[k];f=d['minecraft:food'];effects=[]
  for e in d['minecraft:consumable'].get('on_consume_effects',[]):
   if e['type']=='minecraft:apply_effects':
    for v in e['effects']:effects.append(LANG.get('effect.minecraft.'+sid(v['id']),title(v['id']))+f' for {v.get("duration",0)/20:g} seconds'+(f' at {e["probability"]*100:g}% chance' if 'probability' in e else ''))
   elif e['type']=='minecraft:remove_effects':effects.append('Removes '+human_ingredient(e['effects']))
   elif e['type']=='minecraft:teleport_randomly':effects.append('Random teleport after consumption')
  ed=edition(k);bd=BEDCOMP.get(k);wiki=nutritionproof[name(k)];assert abs(wiki['java']['hunger']-f['nutrition'])<0.0001 and abs(wiki['java']['saturation']-f['saturation'])<0.0001, 'Nutrition table disagrees with Java primary source';nutrition=wiki['bedrock']['hunger'];sat=wiki['bedrock']['saturation']
  if bd and bd.get('nutrition') is not None:assert bd['nutrition']==nutrition
  methods=sorted({stations(d['type']) for _,d in RECIPE_OUTPUTS.get(k,[])})
  rows.append(row(k,'Edible items',name=name(k),hunger=f['nutrition'],saturation=round(f['saturation'],4),acquisition=acquisition(k),preparation=', '.join(methods) or 'Eaten without a crafting or cooking step',effects='; '.join(effects) or ('Effect depends on the flower or retained stew ingredients' if k=='suspicious_stew' else 'No fixed consumption effect'),ruleScope='Java hunger and saturation shown',editions=ed,editionOverrides={'bedrock':{'hunger':nutrition,'saturation':round(sat,6) if sat is not None else None,'acquisition':None,'preparation':None,'effects':'Effect depends on the flower or retained stew ingredients' if k=='suspicious_stew' else None,'ruleScope':'Bedrock hunger and saturation shown; consumption effects are not included' if nutrition is not None else 'Bedrock food availability shown; Java nutrition values are omitted'}} if 'bedrock' in ed else {}))
 rows.append(row('cake','Edible items',name=name('cake'),hunger=2,saturation=0.4,acquisition=acquisition('cake'),preparation='Place the cake and eat individual slices; seven slices per cake',effects='Values are per slice; a full cake restores 14 hunger and 2.8 saturation',ruleScope='Java placed-cake nutrition per slice',editions=edition('cake'),editionOverrides={'bedrock':{'hunger':2,'saturation':0.4,'effects':'Values are per slice; a full cake restores 14 hunger and 2.8 saturation','ruleScope':'Bedrock placed-cake nutrition per slice'}}))
 save('food',rows,['hunger','saturation','acquisition','preparation','effects','ruleScope'],['hunger','saturation','preparation','effects'],'effects',expected=41,exclusions=['Fish buckets have no consumable component','Milk has no food nutrition component'],extra_sources=['https://minecraft.wiki/w/Food'],bedrock_gaps=['All 41 Bedrock nutrition values independently read from the edition-annotated food table','Sweet Berries and Dried Kelp saturation differences retained','Consumption effects remain Java-specific'])

BED_ALIASES={'azalea_leaves_flowered':'flowering_azalea_leaves','brick_block':'bricks','deadbush':'dead_bush','dirt_with_roots':'rooted_dirt','empty_map':'map','end_brick_stairs':'end_stone_brick_stairs','end_bricks':'end_stone_bricks','fence_gate':'oak_fence_gate','frame':'item_frame','frog_spawn':'frogspawn','glow_frame':'glow_item_frame','golden_rail':'powered_rail','grass_path':'dirt_path','hardened_clay':'terracotta','lit_pumpkin':'jack_o_lantern','magma':'magma_block','melon_block':'melon','mob_spawner':'spawner','netherbrick':'nether_brick','normal_stone_slab':'stone_slab','normal_stone_stairs':'stone_stairs','noteblock':'note_block','prismarine_bricks_stairs':'prismarine_brick_stairs','quartz_ore':'nether_quartz_ore','red_nether_brick':'red_nether_bricks','silver_glazed_terracotta':'light_gray_glazed_terracotta','slime':'slime_block','small_dripleaf_block':'small_dripleaf','snow_layer':'snow','stonecutter_block':'stonecutter','trapdoor':'oak_trapdoor','undyed_shulker_box':'shulker_box','waterlily':'lily_pad','waxed_copper':'waxed_copper_block','web':'cobweb','wooden_button':'oak_button','wooden_door':'oak_door','wooden_pressure_plate':'oak_pressure_plate','zombie_pigman_spawn_egg':'zombified_piglin_spawn_egg'}
def items():
 excluded={x:'Education-only building block' for x in ['allow','deny','border_block']}
 # Keep native Bedrock-only variants as separate rows when they have no Java registry equivalent.
 bed={BED_ALIASES.get(x,x):x for x in BEDITEMS if x not in excluded};ids=(set(COMPONENTS)-{'air'})|set(bed);excluded['air']='Empty-slot sentinel, not a usable inventory item';rows=[];usages=collections.defaultdict(set)
 for recipe,d,p in RECIPE_DATA:
  vals,_=recipe_ingredients(d);output=d.get('result',d.get('output',{}));output={'id':output} if isinstance(output,str) else output
  for value,n in vals:
   for ingredient in expand(value):
    if output.get('id'):usages[ingredient].add(sid(output['id']))
 for k in sorted(ids):
  c=COMPONENTS.get(k,{});native=bed.get(k);bc=BEDCOMP.get(native,{}) if native else {};ed=[e for e,yes in [('java',k in COMPONENTS),('bedrock',k in bed)] if yes]
  category='Blocks' if k in REG['block'] else 'Items and materials';outputs=sorted(usages[k]);relations=', '.join(name(x) for x in outputs[:16]) or None
  fields={'name':name(k) if not k.startswith('light_block_') else 'Light Block, level '+k.removeprefix('light_block_'),'category':category,'stackSize':c.get('minecraft:max_stack_size') if k in COMPONENTS else bc.get('maxAmount'),'acquisition':acquisition(k),'uses':'Used in recipes for '+relations if relations else ('Placed as a block' if category=='Blocks' else None),'recipeRelationships':relations,'availability':availability(ed) if len(ed)==2 else ('Listed Java item type' if ed==['java'] else 'Listed Bedrock item type')}
  overrides={'bedrock':{'stackSize':bc.get('maxAmount'),'acquisition':None,'uses':None,'recipeRelationships':None}} if len(ed)==2 else {}
  rows.append(row(k,category,**fields,editions=ed,editionOverrides=overrides))
 save('items',rows,['category','stackSize','acquisition','uses','recipeRelationships','availability'],['category','stackSize','uses'],'uses',{'bedrockAliases':BED_ALIASES,'aliasProof':read(OUT/'items/alias-proof.json'),'javaRegistryCount':len(COMPONENTS),'excludedEmptySlotSentinels':['air']},len(ids),exclusions=excluded,bedrock_gaps=['Stack sizes independently queried in Bedrock 26.52.3','Java crafting/loot relationships remain edition-scoped'])


def loot_location(k):
 exact={'chests/bastion_other':'Bastion remnant chests','chests/bastion_treasure':'Bastion remnant treasure chests','chests/bastion_bridge':'Bastion remnant bridge chests','chests/bastion_hoglin_stable':'Bastion remnant hoglin stable chests','chests/trial_chambers/reward_ominous_rare':'Ominous vault rewards','chests/trial_chambers/reward_ominous_unique':'Ominous vault rewards','chests/trial_chambers/reward_rare':'Vault rewards','chests/trial_chambers/reward_unique':'Vault rewards','archaeology/trail_ruins_common':'Suspicious gravel in trail ruins','archaeology/trail_ruins_rare':'Suspicious gravel in trail ruins','archaeology/desert_pyramid':'Suspicious sand in desert pyramids','archaeology/desert_well':'Suspicious sand in desert wells','archaeology/ocean_ruin_cold':'Suspicious gravel in cold ocean ruins','archaeology/ocean_ruin_warm':'Suspicious sand in warm ocean ruins','chests/shipwreck_treasure':'Shipwreck treasure chests','chests/shipwreck_supply':'Shipwreck supply chests','chests/shipwreck_map':'Shipwreck map chests','chests/stronghold_corridor':'Stronghold corridor chests','chests/stronghold_crossing':'Stronghold crossing chests','chests/stronghold_library':'Stronghold library chests','chests/woodland_mansion':'Woodland mansion chests','chests/ancient_city':'Ancient city chests','chests/pillager_outpost':'Pillager outpost chests','chests/end_city_treasure':'End city chests','chests/jungle_temple':'Jungle temple chests','chests/nether_bridge':'Nether fortress chests','chests/buried_treasure':'Buried treasure chests','chests/simple_dungeon':'Dungeon chests','chests/abandoned_mineshaft':'Mineshaft chests','gameplay/piglin_bartering':'Piglin bartering','entities/elder_guardian':'Elder guardian drops','pots/trial_chambers/corridor':'Decorated pots in trial chamber corridors','chests/trial_chambers/corridor':'Trial chamber corridor chests','chests/trial_chambers/intersection_barrel':'Trial chamber intersection barrels','chests/underwater_ruin_big':'Large ocean ruin chests','chests/underwater_ruin_small':'Small ocean ruin chests','gameplay/fishing/treasure':'Fishing treasure'}
 if k in exact:return exact[k]
 if k.startswith('chests/trial_chambers/reward_ominous'):return 'Ominous vault rewards'
 if k.startswith('chests/trial_chambers/reward'):return 'Vault rewards'
 if k.startswith('chests/village/'):
  village=k.split('/')[-1].removeprefix('village_').replace('_house',' house').replace('_weaponsmith',' weaponsmith');return title(village)+' village chests'
 if k.startswith('entities/'):return title(k.split('/')[-1])+' drops'
 if k.startswith('chests/'):return title(k.removeprefix('chests/').removesuffix('_chest').replace('_common',' common').replace('_rare',' rare'))+' chests'
 if k.startswith('equipment/'):return title(k.removeprefix('equipment/'))+' mob equipment'
 if k.startswith('gameplay/'):return title(k.removeprefix('gameplay/'))
 raise ValueError('Player-facing loot location needs a label: '+k)


def bedloot_sources(item):
 sources=[]
 needle=item.replace('music_disc_','record_') if item.startswith('music_disc_') else item
 for p in (BEDROCK/'behavior_pack/loot_tables').rglob('*.json'):
  text=p.read_text()
  if any('"minecraft:'+v+'"' in text for v in [item,needle]):sources.append(str(p.relative_to(BEDROCK/'behavior_pack/loot_tables')).removesuffix('.json'))
 return sources

def bedlocation(k):
 alias={'chests/shipwrecktreasure':'chests/shipwreck_treasure','chests/shipwrecksupply':'chests/shipwreck_supply','chests/shipwreck':'chests/shipwreck_map','entities/cold_ocean_ruins_brushable_block':'archaeology/ocean_ruin_cold','entities/warm_ocean_ruins_brushable_block':'archaeology/ocean_ruin_warm','entities/desert_pyramid_brushable_block':'archaeology/desert_pyramid','entities/desert_well_brushable_block':'archaeology/desert_well','entities/trail_ruins_brushable_block_rare':'archaeology/trail_ruins_rare','entities/trail_ruins_brushable_block_common':'archaeology/trail_ruins_common','pots/trial_chambers/corridor':'pots/trial_chambers/corridor'}
 return loot_location(alias.get(k,k))

def bed_duplication(item):
 for p in (BEDROCK/'behavior_pack/recipes').glob('*.json'):
  if item+'_duplicate' not in p.name:continue
  outer=read(p);d=next(v for k,v in outer.items() if k.startswith('minecraft:recipe'));counts=collections.Counter(''.join(d['pattern']));return '; '.join(f'{n} × {human_ingredient(d["key"][x])}' for x,n in counts.items() if x!=' ')
 return None

def armor_trims():
 rows=[];proof=[]
 for k,d,p in records('trim_pattern'):
  item=k+'_armor_trim_smithing_template';locations=sorted({loot_location(x) for x in LOOT_SOURCES[item]});recipes=RECIPE_OUTPUTS[item];ingredients=[]
  for recipe,r in recipes:
   vals,_=recipe_ingredients(r);ingredients.append('; '.join(f'{n} × {human_ingredient(v)}' for v,n in vals))
  rows.append(row(k,'Items',name=local(d['description']),acquisition=', '.join(locations) or None,template=name(item),duplication='; '.join(ingredients) or None,application='Smithing table: trim template, armor piece and trim material',appearance='Cosmetic armor pattern; does not add armor protection',editions=edition(item),editionOverrides={'bedrock':{'acquisition':', '.join(sorted({bedlocation(x) for x in bedloot_sources(item)})) or None,'duplication':bed_duplication(item)}} if item in BEDITEMS else {}));proof.append({'id':k,'definition':d,'lootTables':sorted(LOOT_SOURCES[item]),'duplicationRecipes':[x for x,r in recipes]})
 save('armor-trims',rows,['template','acquisition','duplication','application','appearance'],['acquisition','duplication','application'],'appearance',{'java':proof},len(REG['trim_pattern']),bedrock_gaps=['Bedrock acquisition and template duplication independently read from active official loot tables and recipes'])


def bed_disc_acquisition(item):
 if item=='music_disc_tears':return 'Player kills a ghast damaged by a fireball'
 if item=='music_disc_lava_chicken':return 'Player or pet kills a baby zombie riding a chicken'
 sources=bedloot_sources(item);methods=[]
 for k in sources:
  if k=='entities/creeper':
   text=(BEDROCK/'behavior_pack/loot_tables/entities/creeper.json').read_text();killers=re.findall(r'"entity_type": "minecraft:(.*?)"',text);methods.append('Creeper killed by '+', '.join(title(x) for x in killers))
  else:methods.append(bedlocation(k))
 if item=='music_disc_5':
  matches=[p for p in (BEDROCK/'behavior_pack/recipes').glob('*.json') if '"minecraft:music_disc_5"' in p.read_text()]
  if matches:methods.append('Crafting table: nine Disc Fragments')
 return '; '.join(dict.fromkeys(methods)) or None

def music_discs():
 rows=[];proof=[];creeper=set(expand('#minecraft:creeper_drop_music_discs'))
 for k,d,p in records('jukebox_song'):
  item='music_disc_'+k;locations=sorted({loot_location(x) for x in LOOT_SOURCES[item]});methods=locations[:]
  if k=='tears':methods=['Player kills a ghast with a fireball projectile']
  if k=='lava_chicken':methods=['Player kills a baby zombie riding a chicken']
  if item in creeper:methods.append('Creeper killed by '+', '.join(LANG.get('entity.minecraft.'+e,title(e)) for e in expand('#minecraft:skeletons','entity_type')))
  if item in RECIPE_OUTPUTS:methods.append('Crafting table: '+ '; '.join(f'{n} × {human_ingredient(v)}' for v,n in recipe_ingredients(RECIPE_OUTPUTS[item][0][1])[0]))
  rows.append(row(k,'Items',name=local(d['description']),itemName=name(item),durationSeconds=d['length_in_seconds'],comparatorOutput=d['comparator_output'],acquisition='; '.join(methods) or None,uses='Plays in a jukebox; comparator signal depends on the disc',editions=edition(item),editionOverrides={'bedrock':{'durationSeconds':None,'comparatorOutput':None,'acquisition':bed_disc_acquisition(item)}} if item in BEDITEMS else {}));proof.append({'id':k,'definition':d,'lootTables':sorted(LOOT_SOURCES[item]),'creeperDrop':item in creeper})
 save('music-discs',rows,['itemName','durationSeconds','comparatorOutput','acquisition','uses'],['durationSeconds','comparatorOutput','acquisition'],'uses',{'java':proof},len(REG['jukebox_song']),bedrock_gaps=['Bedrock disc acquisition independently read from official loot tables; timings and comparator output remain Java-specific'])

def pottery_sherds():
 keys=[k for k in COMPONENTS if k.endswith('_pottery_sherd')];rows=[];proof=[]
 for k in keys:
  locations=sorted({loot_location(x) for x in LOOT_SOURCES[k]});pot=k in ['flow_pottery_sherd','guster_pottery_sherd','scrape_pottery_sherd'];locations=['Decorated pots in trial chambers'] if pot else locations;rows.append(row(k,'Items',name=name(k),acquisition=', '.join(locations) or None,method='Break the decorated pot with a pickaxe without Silk Touch to recover its sherds' if pot else 'Brush suspicious sand or suspicious gravel at the listed location',uses='Decorated pot crafting: each sherd selects the design on one of four sides',stackSize=COMPONENTS[k]['minecraft:max_stack_size'],editions=edition(k),editionOverrides={'bedrock':{'acquisition':'Decorated pots in trial chambers' if pot else ', '.join(sorted({bedlocation(x) for x in bedloot_sources(k)})) or None,'stackSize':BEDCOMP[k]['maxAmount']}} if k in BEDCOMP else {}));proof.append({'id':k,'lootTables':sorted(LOOT_SOURCES[k])})
 save('pottery-sherds',rows,['acquisition','method','uses','stackSize'],['acquisition','method','stackSize'],'uses',{'java':proof,'javaTrialChamberPots':read(JAVA/'trial-chamber-pottery-sherds-proof.json')},len(keys),extra_sources=['https://minecraft.wiki/w/Pottery_Sherd'],bedrock_gaps=['All 20 Bedrock archaeology locations independently resolved from vanilla brushable-block loot tables','Three trial chamber sherds verified in official Java structure NBT and the shared, edition-present pottery article','Bedrock item availability and stack sizes independently queried'])

ADVANCEMENT_OBJECTIVES={
'adventure/throw_trident':'Hit an entity with a thrown trident.','adventure/voluntary_exile':'Kill a raid captain.','adventure/whos_the_pillager_now':'Kill a pillager with a crossbow.','adventure/play_jukebox_in_meadows':'Play a music disc in a jukebox in a meadow biome.','adventure/lightning_rod_with_villager_no_fire':'Use a lightning rod near a villager without starting a fire.','end/kill_dragon':'Kill the Ender Dragon.','end/enter_end_gateway':'Enter an End gateway.','end/find_end_city':'Enter an End city.','end/root':'Enter the End dimension.','husbandry/root':'Consume an item.','husbandry/balanced_diet':'Eat each food required by the advancement.','husbandry/obtain_netherite_hoe':'Obtain a Netherite Hoe.','husbandry/tactical_fishing':'Collect a fish in a bucket.','husbandry/kill_axolotl_target':'Receive a status effect from an axolotl.','husbandry/plant_seed':'Plant a crop.','nether/obtain_blaze_rod':'Obtain a Blaze Rod.','nether/root':'Enter the Nether dimension.','nether/ride_strider_in_overworld_lava':'Ride a strider in Overworld lava for at least 50 horizontal blocks.','story/shiny_gear':'Obtain diamond armor.','story/follow_ender_eye':'Reach a stronghold.','story/upgrade_tools':'Obtain a Stone Pickaxe.','story/iron_tools':'Obtain an Iron Pickaxe.','story/root':'Obtain a Crafting Table.','story/mine_stone':'Obtain Cobblestone, Blackstone or Cobbled Deepslate.','story/obtain_armor':'Obtain iron armor.'}

ADVANCEMENT_OBJECTIVES.update({
 "adventure/root": "Kill an entity or be killed by one.",
 "adventure/arbalistic": "Defeat five distinct entity types with one crossbow projectile.",
 "adventure/blowback": "Kill a breeze using its redirected wind charge.",
 "adventure/bullseye": "Hit a target block's center from at least 30 blocks away.",
 "adventure/craft_decorated_pot_using_only_sherds": "Craft a decorated pot whose four sides all use pottery sherds.",
 "adventure/fall_from_world_height": "Survive a fall of at least 379 blocks, starting at Y 319 or higher and ending at Y -59 or lower.",
 "adventure/use_lodestone": "Bind a compass to a lodestone.",
 "adventure/crafters_crafting_crafters": "Be present when a crafter produces another crafter.",
 "adventure/trim_with_any_armor_pattern": "Apply one of the permitted armor trim patterns.",
 "adventure/heart_transplanter": "Place a creaking heart between pale oak logs with matching axes so that it is awake or dormant.",
 "adventure/hero_of_the_village": "Win a raid.",
 "adventure/summon_iron_golem": "Build an iron golem.",
 "adventure/spyglass_at_ghast": "View a ghast while using a spyglass.",
 "adventure/spyglass_at_parrot": "View a parrot while using a spyglass.",
 "adventure/spyglass_at_dragon": "View the Ender Dragon while using a spyglass.",
 "adventure/brush_armadillo": "Brush an armadillo.",
 "adventure/kill_mob_near_sculk_catalyst": "Defeat an entity within range of a sculk catalyst.",
 "adventure/walk_on_powder_snow_with_leather_boots": "Stand on powder snow while wearing leather boots.",
 "adventure/lighten_up": "Remove oxidation from a copper bulb with an axe.",
 "adventure/minecraft_trials_edition": "Enter a trial chamber structure.",
 "adventure/spear_many_mobs": "Strike at least five mobs with one spear charge.",
 "adventure/kill_a_mob": "Defeat any one of the monster types included in this advancement.",
 "adventure/ol_betsy": "Fire a crossbow.",
 "adventure/overoverkill": "Inflict at least 100 damage points in a single mace smash.",
 "adventure/totem_of_undying": "Activate a Totem of Undying when a lethal hit would kill you.",
 "adventure/salvage_sherd": "Obtain a pottery sherd while generating loot from a required archaeology site.",
 "adventure/revaulting": "Use an Ominous Trial Key on an ominous vault.",
 "adventure/avoid_vibration": "Avoid triggering a vibration while sneaking.",
 "adventure/sniper_duel": "Kill a skeleton with a projectile from at least 50 horizontal blocks away.",
 "adventure/trade_at_world_height": "Complete a villager trade at Y 319 or higher.",
 "adventure/honey_block_slide": "Slide down the side of a honey block.",
 "adventure/sleep_in_bed": "Sleep in a bed.",
 "adventure/shoot_arrow": "Damage an entity with an arrow projectile.",
 "adventure/read_power_of_chiseled_bookshelf": "Place a comparator facing out from a chiseled bookshelf, or place the bookshelf against that comparator.",
 "adventure/two_birds_one_arrow": "Kill at least two phantoms with one crossbow projectile.",
 "adventure/under_lock_and_key": "Use a Trial Key on a vault.",
 "adventure/very_very_frightening": "Use channeled lightning to strike a villager.",
 "adventure/trade": "Make a trade with a villager.",
 "adventure/who_needs_rockets": "Rise at least eight blocks after a wind-charge explosion.",
 "end/levitate": "Rise at least 50 vertical blocks while affected by Levitation.",
 "end/respawn_dragon": "Summon the Ender Dragon again.",
 "husbandry/safely_harvest_honey": "Collect honey with a glass bottle from a hive or nest while a lit campfire prevents bee aggression.",
 "husbandry/tame_an_animal": "Successfully tame an animal.",
 "husbandry/allay_deliver_cake_to_note_block": "Have an allay deliver cake onto a note block.",
 "husbandry/tadpole_in_a_bucket": "Collect a tadpole using a water bucket.",
 "husbandry/fishy_business": "Catch one of the four required fish types with a fishing rod.",
 "husbandry/make_a_sign_glow": "Apply glow ink to a sign.",
 "husbandry/repair_wolf_armor": "Use an armadillo scute on a wolf until its equipped wolf armor has no damage.",
 "husbandry/feed_snifflet": "Feed a torchflower seed to a baby sniffer.",
 "husbandry/plant_any_sniffer_seed": "Plant a torchflower seed or pitcher pod.",
 "husbandry/remove_wolf_armor": "Shear the armor off a wolf.",
 "husbandry/place_dried_ghast_in_water": "Place a dried ghast in water so the block is waterlogged.",
 "husbandry/axolotl_in_a_bucket": "Collect an axolotl using a water bucket.",
 "husbandry/breed_an_animal": "Breed a pair of animals.",
 "husbandry/silk_touch_nest": "Break a bee nest or beehive containing three bees using Silk Touch.",
 "husbandry/uh_oh": "Give an explosive-tagged item to an adult sulfur cube.",
 "husbandry/wax_off": "Remove wax from a copper block with an axe.",
 "husbandry/wax_on": "Apply honeycomb to wax a copper block.",
 "husbandry/ride_a_boat_with_a_goat": "Enter a boat that has a goat as another passenger.",
 "husbandry/allay_deliver_item_to_player": "Pick up an item thrown to you by an allay.",
 "nether/find_fortress": "Enter a Nether fortress structure.",
 "nether/create_full_beacon": "Be present when a beacon activates with a four-layer base.",
 "nether/create_beacon": "Be present when a beacon activates with a base of at least one layer.",
 "nether/brew_potion": "Take a potion from a brewing stand.",
 "nether/charge_respawn_anchor": "Add glowstone to bring a respawn anchor to four charges.",
 "nether/distract_piglin": "Give a gold ingot to a piglin through interaction or a dropped item.",
 "nether/return_to_sender": "Kill a ghast with a fireball projectile.",
 "nether/fast_travel": "Use Nether travel to cover at least 7,000 horizontal blocks measured in the Overworld.",
 "nether/ride_strider": "Wear down a Warped Fungus on a Stick while riding a strider.",
 "nether/find_bastion": "Enter a bastion remnant structure.",
 "nether/uneasy_alliance": "Kill a ghast while in the Overworld.",
 "nether/loot_bastion": "Generate chest loot from one of the four bastion remnant chest types.",
 "nether/summon_wither": "Summon a wither.",
 "story/enchant_item": "Complete an item enchantment.",
 "story/deflect_arrow": "Block projectile damage with a shield.",
 "story/enter_the_end": "Travel into the End dimension.",
 "story/enter_the_nether": "Travel into the Nether dimension.",
 "story/cure_zombie_villager": "Finish curing a zombie villager."
})

def advancements():
 definitions={k:d for k,d,p in records('advancement')};visible={k:d for k,d in definitions.items() if 'display' in d};rows=[]
 for k,d in visible.items():
  display=d['display'];rewards=d.get('rewards',{});parent=definitions.get(sid(d.get('parent','')),{}).get('display',{});parts=[]
  if rewards.get('experience'):parts.append(str(rewards['experience'])+' experience points')
  if rewards.get('recipes'):parts.append('Unlocks recipes for '+', '.join(name(sid(x).split('/')[-1]) for x in rewards['recipes']))
  if rewards.get('loot'):parts.append('Loot reward')
  icon=display['icon'];requirements=d.get('requirements',[[x] for x in d['criteria']]);structure=f'{len(requirements)} required condition '+('group' if len(requirements)==1 else 'groups')+'; any one condition in each group completes that group'
  objective=ADVANCEMENT_OBJECTIVES.get(k)
  if objective is None and all(v['trigger']=='minecraft:inventory_changed' for v in d['criteria'].values()):
   inventory=list(dict.fromkeys(name(x) for v in d['criteria'].values() for item in v['conditions'].get('items',[]) for x in expand(item.get('items',[]))));objective='Have '+', '.join(inventory)+' in your inventory.' if inventory else None
  if k=='husbandry/uh_oh':objective='Give '+', '.join(name(v) for v in expand('#minecraft:sulfur_cube_archetype/explosive'))+' to an adult sulfur cube through interaction or a dropped item.'
  if k in ['nether/all_potions','nether/all_effects']:
   effects=next(iter(d['criteria'].values()))['conditions']['effects'];objective=f'Have all {len(effects)} effects required by this advancement active together.';structure+='; required effects: '+', '.join(LANG.get('effect.minecraft.'+sid(v),title(v)) for v in effects)
  if objective is None and k not in ['adventure/adventuring_time','nether/explore_nether','husbandry/whole_pack','husbandry/complete_catalogue','husbandry/bred_all_animals','husbandry/leash_all_frog_variants','adventure/kill_all_mobs','adventure/trim_with_all_exclusive_armor_patterns']:raise ValueError('Advancement needs an original factual objective: '+k)
  if k=='adventure/adventuring_time':
   biomes=[v['conditions']['player']['predicate']['minecraft:location']['biomes'] for v in d['criteria'].values()];assert len(biomes)==len(requirements)==56;objective=f'Visit all {len(biomes)} biomes required by this advancement.';structure+='; required biomes: '+', '.join(LANG.get('biome.minecraft.'+sid(v),title(v)) for v in biomes)
  counted={
   'adventure/kill_all_mobs':('Kill each of the {n} monster types required by this advancement.', 'entity'),
   'adventure/trim_with_all_exclusive_armor_patterns':('Apply each of the {n} required armor trim patterns.', 'trim'),
   'nether/explore_nether':('Visit all {n} required Nether biomes.', 'biome'),
   'husbandry/whole_pack':('Tame each of the {n} required wolf variants.', 'variant'),
   'husbandry/complete_catalogue':('Tame each of the {n} required cat variants.', 'variant'),
   'husbandry/balanced_diet':('Eat each of the {n} required foods.', 'item'),
   'husbandry/bred_all_animals':('Breed each of the {n} required animal types.', 'entity'),
   'husbandry/leash_all_frog_variants':('Use a lead on each of the {n} required frog variants.', 'variant')}
  if k in counted:
   sentence,kind=counted[k];assert all(len(g)==1 for g in requirements);objective=sentence.format(n=len(requirements));targets=[]
   for identifier,c in d['criteria'].items():
    target=sid(identifier)
    if kind=='trim':target=sid(c['conditions']['recipes']).removesuffix('_armor_trim_smithing_template_smithing_trim');targets.append(title(target)+' armor trim')
    elif kind=='item':targets.append(name(c['conditions']['item']['items']))
    elif kind=='entity':targets.append(LANG.get('entity.minecraft.'+target,title(target)))
    elif kind=='biome':targets.append(LANG.get('biome.minecraft.'+target,title(target)))
    else:targets.append(title(target))
   structure+='; required targets: '+', '.join(targets)
  rows.append(row(k,{'story':'Minecraft','nether':'Nether','end':'The End','adventure':'Adventure','husbandry':'Husbandry'}.get(k.split('/')[0],title(k.split('/')[0])),name=local(display['title']),objective=objective,frame=title(display.get('frame','task')),parent=local(parent.get('title')) or 'Root advancement',criteria=structure,rewards='; '.join(parts) or 'No explicit reward',icon=name(icon['id']),visibility='Hidden until completed' if display.get('hidden') else 'Visible when its branch is unlocked',editions=['java']))
 save('advancements',rows,['objective','frame','parent','criteria','rewards','visibility','icon'],['frame','objective','rewards'],'objective',{'java':visible},len(visible),exclusions=[{'scope':'Recipe-unlock advancements without a display','count':len(definitions)-len(visible)}],bedrock_gaps=['Advancements are Java Edition only; Bedrock achievements are outside this collection'])


def ores():
 keys=[k for k in COMPONENTS if k.endswith('_ore')]+['ancient_debris'];keys=[k for k in keys if k!='gilded_blackstone'];assert len(keys)==19
 bedproof=read(OUT/'ores/bedrock-field-proof.json');bedprocessing=collections.defaultdict(list)
 for file in (BEDROCK/'behavior_pack/recipes').glob('*.json'):
  d=read(file).get('minecraft:recipe_furnace')
  if not d or 'deprecated' in d.get('tags',[]):continue
  key=BED_ALIASES.get(bed_identifier(d['input']),bed_identifier(d['input']));result=d['output'];out=bed_identifier(result)
  bedprocessing[key].append(name(BED_ALIASES.get(out,out))+' at '+', '.join(title(t) for t in d['tags']))
 features={k:d for k,d,p in records('worldgen/feature')};placed={k:d for k,d,p in records('worldgen/placed_feature')};rows=[];proof=[]
 tiers=[('diamond',set(expand('#minecraft:needs_diamond_tool','block'))),('iron',set(expand('#minecraft:needs_iron_tool','block'))),('stone',set(expand('#minecraft:needs_stone_tool','block')))]
 def anchor(x,minimum,maximum):return x.get('absolute',minimum+x['above_bottom'] if 'above_bottom' in x else maximum-x['below_top'] if 'below_top' in x else None)
 def lootnames(v):
  if isinstance(v,dict):
   return ([sid(v['name'])] if v.get('type')=='minecraft:item' else [])+[x for y in v.values() for x in lootnames(y)]
  if isinstance(v,list):return [x for y in v for x in lootnames(y)]
  return []
 for k in keys:
  dimension='Nether' if k in ['nether_gold_ore','nether_quartz_ore','ancient_debris'] else 'Overworld';noise=read(JAVA/'data/worldgen/noise_settings'/('overworld.json' if dimension=='Overworld' else 'nether.json'))['noise'];minimum=noise['min_y'];maximum=minimum+noise['height']-1;bands=[];matching=[]
  for fk,fd in features.items():
   if any(t.get('state')=='minecraft:'+k for t in fd.get('targets',[])):
    matching.append(fk)
    for pk,pd in placed.items():
     if pd.get('feature')!='minecraft:'+fk:continue
     for modifier in pd['placement']:
      if modifier['type']=='minecraft:height_range':
       h=modifier['height'];lo=max(minimum,anchor(h['min_inclusive'],minimum,maximum));hi=min(maximum,anchor(h['max_inclusive'],minimum,maximum));bands.append(f'Y {lo} to {hi}, '+sid(h['type'])+' distribution')
  loot=read(JAVA/'data/loot_table/blocks'/(k+'.json'));drops=sorted(set(lootnames(loot))-{k}) or [k];tier=next((t for t,values in tiers if k in values),'wooden');tool=title(tier)+' pickaxe or another tool in a sufficient harvest tier';uses=[]
  for output,d in COMPONENTS.items():
   for rk,rd in RECIPE_OUTPUTS.get(output,[]):
    if rd.get('ingredient')=='minecraft:'+k:uses.append(name(output)+' at '+stations(rd['type']))
  rows.append(row(k,'Items',name=name(k),dimension=dimension,miningRequirement=tool,drops=', '.join(name(x) for x in drops),generation='; '.join(dict.fromkeys(bands))+'; replacement blocks and biome placement affect actual occurrence' if bands else None,silkTouch='Silk Touch returns the intact ore block' if 'can_silk_touch' in json.dumps(loot) else 'No Silk Touch branch in the block drop rules',processing='; '.join(dict.fromkeys(uses)) or None,editions=edition(k),editionOverrides={'bedrock':{**{f:bedproof[k.removeprefix('deepslate_')][f] for f in ['miningRequirement','drops','silkTouch']},'generation':None,'processing':'; '.join(dict.fromkeys(bedprocessing[k])) or None}} if 'bedrock' in edition(k) else {}));proof.append({'id':k,'features':matching,'generationBounds':noise,'loot':loot})
 save('ores',rows,['dimension','miningRequirement','drops','generation','silkTouch','processing'],['dimension','miningRequirement','drops','generation'],'generation',{'java':proof},19,extra_sources=[v['url'] for v in bedproof.values()],bedrock_gaps=['All 19 Bedrock mining requirements, base drops and Silk Touch behavior independently checked against edition-present ore articles','Processing independently read from active Bedrock furnace recipes','Detailed generation placement bands remain Java-specific'])


def villager_professions():
 profession_code=(JAVA/'code/world/entity/npc/villager/VillagerProfession.java').read_text();poi_code=(JAVA/'code/world/entity/ai/village/poi/PoiTypes.java').read_text();workstations=dict((k.lower(),block.lower()) for k,block in re.findall(r'register\(registry, (\w+), getBlockStates\(Blocks\.(\w+)\)',poi_code));workstations['leatherworker']='cauldron';rows=[];proof=[]
 for k in REG['villager_profession']:
  block=workstations.get(k);goods=set();available=0
  for setkey,d,p in records('trade_set'):
   if not setkey.startswith(k+'/'):continue
   for trade in expand(d['trades'],'villager_trade'):
    td=read(JAVA/'data/villager_trade'/(trade+'.json'));goods.add(name(td['gives']['id']));available+=1
  label=LANG.get('entity.minecraft.villager.'+k,'Unemployed' if k=='none' else title(k))
  fields={'name':label,'workstation':name(block) if block else 'None','tradeGoods':', '.join(sorted(goods)) or 'Does not offer trades','tradeOptions':available,'levels':'Novice, Apprentice, Journeyman, Expert, Master' if block else 'No profession levels','jobConditions':'Cannot acquire a profession or offer trades' if k=='nitwit' else 'Can acquire an available job site' if k=='none' else 'Acquires this profession through its matching job site','ruleScope':'Java workstations and complete trade categories shown'}
  tables,_=bed_villager_tables();bgoods=set();bcount=0
  if k in tables:
   for tier in read_jsonc(BEDROCK/'behavior_pack'/tables[k])['tiers']:
    for group in tier.get('groups',[{'trades':tier.get('trades',[])}]):
     seen=set()
     for trade in group['trades']:
      signature=json.dumps(trade,sort_keys=True)
      if signature in seen:continue
      seen.add(signature);bcount+=1;bgoods.update(trade_item(v) for v in trade['gives'])
  rows.append(row(k,'Items',**fields,editions=['java','bedrock'],editionOverrides={'bedrock':{'workstation':name(block) if block else 'None','tradeGoods':'; '.join(sorted(bgoods)) or 'Does not offer trades','tradeOptions':bcount,'levels':'Novice, Apprentice, Journeyman, Expert, Master' if k in tables else 'No profession levels','jobConditions':'Cannot acquire a profession or offer trades' if k=='nitwit' else 'Adult unemployed villager linked to a bed can claim an unclaimed job site; the first trade locks its profession','ruleScope':'Bedrock workstations, job requirements and trade categories shown'}}));proof.append({'id':k,'workstation':block,'tradeOptions':available})
 save('villager-professions',rows,['workstation','tradeGoods','tradeOptions','levels','jobConditions','ruleScope'],['workstation','tradeGoods','tradeOptions'],'jobConditions',{'java':proof},15,extra_sources=['https://minecraft.wiki/w/Villager'],bedrock_gaps=['Bedrock trades independently extracted from active economy trade tables','All 13 workstation pairings and Bedrock bed-linked job requirements verified in the shared villager article and vanilla worksite block list'])


def read_jsonc(p):return json.loads(re.sub(r',\s*([}\]])',r'\1',re.sub(r'//[^\n]*','',p.read_text())))
def bed_villager_tables():
 e=read_jsonc(BEDROCK/'behavior_pack/entities/villager_v2.json')['minecraft:entity'];tables={k:v['minecraft:economy_trade_table']['table'] for k,v in e['component_groups'].items() if v.get('minecraft:economy_trade_table',{}).get('table')};tables['wandering_trader']='trading/economy_trades/wandering_trader_trades.json';variants={v['minecraft:mark_variant']['value']:k.removesuffix('_villager') for k,v in e['component_groups'].items() if k.endswith('_villager') and 'minecraft:mark_variant' in v};variants[0]='plains';return tables,variants

def quantity(v):
 if isinstance(v,dict):return str(v.get('min')) if v.get('min')==v.get('max') else str(v.get('min'))+' to '+str(v.get('max'))
 return str(v)
def trade_item(v):
 if 'choice' in v:return ' or '.join(trade_item(x) for x in v['choice'])
 k=bed_identifier(v['item']);label=human_ingredient({'item':v['item']});functions=v.get('functions',[])
 for f in functions:
  if f['function']=='exploration_map':label=title(f['destination'])+' explorer map'
  if f['function']=='set_potion':label='Tipped arrows of '+title(potion_id(f['id']))
  if 'enchant' in f['function'] and not label.startswith('Enchanted '):label='Enchanted '+label
  if f['function'] in ['random_aux_value','random_dye']:label+=' with a randomly selected variant'
 return quantity(v.get('quantity',1))+' × '+label

def villager_trades():
 rows=[];proof=[];duplicates=[];defs={k:d for k,d,p in records('villager_trade')};members=collections.defaultdict(list)
 for k,d,p in records('trade_set'):
  for trade in expand(d['trades'],'villager_trade'):members[trade].append(k)
 assert set(members)==set(defs)
 levels={1:'Novice',2:'Apprentice',3:'Journeyman',4:'Expert',5:'Master'}
 for k,d in defs.items():
  sets=members[k];professions=sorted({v.split('/')[0] for v in sets});profession=', '.join(title(v) for v in professions);section=title(professions[0]) if len(professions)==1 else 'Shared smith offers';career=sorted(set(levels[int(v.split('level_')[1])] if 'level_' in v else title(v.split('/')[-1]) for v in sets));inputs=[d['wants']]+([d['additional_wants']] if d.get('additional_wants') else []);mods=d.get('given_item_modifier',[]);mods=mods if isinstance(mods,list) else [mods];variable=any(m.get('include_additional_cost_component') for m in mods);outputs=name(d['gives']['id']);components=d['gives'].get('components',{});pot=components.get('minecraft:potion_contents',{}).get('potion')
  if pot:outputs=potion_title(potion_id(pot))
  if any('enchant' in m.get('type','') for m in mods) and not outputs.startswith('Enchanted '):outputs='Enchanted '+outputs
  conditions=['Prices can change with demand, reputation and other discounts']
  if len(professions)>1:conditions.append('Shared offer available to '+profession+' at the listed career level')
  predicate=d.get('merchant_predicate',{}).get('predicate',{}).get('minecraft:predicates',{}).get('minecraft:villager/variant')
  if predicate:conditions.append('Available from '+', '.join(title(x) for x in (predicate if isinstance(predicate,list) else [predicate]))+' villager types')
  if variable:conditions.append('Enchantment selection adds to the emerald price')
  wants='; '.join(('Variable' if variable and sid(v['id'])=='emerald' else str(v.get('count',1)))+' × '+name(v['id']) for v in inputs)
  rows.append(row('java-'+k,section,name=outputs+' trade',profession=profession,level=', '.join(career),inputs=wants,outputs=str(d['gives'].get('count',1))+' × '+outputs,basePrice='Variable enchanted-item price' if variable else str(d['wants'].get('count',1))+' '+name(d['wants']['id']),maxUses=d.get('max_uses'),villagerExperience=d.get('xp'),conditions='; '.join(conditions),editions=['java']));proof.append({'id':k,'edition':'java','sets':sets,'definition':d})
 tables,variants=bed_villager_tables();bedcount=0
 def filters(v):
  if isinstance(v,dict):
   if v.get('test')=='is_mark_variant':return [title(variants[v['value']])+' villager']
   if v.get('test')=='in_overworld':return ['Overworld']
   return [a for x in v.values() for a in filters(x)]
  if isinstance(v,list):return [a for x in v for a in filters(x)]
  return []
 for profession,file in tables.items():
  data=read_jsonc(BEDROCK/'behavior_pack'/file)
  for tierindex,tier in enumerate(data['tiers']):
   for groupindex,group in enumerate(tier.get('groups',[{'trades':tier.get('trades',[])}])):
    signatures=collections.Counter(json.dumps(v,sort_keys=True) for v in group['trades']);seen=set()
    for tradeindex,d in enumerate(group['trades']):
     signature=json.dumps(d,sort_keys=True)
     if signature in seen:
      duplicates.append({'profession':profession,'tier':tierindex,'group':groupindex,'offerIndex':tradeindex,'definition':d,'reason':'Exact semantic duplicate in the same offer-selection group'});continue
     seen.add(signature);multiplicity=signatures[signature]
     bedcount+=1;k=f'{profession}-{tierindex}-{groupindex}-{tradeindex}';conditions=['Prices can change with demand and discounts'];restrictions=list(dict.fromkeys(filters(d)))
     if restrictions:conditions.append('Output choice depends on '+', '.join(restrictions))
     if 'enchant_book_for_trading' in str(d):conditions.append('Random enchantment changes the emerald cost')
     if 'num_to_select' in group:conditions.append(f'The trader selects {group["num_to_select"]} of {len(group["trades"])} offers in this group')
     if multiplicity>1:conditions.append(f'This identical offer occupies {multiplicity} of {len(group["trades"])} selection slots')
     inputs='; '.join(('Variable × Emerald' if 'enchant_book_for_trading' in str(d) and bed_identifier(v['item'])=='emerald' else trade_item(v)) for v in d['wants']);outputs='; '.join(trade_item(v) for v in d['gives'])
     rows.append(row('bedrock-'+k,title(profession),name=outputs+' trade',profession=title(profession),level=levels.get(tierindex+1) if profession!='wandering_trader' else 'Wandering trader',inputs=inputs,outputs=outputs,basePrice='Variable enchanted-book price' if 'enchant_book_for_trading' in str(d) else inputs,maxUses=d.get('max_uses'),villagerExperience=d.get('trader_exp'),conditions='; '.join(conditions),editions=['bedrock']));proof.append({'id':k,'edition':'bedrock','definition':d,'groupSelection':group.get('num_to_select')})
 save('villager-trades',rows,['profession','level','inputs','outputs','basePrice','maxUses','villagerExperience','conditions'],['level','inputs','outputs','maxUses'],'conditions',{'definitions':proof,'bedrockActiveTables':tables,'bedrockVariantLabels':variants,'bedrockRawOfferSlots':bedcount+len(duplicates),'bedrockUniqueOffers':bedcount,'exactDuplicateOffers':duplicates},len(defs)+bedcount,exclusions=['Retired Bedrock trading files outside active economy_trade_table references','Experimental Trade Rebalance datapacks'],bedrock_gaps=['Java and Bedrock transaction rows remain distinct; random output choices and villager-type conditions retained'])


def commands():
 tree=read(JAVA/'summary/commands/data.json')['children'];bedsource=read(BEDROCK/'metadata/command_modules/mojang-commands.json');aliases=collections.defaultdict(list);excluded=[]
 for k,d in tree.items():
  if d.get('redirect'):aliases[d['redirect'][0]].append(k);excluded.append({'edition':'java','command':k,'reason':'Alias of '+d['redirect'][0]})
 java={k:d for k,d in tree.items() if not d.get('redirect')};bed={d['name']:d for d in bedsource['commands'] if d['name'] not in ['editor-allowlist','project','gametest']}
 excluded.extend({'edition':'bedrock','command':d['name'],'reason':'Editor-only' if d['name']!='gametest' else 'Experimental GameTest requires Beta APIs'} for d in bedsource['commands'] if d['name'] not in bed)
 def java_paths(d,path):
  result=[path] if d.get('executable') else []
  if 'redirect' in d:result.append(path+' '+('<command>' if not d['redirect'] else '<'+d['redirect'][0]+' continuation>'))
  for k,v in d.get('children',{}).items():result+=java_paths(v,path+' '+(k if v['type']=='literal' else '<'+k+'>'))
  return result
 def params(d):
  result=[]
  for k,v in d.get('children',{}).items():
   if v['type']=='argument':result.append(k+' = '+title(v.get('parser','value').split(':')[-1]))
   result+=params(v)
  return list(dict.fromkeys(result))
 enums={d['name'].lower():[v['value'] for v in d['values']] for d in bedsource['command_enums']}
 def bedsyntax(k,d):
  lines=[]
  for overload in d['overloads']:
   line='/'+k
   for param in overload['params']:
    enum=enums.get(param['type']['name'].lower());label='|'.join(enum) if enum and len(enum)<20 else '<'+param['name']+'>'
    line+=' '+('['+label+']' if param['is_optional'] else label)
   lines.append(line)
  return '\n'.join(dict.fromkeys(lines))
 dedicated={'allowlist','changesetting','reloadconfig','reloadpacketlimitconfig','save','sendshowstoreoffer','serveridentity','stop','transfer'}
 def bedfields(k,d):
  context='Dedicated server' if k in dedicated else 'Script debugging; Admin permission and cheats required' if k=='script' else 'Behavior-pack script event listener; cheats required' if k=='scriptevent' else 'Camera control; some schemes require experimental camera settings' if k=='controlscheme' else 'Stable Bedrock command'
  return {'syntax':bedsyntax(k,d),'parameters':'; '.join(dict.fromkeys(p['name']+' = '+title(p['type']['name'].lower()) for o in d['overloads'] for p in o['params'])) or 'No parameters','permission':{0:'Any',1:'Game Director',2:'Admin'}.get(d['permission_level'],'Level '+str(d['permission_level'])),'requiresCheats':'Yes' if d['requires_cheats'] else 'No','availability':context,'aliases':', '.join('/'+v['name'] for v in d['aliases']) or 'None','example':None}
 rows=[]
 for k in sorted(set(java)|set(bed)):
  ed=[e for e,yes in [('java',k in java),('bedrock',k in bed)] if yes]
  if k in java:
   d=java[k];permission=d.get('permissions',{}).get('permission',{}).get('level');fields={'syntax':'\n'.join(dict.fromkeys(java_paths(d,'/'+k))) or '/'+k,'parameters':'; '.join(params(d)) or 'No parameters','permission':{'gamemasters':'Game Master','admins':'Admin','owners':'Owner'}.get(permission,'No explicit permission requirement'),'requiresCheats':'Permission-dependent' if permission else 'No explicit permission requirement','availability':'Command registration depends on the world or server context','aliases':', '.join('/'+x for x in aliases[k]) or 'None','example':None};overrides={'bedrock':bedfields(k,bed[k])} if k in bed else {}
  else:fields=bedfields(k,bed[k]);overrides={}
  rows.append(row(k,'Items',name='/'+k,**fields,editions=ed,editionOverrides=overrides))
 save('commands',rows,['syntax','parameters','permission','requiresCheats','availability','aliases','example'],['permission','requiresCheats','availability','aliases'],'syntax',{'java':java,'bedrock':bed,'javaAliases':dict(aliases)},len(set(java)|set(bed)),exclusions=excluded,extra_sources=['https://learn.microsoft.com/en-us/minecraft/creator/commands/commands?view=minecraft-bedrock-stable'],bedrock_gaps=['Full independent edition grammar retained; no untested command examples supplied'])

SKIP_TOOL_EXPORT=False
ORDER=['enchantments','potions','recipes','fuels','tools','weapons','armor','status-effects','ores','food','villager-trades','items','villager-professions','armor-trims','music-discs','pottery-sherds','advancements','commands']
BUILDERS={'commands':commands,'villager-trades':villager_trades,'villager-professions':villager_professions,'ores':ores,'armor-trims':armor_trims,'music-discs':music_discs,'pottery-sherds':pottery_sherds,'advancements':advancements,'enchantments':enchantments,'fuels':fuels,'potions':potions,'recipes':recipes,'status-effects':status_effects,'food':food,'items':items,'tools':lambda:equipment('tools'),'weapons':lambda:equipment('weapons'),'armor':lambda:equipment('armor')}
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--collection',required=True,choices=ORDER);parser.add_argument('--skip-tool-export',action='store_true');args=parser.parse_args();SKIP_TOOL_EXPORT=args.skip_tool_export;BUILDERS[args.collection]()
