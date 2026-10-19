/** GitHub-only readback of an already-staged immutable Roblox bundle.
 * Only accounts/cleanup mutate managed development: isolated app users, sessions,
 * and their selected wiki-collection progress. No publishers run in write mode.
 */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash, createHmac, randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import sharp from 'sharp';
import {parseBatch, ownedPath} from './content-contract.mjs';
import {decodeBundle, extractBundle} from './content-bundle.mjs';
import {contentDigest} from './managed-content-receipt.mjs';
import {bundleInput, collectionVisibleFacts, stable, MANAGED_TARGET} from './selected-franchise-qa-contract.mjs';
import {getFieldLabel} from '../../apps/web/src/lib/game-collections';
import {pickWikiThumbnail} from '../../apps/web/src/lib/wiki-images';
import {markdownToPlainText} from '../../apps/web/src/lib/markdown';

class QaFailure extends Error {}
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const json = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const output = 'tmp/test-reports/selected-roblox';
const privateFile = (name: string) => path.join(process.env.RUNNER_TEMP!, `selected-roblox-${name}.json`);
const write = (name: string, value: unknown) => { fs.mkdirSync(output, {recursive: true}); fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2)); };
const same = (expected: unknown, actual: unknown, label: string) => {
  if (JSON.stringify(stable(expected)) !== JSON.stringify(stable(actual))) throw new QaFailure(`${label} differs from frozen inputs.`);
};
export function assertEnvironment(env: NodeJS.ProcessEnv, downloaded = true) {
  if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || env.BLOXODES_MANAGED_QA !== 'true' || env.BLOXODES_SELECTED_ROBLOX_QA !== 'true' || env.BLOXODES_ENV_PROFILE !== 'process-only' || !env.RUNNER_TEMP || !env.GITHUB_RUN_ID || !env.GITHUB_RUN_ATTEMPT) throw new QaFailure('Selected Roblox QA requires explicit GitHub development dispatch.');
  for (const key of ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'ARTICLE_DEV_SUPABASE_URL', 'SUPABASE_MEDIA_PUBLIC_URL']) if (env[key] !== MANAGED_TARGET) throw new QaFailure(`Unexpected managed target: ${key}`);
  if (env.TEST_BASE_URL !== 'http://bloxodes.test:3000' || env.NODE_ENV === 'production' || ['BLOXODES_CONTENT_RELEASE', 'BLOXODES_MANAGED_RECEIPT', 'BLOXODES_APPROVED_SHA', 'REVALIDATE_SECRET', 'BLOXODES_SELECTED_FRANCHISE_STAGE'].some(key => env[key])) throw new QaFailure('Production/staging inputs cannot enter selected Roblox QA.');
  if (!/^[0-9a-f]{64}$/.test(env.BUNDLE_HASH ?? '') || downloaded && (env.BLOXODES_VERIFIED_BUNDLE !== env.BUNDLE_HASH || env.BATCH !== `content/releases/${env.BUNDLE_HASH}/batch.json`)) throw new QaFailure('Select the exact downloaded immutable bundle.');
}
const slug = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
export function selectedImageInput(base: string, mediaRoot: string, value: unknown) {
  if (typeof value !== 'string' || /^https?:\/\//i.test(value) || value.includes('\\')) throw new QaFailure('Selected images must be local bundle files.');
  // Match the Roblox publisher without changing the frozen dataset strings.
  const decoded = decodeURIComponent(value.split(/[?#]/, 1)[0]).replace(/^\/+/, '');
  const absolute = path.resolve(mediaRoot, decoded), relative = path.relative(mediaRoot, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || decoded.includes('\\')) throw new QaFailure('Image escapes the selected media root.');
  // Canonical resolution still goes through existence and symlink guards.
  return bundleInput(base, path.relative(path.resolve(base), absolute).split(path.sep).join('/'));
}

const CHECKLIST_FIELDS = ['region', 'location', 'landmark', 'access', 'requirements', 'reward', 'coordinates', 'approach', 'vehicle', 'environment', 'animalForm', 'notes'];
const CHECKLIST_LABELS: Record<string, string> = {
  collectionOrder: 'Order', region: 'Region', area: 'Area', nearestLandmark: 'Nearest landmark', exactSpot: 'Exact spot', accessNotes: 'Access', cardSummary: 'Summary', location: 'Location', landmark: 'Landmark', access: 'Access', requirements: 'Requirements', reward: 'Reward', coordinates: 'Coordinates', approach: 'Approach', vehicle: 'Recommended vehicle', environment: 'Environment', animalForm: 'Animal form', notes: 'Notes'
};
const checklistHumanize = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, letter => letter.toUpperCase());
function checklistText(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(checklistText).filter(Boolean).join('; ');
  if (typeof value === 'object') return Object.entries(value).map(([key, entry]) => `${checklistHumanize(key)}: ${checklistText(entry)}`).filter(entry => !entry.endsWith(': ')).join('; ');
  return String(value).replace(/\s+/g, ' ').trim();
}
/** Roblox passes cardFields, never database fieldPresentation, to CollectionChecklist. */
export function robloxCollectibleFacts(display: {cardFields?: string[] | null}, item: Record<string, unknown>) {
  const keys = display.cardFields?.length ? display.cardFields : CHECKLIST_FIELDS;
  const facts = [...new Set(keys)].flatMap(key => {
    const text = checklistText(item[key]);
    if (!text) return [];
    return [{key, label: CHECKLIST_LABELS[key] ?? checklistHumanize(key), text, description: false}];
  });
  return {cards: facts, list: facts};
}

// Mirror only the pure metadata values from apps/web/src/lib/seo.ts here.
// Importing that module loads Next's global types into the scripts CI program.
const QA_WIKI_DESCRIPTION = 'Roblox wiki hubs with live universe stats, codes, tools, catalog links, controls, tips, and gameplay notes.';
function resolveQaSeoTitle(template?: string | null, now = new Date()): string | null {
  if (!template) return null;
  const trimmed = template.trim();
  if (!trimmed) return null;
  const month = new Intl.DateTimeFormat('en-US', {month: 'long'}).format(now);
  const year = String(now.getFullYear());
  return trimmed.replace(/%([a-z]+)%/gi, (match, token) => {
    switch (token.toLowerCase()) {
      case 'month': return month;
      case 'year': return year;
      default: return match;
    }
  });
}
type MetadataInput = {title: string; seo_title?: string | null; meta_description?: string | null; description_md?: string | null};
export function robloxMetadata(final: MetadataInput, route: string, kind: 'hub' | 'database' | 'collectible', currentPage = 1, now = new Date()) {
  const normalizeDescription = (value?: string | null) => {
    if (!value) return null;
    const plain = markdownToPlainText(value).replace(/\s+/g, ' ').trim();
    if (!plain) return null;
    if (plain.length <= 180) return plain;
    const slice = plain.slice(0, 177), lastSpace = slice.lastIndexOf(' ');
    return `${lastSpace > 130 ? slice.slice(0, lastSpace) : slice}…`;
  };
  const title = resolveQaSeoTitle(final.seo_title, now) ?? final.title;
  const description = kind === 'hub' ? normalizeDescription(final.meta_description) ?? normalizeDescription(final.description_md) ?? QA_WIKI_DESCRIPTION : final.meta_description ?? QA_WIKI_DESCRIPTION;
  const paginated = kind === 'database' && currentPage > 1;
  return {
    title: paginated ? `${title} - Page ${currentPage}` : title,
    heading: paginated ? `${final.title} - Page ${currentPage}` : final.title,
    description: paginated ? `${description} Page ${currentPage}.` : description,
    canonical: `https://bloxodes.com${route}${paginated ? `/page/${currentPage}` : ''}`
  };
}
export function selectedPlan(base: string, input: unknown) {
  const batch: {operations: Array<{publisher: string; file: string}>; urls: Array<{path: string; contains: string}>; events: Array<{type: string; slug: string}>} = parseBatch(input);
  const collections: any[] = [], hubs: any[] = [];
  if (!batch.operations.length) throw new QaFailure('Select explicit Roblox operations.');
  for (const operation of batch.operations) {
    if (!['roblox-wiki', 'roblox-collection'].includes(operation.publisher) || Object.keys(operation).some(key => !['publisher', 'file'].includes(key))) throw new QaFailure('Only exact Roblox wiki/collection files are supported.');
    const file = bundleInput(base, operation.file), payload = json(file);
    if (operation.publisher === 'roblox-wiki') {
      if (!slug(payload.slug) || !Number.isSafeInteger(payload.universe_id) || payload.universe_id <= 0 || payload.is_published === false || payload.cover_image != null) throw new QaFailure('Invalid selected hub identity or artwork override.');
      for (const key of ['title', 'seo_title', 'meta_description', 'description_md', 'tips_md']) if (typeof payload[key] === 'string') payload[key] = payload[key].trim();
      hubs.push({path: `/wiki/${payload.slug}`, final: payload});
      continue;
    }
    const manifest = payload, root = path.posix.dirname(operation.file);
    const resolve = (relative: string, directory = false) => {
      ownedPath('manifest', relative);
      return bundleInput(base, root === '.' ? relative : `${root}/${relative}`, {directory});
    };
    if (manifest.schemaVersion !== 1 || manifest.namespace !== undefined || !slug(manifest.game?.slug) || !Number.isSafeInteger(manifest.game?.universeId) || manifest.game.universeId <= 0 || !manifest.game.name?.trim() || !slug(manifest.collection?.slug) || !manifest.collection.label?.trim() || !['database', 'collectible'].includes(manifest.collection.pageType)) throw new QaFailure('Invalid explicit Roblox collection manifest.');
    const datasetFile = resolve(manifest.dataset), finalFile = resolve(manifest.finalJson), mediaRoot = resolve(manifest.mediaRoot, true);
    const dataset = json(datasetFile), final = json(finalFile), route = `/wiki/${manifest.game.slug}/${manifest.collection.slug}`;
    if (manifest.route !== undefined && manifest.route !== route || dataset.meta?.schemaVersion !== 2 || (dataset.meta.gameSlug !== undefined && dataset.meta.gameSlug !== manifest.game.slug) || (dataset.meta.collection !== undefined && dataset.meta.collection !== manifest.collection.slug) || !Array.isArray(dataset.items) || !dataset.items.length || dataset.items.length > 10000 || final.code !== `${manifest.game.slug}-${manifest.collection.slug}` || (final.wiki_slug !== undefined && final.wiki_slug !== manifest.game.slug) || (final.collection_slug !== undefined && final.collection_slug !== manifest.collection.slug)) throw new QaFailure('Manifest, dataset, final and route must agree.');
    const seen = new Set();
    for (const row of dataset.items) {
      if (!slug(row.system?.slug) || seen.has(row.system.slug) || !row.system.section?.trim() || !row.item?.name?.trim()) throw new QaFailure('Selected items need unique stable slugs, names and sections.');
      seen.add(row.system.slug);
      if (row.system.image) {
        selectedImageInput(base, mediaRoot, row.system.image);
      }
    }
    if (!dataset.meta.display || manifest.collection.pageType === 'database' && (!dataset.meta.display.cardFields?.length || !dataset.meta.display.tableFields?.length)) throw new QaFailure('Selected database QA requires explicit v2 card/list display fields.');
    collections.push({path: route, manifestFile: file, manifest, dataset, datasetFile, final, finalFile});
  }
  const paths = [...hubs, ...collections].map(entry => entry.path);
  if (new Set(paths).size !== paths.length || batch.urls.length !== paths.length || new Set(batch.urls.map(url => url.path)).size !== paths.length || batch.urls.some(url => !paths.includes(url.path))) throw new QaFailure('URLs must exactly match selected pages.');
  const events = new Set([...hubs.map(hub => `wiki:${hub.final.slug}`), ...collections.map(entry => `wiki_collection:${entry.manifest.game.slug}/${entry.manifest.collection.slug}`)]);
  if (batch.events.some(event => !events.has(`${event.type}:${event.slug}`))) throw new QaFailure('Events must refer only to selected Roblox pages.');
  return {hubs, collections, urls: batch.urls};
}
function selection() {
  assertEnvironment(process.env);
  const base = path.dirname(process.env.BATCH!);
  return {base, plan: selectedPlan(base, json(process.env.BATCH!))};
}
function database(downloaded = true) {
  assertEnvironment(process.env, downloaded);
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!, {auth: {persistSession: false}, global: {fetch: (input, init) => fetch(input, {...init, signal: AbortSignal.timeout(30_000)})}});
}
const result = async (query: PromiseLike<any>) => { const response = await query; if (response.error) throw new QaFailure('Managed QA database operation failed.'); return response.data; };
const resolveCount = (value: any, count: number): any => typeof value === 'string' ? value.replaceAll('{count}', count.toLocaleString('en-US')) : Array.isArray(value) ? value.map(child => resolveCount(child, count)) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key, resolveCount(child, count)])) : value;
async function verify() {
  const {base, plan} = selection(), db = database(), state = json(privateFile('state'));
  same(state.digest, contentDigest(base), 'Frozen bundle digest');
  const readback: any[] = [], browser: any = {urls: plan.urls, collections: [], hubs: []}, media = new Set<string>();
  for (const hub of plan.hubs) {
    const row = await result(db.from('wiki_pages').select('*').eq('slug', hub.final.slug).single());
    for (const key of ['slug', 'universe_id', 'title', 'seo_title', 'meta_description', 'description_md', 'tips_md']) same(hub.final[key], row[key], `Hub ${key}`);
    same(hub.final.controls_json ?? [], row.controls_json, 'Hub controls');
    same(null, row.cover_image, 'Hub cover override'); same(true, row.is_published, 'Hub publication');
    const universe = await result(db.from('roblox_universes').select('icon_url,thumbnail_urls').eq('universe_id', row.universe_id).single());
    const thumb = pickWikiThumbnail(universe.thumbnail_urls);
    if (!thumb || !universe.icon_url || thumb === universe.icon_url) throw new QaFailure('Hub requires distinct official icon and thumbnail.');
    for (const [url, width, height] of [[universe.icon_url, 512, 512], [thumb, 768, 432]] as const) {
      if (!url.startsWith('https://')) throw new QaFailure('Official artwork must be hosted over HTTPS.');
      const response = await fetch(url, {redirect: 'error', signal: AbortSignal.timeout(30_000)});
      if (!response.ok) throw new QaFailure('Official hub artwork is unavailable.');
      const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
      same(width, metadata.width, 'Official artwork width'); same(height, metadata.height, 'Official artwork height');
    }
    browser.hubs.push({...hub, icon: universe.icon_url, thumb});
    readback.push({path: hub.path, fieldsCompared: Object.keys(hub.final), officialArtwork: {icon: universe.icon_url, thumb}});
  }
  for (const entry of plan.collections) {
    const {manifest, dataset, final} = entry;
    const page = await result(db.from('wiki_collection_pages_view').select('*').eq('code', final.code).single());
    const identity = {code: final.code, wiki_slug: manifest.game.slug, collection_slug: manifest.collection.slug, universe_id: manifest.game.universeId, page_type: manifest.collection.pageType, item_count: dataset.items.length, is_published: true};
    for (const [key, value] of Object.entries(identity)) same(value, page[key], `${final.code}.${key}`);
    if (!page.published_dataset_id) throw new QaFailure('Missing staged revision pointer.');
    const copy = resolveCount(final, dataset.items.length);
    for (const key of ['intro_md', 'how_it_works_md', 'description_md', 'wiki_md']) if (typeof copy[key] !== 'string') copy[key] = null;
    copy.schema_ld_json = copy.schema_ld_json && typeof copy.schema_ld_json === 'object' ? copy.schema_ld_json : null;
    copy.thumb_url = typeof copy.thumb_url === 'string' && copy.thumb_url.trim() ? copy.thumb_url : null;
    copy.wiki_sort_order = Number.isFinite(copy.wiki_sort_order) ? Number(copy.wiki_sort_order) : manifest.collection.sortOrder ?? 0;
    const copyKeys = ['title', 'display_name', 'seo_title', 'meta_description', 'intro_md', 'how_it_works_md', 'description_md', 'description_json', 'faq_json', 'schema_ld_json', 'thumb_url', 'wiki_md', 'wiki_sort_order'];
    for (const key of copyKeys) same(copy[key] ?? (key === 'wiki_sort_order' ? manifest.collection.sortOrder ?? 0 : null), page[key], `${final.code}.${key}`);
    const revision = await result(db.from('wiki_collection_datasets').select('*').eq('id', page.published_dataset_id).eq('collection_page_id', page.id).single());
    same(state.plans[final.code].contentHash, revision.content_hash, 'Dryplan content hash');
    same(2, revision.schema_version, 'Dataset schema'); same(dataset.items.length, revision.item_count, 'Revision count');
    const rows: any[] = [];
    for (let start = 0; start <= dataset.items.length; start += 500) {
      const part = await result(db.from('wiki_collection_items').select('*').eq('dataset_id', revision.id).order('item_slug').range(start, start + 499));
      rows.push(...part); if (part.length < 500) break;
    }
    same(dataset.items.length, rows.length, 'Stored item count');
    const expected = [], items = [], bySlug = new Map(rows.map(row => [row.item_slug, row]));
    for (const [index, authored] of dataset.items.entries()) {
      const saved = bySlug.get(authored.system.slug); if (!saved) throw new QaFailure('Missing selected item.');
      const {name, ...fields} = authored.item;
      const item: any = {item_slug: authored.system.slug, item_name: name.trim(), section: authored.system.section.trim(), sort_order: Number.isInteger(authored.system.sortOrder) ? authored.system.sortOrder : (index + 1) * 10, fields_json: fields};
      for (const key of ['image_key', 'image_mime', 'image_width', 'image_height', 'image_bytes', 'image_sha256']) item[key] = saved[key];
      for (const [key, value] of Object.entries(item)) same(value, saved[key], `${final.code}/${item.item_slug}.${key}`);
      let image: string | null = null;
      if (authored.system.image) {
        if (!/^[a-f0-9]{64}$/.test(saved.image_sha256 ?? '') || !['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'].includes(saved.image_mime)) throw new QaFailure('Missing exact image metadata.');
        const extension = saved.image_mime === 'image/jpeg' ? 'jpg' : saved.image_mime.slice(6);
        same(`${manifest.game.universeId}/${manifest.collection.slug}/${item.item_slug}-${saved.image_sha256.slice(0, 16)}.${extension}`, saved.image_key, 'Roblox image key');
        image = `https://media.bloxodes.com/wiki/${saved.image_key}`;
        if (!media.has(image)) {
          const remote = await fetch(image, {redirect: 'error', signal: AbortSignal.timeout(30_000)});
          if (!remote.ok) throw new QaFailure('Selected public media is unavailable.');
          const bytes = Buffer.from(await remote.arrayBuffer());
          same(saved.image_sha256, hash(bytes), 'Public image bytes'); same(saved.image_bytes, bytes.length, 'Image byte count');
          media.add(image);
        }
      } else for (const key of ['image_key', 'image_mime', 'image_width', 'image_height', 'image_bytes', 'image_sha256']) same(null, saved[key], `Text-only ${key}`);
      expected.push(item);
      const display = dataset.meta.display;
      const statLabels = page.page_type === 'database' ? Object.fromEntries(display.tableFields.map((key: string) => [key, getFieldLabel(key)])) : {};
      const facts = page.page_type === 'collectible'
        ? robloxCollectibleFacts(display, authored.item)
        : Object.fromEntries(['cards', 'list'].map(view => [view, collectionVisibleFacts(display, authored.item, view, 'database', statLabels)]));
      items.push({...authored, system: {...authored.system, sortOrder: item.sort_order}, image, facts});
    }
    const meta = {...dataset.meta, runtime: {gameName: manifest.game.name, label: manifest.collection.label, pageType: manifest.collection.pageType, source: 'wiki_collection_datasets'}};
    same(meta, revision.meta_json, 'Display/runtime metadata');
    // The dryplan uses the publisher's exact normalization and hashing. Hashing
    // the complete readback in authored order binds every stored media field too.
    same(state.plans[final.code].contentHash, hash(JSON.stringify(stable({meta, items: expected}))), 'Complete immutable row hash');
    readback.push({path: entry.path, pointer: revision.id, contentHash: revision.content_hash, count: rows.length, imageCount: items.filter(item => item.image).length, approvedTextOnlySlugs: items.filter(item => !item.image).map(item => item.system.slug), copyFieldsCompared: copyKeys, allItemFieldsCompared: true});
    items.sort((a, b) => (a.system.sortOrder ?? 0) - (b.system.sortOrder ?? 0) || a.system.slug.localeCompare(b.system.slug));
    browser.collections.push({path: entry.path, code: final.code, label: page.display_name, pageType: page.page_type, final: copy, items});
  }
  const previousFile = path.join(output, 'readback.json');
  if (fs.existsSync(previousFile)) {
    const previous = json(previousFile);
    for (const row of readback.filter(row => row.pointer)) {
      const prior = previous.find((entry: any) => entry.path === row.path);
      same(prior?.pointer, row.pointer, 'Published pointer across browser QA');
      same(prior?.contentHash, row.contentHash, 'Published hash across browser QA');
    }
  }
  write('readback.json', readback);
  fs.writeFileSync(privateFile('browser'), JSON.stringify(browser));
  write('development-report.json', {...state, status: 'browser-pending', dataReadback: 'passed', verifiedPublicMedia: media.size, productionReleaseReceipt: false});
}

type OwnedAccount = {project: string; userId: string; sessionId: string; token: string; displayName: string};
export async function cleanupAccounts(db: any, records: OwnedAccount[], codes: string[]) {
  const failures: string[] = [];
  for (const account of records) {
    // A failed insert must never turn a UUID collision into deletion of a user.
    try {
      const user = await db.from('app_users').select('display_name').eq('user_id', account.userId).maybeSingle();
      if (user.error || user.data && user.data.display_name !== account.displayName) throw new QaFailure('Fixture ownership mismatch.');
    } catch { failures.push(`${account.project}:ownership`); continue; }
    for (const read of [false, true]) for (const table of ['app_sessions', 'user_checklist_progress', 'app_users']) {
      try {
        let query = read ? db.from(table).select(table === 'app_sessions' ? 'id' : 'user_id') : db.from(table).delete();
        query = query.eq('user_id', account.userId);
        if (table === 'app_users' && !read) query = query.eq('display_name', account.displayName);
        if (table === 'app_sessions') query = query.eq('id', account.sessionId);
        if (table === 'user_checklist_progress') query = query.in('checklist_slug', codes.map(code => `wiki-collection:${code}`));
        const response = await query;
        if (response.error || read && (!Array.isArray(response.data) || response.data.length)) throw new QaFailure('Owned fixture removal/absence failed.');
      } catch { failures.push(`${account.project}:${read ? 'absence' : 'delete'}:${table}`); }
    }
  }
  return failures;
}
async function accounts(cleanup = false) {
  assertEnvironment(process.env, !cleanup);
  const finish = () => {
    const file = path.join(output, 'development-report.json');
    if (fs.existsSync(file)) { const report = json(file); write('development-report.json', {...report, cleanup: 'passed', status: report.status === 'browser-passed-cleanup-pending' ? 'passed' : report.status}); }
  };
  const auth = privateFile('auth');
  if (cleanup && !fs.existsSync(auth)) { write('fixture-cleanup.json', {status: 'passed', accounts: 0}); finish(); return; }
  assertEnvironment(process.env);
  const db = database(), owner = `${process.env.GITHUB_RUN_ID}/${process.env.GITHUB_RUN_ATTEMPT}/${process.env.BUNDLE_HASH}`;
  if (cleanup) {
    const saved = json(auth);
    if (saved.owner !== owner || !Array.isArray(saved.accounts) || saved.accounts.some((account: OwnedAccount) => !/^[a-f0-9-]{36}$/.test(account.userId) || !/^[a-f0-9-]{36}$/.test(account.sessionId)) || !Array.isArray(saved.codes) || !saved.codes.length || !saved.codes.every(slug) || saved.accounts.some((account: OwnedAccount) => account.displayName !== `Selected Roblox QA ${owner}`)) throw new QaFailure('Invalid private QA ownership ledger.');
    const failures = await cleanupAccounts(db, saved.accounts, saved.codes);
    write('fixture-cleanup.json', {status: failures.length ? 'failed' : 'passed', accounts: saved.accounts.length, failures});
    if (failures.length) {
      const file = path.join(output, 'development-report.json');
      if (fs.existsSync(file)) write('development-report.json', {...json(file), status: 'cleanup-failed'});
      throw new QaFailure('Isolated QA cleanup failed; see fixture-cleanup.json.');
    }
    finish(); fs.rmSync(auth); return;
  }
  const {plan} = selection(), codes = plan.collections.filter(entry => entry.manifest.collection.pageType === 'collectible').map(entry => entry.final.code);
  if (!codes.length) return;
  if (fs.existsSync(auth) || !process.env.AUTH_SESSION_SECRET) throw new QaFailure('Missing signing secret or existing fixture ownership.');
  const records: OwnedAccount[] = [];
  try {
    for (const project of ['desktop-chromium', 'mobile-chromium']) {
      const userId = randomUUID(), sessionId = randomUUID(), now = Math.floor(Date.now() / 1000), expires = now + 3600;
      const payload = Buffer.from(JSON.stringify({v: 1, sid: sessionId, uid: userId, iat: now, exp: expires})).toString('base64url');
      const token = `${payload}.${createHmac('sha256', process.env.AUTH_SESSION_SECRET!).update(payload).digest('base64url')}`;
      console.log(`::add-mask::${token}`);
      const displayName = `Selected Roblox QA ${owner}`;
      records.push({project, userId, sessionId, token, displayName});
      fs.writeFileSync(auth, JSON.stringify({owner, codes, accounts: records}), {mode: 0o600}); // Ownership precedes every insert.
      await result(db.from('app_users').insert({user_id: userId, display_name: displayName, role: 'user'}));
      await result(db.from('app_sessions').insert({id: sessionId, user_id: userId, expires_at: new Date(expires * 1000).toISOString()}));
    }
  } catch (error) { await accounts(true); throw error; }
}
async function main() {
  const mode = process.argv[2];
  if (mode === 'download') {
    const db = database(false), selectedHash = process.env.BUNDLE_HASH!;
    const {data, error} = await db.storage.from('ci-release-bundles').download(`${selectedHash}.json`);
    if (error || !data) throw new QaFailure('Selected private bundle unavailable.');
    const bundle = decodeBundle(Buffer.from(await data.arrayBuffer()), selectedHash), base = `content/releases/${selectedHash}`;
    parseBatch(bundle.batch); fs.mkdirSync(path.dirname(base), {recursive: true}); await extractBundle(bundle, base);
    selectedPlan(base, bundle.batch);
    fs.appendFileSync(process.env.GITHUB_ENV!, `BATCH=${base}/batch.json\nBLOXODES_VERIFIED_BUNDLE=${selectedHash}\n`); return;
  }
  if (mode === 'prepare') {
    const {base, plan} = selection();
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8', timeout: 30_000}).trim();
    same(process.env.GITHUB_SHA, sha, 'Dispatch checkout SHA');
    const plans: Record<string, any> = {};
    for (const entry of plan.collections) {
      const file = privateFile(`plan-${entry.final.code}`);
      execFileSync(process.execPath, ['--import', 'tsx', 'scripts/collections/sync-game-collection-runtime.ts', '--normalize-legacy-media', '--manifest', entry.manifestFile, '--output', file], {stdio: 'inherit', timeout: 180_000});
      const [dryplan] = json(file);
      if (dryplan.code !== entry.final.code || dryplan.duplicateSlugCount || dryplan.repairedSlugCount || dryplan.invalidLegacyImageCount) throw new QaFailure('Dryplan repaired or dropped an approved item.');
      plans[entry.final.code] = dryplan;
    }
    const state = {kind: 'selected-roblox-development-qa', sourceSha: sha, bundleHash: process.env.BUNDLE_HASH, digest: contentDigest(base), runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT, plans};
    fs.writeFileSync(privateFile('state'), JSON.stringify(state));
    await verify();
    fs.writeFileSync(path.join(process.env.RUNNER_TEMP!, 'managed-smoke.json'), JSON.stringify({urls: plan.urls})); return;
  }
  if (mode === 'accounts' || mode === 'cleanup') return accounts(mode === 'cleanup');
  if (mode === 'verify' || mode === 'complete') {
    await verify();
    if (mode === 'complete') { const file = path.join(output, 'development-report.json'); write('development-report.json', {...json(file), status: 'browser-passed-cleanup-pending'}); }
    return;
  }
  throw new QaFailure('Use download, prepare, accounts, verify, complete or cleanup.');
}
if (process.argv[1]?.replaceAll('\\', '/').endsWith('/selected-roblox-qa.ts')) main().catch(error => {
  // Never serialize SDK errors, query headers, session tokens or credentials.
  const reason = error instanceof QaFailure ? error.message : 'Internal operation failed; see step output.';
  write('failure.json', {status: 'failed', phase: process.argv[2], reason, productionReleaseReceipt: false});
  console.error(`Selected Roblox QA failed in ${process.argv[2]}; inspect the selected readback/browser artifacts.`); process.exitCode = 1;
});
