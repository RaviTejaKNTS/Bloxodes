import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {assertSelectedQaEnvironment, assertLiveSourceEquivalent, cleanupOwnedAccounts, collectionVisibleFacts, MANAGED_TARGET, bundleInput, imagePolicy, selectedFranchisePlan, selectedReviewImages} from '../selected-franchise-qa-contract.mjs';

const env = () => ({GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'workflow_dispatch', BLOXODES_MANAGED_QA: 'true', BLOXODES_SELECTED_FRANCHISE_QA: 'true', BLOXODES_ENV_PROFILE: 'process-only', SUPABASE_URL: MANAGED_TARGET, NEXT_PUBLIC_SUPABASE_URL: MANAGED_TARGET, ARTICLE_DEV_SUPABASE_URL: MANAGED_TARGET, SUPABASE_MEDIA_PUBLIC_URL: MANAGED_TARGET, BUNDLE_HASH: 'a'.repeat(64), BLOXODES_VERIFIED_BUNDLE: 'a'.repeat(64), TEST_BASE_URL: 'http://bloxodes.test:3000'});
test('development dispatch rejects production, source, receipt and preview substitution', () => {
  assert.doesNotThrow(() => assertSelectedQaEnvironment(env()));
  for (const [key, value] of Object.entries({GITHUB_ACTIONS: 'false', GITHUB_EVENT_NAME: 'pull_request', BLOXODES_MANAGED_QA: '', BLOXODES_SELECTED_FRANCHISE_QA: '', BLOXODES_ENV_PROFILE: 'production-preview', SUPABASE_URL: 'https://database.bloxodes.com', NEXT_PUBLIC_SUPABASE_URL: 'https://database.bloxodes.com', ARTICLE_DEV_SUPABASE_URL: 'https://other.supabase.co', SUPABASE_MEDIA_PUBLIC_URL: 'https://media.bloxodes.com', BLOXODES_VERIFIED_BUNDLE: 'b'.repeat(64), TEST_BASE_URL: 'https://bloxodes.com', BLOXODES_CONTENT_RELEASE: 'true', BLOXODES_MANAGED_RECEIPT: 'receipt.json', BLOXODES_APPROVED_SHA: 'c'.repeat(40), REVALIDATE_SECRET: 'unexpected', NODE_ENV: 'production'})) assert.throws(() => assertSelectedQaEnvironment({...env(), [key]: value}), undefined, key);
});
test('image exceptions must match every missing row exactly', () => {
  const document = {items: [{system: {slug: 'with-image', image: 'media/a.png'}}, {system: {slug: 'missing-one'}}, {system: {slug: 'missing-two'}}]};
  const acceptedGaps = ['missing-one', 'missing-two'].map(systemSlug => ({systemSlug, status: 'text-only/accepted missing', decisionReason: 'Explicitly approved text-only row.'}));
  const evidence = {acceptedGapCount: 2, acceptedGaps};
  assert.deepEqual(imagePolicy(document, evidence), {requireImages: false, acceptedMissing: ['missing-one', 'missing-two']});
  assert.deepEqual(imagePolicy({items: [document.items[0]]}, null), {requireImages: true, acceptedMissing: []});
  for (const value of [null, {...evidence, acceptedGapCount: 1}, {...evidence, acceptedGaps: [acceptedGaps[0]]}, {...evidence, acceptedGaps: [acceptedGaps[0], acceptedGaps[0]]}, {...evidence, acceptedGaps: [...acceptedGaps.slice(0, 1), {...acceptedGaps[1], systemSlug: 'unapproved'}]}, {...evidence, acceptedGaps: acceptedGaps.map(gap => ({...gap, decisionReason: ''}))}]) assert.throws(() => imagePolicy(document, value));
});
test('bundle inputs reject traversal and symlinks including nonexistent children', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'selected-qa-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'selected-outside-'));
  try {
    fs.writeFileSync(path.join(root, 'approved.json'), '{}');
    fs.symlinkSync(outside, path.join(root, 'escape'));
    assert.equal(bundleInput(root, 'approved.json'), path.join(root, 'approved.json'));
    for (const value of ['../outside.json', '/etc/passwd', 'x/../../outside.json', 'x\\outside.json', 'escape/not-created/media']) assert.throws(() => bundleInput(root, value, {optional: true}));
  } finally { fs.rmSync(root, {recursive: true, force: true}); fs.rmSync(outside, {recursive: true, force: true}); }
});
test('selection binds publisher, namespace, payload groups and exact public paths', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'selected-plan-'));
  const payload = {wiki: [{namespace: 'example', slug: 'example', title: 'Example', game_id: 'c0e2c719-0933-4f08-bb8e-738fe4c144b6', is_published: true}]};
  const batch = {version: 1, operations: [{publisher: 'game-pages', namespace: 'example', file: 'pages.json'}], urls: [{path: '/example/wiki', contains: 'Example'}], events: [{type: 'game_content', slug: 'example'}]};
  try {
    fs.writeFileSync(path.join(root, 'pages.json'), JSON.stringify(payload));
    assert.equal(selectedFranchisePlan(root, batch).pages[0].path, '/example/wiki');
    for (const mutation of [
      {...batch, operations: [{...batch.operations[0], publisher: 'content-final'}]},
      {...batch, operations: [{...batch.operations[0], namespace: 'other'}]},
      {...batch, urls: [{path: '/example/wiki/unapproved', contains: 'Extra'}]},
      {...batch, events: [{type: 'wiki', slug: 'example'}]}
    ]) assert.throws(() => selectedFranchisePlan(root, mutation));
    fs.writeFileSync(path.join(root, 'pages.json'), JSON.stringify({...payload, checklists: [{}]}));
    assert.throws(() => selectedFranchisePlan(root, batch), /Only selected/);
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
});

test('two selected pages require exactly one URL for each path, in either order', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'selected-inventory-'));
  const urls = [{path: '/example/wiki', contains: 'Example'}, {path: '/example/wiki/world', contains: 'World'}];
  const batch = {version: 1, operations: [{publisher: 'game-pages', namespace: 'example', file: 'pages.json'}], urls, events: [{type: 'game_content', slug: 'example'}]};
  try {
    fs.writeFileSync(path.join(root, 'pages.json'), JSON.stringify({wiki: [
      {slug: 'example', title: 'Example', is_published: true}, {slug: 'world', title: 'World', is_published: true}
    ]}));
    assert.deepEqual(selectedFranchisePlan(root, {...batch, urls: [...urls].reverse()}).urls, [...urls].reverse());
    for (const replacement of [[urls[0], urls[0]], [urls[1], urls[1]], [urls[0]], [...urls, urls[0]], [urls[0], {path: '/example/wiki/extra', contains: 'Extra'}]]) {
      assert.throws(() => selectedFranchisePlan(root, {...batch, urls: replacement}), /exactly match/);
    }
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
});

// Frozen first-row regression facts from the approved Mario Kart World inputs.
test('first Tracks card keeps boolean, badge, array subtitle and description facts', () => {
  const display = {
    cardFields: ['snesHostCourse', 'raceModes', 'freeRoamAccess', 'balloonBattleArena', 'updateIntroduced', 'rallySelectionUnlock'],
    tableFields: ['entryType', 'grandPrixCups', 'cupLayoutNote', 'snesHostCourse', 'raceModes', 'freeRoamAccess', 'balloonBattleArena', 'rallyAppearances', 'updateIntroduced', 'rallySelectionUnlock', 'rallyRoute'],
    badgeField: 'entryType', subtitleFields: ['grandPrixCups'], descriptionField: 'cardSummary', cardDescriptionField: 'cardSummary',
    fieldPresentation: {entryType: {kind: 'chip', label: 'Entry type'}, grandPrixCups: {kind: 'chip', label: 'Grand Prix cup(s)'}, balloonBattleArena: {kind: 'highlight', label: 'Balloon Battle arena'}, rallyAppearances: {kind: 'normal', label: 'Knockout Tour rallies'}}
  };
  const row = {name: 'Mario Bros. Circuit', cardSummary: 'Knockout Tour rallies: Golden, Cloud, Boomerang.', entryType: 'Grand Prix course', grandPrixCups: ['Mushroom Cup'], cupLayoutNote: null, snesHostCourse: null, raceModes: null, freeRoamAccess: null, balloonBattleArena: true, rallyAppearances: ['Golden', 'Cloud', 'Boomerang'], updateIntroduced: null, rallySelectionUnlock: null, rallyRoute: null};
  assert.deepEqual(collectionVisibleFacts(display, row, 'cards', 'database'), [
    {key: 'entryType', label: 'Entry type', text: 'Grand Prix course', description: false},
    {key: 'grandPrixCups', label: 'Grand Prix cup(s)', text: 'Mushroom Cup', description: false},
    {key: 'balloonBattleArena', label: 'Balloon Battle arena', text: 'Yes', description: false},
    {key: 'cardSummary', label: 'Description', text: row.cardSummary, description: true}
  ]);
  assert.equal(collectionVisibleFacts(display, row, 'list', 'database').find(fact => fact.key === 'rallyAppearances').text, 'Golden; Cloud; Boomerang');
  assert.equal(collectionVisibleFacts(display, {...row, balloonBattleArena: false}, 'cards', 'database').find(fact => fact.key === 'balloonBattleArena').text, 'No');
  assert.deepEqual(collectionVisibleFacts({cardFields: ['name', 'id', 'slug', 'image', 'empty', 'url']}, {name: 'Identity alone', id: 7, slug: 'identity', image: 'media/a.png', empty: null, url: 'https://example.com'}, 'cards', 'database'), []);
});

test('Vehicles lists assert individual table stats rather than card summary fields', () => {
  const display = {cardFields: ['surfaceSpeedLevels', 'acceleration', 'surfaceHandlingLevels', 'weight', 'statVersion'], tableFields: ['vehicleType', 'unlockStatus', 'statVersion', 'roadSpeed', 'offroadSpeed', 'waterSpeed', 'glidingSpeed', 'acceleration', 'roadHandling', 'offroadHandling', 'waterHandling', 'weight'], badgeField: 'unlockStatus', subtitleFields: ['vehicleType'], descriptionField: null, cardDescriptionField: null, fieldPresentation: {unlockStatus: {kind: 'highlight', label: 'Unlock'}, vehicleType: {kind: 'chip', label: 'Type'}, roadSpeed: {kind: 'chip', label: 'Road speed level'}, glidingSpeed: {kind: 'chip', label: 'Gliding level (0 = base speed)'}}};
  const row = {name: 'B Dasher', vehicleType: 'Karts', unlockStatus: 'Unlock with coins', roadSpeed: 8, offroadSpeed: 4, waterSpeed: 4, glidingSpeed: 0, surfaceSpeedLevels: 'Road 8 · Off-road 4 · Water 4 · Gliding base', acceleration: 4, roadHandling: 9, offroadHandling: 4, waterHandling: 4, surfaceHandlingLevels: 'Road 9 · Off-road 4 · Water 4', weight: 3, statVersion: '1.7.0'};
  const cards = collectionVisibleFacts(display, row, 'cards', 'database'), list = collectionVisibleFacts(display, row, 'list', 'database');
  assert.equal(cards.find(fact => fact.key === 'surfaceSpeedLevels').text, row.surfaceSpeedLevels);
  assert.equal(cards.find(fact => fact.key === 'surfaceHandlingLevels').text, row.surfaceHandlingLevels);
  assert.ok(!cards.some(fact => fact.key === 'roadSpeed'));
  assert.deepEqual(list.map(fact => fact.key), ['unlockStatus', 'vehicleType', 'statVersion', 'roadSpeed', 'offroadSpeed', 'waterSpeed', 'glidingSpeed', 'acceleration', 'roadHandling', 'offroadHandling', 'waterHandling', 'weight']);
  assert.deepEqual(list.find(fact => fact.key === 'glidingSpeed'), {key: 'glidingSpeed', label: 'Gliding level (0 = base speed)', text: '0', description: false});
  assert.equal(list.find(fact => fact.key === 'roadSpeed').text, '8');
});

test('collectible Cards/List preserve their shared configured facts and boolean spelling', () => {
  const display = {cardFields: ['nearbyCourse', 'approach', 'tip'], tableFields: ['nearbyCourse', 'location', 'approach', 'tip'], subtitleFields: ['nearbyCourse'], descriptionField: 'location', cardDescriptionField: 'location', fieldPresentation: {nearbyCourse: {kind: 'chip', label: 'Nearby course'}}};
  const row = {name: 'Take to the skies high above Peach Stadium!', nearbyCourse: 'Peach Stadium', location: 'Beneath the raised castle track in the center of Peach Stadium.', approach: null, tip: null};
  const expected = [{key: 'nearbyCourse', label: 'Nearby course', text: 'Peach Stadium', description: false}, {key: 'location', label: 'Location', text: row.location, description: false}];
  assert.deepEqual(collectionVisibleFacts(display, row, 'cards', 'collectible'), expected);
  assert.deepEqual(collectionVisibleFacts(display, row, 'list', 'collectible'), expected);
  assert.equal(collectionVisibleFacts({cardFields: ['flag']}, {flag: true}, 'list', 'collectible')[0].text, 'true');
});

test('view labels follow status presentation, shared stat labels and primary description headers', () => {
  const display = {cardFields: ['character', 'outfitName', 'availability'], tableFields: ['character', 'outfitName', 'availability'], badgeField: 'availability', subtitleFields: [], descriptionField: null, cardDescriptionField: null, fieldPresentation: {character: {kind: 'normal'}, outfitName: {kind: 'normal'}, availability: {kind: 'highlight'}}};
  const row = {name: 'Mario (Default)', character: 'Mario', outfitName: 'Default', availability: 'Default appearance'};
  const labels = {character: 'character', outfitName: 'Outfit Name', availability: 'availability'};
  const cards = collectionVisibleFacts(display, row, 'cards', 'database', labels), list = collectionVisibleFacts(display, row, 'list', 'database', labels);
  assert.deepEqual(cards.map(fact => fact.label), ['Status', 'character', 'Outfit Name']);
  assert.deepEqual(list.map(fact => fact.label), ['Availability', 'character', 'Outfit Name']);
  const description = {cardFields: [], tableFields: ['unlockCondition'], descriptionField: 'unlockCondition', cardDescriptionField: 'unlockCondition', fieldPresentation: {unlockCondition: {kind: 'detail', label: 'Unlock condition'}}};
  assert.deepEqual(collectionVisibleFacts(description, {unlockCondition: 'Available from the start.'}, 'list', 'database'), [{key: 'unlockCondition', label: 'Unlock Condition', text: 'Available from the start.', description: true}]);
  const booleanDisplay = {cardFields: ['hasShield'], tableFields: ['hasShield']};
  assert.deepEqual(collectionVisibleFacts(booleanDisplay, {hasShield: false}, 'cards', 'database'), [{key: 'hasShield', label: 'Status', text: 'No shield', description: false}]);
  assert.equal(collectionVisibleFacts(booleanDisplay, {hasShield: false}, 'list', 'database')[0].label, 'Has Shield');
});

test('visual targets include exact default outfit, character and all four transparent maps', () => {
  const row = (slug, name, image = `media/${slug}.png`) => ({system: {slug, image}, item: {name}});
  const dataset = (collection, items) => ({meta: {gameSlug: 'mario-kart-world', collection}, items});
  assert.deepEqual(selectedReviewImages(dataset('outfits', [row('mario-default', 'Mario (Default)'), row('donkey-kong-default', 'Donkey Kong (Default)'), row('donkey-kong-all-terrain', 'Donkey Kong (All-Terrain)')]), {items: []}), ['Donkey Kong (Default)']);
  assert.deepEqual(selectedReviewImages(dataset('characters', [row('donkey-kong', 'Donkey Kong')]), null), ['Donkey Kong']);
  const maps = [['crown-city', 'Crown City'], ['peach-stadium', 'Peach Stadium'], ['peach-beach', 'Peach Beach'], ['cheep-cheep-falls', 'Cheep Cheep Falls']];
  const evidence = {items: maps.map(([, name]) => ({name, visualReview: 'White route on transparent background; contrast must be reviewed in GitHub screenshots.'}))};
  assert.deepEqual(selectedReviewImages(dataset('tracks', [row('mario-bros-circuit', 'Mario Bros. Circuit'), ...maps.map(([slug, name]) => row(slug, name))]), evidence), maps.map(([, name]) => name));
  assert.deepEqual(selectedReviewImages(dataset('outfits', [row('donkey-kong-default', 'Donkey Kong (Default)', null)]), null), []);
});

test('live-source proof rejects Tailwind, workspace package and new web build inputs', () => {
  for (const file of ['apps/web/tailwind.config.ts', 'apps/web/package.json', 'apps/web/new-build.config.mjs', 'apps/web/src/app/page.tsx', 'apps/web/public/map.png', 'apps/web/next.config.js', 'apps/web/postcss.config.js', 'apps/web/tsconfig.json', 'apps/mobile/package.json', 'types/shared.d.ts', 'data/example.json', 'package-lock.json', 'Dockerfile', '.dockerignore', 'scripts/ops/run-with-production-build-env.mjs']) {
    assert.throws(() => assertLiveSourceEquivalent([file]), /Preview runtime differs/, file);
  }
  assert.deepEqual(assertLiveSourceEquivalent(['apps/web/e2e/managed-franchise-content.spec.ts', 'apps/web/vitest.config.ts', 'apps/web/src/app/AGENTS.md', 'scripts/ci/selected-franchise-qa.ts', '.github/workflows/pull-request.yml', 'dev-docs/operations/deployment.md']), []);
});

test('cleanup attempts all owned deletes and absence reads after returned or thrown errors', async () => {
  const accounts = ['desktop', 'mobile'].map(project => ({project, namespace: 'example', userId: `${project}-user`, sessionId: `${project}-session`}));
  for (const failedStep of ['delete:game_collection_progress', 'delete:game_quiz_progress', 'delete:app_sessions', 'delete:app_users', 'absence:game_collection_progress', 'absence:app_users']) for (const rejects of [false, true]) {
    const calls = [];
    const db = {from(table) {
      let mode;
      const filters = [];
      const query = {delete() {mode = 'delete'; return query;}, select() {mode = 'absence'; return query;}, eq(key, value) {filters.push([key, value]); return query;}, then(resolve, reject) {
        calls.push({step: `${mode}:${table}`, filters});
        if (`${mode}:${table}` === failedStep && filters.some(([key, value]) => key === 'user_id' && value === 'desktop-user')) {
          const error = new Error('injected cleanup failure');
          return rejects ? Promise.reject(error).then(resolve, reject) : Promise.resolve({error}).then(resolve, reject);
        }
        return Promise.resolve({error: null, data: []}).then(resolve, reject);
      }};
      return query;
    }};
    const result = await cleanupOwnedAccounts(db, accounts);
    assert.equal(result.failures.length, 1);
    assert.match(result.failures[0], /injected cleanup failure/);
    assert.equal(result.attempts.filter(attempt => attempt.status === 'failed').length, 1);
    assert.equal(calls.length, 16);
    for (const [index, account] of accounts.entries()) {
      const operations = calls.slice(index * 8, index * 8 + 8);
      assert.deepEqual(operations.map(call => call.step), ['delete:game_collection_progress', 'delete:game_quiz_progress', 'delete:app_sessions', 'delete:app_users', 'absence:game_collection_progress', 'absence:game_quiz_progress', 'absence:app_sessions', 'absence:app_users']);
      for (const call of operations) assert.deepEqual(call.filters, call.step.endsWith('app_sessions') ? [['id', account.sessionId], ['user_id', account.userId]] : call.step.endsWith('app_users') ? [['user_id', account.userId]] : [['namespace', account.namespace], ['user_id', account.userId]]);
    }
  }
});

test('cleanup records a remaining owned account and still completes other absence reads', async () => {
  const db = {from(table) {
    let read = false;
    const query = {delete() {return query;}, select() {read = true; return query;}, eq() {return query;}, then(resolve, reject) {return Promise.resolve({error: null, data: read && table === 'app_users' ? [{user_id: 'owned-user'}] : []}).then(resolve, reject);}};
    return query;
  }};
  const result = await cleanupOwnedAccounts(db, [{project: 'desktop', namespace: 'example', userId: 'owned-user', sessionId: 'owned-session'}]);
  assert.equal(result.attempts.length, 8);
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0], /absence:app_users/);
});
