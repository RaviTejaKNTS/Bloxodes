import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {tsImport} from 'tsx/esm/api';
const {assertEnvironment, selectedPlan, selectedImageInput, robloxCollectibleFacts, robloxMetadata, cleanupAccounts} = await tsImport('../selected-roblox-qa.ts', import.meta.url);
const target = 'https://bbtcaurrtyoukvjbxbbj.supabase.co';
const env = () => ({GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_RUN_ID: '1', GITHUB_RUN_ATTEMPT: '1', RUNNER_TEMP: '/tmp', BLOXODES_MANAGED_QA: 'true', BLOXODES_SELECTED_ROBLOX_QA: 'true', BLOXODES_ENV_PROFILE: 'process-only', SUPABASE_URL: target, NEXT_PUBLIC_SUPABASE_URL: target, ARTICLE_DEV_SUPABASE_URL: target, SUPABASE_MEDIA_PUBLIC_URL: target, TEST_BASE_URL: 'http://bloxodes.test:3000', BUNDLE_HASH: 'a'.repeat(64), BLOXODES_VERIFIED_BUNDLE: 'a'.repeat(64), BATCH: `content/releases/${'a'.repeat(64)}/batch.json`});
test('explicit dispatch, all managed targets, exact download and no production inputs are mandatory', () => {
  assert.doesNotThrow(() => assertEnvironment(env()));
  for (const key of ['GITHUB_ACTIONS', 'GITHUB_EVENT_NAME', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'RUNNER_TEMP', 'BLOXODES_MANAGED_QA', 'BLOXODES_SELECTED_ROBLOX_QA', 'BLOXODES_ENV_PROFILE', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'ARTICLE_DEV_SUPABASE_URL', 'SUPABASE_MEDIA_PUBLIC_URL', 'TEST_BASE_URL', 'BUNDLE_HASH', 'BLOXODES_VERIFIED_BUNDLE', 'BATCH']) assert.throws(() => assertEnvironment({...env(), [key]: ''}), undefined, key);
  for (const key of ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'ARTICLE_DEV_SUPABASE_URL', 'SUPABASE_MEDIA_PUBLIC_URL']) assert.throws(() => assertEnvironment({...env(), [key]: 'https://database.bloxodes.com'}));
  for (const key of ['BLOXODES_CONTENT_RELEASE', 'BLOXODES_MANAGED_RECEIPT', 'BLOXODES_APPROVED_SHA', 'REVALIDATE_SECRET', 'BLOXODES_SELECTED_FRANCHISE_STAGE']) assert.throws(() => assertEnvironment({...env(), [key]: 'true'}));
  assert.throws(() => assertEnvironment({...env(), NODE_ENV: 'production'}));
  assert.doesNotThrow(() => assertEnvironment({...env(), BLOXODES_VERIFIED_BUNDLE: '', BATCH: ''}, false));
  assert.throws(() => assertEnvironment({...env(), SUPABASE_URL: 'https://database.bloxodes.com'}, false));
});
test('selection binds only exact Roblox operations, manifest finals, dataset identities and page URLs', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'roblox-qa-'));
  const batch = {version: 1, operations: [{publisher: 'roblox-collection', file: 'manifest.json'}], urls: [{path: '/wiki/example/pets', contains: 'Pets'}], events: [{type: 'wiki_collection', slug: 'example/pets'}]};
  const manifest = {schemaVersion: 1, game: {slug: 'example', name: 'Example', universeId: 7}, collection: {slug: 'pets', label: 'Pets', pageType: 'database'}, dataset: 'dataset.json', finalJson: 'final.json', mediaRoot: 'media'};
  const dataset = {meta: {schemaVersion: 2, display: {cardFields: ['rarity'], tableFields: ['rarity']}}, items: [{item: {name: 'Cat', rarity: 'Rare'}, system: {slug: 'cat', section: 'Pets', image: null}}]};
  const put = (file, value) => fs.writeFileSync(path.join(root, file), JSON.stringify(value));
  try {
    fs.mkdirSync(path.join(root, 'media')); put('manifest.json', manifest); put('dataset.json', dataset); put('final.json', {code: 'example-pets'});
    assert.equal(selectedPlan(root, batch).collections.length, 1);
    for (const mutation of [
      {...batch, operations: [{publisher: 'franchise-collection', namespace: 'example', file: 'manifest.json'}]},
      {...batch, operations: [{...batch.operations[0], namespace: 'roblox'}]},
      {...batch, urls: [{path: '/wiki/example/other', contains: 'Other'}]},
      {...batch, urls: [...batch.urls, ...batch.urls]},
      {...batch, events: [{type: 'wiki', slug: 'unselected'}]}
    ]) assert.throws(() => selectedPlan(root, mutation));
    put('manifest.json', {...manifest, dataset: '../escape.json'}); assert.throws(() => selectedPlan(root, batch)); put('manifest.json', manifest);
    put('dataset.json', {...dataset, meta: {...dataset.meta, gameSlug: 'wrong'}}); assert.throws(() => selectedPlan(root, batch));
    put('dataset.json', {...dataset, items: [dataset.items[0], dataset.items[0]]}); assert.throws(() => selectedPlan(root, batch));
    put('dataset.json', {...dataset, items: [{...dataset.items[0], system: {...dataset.items[0].system, image: '../escape.png'}}]}); assert.throws(() => selectedPlan(root, batch));
    put('dataset.json', dataset); put('final.json', {code: 'other-pets'}); assert.throws(() => selectedPlan(root, batch));
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
});
test('publisher image normalization accepts approved local paths without changing frozen strings', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'roblox-images-'));
  const external = fs.mkdtempSync(path.join(os.tmpdir(), 'roblox-external-image-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  t.after(() => fs.rmSync(external, {recursive: true, force: true}));
  const mediaRoot = path.join(root, 'collection/media');
  fs.mkdirSync(mediaRoot, {recursive: true});
  for (const name of ['coins-icon.png', 'sky island.png', 'hash#question?.png']) fs.writeFileSync(path.join(mediaRoot, name), 'fixture bytes');
  const batch = {version: 1, operations: [{publisher: 'roblox-collection', file: 'collection/manifest.json'}], urls: [{path: '/wiki/example/pets', contains: 'Pets'}], events: [{type: 'wiki_collection', slug: 'example/pets'}]};
  const manifest = {schemaVersion: 1, game: {slug: 'example', name: 'Example', universeId: 7}, collection: {slug: 'pets', label: 'Pets', pageType: 'database'}, dataset: 'dataset.json', finalJson: 'final.json', mediaRoot: 'media'};
  fs.writeFileSync(path.join(root, 'collection/manifest.json'), JSON.stringify(manifest));
  fs.writeFileSync(path.join(root, 'collection/final.json'), JSON.stringify({code: 'example-pets'}));
  const datasetFile = path.join(root, 'collection/dataset.json');
  const putImage = image => fs.writeFileSync(datasetFile, JSON.stringify({meta: {schemaVersion: 2, display: {cardFields: ['rarity'], tableFields: ['rarity']}}, items: [{item: {name: 'Cat', rarity: 'Rare'}, system: {slug: 'cat', section: 'Pets', image}}]}));
  for (const [image, file] of [
    ['/coins-icon.png', 'coins-icon.png'],
    ['///coins-icon.png', 'coins-icon.png'],
    ['/sky%20island.png', 'sky island.png'],
    ['/coins-icon.png?version=2#preview', 'coins-icon.png'],
    ['coins-icon.png#preview?version=2', 'coins-icon.png'],
    ['/hash%23question%3F.png?version=2', 'hash#question?.png']
  ]) {
    putImage(image);
    const frozen = fs.readFileSync(datasetFile, 'utf8');
    assert.equal(selectedImageInput(root, mediaRoot, image), path.join(mediaRoot, file));
    assert.equal(selectedPlan(root, batch).collections[0].dataset.items[0].system.image, image);
    assert.equal(fs.readFileSync(datasetFile, 'utf8'), frozen);
  }
  // A real target inside the bundle but outside mediaRoot must still be rejected.
  fs.writeFileSync(path.join(root, 'collection/outside.png'), 'outside media');
  fs.symlinkSync('../outside.png', path.join(mediaRoot, 'escape.png'));
  fs.symlinkSync('coins-icon.png', path.join(mediaRoot, 'inside-link.png'));
  fs.symlinkSync('..', path.join(mediaRoot, 'linked-directory'));
  fs.writeFileSync(path.join(external, 'outside.png'), 'outside bundle');
  fs.symlinkSync(path.join(external, 'outside.png'), path.join(mediaRoot, 'external-link.png'));
  for (const image of [
    '../outside.png', '/%2e%2e/outside.png', '%2e%2e%2foutside.png',
    'folder\\coins-icon.png', 'folder%5Ccoins-icon.png',
    '/missing.png', 'https://example.com/coins-icon.png', 'HTTP://example.com/coins-icon.png',
    '/escape.png', '/inside-link.png', '/external-link.png', '/linked-directory/outside.png', '/?version=2', '/#preview', '/bad%ZZ.png'
  ]) {
    putImage(image);
    assert.throws(() => selectedImageInput(root, mediaRoot, image), undefined, image);
    assert.throws(() => selectedPlan(root, batch), undefined, image);
  }
  // Collectibles may use the checklist's preferred-field fallback without tableFields.
  manifest.collection.pageType = 'collectible';
  fs.writeFileSync(path.join(root, 'collection/manifest.json'), JSON.stringify(manifest));
  fs.writeFileSync(datasetFile, JSON.stringify({meta: {schemaVersion: 2, display: {}}, items: [{item: {name: 'Cat', location: 'Spawn'}, system: {slug: 'cat', section: 'Pets', image: null}}]}));
  assert.equal(selectedPlan(root, batch).collections.length, 1);
});
test('Roblox islands and shiny-star facts follow checklist keys and labels in both views', () => {
  // Approved display definitions; database presentation labels deliberately differ.
  const islands = {cardFields: ['gateRequirement', 'elevation', 'mainStop', 'cardSummary', 'alternateAccess'], tableFields: ['routeOrder', 'gateRequirement', 'elevation', 'mainStop', 'alternateAccess', 'cardSummary'], fieldPresentation: {gateRequirement: {label: 'Gate'}, mainStop: {label: 'Main stop'}, cardSummary: {label: 'Summary'}, alternateAccess: {label: 'Alternate access'}}};
  const island = {name: 'Sky Island', routeOrder: 1, gateRequirement: '7–10 million Coins', elevation: null, mainStop: 'Gem-upgrades station', cardSummary: 'Sky and Nimbus Eggs are here.', alternateAccess: '', location: 'Must not be appended'};
  const facts = robloxCollectibleFacts(islands, island);
  assert.deepEqual(facts.cards, [
    {key: 'gateRequirement', label: 'Gate Requirement', text: '7–10 million Coins', description: false},
    {key: 'mainStop', label: 'Main Stop', text: 'Gem-upgrades station', description: false},
    {key: 'cardSummary', label: 'Summary', text: 'Sky and Nimbus Eggs are here.', description: false}
  ]);
  assert.deepEqual(facts.list, facts.cards);
  const stars = {cardFields: ['landmark', 'location', 'access'], tableFields: ['collectionOrder', 'island', 'landmark', 'location', 'access'], fieldPresentation: {location: {kind: 'detail', label: 'Directions'}, access: {kind: 'detail', label: 'Extra access', omitWhenEmpty: true}}};
  const star = {landmark: 'Fountain', location: 'Behind the fountain.', access: 'Cross the bridge.', collectionOrder: 1, island: 'Spawn Lobby'};
  const starFacts = robloxCollectibleFacts(stars, star);
  assert.deepEqual(starFacts.cards.map(({key, label}) => [key, label]), [['landmark', 'Landmark'], ['location', 'Location'], ['access', 'Access']]);
  assert.deepEqual(starFacts.list, starFacts.cards);
  for (const access of ['', ' \n ', null, undefined, [], {}]) {
    const empty = robloxCollectibleFacts(stars, {...star, access});
    assert.deepEqual(empty.cards.map(fact => fact.key), ['landmark', 'location']);
    assert.deepEqual(empty.list, empty.cards);
  }
});
test('Roblox checklist fallback, fixed labels and value normalization match the renderer', () => {
  const values = {region: '  First\n area ', location: ['North', '', null, 'South'], landmark: {nearbyStop: 'Tree', empty: null}, access: false, requirements: 0, reward: 'none', coordinates: [1, 2], approach: 'Walk', vehicle: 'Bike', environment: 'Forest', animalForm: 'Cat', notes: 'n/a', unrelated: 'Hidden'};
  const fallback = robloxCollectibleFacts({}, values);
  assert.deepEqual(fallback.cards.map(fact => fact.key), ['region', 'location', 'landmark', 'access', 'requirements', 'reward', 'coordinates', 'approach', 'vehicle', 'environment', 'animalForm', 'notes']);
  assert.deepEqual(fallback.cards.map(fact => fact.text), ['First area', 'North; South', 'Nearby Stop: Tree', 'false', '0', 'none', '1; 2', 'Walk', 'Bike', 'Forest', 'Cat', 'n/a']);
  assert.deepEqual(robloxCollectibleFacts({cardFields: []}, values), fallback);
  assert.deepEqual(fallback.list, fallback.cards);
  const keys = ['collectionOrder', 'area', 'nearestLandmark', 'exactSpot', 'accessNotes', 'cardSummary', 'main_stop', 'gateRequirement', 'animalForm', 'vehicle'];
  const fixed = robloxCollectibleFacts({cardFields: [...keys, 'main_stop']}, Object.fromEntries(keys.map(key => [key, 'value'])));
  assert.deepEqual(fixed.cards.map(fact => fact.label), ['Order', 'Area', 'Nearest landmark', 'Exact spot', 'Access', 'Summary', 'Main Stop', 'Gate Requirement', 'Animal form', 'Recommended vehicle']);
  assert.deepEqual(fixed.list, fixed.cards);
});
test('metadata expectations resolve SEO tokens, exact canonical and Page N copy', () => {
  const now = new Date(2026, 9, 20, 12);
  const final = {title: 'All Pets', seo_title: '  Pets %MONTH% %year% %unknown%  ', meta_description: 'All pet details.'};
  assert.deepEqual(robloxMetadata(final, '/wiki/example/pets', 'database', 1, now), {title: 'Pets October 2026 %unknown%', heading: 'All Pets', description: 'All pet details.', canonical: 'https://bloxodes.com/wiki/example/pets'});
  assert.deepEqual(robloxMetadata(final, '/wiki/example/pets', 'database', 3, now), {title: 'Pets October 2026 %unknown% - Page 3', heading: 'All Pets - Page 3', description: 'All pet details. Page 3.', canonical: 'https://bloxodes.com/wiki/example/pets/page/3'});
  assert.deepEqual(robloxMetadata(final, '/wiki/example/pets', 'collectible', 3, now), robloxMetadata(final, '/wiki/example/pets', 'collectible', 1, now));
  assert.equal(robloxMetadata({...final, seo_title: '  '}, '/wiki/example/pets', 'database', 1, now).title, 'All Pets');
});
test('hub metadata uses plain text, the 180-character limit and description fallback', () => {
  const final = {title: 'Example Wiki', seo_title: '  Example Wiki  ', meta_description: '**Read** [this guide](/wiki/example).\n <b>All details.</b>'};
  const expected = robloxMetadata(final, '/wiki/example', 'hub');
  assert.deepEqual(expected, {title: 'Example Wiki', heading: 'Example Wiki', description: 'Read this guide. All details.', canonical: 'https://bloxodes.com/wiki/example'});
  assert.equal(robloxMetadata({...final, meta_description: 'x'.repeat(180)}, '/wiki/example', 'hub').description, 'x'.repeat(180));
  assert.equal(robloxMetadata({...final, meta_description: 'x'.repeat(181)}, '/wiki/example', 'hub').description, 'x'.repeat(177) + '…');
  assert.equal(robloxMetadata({...final, meta_description: 'word '.repeat(40)}, '/wiki/example', 'hub').description, Array(35).fill('word').join(' ') + '…');
  assert.equal(robloxMetadata({...final, meta_description: '  ', description_md: '## Fallback\nUseful **details**.'}, '/wiki/example', 'hub').description, 'Fallback Useful details.');
  // Collections render stored descriptions without the hub's Markdown/truncation rules.
  assert.equal(robloxMetadata(final, '/wiki/example/pets', 'database').description, final.meta_description);
});
test('cleanup stays on owned users and selected progress and continues after rejected operations', async () => {
  const calls = [];
  const db = {from(table) {
    const call = {table, filters: [], read: false}; calls.push(call);
    const query = {
      select() {call.read = true; return query;}, maybeSingle() {call.ownership = true; return query;}, delete() {return query;},
      eq(key, value) {call.filters.push([key, value]); return query;}, in(key, value) {call.filters.push([key, value]); return query;},
      then(resolve, reject) {return call.table === 'app_sessions' && !call.read ? Promise.reject(new Error('transport failure')).then(resolve, reject) : Promise.resolve({data: call.ownership ? {display_name: 'Selected Roblox QA test'} : [], error: null}).then(resolve, reject);}
    }; return query;
  }};
  const records = ['desktop-chromium', 'mobile-chromium'].map((project, index) => ({project, userId: `owned-${index}`, sessionId: `session-${index}`, displayName: 'Selected Roblox QA test'}));
  const failures = await cleanupAccounts(db, records, ['example-islands']);
  assert.equal(failures.length, 2); assert.equal(calls.length, 14);
  for (const call of calls) {
    assert.ok(call.filters.some(([key, value]) => key === 'user_id' && records.some(account => account.userId === value)));
    if (call.table === 'app_users' && !call.read) assert.ok(call.filters.some(([key, value]) => key === 'display_name' && value === 'Selected Roblox QA test'));
    if (call.table === 'app_sessions') assert.ok(call.filters.some(([key]) => key === 'id'));
    if (call.table === 'user_checklist_progress') assert.deepEqual(call.filters.find(([key]) => key === 'checklist_slug')[1], ['wiki-collection:example-islands']);
  }
});
test('cleanup refuses a real user if private fixture ownership no longer matches', async () => {
  const calls = [];
  const db = {from(table) {
    calls.push(table);
    return {select() {return this;}, eq() {return this;}, maybeSingle() {return Promise.resolve({data: {display_name: 'Existing player'}, error: null});}};
  }};
  const failures = await cleanupAccounts(db, [{project: 'desktop', userId: 'owned', sessionId: 'session', displayName: 'Selected Roblox QA test'}], ['example-islands']);
  assert.deepEqual(failures, ['desktop:ownership']);
  assert.deepEqual(calls, ['app_users']);
});
