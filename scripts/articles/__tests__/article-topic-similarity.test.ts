import test from "node:test";
import assert from "node:assert/strict";
import { compareArticleTopics, similarArticleTopics, inferArticleScope } from "../article-topic-similarity";
import { nearDuplicateArticleTitle } from "../article-queue-dedupe";
import { loadRelevantInventory } from "../curate-article-topics";

for(const [a,b]of [
 ['How to Get Farm Egg in Adopt Me','How to Get Egg in Adopt Me'],
 ['How to Get Top Hat in Adopt Me','How to Get Hat in Adopt Me'],
 ['How to Get Upgrade Token in Adopt Me','How to Get Token in Adopt Me'],
 ['How to Get Guide Book in Adopt Me','How to Get Book in Adopt Me'],
 ['How to Get Best Friend Hat in Adopt Me','How to Get Friend Hat in Adopt Me'],
 ['What Is Farm Egg in Adopt Me','What Is Egg in Adopt Me'],
 ['When Does Farm Egg Spawn in Adopt Me','When Does Egg Spawn in Adopt Me'],
])test(`subject words survive task normalization: ${a}`,()=>{
 for(const [left,right]of [[a,b],[b,a]]) {
  const result=compareArticleTopics(left,right,'Adopt Me');
  assert.equal(result.duplicate,false);assert.ok(result.score>0&&result.score<1);
  assert.equal(nearDuplicateArticleTitle(left,right),false);
 }
});

test("question intent and entity qualifiers stay distinct even with subject containment",()=>{
 for(const [a,b] of [
  ['How to Beat the Ice Dragon','When Does the Ice Dragon Spawn?'],
  ['How to Get Moon Sword','How to Get Moon Sword Fragments'],
  ['How to Get Moon Sword','How to Get Moon Sword Shards'],
  ['How to Get Moon Sword','How to Get Moon Sword Recipe'],
  ['How to Get Moon Sword','Where to Get Moon Sword'],
  ['What Is Moon Sword','How to Get Moon Sword'],
  ['Ice Dragon Guide','Ice Dragon Spawn Time Guide'],
  ['Ice Dragon Guide','How to Beat the Ice Dragon'],
  ['How to Get Dual Katana in Blox Fruits','How to Get Cursed Dual Katana in Blox Fruits'],
  ['How to Get Moon Sword','How to Get Dark Moon Sword'],
  ['How to Make Money with Rods','How to Make Money with Magic Rods'],
  ['How to Install Mods','How to Install Weapon Mods'],
 ]) {
  for(const [left,right] of [[a,b],[b,a]]) {
   const result=compareArticleTopics(left,right);
   assert.equal(result.duplicate,false,`${left} / ${right}`);
   assert.ok(result.score>0,`${left} / ${right} should still be a near match`);
   assert.equal(nearDuplicateArticleTitle(left,right),false);
  }
 }
});

test("best, top and fastest modify the task rather than turning it into a ranking",()=>{
 for(const title of ['Best Ways to Make Money in Fisch','Top Ways to Earn Cash in Fisch','Fastest Ways to Make Money in Fisch']) {
  const result=compareArticleTopics('Fisch Money Farming Guide',title,'Fisch');
  assert.equal(result.duplicate,true,title);assert.deepEqual(result.actions,['money','money']);
 }
 assert.equal(compareArticleTopics('Fisch Rod Tier List','Best Ways to Get Rods in Fisch','Fisch').duplicate,false);
});

test("ranking phrases recognize the ranked subject, including context in subtitles",()=>{
 for(const [game,a,b]of [
  ['A Bizarre Run','A Bizarre Run Stands Tier List: Ranking All Stands','A Bizarre Run Stand Tier List: Best Stands for Races and Fights'],
  ...['Best Rods','Top Rods','Top 10 Rods','Rods Ranked','Strongest Rods','Best Rods for Beginners',': Best Rods'].map(title=>['Fisch',`Fisch ${title}`,'Fisch Rod Tier List']),
 ])assert.equal(compareArticleTopics(a,b,game).duplicate,true,`${a} / ${b}`);
 assert.equal(compareArticleTopics('Fisch Best Rods','Fisch Best Magic Rods','Fisch').duplicate,false);
});
test("Black Market containment stays a near match with a score and URL",()=>{
 const title='Steal An Egg Black Market Dealer Guide';
 const item={family:'article',title:'Steal An Egg Slick Rick Spawn Times and Black Market Items',key:'black-market-items',universe_id:1};
 const [match]=similarArticleTopics(title,{universeId:1,game:'Steal An Egg'},[item]);
 assert.equal(match.duplicate,false);assert.ok(match.score!>0);assert.equal(match.url,'https://bloxodes.com/articles/black-market-items');
});
test("curator overlap context includes near matches with a different task",()=>{
 const item={family:'article',title:'When Does the Ice Dragon Spawn?',key:'ice-dragon-spawn'};
 const candidate={id:'source',source_title:'How to Beat the Ice Dragon',source_description:null,source_evidence:null} as any;
 assert.deepEqual(loadRelevantInventory([item],[candidate]),[item]);
});
test("synonyms retain the task and remove game name words",()=>{
 for(const [a,b] of [['How to obtain the Moon Crystal','How to unlock Moon Crystals'],['How to install mods','How to add mods'],['How to defeat the Ice Dragon','How to beat Ice Dragons']])assert.equal(compareArticleTopics(a,b).duplicate,true,`${a}/${b}`);
});
test("different tasks, entities and games do not collide",()=>{
 for(const [a,b]of [['How to get Moon Crystals','How to use Moon Crystals'],['How to get Moon Crystals','How to get Sun Crystals'],['Best Stands','Best Weapons']])assert.equal(compareArticleTopics(a,b).duplicate,false);
 const items=[{family:'article',title:'How to Get Moon Crystals',key:'moon-crystals',universe_id:2}];
 assert.equal(similarArticleTopics('How to Unlock Moon Crystals',{universeId:1},items).length,0);
});

test("real game article comparisons preserve distinct announcements",()=>{
 const fps=compareArticleTopics("Rockstar Confirms GTA 6 Targets 30 FPS on PS5 and Xbox","Does GTA 6 Run at 30 or 60 FPS on PS5, PS5 Pro and Xbox?","GTA 6");
 assert.equal(fps.duplicate,false);assert.ok(fps.score>0);
 // These two live news stories cite different announcements and make different claims.
 const preorders=compareArticleTopics("GTA 6 Sets Preorder Records on PlayStation and Microsoft Store","GTA 6 Pre-Orders Far Above Expectations: What Take-Two Said","GTA 6");
 assert.equal(preorders.duplicate,false);
});

test("legacy queue topics infer the editorial game name across incorrect historical article universe IDs",()=>{
 const items=[{family:'codes',title:'A Bizarre Run',key:'a-bizarre-run',universe_id:9867225552},
 {family:'article',title:'A Bizarre Run Stand Tier List: Best Stands for Races and Fights',key:'a-bizarre-run-stand-tier-list',universe_id:10354679738}];
 const title='A Bizarre Run Stands Tier List: Ranking All Stands';const scope=inferArticleScope(title,items)!;
 assert.ok(scope);assert.equal(similarArticleTopics(title,scope,items)[0].duplicate,true);
});

test("a game's general money and level-up questions recognize equivalent wording",()=>{
 assert.equal(compareArticleTopics('How to Make Money Fast in Fisch','How to Earn Cash in Fisch','Fisch').duplicate,true);
 assert.equal(compareArticleTopics('How to Upgrade in Fisch','How to Level Up in Fisch','Fisch').duplicate,true);
 assert.equal(compareArticleTopics('How to Get the Moon Sword in Fisch','How to Use the Moon Sword in Fisch','Fisch').duplicate,false);
});

test("nearest matches deduplicate inventory rows and include unclassified owner game topics",()=>{
 const page={family:'article',title:'How to Get Moon Pearls',key:'moon-pearls',universe_id:null,namespace:'example',slug:'example-game',kind:'game' as const,public_path:'/articles/moon-pearls'};
 const owner={id:'owner',article_title:'How to Obtain Moon Pearls',game:'Example Game',status:'pending'};
 const matches=similarArticleTopics('How to Find Moon Pearls',{namespace:'example',gameSlug:'example-game'},[page,page],[owner]);
 assert.equal(matches.filter(r=>r.page_type==='article').length,1);assert.equal(matches.filter(r=>r.page_type==='queue').length,1);
});
