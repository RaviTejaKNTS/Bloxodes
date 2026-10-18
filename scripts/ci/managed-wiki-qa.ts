import fs from 'node:fs';
import path from 'node:path';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { ownedPath, parseBatch } from './content-contract.mjs';
import { contentDigest } from './managed-content-receipt.mjs';
import { resolveWikiMediaUrl } from '../../apps/web/src/lib/wiki-media';

// Optional committed contract: content/qa/wiki-selection.json
// {"version":1,"bundleHash":"<64 lowercase hex>","reviewedSourceSha":"<40 lowercase hex>","managedQaRunId":"<successful predecessor run ID>"}
// Absence skips the PR job. Never commit a placeholder selection or bundle.
// This harness produces supplementary PR evidence, never a publication receipt.
type ExpectedMedia = {
  image_key: string | null; image_mime: string | null; image_width: number | null;
  image_height: number | null; image_bytes: number | null; image_sha256: string | null;
};
export type WikiQaItem = {
  id: string; name: string; section: string; sortOrder: number;
  fields: Record<string, unknown>; hasImage: boolean; image: string | null;
  media: ExpectedMedia;
};
export type WikiQaCollection = {
  path: string; code: string; universeId: number; pageType: 'database' | 'collectible';
  title: string; seoTitle: string; description: string; label: string;
  sectionOrder: string[]; cardFields: string[]; items: WikiQaItem[];
  metaJson: Record<string, unknown>; pageCopy: Record<string, unknown>; contentHash: string;
  pageId?: string; datasetId?: string;
};
export type WikiQaState = {
  version: 1; bundleHash: string; reviewedSourceSha: string; testHeadSha: string;
  managedQaRunId: string; predecessorArtifactId?: string; predecessorVerified?: boolean;
  runId: string; runAttempt: string; digest: string; batch: string;
  hubs: Array<{slug: string; expected: Record<string, unknown>; pageId?: string}>;
  urls: Array<{path: string; contains: string}>; collections: WikiQaCollection[];
};
type Account = {project: string; userId: string; sessionId: string; token: string};
const target = 'https://bbtcaurrtyoukvjbxbbj.supabase.co';
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const report = 'tmp/test-reports/selected-wiki-inputs.json';
const stateFile = () => process.env.MANAGED_WIKI_STATE!;
const authFile = () => process.env.MANAGED_WIKI_AUTH!;
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
function fail(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function guard() {
  fail(process.env.GITHUB_ACTIONS === 'true' && process.env.BLOXODES_MANAGED_QA === 'true'
    && process.env.BLOXODES_ENV_PROFILE === 'process-only'
    && process.env.SUPABASE_URL === target && process.env.ARTICLE_DEV_SUPABASE_URL === target,
  'Selected wiki QA requires GitHub and the exact managed-development target.');
  for (const file of [stateFile(), authFile()]) {
    fail(file && path.dirname(file) === process.env.RUNNER_TEMP, 'QA state must stay in runner temporary storage.');
  }
}
function database() {
  guard();
  return createClient(target, process.env.SUPABASE_SERVICE_ROLE!, {auth: {persistSession: false}});
}
function save(state: WikiQaState) {
  fs.writeFileSync(stateFile(), JSON.stringify(state));
  fs.mkdirSync(path.dirname(report), {recursive: true});
  fs.writeFileSync(report, JSON.stringify({...state, evidence: 'supplementary-pr-qa', publicationReceipt: false}, null, 2));
}
function selection() {
  const selected = read('content/qa/wiki-selection.json');
  fail(selected.version === 1 && /^[0-9a-f]{64}$/.test(selected.bundleHash ?? '')
    && /^[0-9a-f]{40}$/.test(selected.reviewedSourceSha ?? '')
    && typeof selected.managedQaRunId === 'string' && /^[1-9][0-9]*$/.test(selected.managedQaRunId)
    && Object.keys(selected).sort().join(',') === 'bundleHash,managedQaRunId,reviewedSourceSha,version', 'Invalid committed wiki QA selection.');
  fail(selected.managedQaRunId !== process.env.GITHUB_RUN_ID, 'Select a completed predecessor, never this PR run.');
  return selected as {version: 1; bundleHash: string; reviewedSourceSha: string; managedQaRunId: string};
}
function select() {
  const selected = selection();
  const head = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
  fail(head === process.env.BLOXODES_BUILD_SHA, 'The preview must build the exact PR head.');
  execFileSync('git', ['merge-base', '--is-ancestor', selected.reviewedSourceSha, head]);
  // Bind application behavior to the reviewed source while allowing this unmerged QA harness.
  const runtimeDiff = execFileSync('git', ['diff', '--name-only', selected.reviewedSourceSha, head, '--',
    'apps/web/', 'data/', 'Dockerfile', 'package.json', 'package-lock.json',
    ':(exclude)apps/web/e2e/managed-wiki-collections.spec.ts',
    ':(glob,exclude)apps/web/**/AGENTS.md', ':(glob,exclude)apps/web/**/CLAUDE.md',
    ':(exclude)apps/web/README.md'], {encoding: 'utf8'}).trim();
  fail(!runtimeDiff, 'Reviewed source differs from the PR application runtime. Review a new source SHA.');
  fs.appendFileSync(process.env.GITHUB_ENV!, `BUNDLE_HASH=${selected.bundleHash}\nBLOXODES_APPROVED_SHA=${selected.reviewedSourceSha}\nMANAGED_QA_RUN_ID=${selected.managedQaRunId}\n`);
}
const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, stableValue(entry)]));
  return value;
}
function resolveCounts(value: any, count: number): any {
  if (typeof value === 'string') return value.replaceAll('{count}', count.toLocaleString('en-US'));
  if (Array.isArray(value)) return value.map(entry => resolveCounts(entry, count));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, resolveCounts(entry, count)]));
  return value;
}
// Mirror sync-game-collection-runtime.ts's pure planning contract. Do not import its
// executable entry point, fetch remote source images, upload media or consult DB rows.
// publish-content always supplies --normalize-legacy-media for Roblox collections.
async function expectedMedia(value: unknown, mediaRoot: string, universeId: number, collection: string, id: string): Promise<ExpectedMedia> {
  const empty: ExpectedMedia = {image_key: null, image_mime: null, image_width: null,
    image_height: null, image_bytes: null, image_sha256: null};
  if (!value) return empty;
  fail(typeof value === 'string' && !/^https?:\/\//i.test(value), 'Selected media must be local frozen bundle bytes.');
  const decoded = decodeURIComponent(value.split(/[?#]/, 1)[0]).replace(/^\/+/, '');
  const file = ownedPath(mediaRoot, decoded);
  // The publisher resolves source paths before its legacy decode fallback. Missing
  // files and unsafe paths must fail here too, rather than become image omissions.
  const original = fs.readFileSync(file);
  let prepared: {bytes: Buffer; mime: string; width: number | null; height: number | null};
  const formats: Record<string, string> = {avif: 'avif', gif: 'gif', jpeg: 'jpeg', jpg: 'jpeg', png: 'png', webp: 'webp'};
  try {
    const metadata = await sharp(original, {animated: true}).metadata();
    const format = metadata.format && formats[metadata.format];
    if (format && original.byteLength <= 1_000_000 && (metadata.width || 0) <= 960 && (metadata.height || 0) <= 960) {
      prepared = {bytes: original, mime: `image/${format}`, width: metadata.width || null, height: metadata.height || null};
    } else {
      let normalized: typeof prepared | undefined;
      for (const dimension of [960, 800, 640]) {
        for (const quality of [82, 72, 62, 52, 42]) {
          const output = await sharp(original).resize({width: dimension, height: dimension, fit: 'inside', withoutEnlargement: true})
            .webp({quality, effort: 4}).toBuffer({resolveWithObject: true});
          if (output.data.byteLength <= 1_000_000 && output.info.width <= 960 && output.info.height <= 960) {
            normalized = {bytes: output.data, mime: 'image/webp', width: output.info.width, height: output.info.height};
            break;
          }
        }
        if (normalized) break;
      }
      if (!normalized) throw new Error('Could not normalize legacy collection image.');
      prepared = normalized;
    }
  } catch {
    // The publisher skips unreadable legacy images with the normalization flag.
    return empty;
  }
  const sha = hash(prepared.bytes), extension = prepared.mime === 'image/jpeg' ? 'jpg' : prepared.mime.slice('image/'.length);
  return {image_key: `${universeId}/${collection}/${id}-${sha.slice(0, 16)}.${extension}`,
    image_sha256: sha, image_mime: prepared.mime, image_width: prepared.width,
    image_height: prepared.height, image_bytes: prepared.bytes.byteLength};
}
async function prepare() {
  const selected = selection();
  fail(process.env.BLOXODES_VERIFIED_BUNDLE === selected.bundleHash && process.env.BUNDLE_HASH === selected.bundleHash
    && process.env.BATCH === `content/releases/${selected.bundleHash}/batch.json`, 'Use the existing verified bundle downloader.');
  const base = path.dirname(process.env.BATCH!);
  const batch = parseBatch(read(process.env.BATCH!));
  const collections: WikiQaCollection[] = [];
  const hubs: WikiQaState['hubs'] = [];
  const paths: string[] = [];
  const json = (relative: string) => read(ownedPath(base, relative));
  const nested = (manifest: string, input: string) => {
    ownedPath(base, input); // Reject absolute paths, traversal and empty segments before joining.
    return path.posix.join(path.posix.dirname(manifest), input);
  };
  fail(batch.operations.length > 0 && batch.operations[0].publisher === 'roblox-wiki', 'Select the reviewed wiki hub first.');
  for (const operation of batch.operations) {
    fail(['roblox-wiki', 'roblox-collection'].includes(operation.publisher), 'This QA lane selects only Roblox wiki content.');
    if (operation.publisher === 'roblox-wiki') {
      const final = json(operation.file);
      fail(slug.test(final.slug ?? ''), 'The hub needs its reviewed editorial slug.');
      const expected: Record<string, unknown> = {slug: final.slug, universe_id: final.universe_id,
        controls_json: final.controls_json ?? [], cover_image: null, is_published: final.is_published !== false};
      for (const key of ['title', 'seo_title', 'meta_description', 'description_md', 'tips_md']) {
        fail(typeof final[key] === 'string' && final[key].trim(), `Hub final is missing ${key}.`);
        expected[key] = final[key].trim();
      }
      fail(Number.isSafeInteger(final.universe_id) && final.universe_id > 0 && expected.is_published, 'Selected hub must publish a valid universe.');
      hubs.push({slug: final.slug, expected});
      paths.push(`/wiki/${final.slug}`);
      continue;
    }
    const manifest = json(operation.file);
    const game = manifest.game?.slug, collection = manifest.collection?.slug;
    fail(slug.test(game ?? '') && slug.test(collection ?? ''), 'Invalid selected collection identity.');
    const pageType = manifest.collection.pageType === 'checklist' ? 'collectible' : manifest.collection.pageType ?? 'database';
    fail(pageType === 'database' || pageType === 'collectible', 'Select an explicit supported collection page type.');
    fail(manifest.schemaVersion === 1 && Number.isSafeInteger(manifest.game.universeId) && manifest.game.universeId > 0
      && typeof manifest.game.name === 'string' && manifest.game.name.trim()
      && typeof manifest.collection.label === 'string' && manifest.collection.label.trim(), 'Invalid runtime manifest.');
    const document = json(nested(operation.file, manifest.dataset));
    const final = json(nested(operation.file, manifest.finalJson));
    fail(document.meta?.schemaVersion === 2 && Array.isArray(document.items) && document.items.length, 'Selected QA requires nonempty v2 rows.');
    const code = `${game}-${collection}`;
    fail(final.code === code && final.wiki_slug === game && final.collection_slug === collection
      && Number(final.universe_id) === Number(manifest.game.universeId), 'Selected final and manifest identities differ.');
    const mediaRoot = ownedPath(base, nested(operation.file, manifest.mediaRoot));
    const items: WikiQaItem[] = [];
    for (const [index, row] of document.items.entries()) {
      fail(slug.test(row.system?.slug ?? '') && row.item?.name && row.system?.section, 'QA needs explicit unique row slugs, names and sections.');
      const {name, ...fields} = row.item;
      const media = await expectedMedia(row.system.image, mediaRoot, manifest.game.universeId, collection, row.system.slug);
      items.push({id: row.system.slug, name: name.trim(), section: row.system.section.trim(),
        sortOrder: Number.isInteger(row.system.sortOrder) ? row.system.sortOrder : (index + 1) * 10,
        fields, hasImage: Boolean(media.image_key), image: resolveWikiMediaUrl(media.image_key), media});
    }
    fail(new Set(items.map(item => item.id)).size === items.length, 'Selected QA requires unique item slugs.');
    const copy = resolveCounts(final, items.length);
    for (const key of ['title', 'display_name', 'seo_title', 'meta_description']) {
      fail(typeof copy[key] === 'string' && copy[key].trim(), `Selected collection final is missing ${key}.`);
    }
    const pageCopy: Record<string, unknown> = {title: copy.title, display_name: copy.display_name,
      seo_title: copy.seo_title, meta_description: copy.meta_description,
      description_json: copy.description_json, faq_json: copy.faq_json,
      schema_ld_json: copy.schema_ld_json && typeof copy.schema_ld_json === 'object' ? copy.schema_ld_json : null,
      thumb_url: typeof copy.thumb_url === 'string' && copy.thumb_url.trim() ? copy.thumb_url : null,
      wiki_sort_order: Number.isFinite(copy.wiki_sort_order) ? Number(copy.wiki_sort_order) : manifest.collection.sortOrder ?? 0};
    for (const key of ['intro_md', 'how_it_works_md', 'description_md', 'wiki_md']) pageCopy[key] = typeof copy[key] === 'string' ? copy[key] : null;
    const metaJson = {...document.meta, runtime: {gameName: manifest.game.name, label: manifest.collection.label,
      pageType, source: 'wiki_collection_datasets'}};
    const contentHash = hash(JSON.stringify(stableValue({meta: metaJson, items: items.map(item => ({
      item_slug: item.id, item_name: item.name, section: item.section, sort_order: item.sortOrder,
      fields_json: item.fields, ...item.media
    }))})));
    const pathname = `/wiki/${game}/${collection}`;
    paths.push(pathname);
    collections.push({path: pathname, code, universeId: Number(manifest.game.universeId), pageType,
      title: copy.title, seoTitle: copy.seo_title, description: copy.meta_description, label: manifest.collection.label,
      metaJson, pageCopy, contentHash,
      sectionOrder: document.meta.display?.sectionOrder ?? [], cardFields: document.meta.display?.cardFields ?? [], items});
  }
  fail(collections.length && new Set(paths).size === paths.length, 'Select each hub/collection exactly once.');
  fail(batch.urls.length === paths.length && paths.every(p => batch.urls.filter((url: any) => url.path === p).length === 1),
    'Bundle URLs must select every hub/collection exactly once, without unrelated routes.');
  save({...selected, testHeadSha: process.env.BLOXODES_BUILD_SHA!, runId: process.env.GITHUB_RUN_ID!,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT!, batch: process.env.BATCH!, digest: contentDigest(base), urls: batch.urls, hubs, collections});
  // The branch no longer stages content, so create the data-only smoke selection here.
  fs.writeFileSync(path.join(process.env.RUNNER_TEMP!, 'managed-smoke.json'), JSON.stringify(batch));
}
function frozenState(): WikiQaState {
  const state: WikiQaState = read(stateFile()), selected = selection();
  fail(state.bundleHash === selected.bundleHash && state.reviewedSourceSha === selected.reviewedSourceSha
    && state.managedQaRunId === selected.managedQaRunId && state.runId === process.env.GITHUB_RUN_ID
    && state.runAttempt === process.env.GITHUB_RUN_ATTEMPT && state.testHeadSha === process.env.BLOXODES_BUILD_SHA
    && contentDigest(path.dirname(state.batch)) === state.digest, 'Frozen selection or extracted bytes changed during QA.');
  return state;
}
async function predecessor() {
  const state = frozenState(), repository = process.env.GITHUB_REPOSITORY;
  fail(repository && /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository) && process.env.GH_TOKEN,
    'Predecessor evidence requires this repository and an actions-read token.');
  const api = async (suffix: string) => {
    const response = await fetch(`https://api.github.com/repos/${repository}/actions/${suffix}`, {
      headers: {Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'},
      redirect: 'error', signal: AbortSignal.timeout(30_000)
    });
    fail(response.ok, `Predecessor GitHub evidence unavailable (${response.status}).`);
    return response.json();
  };
  const run = await api(`runs/${state.managedQaRunId}`);
  fail(String(run.id) === state.managedQaRunId && run.repository?.full_name === repository
    && run.head_repository?.full_name === repository && run.head_repository?.id === run.repository?.id
    && run.path === '.github/workflows/managed-content-qa.yml' && run.event === 'workflow_dispatch'
    && run.head_branch === 'production' && run.head_sha === state.reviewedSourceSha
    && run.status === 'completed' && run.conclusion === 'success',
  'Selected predecessor must be this repository\'s successful dispatched managed QA on the reviewed production SHA.');
  const result = await api(`runs/${state.managedQaRunId}/artifacts?per_page=100`);
  fail(Array.isArray(result.artifacts) && result.total_count <= 100, 'Unexpected predecessor artifact inventory.');
  const matches = result.artifacts.filter((artifact: any) => artifact.name === `managed-content-receipt-${state.managedQaRunId}`);
  fail(matches.length === 1, 'Require exactly one existing predecessor receipt artifact.');
  const artifact = matches[0];
  fail(!artifact.expired && Number.isSafeInteger(artifact.id) && artifact.id > 0
    && String(artifact.workflow_run?.id) === state.managedQaRunId
    && artifact.workflow_run?.repository_id === run.repository.id
    && artifact.workflow_run?.head_repository_id === run.repository.id
    && artifact.workflow_run?.head_branch === 'production' && artifact.workflow_run?.head_sha === state.reviewedSourceSha,
  'Predecessor receipt artifact is expired or has a different run/source owner.');
  state.predecessorArtifactId = String(artifact.id);
  save(state);
  // Download this immutable artifact ID, never a current-run artifact or loose receipt URL.
  fs.appendFileSync(process.env.GITHUB_ENV!, `MANAGED_QA_ARTIFACT_ID=${state.predecessorArtifactId}\n`);
}
function receipt() {
  const state = frozenState();
  fail(state.predecessorArtifactId, 'Validate the predecessor run and immutable artifact before its receipt.');
  const directory = path.join(process.env.RUNNER_TEMP!, 'selected-wiki-predecessor');
  fail(fs.readdirSync(directory).join(',') === 'managed-content-receipt.json', 'Unexpected predecessor receipt artifact files.');
  const file = path.join(directory, 'managed-content-receipt.json');
  fail(fs.lstatSync(file).isFile() && !fs.lstatSync(file).isSymbolicLink(), 'Receipt must be a regular artifact file.');
  const prior = read(file);
  fail(prior.status === 'passed' && prior.sha === state.reviewedSourceSha && prior.runId === state.managedQaRunId
    && prior.digest === state.digest, 'Predecessor receipt does not cover these exact frozen selected inputs.');
  state.predecessorVerified = true;
  save(state);
}
async function verify() {
  const state = frozenState();
  fail(state.predecessorVerified, 'Exact selected readback requires the verified successful predecessor receipt.');
  const db = database();
  for (const hub of state.hubs) {
    const result = await db.from('wiki_pages').select(`id,${Object.keys(hub.expected).join(',')}`).eq('slug', hub.slug).single();
    if (result.error) throw result.error;
    const {id, ...actual} = result.data as unknown as {id: string; [key: string]: unknown};
    fail(isDeepStrictEqual(actual, hub.expected) && (!hub.pageId || hub.pageId === id), `${hub.slug}: staged hub differs from frozen input.`);
    hub.pageId = id;
  }
  const verifiedMedia = new Set<string>();
  for (const entry of state.collections) {
    const {data: page, error} = await db.from('wiki_collection_pages')
      .select(`id,code,universe_id,wiki_slug,collection_slug,wiki_page_id,page_type,is_published,published_dataset_id,item_count,${Object.keys(entry.pageCopy).join(',')}`)
      .eq('code', entry.code).single();
    if (error) throw error;
    const selectedPage = page as unknown as Record<string, any>;
    fail(selectedPage.is_published && selectedPage.page_type === entry.pageType && Number(selectedPage.universe_id) === entry.universeId
      && selectedPage.item_count === entry.items.length && selectedPage.published_dataset_id
      && entry.path === `/wiki/${selectedPage.wiki_slug}/${selectedPage.collection_slug}`
      && state.hubs.some(hub => hub.slug === selectedPage.wiki_slug && hub.pageId === selectedPage.wiki_page_id)
      && Object.entries(entry.pageCopy).every(([key, expected]) => isDeepStrictEqual(selectedPage[key], expected)),
    `${entry.code}: selected published page differs from the frozen input.`);
    if (entry.datasetId) fail(entry.datasetId === selectedPage.published_dataset_id && entry.pageId === selectedPage.id,
      `${entry.code}: published pointer changed during browser QA.`);
    const revision = await db.from('wiki_collection_datasets').select('schema_version,content_hash,item_count,meta_json')
      .eq('id', selectedPage.published_dataset_id).eq('collection_page_id', selectedPage.id).single();
    if (revision.error) throw revision.error;
    fail(revision.data.schema_version === 2 && revision.data.item_count === entry.items.length
      && revision.data.content_hash === entry.contentHash && isDeepStrictEqual(revision.data.meta_json, entry.metaJson),
    `${entry.code}: published revision hash, count or metadata differs from frozen planning.`);
    const rows: any[] = [];
    for (let start = 0; ; start += 500) {
      const result = await db.from('wiki_collection_items').select('item_slug,item_name,section,sort_order,fields_json,image_key,image_mime,image_width,image_height,image_bytes,image_sha256')
        .eq('dataset_id', selectedPage.published_dataset_id).order('item_slug').range(start, start + 499);
      if (result.error) throw result.error;
      rows.push(...result.data);
      if (result.data.length < 500) break;
    }
    fail(rows.length === entry.items.length, 'Published runtime row count differs.');
    for (const item of entry.items) {
      const row = rows.find(row => row.item_slug === item.id);
      fail(row && row.item_name === item.name && row.section === item.section && row.sort_order === item.sortOrder
        && isDeepStrictEqual(row.fields_json, item.fields)
        && Object.entries(item.media).every(([key, value]) => row[key] === value),
      `${entry.code}/${item.id}: runtime fields or exact prepared media differ from frozen planning.`);
      if (item.image && !verifiedMedia.has(item.image)) {
        const response = await fetch(item.image, {redirect: 'error', signal: AbortSignal.timeout(30_000)});
        fail(response.ok, `${entry.code}/${item.id}: expected public media is unavailable.`);
        const bytes = Buffer.from(await response.arrayBuffer());
        fail(bytes.byteLength === item.media.image_bytes && hash(bytes) === item.media.image_sha256,
          `${entry.code}/${item.id}: public media bytes differ from frozen preparation.`);
        verifiedMedia.add(item.image);
      }
    }
    entry.pageId = selectedPage.id; entry.datasetId = selectedPage.published_dataset_id;
  }
  save(state);
}
async function accounts() {
  const state = frozenState();
  fail(state.predecessorVerified && state.collections.every(entry => entry.datasetId && entry.pageId),
    'Owned account fixtures require successful exact selected readback.');
  if (!state.collections.some(entry => entry.pageType === 'collectible')) return;
  fail(!fs.existsSync(authFile()), 'Temporary account ownership already exists.');
  const secret = randomBytes(32).toString('hex');
  console.log(`::add-mask::${secret}`);
  fs.appendFileSync(process.env.GITHUB_ENV!, `AUTH_SESSION_SECRET=${secret}\n`);
  const db = database(), owned: Account[] = [];
  for (const project of ['desktop-chromium', 'mobile-chromium']) {
    const userId = randomUUID(), sessionId = randomUUID(), now = Math.floor(Date.now() / 1000), expires = now + 7200;
    const payload = Buffer.from(JSON.stringify({v: 1, sid: sessionId, uid: userId, iat: now, exp: expires})).toString('base64url');
    const token = `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
    console.log(`::add-mask::${token}`);
    owned.push({project, userId, sessionId, token});
    // Save ownership before either insert, including partial failures.
    fs.writeFileSync(authFile(), JSON.stringify(owned), {mode: 0o600});
    const user = await db.from('app_users').insert({user_id: userId, display_name: 'Wiki collection QA', role: 'user'});
    if (user.error) throw user.error;
    const session = await db.from('app_sessions').insert({id: sessionId, user_id: userId, expires_at: new Date(expires * 1000).toISOString()});
    if (session.error) throw session.error;
  }
}
async function cleanup() {
  if (!fs.existsSync(authFile())) return;
  const db = database(), failures: string[] = [];
  for (const account of read(authFile()) as Account[]) {
    try {
      const revoked = await db.from('app_sessions').update({revoked_at: new Date().toISOString()})
        .eq('id', account.sessionId).eq('user_id', account.userId);
      if (revoked.error) throw revoked.error;
      const progress = await db.from('user_checklist_progress').delete().eq('user_id', account.userId);
      if (progress.error) throw progress.error;
      const session = await db.from('app_sessions').delete().eq('id', account.sessionId).eq('user_id', account.userId);
      if (session.error) throw session.error;
      const user = await db.from('app_users').delete().eq('user_id', account.userId);
      if (user.error) throw user.error;
      for (const [table, column, id] of [['app_users', 'user_id', account.userId], ['app_sessions', 'id', account.sessionId], ['user_checklist_progress', 'user_id', account.userId]]) {
        const remaining = await db.from(table).select(column).eq(column, id).limit(1);
        if (remaining.error) throw remaining.error;
        fail(remaining.data.length === 0, 'Temporary QA account/progress cleanup readback failed.');
      }
    } catch (error: any) { failures.push(error.message); }
  }
  if (failures.length) throw new Error(failures.join('\n'));
  fs.rmSync(authFile());
  fs.mkdirSync('tmp/test-reports', {recursive: true});
  fs.writeFileSync('tmp/test-reports/selected-wiki-cleanup.json', JSON.stringify({ownedAccountsRemoved: true, runId: process.env.GITHUB_RUN_ID}));
}
async function main() {
  guard();
  switch (process.argv[2]) {
    case 'select': return select();
    case 'prepare': return prepare();
    case 'predecessor': return predecessor();
    case 'receipt': return receipt();
    case 'verify': return verify();
    case 'accounts': return accounts();
    case 'cleanup': return cleanup();
    default: throw new Error('Select one explicit wiki QA mode.');
  }
}
main().catch(error => {console.error(error.message); process.exitCode = 1;});
