import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash, createHmac, randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import sharp from 'sharp';
import {assertSelectedQaEnvironment, assertLiveSourceEquivalent, bundleInput, cleanupOwnedAccounts, collectionVisibleFacts, selectedFranchisePlan, selectedReviewImages, stable} from './selected-franchise-qa-contract.mjs';
import {contentDigest} from './managed-content-receipt.mjs';
import {collectionImageKey} from '../shared/franchise-collection-media';
import {parseGameQuizData} from '../../apps/web/src/lib/game-page-data';
import {getFieldLabel} from '../../apps/web/src/lib/game-collections';

const output = 'tmp/test-reports/selected-franchise';
const stateFile = path.join(process.env.RUNNER_TEMP!, 'selected-franchise-state.json');
const authFile = path.join(process.env.RUNNER_TEMP!, 'selected-franchise-auth.json');
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const same = (expected: unknown, actual: unknown, label: string) => {
  if (label.endsWith('_at') && typeof expected === 'string' && typeof actual === 'string' && Date.parse(expected) === Date.parse(actual)) return;
  if (JSON.stringify(stable(expected)) !== JSON.stringify(stable(actual))) throw new Error(`${label} differs from the frozen input.`);
};
const git = (...args: string[]) => execFileSync('git', args, {encoding: 'utf8', timeout: 30_000}).trim();
const write = (name: string, value: unknown) => { fs.mkdirSync(output, {recursive: true}); fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2)); };
function selection() {
  assertSelectedQaEnvironment(process.env);
  const expected = `content/releases/${process.env.BUNDLE_HASH}/batch.json`;
  if (process.env.BATCH !== expected) throw new Error('The selected batch must be the exact downloaded immutable bundle.');
  const base = path.dirname(expected);
  return {base, plan: selectedFranchisePlan(base, JSON.parse(fs.readFileSync(expected, 'utf8')))};
}
function database() {
  assertSelectedQaEnvironment(process.env);
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!, {
    auth: {persistSession: false},
    global: {fetch: (input, init) => fetch(input, {...init, signal: AbortSignal.timeout(30_000)})}
  });
}
async function sourceProof() {
  const sha = git('rev-parse', 'HEAD');
  if (sha !== process.env.GITHUB_SHA) throw new Error('Dispatch checkout is not the exact selected head.');
  const response = await fetch('https://bloxodes.com/api/health?scope=deploy', {signal: AbortSignal.timeout(30_000)});
  const health = await response.json();
  const productionSha = health.build?.sha || health.buildSha || health.commit;
  if (!response.ok || health.ok !== true || !/^[0-9a-f]{40}$/.test(productionSha ?? '')) throw new Error('Live runtime source SHA is unavailable.');
  const changed = assertLiveSourceEquivalent(git('diff', '--name-only', productionSha, sha).split('\n').filter(Boolean));
  return {sourceSha: sha, liveProductionSha: productionSha, runtimeChangedPaths: changed, comparison: 'whole web workspace excluding AGENTS/browser tests/test-runner configs; data, shared types, all workspace package manifests, root build configs and Docker build inputs'};
}
async function preparedImage(file: string) {
  const original = fs.readFileSync(file);
  const meta = await sharp(original, {animated: true}).metadata();
  const supported = ['png', 'jpeg', 'webp', 'avif', 'gif'].includes(meta.format ?? '');
  const bytes = supported && original.length <= 1_000_000 && (meta.width ?? 0) <= 960 && (meta.height ?? 0) <= 960
    ? original : await sharp(original, {animated: true}).rotate().resize({width: 960, height: 960, fit: 'inside', withoutEnlargement: true}).webp({quality: 86}).toBuffer();
  const metadata = await sharp(bytes, {animated: true}).metadata();
  if (!metadata.width || !metadata.height || !metadata.format) throw new Error('Invalid selected item image.');
  return {bytes, hash: hash(bytes), mime: `image/${metadata.format}`, width: metadata.width, height: metadata.height};
}
async function verify() {
  const {base, plan} = selection(), db = database();
  const prior = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  same(prior.digest, contentDigest(base), 'Selected bundle digest');
  const readback: any[] = [], browser: any = {namespace: plan.namespace, urls: plan.urls, collections: [], pages: plan.pages};
  const verifiedMedia = new Set<string>();
  for (const game of plan.games) {
    const result = await db.from('games').select('*').eq('namespace', plan.namespace).eq('slug', game.slug).eq('kind', game.kind).single();
    if (result.error) throw result.error;
    for (const [key, value] of Object.entries(game)) same(value, result.data[key], `Game ${game.slug}.${key}`);
    readback.push({kind: 'game', slug: game.slug, id: result.data.id, parentId: result.data.parent_id, gameKind: result.data.kind});
  }
  for (const entry of plan.pages) {
    const table = entry.kind === 'hub' ? 'game_wiki_pages' : 'game_quiz_pages';
    const result = await db.from(table).select('*').eq('namespace', plan.namespace).eq('slug', entry.row.slug).single();
    if (result.error) throw result.error;
    for (const [key, value] of Object.entries(entry.row)) same(key === 'quiz_data' ? parseGameQuizData(value) : value, result.data[key], `${table}.${entry.row.slug}.${key}`);
    const view = await db.from(`${table}_view`).select('canonical_path').eq('namespace', plan.namespace).eq('id', result.data.id).single();
    if (view.error) throw view.error;
    same(entry.path, view.data.canonical_path, 'Page canonical path');
    readback.push({kind: entry.kind, path: entry.path, id: result.data.id, fieldsCompared: Object.keys(entry.row)});
  }
  for (const entry of plan.collections) {
    const {manifest, dataset, final} = entry;
    const result = await db.from('game_collection_pages_view').select('*').eq('namespace', plan.namespace).eq('code', final.code).single();
    if (result.error) throw result.error;
    const page = result.data;
    if (!page.is_published || page.page_type !== manifest.collection.pageType || page.item_count !== dataset.items.length || page.canonical_path !== entry.path || !page.published_dataset_id) throw new Error(`Invalid published pointer/count/type: ${final.code}`);
    const replaceCount = (value: unknown): any => typeof value === 'string' ? value.replaceAll('{count}', dataset.items.length.toLocaleString('en-US')) : Array.isArray(value) ? value.map(replaceCount) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key, replaceCount(child)])) : value;
    const copyKeys = ['title', 'display_name', 'seo_title', 'meta_description', 'intro_md', 'how_it_works_md', 'description_md', 'description_json', 'faq_json', 'schema_ld_json', 'thumb_url', 'wiki_md', 'wiki_sort_order'];
    for (const key of copyKeys) same(replaceCount(final[key] ?? (key === 'wiki_sort_order' ? manifest.collection.sortOrder ?? 0 : null)), page[key], `${final.code}.${key}`);
    const revision = await db.from('game_collection_datasets').select('*').eq('namespace', plan.namespace).eq('id', page.published_dataset_id).eq('collection_page_id', page.id).single();
    if (revision.error) throw revision.error;
    const rows: any[] = [];
    for (let start = 0;; start += 500) {
      const part = await db.from('game_collection_items').select('*').eq('namespace', plan.namespace).eq('dataset_id', page.published_dataset_id).order('item_slug').range(start, start + 499);
      if (part.error) throw part.error;
      rows.push(...part.data); if (part.data.length < 500) break;
    }
    same(dataset.items.length, rows.length, 'Published item count');
    same(dataset.items.length, revision.data.item_count, 'Revision count');
    const expected: any[] = [];
    for (const [index, authored] of dataset.items.entries()) {
      const {name, ...fields} = authored.item;
      const item: any = {item_slug: authored.system.slug, item_name: name.trim(), section: authored.system.section.trim(), sort_order: Number.isInteger(authored.system.sortOrder) ? authored.system.sortOrder : index + 1, fields_json: fields, image_key: null, image_mime: null, image_width: null, image_height: null, image_bytes: null, image_sha256: null};
      if (authored.system.image) {
        const relative = path.relative(base, path.join(entry.mediaRoot, authored.system.image.replace(/^media\//, ''))).split(path.sep).join('/');
        const image = await preparedImage(bundleInput(base, relative));
        item.image_key = collectionImageKey({namespace: plan.namespace, mediaPrefix: plan.namespace, gameSlug: manifest.game.slug, collectionSlug: manifest.collection.slug, itemSlug: item.item_slug, hash: image.hash, extension: image.mime === 'image/jpeg' ? 'jpg' : image.mime.replace('image/', '')});
        Object.assign(item, {image_mime: image.mime, image_width: image.width, image_height: image.height, image_bytes: image.bytes.length, image_sha256: image.hash});
        if (!verifiedMedia.has(item.image_key)) {
          const mediaUrl = `https://media.bloxodes.com/wiki/${item.image_key.split('/').map(encodeURIComponent).join('/')}`;
          const remote = await fetch(mediaUrl, {redirect: 'error', signal: AbortSignal.timeout(30_000)});
          if (!remote.ok) throw new Error(`Selected media unavailable: ${item.image_key}`);
          same(image.hash, hash(Buffer.from(await remote.arrayBuffer())), `Public prepared image ${item.image_key}`);
          verifiedMedia.add(item.image_key);
        }
      }
      const saved = rows.find(row => row.item_slug === item.item_slug);
      if (!saved) throw new Error(`Missing selected item: ${item.item_slug}`);
      for (const [key, value] of Object.entries(item)) same(value, saved[key], `${final.code}/${item.item_slug}.${key}`);
      expected.push(item);
    }
    const meta = {...dataset.meta, runtime: {gameName: manifest.game.name.trim(), label: manifest.collection.label.trim(), pageType: manifest.collection.pageType, namespace: plan.namespace, source: 'game_collection_datasets'}};
    same(meta, revision.data.meta_json, 'Published display fields and runtime metadata');
    same(hash(JSON.stringify(stable({meta, items: expected}))), revision.data.content_hash, 'Immutable dataset content hash');
    readback.push({kind: 'collection', path: entry.path, code: final.code, pointer: page.published_dataset_id, contentHash: revision.data.content_hash, count: rows.length, imageCount: expected.filter(row => row.image_key).length, acceptedMissingImages: entry.policy.acceptedMissing, copyFieldsCompared: copyKeys, itemFieldsAndMediaCompared: true, publicMediaBytesCompared: true});
    const reviewImages = selectedReviewImages(dataset, entry.imageEvidence);
    const display = dataset.meta.display ?? {};
    const statLabels = Object.fromEntries((display.tableFields ?? []).map((key: string) => [key, getFieldLabel(key)]));
    const visibleFacts = Object.fromEntries(['cards', 'list'].map(view => [view, collectionVisibleFacts(display, dataset.items[0].item, view, page.page_type, statLabels)]));
    browser.collections.push({path: entry.path, hubPath: entry.path.slice(0, entry.path.lastIndexOf('/')), pageType: page.page_type, count: rows.length, code: final.code, label: manifest.collection.label, items: dataset.items, display, visibleFacts, wikiCopy: final.wiki_md, imageCount: expected.filter(row => row.image_key).length, reviewImages});
  }
  write('readback.json', readback);
  // Browser state contains approved facts only. Session tokens stay in RUNNER_TEMP.
  fs.writeFileSync(path.join(process.env.RUNNER_TEMP!, 'selected-franchise-browser.json'), JSON.stringify(browser));
  write('development-report.json', {...prior, dataReadback: 'passed', verifiedPublicMediaObjects: verifiedMedia.size, status: 'browser-pending', productionReleaseReceipt: false});
}
async function prepare() {
  const {base, plan} = selection();
  const proof = await sourceProof();
  const initial = {kind: 'selected-franchise-development-qa', bundleHash: process.env.BUNDLE_HASH, digest: contentDigest(base), runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT, stageSelected: process.env.BLOXODES_SELECTED_FRANCHISE_STAGE === 'true', ...proof};
  fs.writeFileSync(stateFile, JSON.stringify(initial));
  write('development-report.json', {...initial, status: 'audits-pending', productionReleaseReceipt: false});
  for (const entry of plan.collections) {
    // Frozen files do not preserve empty directories. Never change their bytes.
    fs.mkdirSync(entry.mediaRoot, {recursive: true});
    const common = ['--game', entry.manifest.game.slug, '--collection', entry.manifest.collection.slug, '--file', entry.datasetFile];
    execFileSync('npm', ['run', 'audit:game-collection-datasets:v2', '--', ...common], {stdio: 'inherit'});
    execFileSync('npm', ['run', 'check:game-collection-data', '--', ...common, '--final-json', entry.finalFile, ...(entry.policy.requireImages ? ['--require-images'] : [])], {stdio: 'inherit'});
  }
  // Existing dryplans run for every operation before any write. Identity bundles
  // must be staged in a prior dispatch before a collection or quiz batch.
  const stageSelected = process.env.BLOXODES_SELECTED_FRANCHISE_STAGE === 'true';
  if (stageSelected && plan.collections.some(entry => entry.dataset.items.some((row: any) => row.system?.image)) && ['WIKI_R2_ENDPOINT', 'WIKI_R2_ACCESS_KEY_ID', 'WIKI_R2_SECRET_ACCESS_KEY', 'WIKI_R2_BUCKET'].some(key => !process.env[key])) throw new Error('Image staging needs four R2 secrets on the dispatch ref. Stage through protected managed-content-qa on production first, then dispatch this development QA with selected_franchise_stage=false.');
  execFileSync(process.execPath, ['--import', 'tsx', 'scripts/ci/publish-content.ts', '--managed', ...(stageSelected ? ['--stage'] : []), '--batch', process.env.BATCH!], {stdio: 'inherit', env: process.env});
  if (!stageSelected) fs.writeFileSync(path.join(process.env.RUNNER_TEMP!, 'managed-smoke.json'), JSON.stringify({urls: plan.urls}));
  await verify();
}
async function accounts(cleanup = false) {
  const finishReport = (status: string) => {
    const reportFile = path.join(output, 'development-report.json');
    if (!fs.existsSync(reportFile)) return;
    const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
    if (report.status === 'browser-passed-cleanup-pending' || status === 'cleanup-failed') write('development-report.json', {...report, status});
  };
  if (cleanup && !fs.existsSync(authFile)) { finishReport('passed'); return; }
  const db = database();
  if (cleanup) {
    const owned = JSON.parse(fs.readFileSync(authFile, 'utf8'));
    const {failures, attempts} = await cleanupOwnedAccounts(db, owned);
    write('fixture-cleanup.json', {status: failures.length ? 'failed' : 'passed', createdAccounts: owned.length, failures, attempts});
    finishReport(failures.length ? 'cleanup-failed' : 'passed');
    if (failures.length) throw new Error(failures.join('\n'));
    return;
  }
  const {plan} = selection();
  if (!plan.collections.some(entry => entry.manifest.collection.pageType === 'collectible') && !plan.pages.some(page => page.kind === 'quiz')) return;
  if (fs.existsSync(authFile)) throw new Error('Refusing to replace QA account ownership.');
  const records: any[] = [];
  for (const project of ['desktop-chromium', 'mobile-chromium']) {
    const userId = randomUUID(), sessionId = randomUUID(), now = Math.floor(Date.now() / 1000), expires = now + 3600;
    if (!process.env.AUTH_SESSION_SECRET) throw new Error('Missing runner-only session signing secret.');
    const payload = Buffer.from(JSON.stringify({v: 1, sid: sessionId, uid: userId, iat: now, exp: expires})).toString('base64url');
    const token = `${payload}.${createHmac('sha256', process.env.AUTH_SESSION_SECRET).update(payload).digest('base64url')}`;
    records.push({project, userId, sessionId, namespace: plan.namespace, token});
    fs.writeFileSync(authFile, JSON.stringify(records), {mode: 0o600}); // Cleanup ownership precedes writes.
    const user = await db.from('app_users').insert({user_id: userId, display_name: 'Selected franchise QA', role: 'user'}); if (user.error) throw user.error;
    const session = await db.from('app_sessions').insert({id: sessionId, user_id: userId, expires_at: new Date(expires * 1000).toISOString()}); if (session.error) throw session.error;
  }
}
async function main() {
  const mode = process.argv[2];
  if (mode === 'prepare') return prepare();
  if (mode === 'accounts') return accounts();
  if (mode === 'cleanup') return accounts(true);
  if (mode === 'verify') return verify();
  if (mode === 'complete') {
    await verify();
    const report = JSON.parse(fs.readFileSync(path.join(output, 'development-report.json'), 'utf8'));
    write('development-report.json', {...report, status: 'browser-passed-cleanup-pending', browserEvidence: 'Playwright desktop/mobile report and attachments', productionReleaseReceipt: false});
    return;
  }
  throw new Error('Use prepare, accounts, verify, complete or cleanup.');
}
main().catch(error => {
  console.error(error.message);
  const reportFile = path.join(output, 'development-report.json');
  if (fs.existsSync(reportFile)) write('development-report.json', {...JSON.parse(fs.readFileSync(reportFile, 'utf8')), status: 'failed', failedPhase: process.argv[2], error: error.message});
  process.exitCode = 1;
});
