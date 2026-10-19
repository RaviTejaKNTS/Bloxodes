import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {acceptedImagePolicy, assertSelectedRobloxEnvironment, cleanupRobloxAccounts, MANAGED_TARGET, selectedRobloxImage, selectedRobloxPageCopy, selectedRobloxPlan, visibleRobloxFacts} from '../selected-roblox-qa-contract.mjs';

const hash = 'a'.repeat(64);
const env = () => ({GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/heads/task', GITHUB_SHA: 'b'.repeat(40), BLOXODES_ENV_PROFILE: 'process-only', BLOXODES_MANAGED_QA: 'true', BLOXODES_SELECTED_ROBLOX_QA: 'true', BLOXODES_SELECTED_ROBLOX_STAGE: 'false', SUPABASE_URL: MANAGED_TARGET, NEXT_PUBLIC_SUPABASE_URL: MANAGED_TARGET, ARTICLE_DEV_SUPABASE_URL: MANAGED_TARGET, SUPABASE_MEDIA_PUBLIC_URL: MANAGED_TARGET, TEST_BASE_URL: 'http://bloxodes.test:3000', BUNDLE_HASH: hash, BLOXODES_VERIFIED_BUNDLE: hash, BATCH: `content/releases/${hash}/batch.json`});
test('dispatch guard rejects PRs, production, tags, substituted bundles and release flags', () => {
  assert.doesNotThrow(() => assertSelectedRobloxEnvironment(env()));
  for (const [key, value] of Object.entries({GITHUB_ACTIONS: '', GITHUB_EVENT_NAME: 'pull_request', GITHUB_REF: 'refs/heads/production', GITHUB_SHA: 'bad', BLOXODES_MANAGED_QA: '', BLOXODES_SELECTED_ROBLOX_QA: '', BLOXODES_ENV_PROFILE: 'production-preview', BLOXODES_SELECTED_ROBLOX_STAGE: '', SUPABASE_URL: 'https://database.bloxodes.com', NEXT_PUBLIC_SUPABASE_URL: 'https://other.supabase.co', ARTICLE_DEV_SUPABASE_URL: 'https://database.bloxodes.com', SUPABASE_MEDIA_PUBLIC_URL: 'https://media.bloxodes.com', TEST_BASE_URL: 'https://bloxodes.com', BUNDLE_HASH: 'x'.repeat(64), BLOXODES_VERIFIED_BUNDLE: 'c'.repeat(64), BATCH: 'content/releases/other/batch.json', NODE_ENV: 'production', BLOXODES_CONTENT_RELEASE: 'true', BLOXODES_MANAGED_RECEIPT: 'receipt', BLOXODES_APPROVED_SHA: 'c'.repeat(40), REVALIDATE_SECRET: 'forbidden', BLOXODES_SELECTED_FRANCHISE_QA: 'true'})) assert.throws(() => assertSelectedRobloxEnvironment({...env(), [key]: value}), undefined, key);
  assert.throws(() => assertSelectedRobloxEnvironment({...env(), GITHUB_REF: 'refs/tags/task'}));
});

function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'selected-roblox-'));
  const dataset = {meta: {schemaVersion: 2, display: {cardFields: ['reward'], tableFields: ['reward']}}, items: [{item: {name: 'One', reward: 'Coins'}, system: {slug: 'one', section: 'Island', image: null}}]};
  const final = {code: 'example-items', wiki_slug: 'example', collection_slug: 'items', title: 'All {count} Items'};
  const manifest = {schemaVersion: 1, game: {slug: 'example', name: 'Example', universeId: 123}, collection: {slug: 'items', label: 'Items', pageType: 'collectible'}, dataset: 'dataset.json', finalJson: 'final.json', mediaRoot: 'media', sourceUrls: ['https://example.com']};
  const hub = {slug: 'example', universe_id: 123, title: 'Example Wiki', cover_image: null};
  const evidence = {acceptedGapCount: 1, acceptedGaps: [{systemSlug: 'one', status: 'text-only/accepted missing', decisionReason: 'Main approved after exact-image search.'}]};
  const batch = {version: 1, operations: [{publisher: 'roblox-wiki', file: 'hub.json'}, {publisher: 'roblox-collection', file: 'collection/runtime-manifest.json'}], urls: [{path: '/wiki/example', contains: 'Example'}, {path: '/wiki/example/items', contains: 'Items'}], events: [{type: 'wiki', slug: 'example'}, {type: 'wiki_collection', slug: 'example/items'}]};
  const save = (name, value) => fs.writeFileSync(path.join(root, name), JSON.stringify(value));
  fs.mkdirSync(path.join(root, 'collection/media'), {recursive: true});
  save('hub.json', hub); save('collection/runtime-manifest.json', manifest); save('collection/dataset.json', dataset); save('collection/final.json', final); save('collection/images.json', evidence);
  try { run({root, dataset, final, manifest, hub, evidence, batch, save}); } finally { fs.rmSync(root, {recursive: true, force: true}); }
}
test('binds exact selected identities, v2 files, finals, URLs and publisher allowlist', () => fixture(({root, batch, save, manifest, final, dataset, hub}) => {
  assert.equal(selectedRobloxPlan(root, batch).collections[0].policy.acceptedMissing[0], 'one');
  assert.equal(selectedRobloxPlan(root, {...batch, urls: [...batch.urls].reverse()}).pages[0].path, '/wiki/example');
  for (const operation of [
    {publisher: 'game-pages', file: 'hub.json', namespace: 'example'}, {publisher: 'content-final', file: 'hub.json'},
    {publisher: 'roblox-wiki', file: 'hub.json', namespace: 'roblox'}, {publisher: 'roblox-wiki', file: '../hub.json'}
  ]) assert.throws(() => selectedRobloxPlan(root, {...batch, operations: [operation]}));
  for (const urls of [[batch.urls[0], batch.urls[0]], [batch.urls[0]], [...batch.urls, {path: '/wiki/extra', contains: 'Extra'}]]) assert.throws(() => selectedRobloxPlan(root, {...batch, urls}), /exactly match/);
  assert.throws(() => selectedRobloxPlan(root, {...batch, events: [{type: 'wiki_collection', slug: 'other/items'}]}));
  save('hub.json', {...hub, universe_id: 456}); assert.throws(() => selectedRobloxPlan(root, batch), /identity mismatch/); save('hub.json', hub);
  save('collection/runtime-manifest.json', {...manifest, route: '/wiki/other/items'}); assert.throws(() => selectedRobloxPlan(root, batch), /must match/); save('collection/runtime-manifest.json', manifest);
  save('collection/final.json', {...final, wiki_slug: 'other'}); assert.throws(() => selectedRobloxPlan(root, batch), /must match/); save('collection/final.json', final);
  for (const meta of [{...dataset.meta, schemaVersion: 1}, {...dataset.meta, gameSlug: 'other'}, {...dataset.meta, collection: 'other'}]) {
    save('collection/dataset.json', {...dataset, meta}); assert.throws(() => selectedRobloxPlan(root, batch), /must match/);
  }
  save('collection/dataset.json', {...dataset, items: [...dataset.items, ...dataset.items]}); assert.throws(() => selectedRobloxPlan(root, batch), /unique stable/);
}));
test('media paths match publisher normalization and reject decoded traversal, remote files and symlinks', () => fixture(({root, batch, dataset, save}) => {
  const row = dataset.items[0];
  const mediaRoot = path.join(root, 'collection/media'), file = path.join(mediaRoot, 'one.png');
  fs.writeFileSync(file, 'image fixture');
  fs.writeFileSync(path.join(mediaRoot, 'one #?.png'), 'encoded image fixture');
  save('collection/images.json', {});
  const withImage = image => save('collection/dataset.json', {...dataset, items: [{...row, system: {...row.system, image}}]});
  for (const image of ['one.png', '/one.png', '//one.png', '/%6Fne.png?download=1#preview', 'one.png#preview?ignored=1']) {
    withImage(image); assert.doesNotThrow(() => selectedRobloxPlan(root, batch));
    assert.equal(selectedRobloxImage(root, mediaRoot, image), file);
  }
  withImage('/one%20%23%3F.png?download=1#preview');
  assert.doesNotThrow(() => selectedRobloxPlan(root, batch));
  assert.equal(selectedRobloxImage(root, mediaRoot, '/one%20%23%3F.png?download=1#preview'), path.join(mediaRoot, 'one #?.png'));
  for (const image of ['../final.json', '/%2e%2e/final.json', '%2e%2e%2ffinal.json', '/%2e%2e%5cfinal.json', 'https://example.com/one.png', 'https%3A%2F%2Fexample.com/one.png', 'file:///one.png', '/etc/passwd', 'media/one.png']) {
    withImage(image); assert.throws(() => selectedRobloxPlan(root, batch));
    assert.throws(() => selectedRobloxImage(root, mediaRoot, image));
  }
  fs.symlinkSync(path.join(root, 'hub.json'), path.join(root, 'collection/media/link.json'));
  fs.symlinkSync(path.join(root, 'collection'), path.join(mediaRoot, 'linked-directory'));
  for (const image of ['link.json', '/%6cink.json?x=1#fragment', '/linked-directory/final.json']) {
    withImage(image); assert.throws(() => selectedRobloxPlan(root, batch), /symlinks/);
    assert.throws(() => selectedRobloxImage(root, mediaRoot, image), /symlinks/);
  }
}));
test('page copy mirrors publisher types, recursive count tokens and verbatim strings', () => {
  const final = {title: ' All {count} Items ', display_name: ' Items ', seo_title: ' {count} Items ', meta_description: ' Find {count}. ', intro_md: '', how_it_works_md: '  ', description_md: 42, wiki_md: false, description_json: {text: '{count}', children: ['{count}']}, faq_json: [{q: 'All {count}?'}], schema_ld_json: {number: '{count}'}, thumb_url: '  https://example.com/one.png  ', wiki_sort_order: 12};
  assert.deepEqual(selectedRobloxPageCopy(final, 1234, 9), {
    title: ' All 1,234 Items ', display_name: ' Items ', seo_title: ' 1,234 Items ', meta_description: ' Find 1,234. ', intro_md: '', how_it_works_md: '  ', description_md: null, wiki_md: null, description_json: {text: '1,234', children: ['1,234']}, faq_json: [{q: 'All 1,234?'}], schema_ld_json: {number: '1,234'}, thumb_url: '  https://example.com/one.png  ', wiki_sort_order: 12
  });
  for (const optional of [undefined, null, false, 1, '', '   ']) {
    const actual = selectedRobloxPageCopy({...final, thumb_url: optional, schema_ld_json: optional, intro_md: optional, wiki_md: optional}, 11);
    assert.equal(actual.thumb_url, null);
    assert.equal(actual.schema_ld_json, null);
    assert.equal(actual.intro_md, typeof optional === 'string' ? optional : null);
    assert.equal(actual.wiki_md, typeof optional === 'string' ? optional : null);
  }
  // The publisher's object rule deliberately accepts arrays for schema_ld_json.
  assert.deepEqual(selectedRobloxPageCopy({...final, schema_ld_json: ['{count}']}, 11).schema_ld_json, ['11']);
  for (const value of [undefined, null, '12', false, NaN, Infinity, -Infinity, {}]) assert.equal(selectedRobloxPageCopy({...final, wiki_sort_order: value}, 11, 7).wiki_sort_order, 7);
  assert.equal(selectedRobloxPageCopy({...final, wiki_sort_order: 0}, 11, 7).wiki_sort_order, 0);
});
test('blank thumbnail readback stays null when a mapped item supplies social artwork', () => fixture(({root, batch, dataset, final, save}) => {
  fs.writeFileSync(path.join(root, 'collection/media/one.png'), 'image fixture');
  save('collection/images.json', {});
  save('collection/dataset.json', {...dataset, items: [{...dataset.items[0], system: {...dataset.items[0].system, image: '/one.png'}}]});
  for (const thumb_url of ['', '  ']) {
    save('collection/final.json', {...final, thumb_url});
    const entry = selectedRobloxPlan(root, batch).collections[0];
    assert.equal(entry.policy.requireImages, true);
    assert.equal(selectedRobloxPageCopy(entry.final, entry.dataset.items.length).thumb_url, null);
  }
}));
test('missing images need exact standardized main approval, including a fully text-only dataset', () => fixture(({dataset, evidence}) => {
  assert.deepEqual(acceptedImagePolicy(dataset, evidence), {requireImages: false, acceptedMissing: ['one']});
  for (const value of [null, {entries: [{status: 'accepted_missing', itemMapping: {slug: 'one'}}]}, {items: [{slug: 'one', status: 'missing', reason: 'Searched'}]}, {...evidence, acceptedGapCount: 0}, {...evidence, acceptedGaps: [...evidence.acceptedGaps, ...evidence.acceptedGaps]}, {...evidence, acceptedGaps: [{...evidence.acceptedGaps[0], systemSlug: 'other'}]}, {...evidence, acceptedGaps: [{...evidence.acceptedGaps[0], decisionReason: ''}]}]) assert.throws(() => acceptedImagePolicy(dataset, value));
  const mapped = {items: [{system: {slug: 'one', image: 'one.png'}}]};
  assert.deepEqual(acceptedImagePolicy(mapped, null), {requireImages: true, acceptedMissing: []});
  assert.throws(() => acceptedImagePolicy(mapped, evidence));
}));
test('collectible facts follow actual shared Cards/List labels and ignore database presentation', () => {
  const display = {cardFields: ['vehicle', 'nearestLandmark', 'reward', 'flag'], tableFields: ['location'], fieldPresentation: {reward: {label: 'Wrong database label'}}};
  const row = {name: 'One', vehicle: 'Boat', nearestLandmark: 'Pier', reward: ['Coins', 'Badge'], flag: true, location: 'Not a configured checklist field'};
  const expected = [{key: 'vehicle', label: 'Recommended vehicle', text: 'Boat', description: false}, {key: 'nearestLandmark', label: 'Nearest landmark', text: 'Pier', description: false}, {key: 'reward', label: 'Reward', text: 'Coins; Badge', description: false}, {key: 'flag', label: 'Flag', text: 'true', description: false}];
  for (const view of ['cards', 'list']) assert.deepEqual(visibleRobloxFacts(display, row, view, 'collectible'), expected);
  assert.equal(visibleRobloxFacts({cardFields: ['power'], tableFields: ['power']}, {power: 1000}, 'cards', 'database', {power: 'Power'}).find(fact => fact.key === 'power').text, '1,000');
});
test('eleven sparse furs require Black Widow facts while a genuinely all-null roster has zero optional facts', () => {
  const display = {cardFields: ['rarity', 'egg', 'hatchingLocation'], tableFields: ['rarity', 'egg', 'hatchingLocation'], fieldPresentation: {hatchingLocation: {label: 'Hatch location'}}};
  const names = ['Ginger', 'Tuxedo', 'Calico', 'Tiger', 'Snow Leopard', 'Gold', 'Crystal', 'Rainbow', 'Galaxy', 'Glitch', 'Black Widow'];
  const unknown = names.map(name => ({name, description: null, rarity: null, egg: null, hatchingLocation: null}));
  const sparse = unknown.map(row => row.name === 'Black Widow' ? {...row, rarity: 'Epic', egg: 'Alien Egg', hatchingLocation: 'Circle in the lobby'} : row);
  for (const view of ['cards', 'list']) {
    const facts = sparse.map(row => visibleRobloxFacts(display, row, view, 'collectible'));
    assert.deepEqual(facts.map(row => row.length), [...Array(10).fill(0), 3]);
    assert.deepEqual(facts[10].map(({label, text}) => ({label, text})), [{label: 'Rarity', text: 'Epic'}, {label: 'Egg', text: 'Alien Egg'}, {label: 'Hatching Location', text: 'Circle in the lobby'}]);
    assert.equal(facts.flat().length, 3);
    assert.deepEqual(unknown.map(row => visibleRobloxFacts(display, row, view, 'collectible')), Array.from({length: 11}, () => []));
  }
});

const account = project => ({project, userId: `${project}-user`, sessionId: `${project}-session`, codes: ['example-items'], owner: 'selected-roblox-qa:123:1:00000000-0000-0000-0000-000000000001'});
function fakeDb(calls, fail, ownership = null) {
  return {from(table) {
    let mode; const filters = [];
    const query = {select() {mode = 'absence'; return query;}, delete() {mode = 'delete'; return query;}, eq(key, value) {filters.push([key, value]); return query;}, maybeSingle() {return Promise.resolve({error: null, data: ownership});}, then(resolve, reject) {
      const call = {table, mode, filters}; calls.push(call);
      const outcome = fail?.(call);
      if (outcome === 'returned') return Promise.resolve({error: new Error('returned database error'), data: null}).then(resolve, reject);
      if (outcome === 'remaining') return Promise.resolve({error: null, data: [{user_id: 'owned-user'}]}).then(resolve, reject);
      if (outcome) return Promise.reject(new Error('injected failure')).then(resolve, reject);
      return Promise.resolve({error: null, data: []}).then(resolve, reject);
    }}; return query;
  }};
}
test('cleanup revokes first, scopes selected progress and continues all absence reads after failure', async () => {
  for (const failedTable of ['app_sessions', 'user_checklist_progress', 'app_users']) {
    const calls = [], accounts = [account('desktop'), account('mobile')];
    const db = fakeDb(calls, call => call.mode === 'delete' && call.table === failedTable && call.filters.some(([key, value]) => key === 'user_id' && value === 'desktop-user'));
    const result = await cleanupRobloxAccounts(db, accounts);
    assert.equal(result.failures.length, 1); assert.equal(calls.length, 12);
    for (const [index, owned] of accounts.entries()) {
      const scoped = calls.slice(index * 6, index * 6 + 6);
      assert.deepEqual(scoped.map(call => `${call.mode}:${call.table}`), ['delete:app_sessions', 'delete:user_checklist_progress', 'delete:app_users', 'absence:app_sessions', 'absence:user_checklist_progress', 'absence:app_users']);
      assert.deepEqual(scoped[1].filters, [['user_id', owned.userId], ['checklist_slug', 'wiki-collection:example-items']]);
      assert.deepEqual(scoped[0].filters, [['id', owned.sessionId], ['user_id', owned.userId]]);
      assert.deepEqual(scoped[5].filters, [['user_id', owned.userId]]);
    }
  }
});
test('cleanup refuses a real user or malformed ownership record before any mutation', async () => {
  for (const [owned, user] of [[account('desktop'), {display_name: 'Real player', role: 'user'}], [{...account('desktop'), owner: ''}, null]]) {
    const calls = [], result = await cleanupRobloxAccounts(fakeDb(calls, null, user), [owned]);
    assert.equal(result.failures.length, 1); assert.deepEqual(calls, []);
  }
});
test('returned database errors and remaining owned rows fail cleanup without skipping absence reads', async () => {
  for (const outcome of ['returned', 'remaining']) {
    const calls = [];
    const db = fakeDb(calls, call => call.mode === 'absence' && call.table === 'user_checklist_progress' ? outcome : false);
    const result = await cleanupRobloxAccounts(db, [account('desktop')]);
    assert.equal(result.failures.length, 1);
    assert.equal(result.attempts.find(attempt => attempt.step === 'absence:user_checklist_progress').status, 'failed');
    assert.equal(calls.length, 6);
    assert.equal(calls.at(-1).table, 'app_users');
  }
});
