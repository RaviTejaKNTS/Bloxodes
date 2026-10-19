import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash, createHmac, randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import sharp from 'sharp';
import {assertSelectedRobloxEnvironment, cleanupRobloxAccounts, selectedRobloxImage, selectedRobloxPageCopy, selectedRobloxPlan, stable, visibleRobloxFacts} from './selected-roblox-qa-contract.mjs';
import {contentDigest} from './managed-content-receipt.mjs';
import {getFieldLabel} from '../../apps/web/src/lib/game-collections';
import {pickWikiThumbnail} from '../../apps/web/src/lib/wiki-images';

const output = 'tmp/test-reports/selected-roblox';
const runnerFile = (name: string) => path.join(process.env.RUNNER_TEMP!, `selected-roblox-${name}.json`);
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const write = (name: string, value: unknown) => { fs.mkdirSync(output, {recursive: true}); fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2)); };
const same = (expected: unknown, actual: unknown, label: string) => {
  if (JSON.stringify(stable(expected)) !== JSON.stringify(stable(actual))) throw new Error(`${label} differs from the frozen input.`);
};
function selection() {
  assertSelectedRobloxEnvironment(process.env);
  if (execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim() !== process.env.GITHUB_SHA) throw new Error('Checkout differs from the dispatched SHA.');
  const base = path.dirname(process.env.BATCH!);
  return {base, plan: selectedRobloxPlan(base, JSON.parse(fs.readFileSync(process.env.BATCH!, 'utf8')))};
}
function database() {
  assertSelectedRobloxEnvironment(process.env);
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!, {auth: {persistSession: false}, global: {fetch: (input, init) => fetch(input, {...init, signal: AbortSignal.timeout(30_000)})}});
}
// Match the existing Roblox publisher's --normalize-legacy-media policy. This
// proof rejects a mapped image the publisher would silently skip as unreadable.
async function preparedImage(file: string) {
  const original = fs.readFileSync(file), meta = await sharp(original, {animated: true}).metadata();
  let bytes = original;
  if (!['png', 'jpeg', 'webp', 'avif', 'gif'].includes(meta.format ?? '') || original.length > 1_000_000 || (meta.width ?? 0) > 960 || (meta.height ?? 0) > 960) {
    let normalized: Buffer | undefined;
    for (const dimension of [960, 800, 640]) {
      for (const quality of [82, 72, 62, 52, 42]) {
        const candidate = await sharp(original).resize({width: dimension, height: dimension, fit: 'inside', withoutEnlargement: true}).webp({quality, effort: 4}).toBuffer({resolveWithObject: true});
        if (candidate.data.length <= 1_000_000 && candidate.info.width <= 960 && candidate.info.height <= 960) { normalized = candidate.data; break; }
      }
      if (normalized) break;
    }
    if (!normalized) throw new Error('Mapped image cannot meet the runtime media policy.');
    bytes = normalized;
  }
  const metadata = await sharp(bytes, {animated: true}).metadata();
  if (!metadata.width || !metadata.height || !metadata.format) throw new Error('Invalid mapped image.');
  return {bytes, hash: hash(bytes), mime: `image/${metadata.format}`, width: metadata.width, height: metadata.height};
}
async function verify() {
  const {base, plan} = selection(), db = database();
  const state = JSON.parse(fs.readFileSync(runnerFile('state'), 'utf8'));
  same(state.digest, contentDigest(base), 'Immutable bundle digest');
  const readback: any[] = [], browser: any = {urls: plan.urls, pages: [], collections: []};
  const media = new Set<string>();
  for (const hub of plan.pages) {
    const result = await db.from('wiki_pages').select('*').eq('slug', hub.row.slug).eq('universe_id', hub.row.universe_id).single();
    if (result.error) throw result.error;
    const keys = ['slug', 'universe_id', 'title', 'seo_title', 'meta_description', 'description_md', 'tips_md'];
    for (const key of keys) same(typeof hub.row[key] === 'string' ? hub.row[key].trim() : hub.row[key], result.data[key], `Hub ${key}`);
    same(hub.row.controls_json ?? [], result.data.controls_json, 'Hub controls');
    same(true, result.data.is_published, 'Hub publication'); same(null, result.data.cover_image, 'Official hub artwork ownership');
    const universe = await db.from('roblox_universes').select('icon_url,thumbnail_urls').eq('universe_id', hub.row.universe_id).single();
    if (universe.error) throw universe.error;
    const image = pickWikiThumbnail(universe.data.thumbnail_urls);
    if (!image || !universe.data.icon_url) throw new Error('Official hub thumbnail/icon missing.');
    browser.pages.push({path: hub.path, title: result.data.title, metaDescription: result.data.meta_description, image});
    readback.push({kind: 'hub', path: hub.path, id: result.data.id, universeId: hub.row.universe_id, fieldsCompared: [...keys, 'controls_json', 'is_published', 'cover_image']});
  }
  for (const entry of plan.collections) {
    const {manifest, dataset, final} = entry, count = dataset.items.length;
    const result = await db.from('wiki_collection_pages').select('*').eq('code', final.code).eq('wiki_slug', manifest.game.slug).eq('collection_slug', manifest.collection.slug).eq('universe_id', manifest.game.universeId).single();
    if (result.error) throw result.error;
    const page = result.data;
    if (!page.is_published || !page.published_dataset_id || page.item_count !== count || page.page_type !== manifest.collection.pageType) throw new Error(`Invalid published pointer/count/type: ${final.code}`);
    const copy = selectedRobloxPageCopy(final, count, manifest.collection.sortOrder ?? 0);
    const keys = Object.keys(copy);
    for (const [key, value] of Object.entries(copy)) same(value, page[key], `${final.code}.${key}`);
    const revision = await db.from('wiki_collection_datasets').select('*').eq('id', page.published_dataset_id).eq('collection_page_id', page.id).single();
    if (revision.error) throw revision.error;
    const rows: any[] = [];
    for (let start = 0;; start += 500) {
      const part = await db.from('wiki_collection_items').select('*').eq('dataset_id', page.published_dataset_id).order('item_slug').range(start, start + 499);
      if (part.error) throw part.error;
      rows.push(...part.data); if (part.data.length < 500) break;
    }
    same(count, rows.length, 'Actual published rows'); same(count, revision.data.item_count, 'Revision count'); same(2, revision.data.schema_version, 'Revision schema');
    const expected: any[] = [], renderedItems: any[] = [];
    for (const [index, authored] of dataset.items.entries()) {
      const {name, ...fields} = authored.item;
      const item: any = {item_slug: authored.system.slug, item_name: name.trim(), section: authored.system.section.trim(), sort_order: Number.isInteger(authored.system.sortOrder) ? authored.system.sortOrder : (index + 1) * 10, fields_json: fields, image_key: null, image_mime: null, image_width: null, image_height: null, image_bytes: null, image_sha256: null};
      if (authored.system.image) {
        const prepared = await preparedImage(selectedRobloxImage(base, entry.mediaRoot, authored.system.image));
        const extension = prepared.mime === 'image/jpeg' ? 'jpg' : prepared.mime.slice('image/'.length);
        Object.assign(item, {image_key: `${manifest.game.universeId}/${manifest.collection.slug}/${item.item_slug}-${prepared.hash.slice(0, 16)}.${extension}`, image_mime: prepared.mime, image_width: prepared.width, image_height: prepared.height, image_bytes: prepared.bytes.length, image_sha256: prepared.hash});
        if (!media.has(item.image_key)) {
          const remote = await fetch(`https://media.bloxodes.com/wiki/${item.image_key}`, {redirect: 'error', signal: AbortSignal.timeout(30_000)});
          if (!remote.ok) throw new Error(`Mapped media unavailable: ${item.image_key}`);
          same(prepared.hash, hash(Buffer.from(await remote.arrayBuffer())), `Mapped public image ${item.item_slug}`); media.add(item.image_key);
        }
      }
      const saved = rows.find(row => row.item_slug === item.item_slug);
      if (!saved) throw new Error(`Published item missing: ${item.item_slug}`);
      for (const [key, value] of Object.entries(item)) same(value, saved[key], `${final.code}/${item.item_slug}.${key}`);
      expected.push(item);
      const display = dataset.meta.display;
      const statLabels = Object.fromEntries(display.tableFields.map((key: string) => [key, getFieldLabel(key)]));
      const facts = Object.fromEntries(['cards', 'list'].map(view => [view, visibleRobloxFacts(display, authored.item, view, page.page_type, statLabels)]));
      renderedItems.push({...authored, system: {...authored.system, section: item.section, sortOrder: item.sort_order}, image: item.image_key ? `https://media.bloxodes.com/wiki/${item.image_key}` : null, facts});
    }
    const meta = {...dataset.meta, runtime: {gameName: manifest.game.name, label: manifest.collection.label, pageType: manifest.collection.pageType, source: 'wiki_collection_datasets'}};
    same(meta, revision.data.meta_json, 'Runtime metadata and display');
    same(hash(JSON.stringify(stable({meta, items: expected}))), revision.data.content_hash, 'Immutable revision hash');
    // Runtime reads sort_order, item_slug order before choosing social artwork.
    const orderedItems = [...renderedItems].sort((a, b) => a.system.sortOrder - b.system.sortOrder || (a.system.slug < b.system.slug ? -1 : a.system.slug > b.system.slug ? 1 : 0));
    const socialItem = orderedItems.find(row => row.image && row.item.imageCreditUrl == null);
    browser.collections.push({path: entry.path, pageType: page.page_type, code: final.code, label: page.display_name?.trim() || manifest.collection.label, title: page.title, metaDescription: page.meta_description, image: socialItem?.image ?? page.thumb_url, count, items: renderedItems});
    readback.push({kind: 'collection', path: entry.path, pointer: page.published_dataset_id, contentHash: revision.data.content_hash, count, imageCount: expected.filter(row => row.image_key).length, acceptedMissingImages: entry.policy.acceptedMissing, copyFieldsCompared: keys, allRowsFieldsAndMediaCompared: true});
  }
  fs.writeFileSync(runnerFile('browser'), JSON.stringify(browser));
  write('readback.json', readback);
  write('development-report.json', {...state, status: 'browser-pending', dataReadback: 'passed', verifiedMediaObjects: media.size, productionReleaseReceipt: false});
}
async function prepare() {
  const {base, plan} = selection();
  const stage = process.env.BLOXODES_SELECTED_ROBLOX_STAGE === 'true';
  const state = {kind: 'selected-roblox-development-qa', sourceSha: process.env.GITHUB_SHA, sourceRef: process.env.GITHUB_REF, bundleHash: process.env.BUNDLE_HASH, digest: contentDigest(base), runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT, stageSelected: stage};
  fs.writeFileSync(runnerFile('state'), JSON.stringify(state));
  write('development-report.json', {...state, status: 'preflight-pending', productionReleaseReceipt: false});
  if (stage && plan.collections.length && ['WIKI_R2_ENDPOINT', 'WIKI_R2_ACCESS_KEY_ID', 'WIKI_R2_SECRET_ACCESS_KEY', 'WIKI_R2_BUCKET'].some(key => !process.env[key])) throw new Error('Collection staging needs all four R2 secrets on this task ref. Otherwise stage through existing protected managed QA, then select stage=false.');
  execFileSync(process.execPath, ['--import', 'tsx', 'scripts/ci/publish-content.ts', '--managed', ...(stage ? ['--stage'] : []), '--batch', process.env.BATCH!], {stdio: 'inherit', env: process.env});
  await verify();
}
async function accounts(cleanup = false) {
  // Cleanup must work even if prepare or bundle parsing failed.
  assertSelectedRobloxEnvironment(process.env);
  if (cleanup) {
    const owned = fs.existsSync(runnerFile('auth')) ? JSON.parse(fs.readFileSync(runnerFile('auth'), 'utf8')) : [];
    const {failures, attempts} = owned.length ? await cleanupRobloxAccounts(database(), owned) : {failures: [], attempts: []};
    write('fixture-cleanup.json', {status: failures.length ? 'failed' : 'passed', createdAccounts: owned.length, failures, attempts});
    const report = path.join(output, 'development-report.json');
    if (fs.existsSync(report)) {
      const value = JSON.parse(fs.readFileSync(report, 'utf8'));
      write('development-report.json', {...value, cleanup: failures.length ? 'failed' : 'passed', status: failures.length ? 'cleanup-failed' : value.status === 'browser-passed-cleanup-pending' ? 'passed' : value.status});
    }
    if (failures.length) throw new Error('Owned fixture cleanup failed; see fixture-cleanup.json.');
    return;
  }
  const {plan} = selection();
  const codes = plan.collections.filter(entry => entry.manifest.collection.pageType === 'collectible').map(entry => entry.final.code);
  if (!codes.length) return;
  const sessionSecret = process.env.AUTH_SESSION_SECRET;
  if (fs.existsSync(runnerFile('auth')) || !sessionSecret) throw new Error('Fixture ownership exists or runner signing secret is missing.');
  const db = database(), records: any[] = [];
  for (const project of ['desktop-chromium', 'mobile-chromium']) {
    const userId = randomUUID(), sessionId = randomUUID(), now = Math.floor(Date.now() / 1000), expires = now + 3600;
    const owner = `selected-roblox-qa:${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT}:${userId}`;
    // Never record a preexisting UUID as owned, even if insert later fails.
    for (const [table, key, id] of [['app_users', 'user_id', userId], ['app_sessions', 'id', sessionId]]) {
      const existing = await db.from(table).select(key).eq(key, id).maybeSingle();
      if (existing.error || existing.data) throw new Error('Generated fixture identity is not provably absent.');
    }
    const payload = Buffer.from(JSON.stringify({v: 1, sid: sessionId, uid: userId, iat: now, exp: expires})).toString('base64url');
    const token = `${payload}.${createHmac('sha256', sessionSecret).update(payload).digest('base64url')}`;
    records.push({project, userId, sessionId, codes, owner, token});
    fs.writeFileSync(runnerFile('auth'), JSON.stringify(records), {mode: 0o600}); // Durable ownership before any mutation.
    const user = await db.from('app_users').insert({user_id: userId, display_name: owner, role: 'user'}); if (user.error) throw user.error;
    const session = await db.from('app_sessions').insert({id: sessionId, user_id: userId, expires_at: new Date(expires * 1000).toISOString()}); if (session.error) throw session.error;
  }
}
async function main() {
  const mode = process.argv[2];
  if (mode === 'prepare') return prepare();
  if (mode === 'accounts') return accounts();
  if (mode === 'cleanup') return accounts(true);
  if (mode === 'complete') {
    await verify();
    const report = JSON.parse(fs.readFileSync(path.join(output, 'development-report.json'), 'utf8'));
    write('development-report.json', {...report, status: 'browser-passed-cleanup-pending', browserEvidence: 'Playwright desktop/mobile report and screenshots', productionReleaseReceipt: false}); return;
  }
  throw new Error('Use prepare, accounts, complete or cleanup.');
}
main().catch(error => {
  console.error(error.message);
  const report = path.join(output, 'development-report.json');
  if (fs.existsSync(report)) write('development-report.json', {...JSON.parse(fs.readFileSync(report, 'utf8')), status: 'failed', failedPhase: process.argv[2]});
  process.exitCode = 1;
});
