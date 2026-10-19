import fs from 'node:fs';
import path from 'node:path';
import {parseBatch, ownedPath} from './content-contract.mjs';
import {bundleInput, imagePolicy, collectionVisibleFacts} from './selected-franchise-qa-contract.mjs';
export {bundleInput, stable} from './selected-franchise-qa-contract.mjs';

export const MANAGED_TARGET = 'https://bbtcaurrtyoukvjbxbbj.supabase.co';
const slug = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
export function assertSelectedRobloxEnvironment(env) {
  if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || env.BLOXODES_ENV_PROFILE !== 'process-only' || env.BLOXODES_MANAGED_QA !== 'true' || env.BLOXODES_SELECTED_ROBLOX_QA !== 'true') throw new Error('Selected Roblox QA requires an explicit GitHub development dispatch.');
  if (!env.GITHUB_REF?.startsWith('refs/heads/') || env.GITHUB_REF === 'refs/heads/production' || !/^[0-9a-f]{40}$/.test(env.GITHUB_SHA ?? '')) throw new Error('Dispatch the exact task branch, never production or a tag.');
  for (const key of ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'ARTICLE_DEV_SUPABASE_URL', 'SUPABASE_MEDIA_PUBLIC_URL']) if (env[key] !== MANAGED_TARGET) throw new Error(`Unexpected managed target: ${key}`);
  for (const key of ['BLOXODES_CONTENT_RELEASE', 'BLOXODES_MANAGED_RECEIPT', 'BLOXODES_APPROVED_SHA', 'REVALIDATE_SECRET', 'BLOXODES_SELECTED_FRANCHISE_QA']) if (env[key]) throw new Error(`Release or other QA input is forbidden: ${key}`);
  if (env.NODE_ENV === 'production' || env.TEST_BASE_URL !== 'http://bloxodes.test:3000' || !['true', 'false'].includes(env.BLOXODES_SELECTED_ROBLOX_STAGE)) throw new Error('Selected QA must use the runner preview and an explicit staging flag.');
  if (!/^[0-9a-f]{64}$/.test(env.BUNDLE_HASH ?? '') || env.BLOXODES_VERIFIED_BUNDLE !== env.BUNDLE_HASH || env.BATCH !== `content/releases/${env.BUNDLE_HASH}/batch.json`) throw new Error('An exact downloaded immutable bundle is required.');
}

export function acceptedImagePolicy(dataset, evidence) {
  const policy = imagePolicy(dataset, evidence);
  // Reject stale acceptance as well as missing approval. Never infer decisions
  // from source-specific entries/items/acceptedGaps with another schema.
  if (!policy.acceptedMissing.length && evidence?.acceptedGaps?.length) throw new Error('Accepted image gaps do not match the dataset.');
  return policy;
}

export function selectedRobloxImage(base, mediaRoot, value) {
  if (typeof value !== 'string' || /^[a-z][a-z0-9+.-]*:/i.test(value)) throw new Error('Remote image references are forbidden.');
  // Same order as resolveImageSource in the Roblox publisher. Existing leading
  // slashes refer to mediaRoot, not the filesystem root.
  const decoded = decodeURIComponent(value.split(/[?#]/, 1)[0]).replace(/^\/+/, '');
  if (/^[a-z][a-z0-9+.-]*:/i.test(decoded)) throw new Error('Remote image references are forbidden.');
  const absolute = path.resolve(mediaRoot, decoded), relative = path.relative(mediaRoot, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Image escapes the selected media root.');
  return bundleInput(base, path.relative(base, absolute).split(path.sep).join('/'));
}

const resolveCount = (value, count) => typeof value === 'string' ? value.replaceAll('{count}', count.toLocaleString('en-US')) : Array.isArray(value) ? value.map(child => resolveCount(child, count)) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key, resolveCount(child, count)])) : value;
/** Mirror pageCopyFromFinal without changing the runtime publisher. */
export function selectedRobloxPageCopy(final, count, sortOrder = 0) {
  const copy = resolveCount(final, count);
  return {
    title: copy.title, display_name: copy.display_name, seo_title: copy.seo_title, meta_description: copy.meta_description,
    intro_md: typeof copy.intro_md === 'string' ? copy.intro_md : null,
    how_it_works_md: typeof copy.how_it_works_md === 'string' ? copy.how_it_works_md : null,
    description_md: typeof copy.description_md === 'string' ? copy.description_md : null,
    description_json: copy.description_json, faq_json: copy.faq_json,
    schema_ld_json: copy.schema_ld_json && typeof copy.schema_ld_json === 'object' ? copy.schema_ld_json : null,
    thumb_url: typeof copy.thumb_url === 'string' && copy.thumb_url.trim() ? copy.thumb_url : null,
    wiki_md: typeof copy.wiki_md === 'string' ? copy.wiki_md : null,
    wiki_sort_order: Number.isFinite(copy.wiki_sort_order) ? Number(copy.wiki_sort_order) : sortOrder
  };
}

/** Only the two Roblox publishers; no implicit identities or extra URLs. */
export function selectedRobloxPlan(base, input) {
  const batch = parseBatch(input), collections = [], pages = [];
  if (!batch.operations.length) throw new Error('Select explicit Roblox operations.');
  const identities = new Map(), universes = new Map();
  const identity = (game, universe) => {
    if (!slug(game) || !Number.isSafeInteger(universe) || universe <= 0 || identities.has(game) && identities.get(game) !== universe || universes.has(universe) && universes.get(universe) !== game) throw new Error('Selected Roblox identity mismatch.');
    identities.set(game, universe); universes.set(universe, game);
  };
  for (const operation of batch.operations) {
    if (!['roblox-wiki', 'roblox-collection'].includes(operation.publisher) || Object.keys(operation).some(key => !['publisher', 'file'].includes(key))) throw new Error('Only exact Roblox wiki and collection files are allowed.');
    const file = bundleInput(base, operation.file), payload = json(file);
    if (operation.publisher === 'roblox-wiki') {
      identity(payload.slug, payload.universe_id);
      if (payload.is_published === false || payload.cover_image || typeof payload.title !== 'string' || !payload.title.trim()) throw new Error('Select a published Roblox hub with official artwork.');
      if (payload.canonical_path !== undefined && payload.canonical_path !== `/wiki/${payload.slug}`) throw new Error('Hub canonical path must match its selected identity.');
      pages.push({kind: 'hub', path: `/wiki/${payload.slug}`, row: payload});
      continue;
    }
    const manifest = payload;
    identity(manifest.game?.slug, manifest.game?.universeId);
    if (manifest.schemaVersion !== 1 || manifest.namespace !== undefined || !slug(manifest.collection?.slug) || !['database', 'collectible'].includes(manifest.collection.pageType) || !manifest.game.name?.trim() || !manifest.collection.label?.trim()) throw new Error('Invalid explicit Roblox runtime manifest.');
    const resolve = (relative, options) => {
      ownedPath('manifest', relative);
      return bundleInput(base, path.posix.join(path.posix.dirname(operation.file), relative), options);
    };
    const datasetFile = resolve(manifest.dataset), finalFile = resolve(manifest.finalJson);
    const mediaRoot = resolve(manifest.mediaRoot, {directory: true});
    const dataset = json(datasetFile), final = json(finalFile);
    const route = `/wiki/${manifest.game.slug}/${manifest.collection.slug}`;
    if (manifest.route !== undefined && manifest.route !== route || dataset.meta?.schemaVersion !== 2 || dataset.meta.gameSlug !== undefined && dataset.meta.gameSlug !== manifest.game.slug || dataset.meta.collection !== undefined && dataset.meta.collection !== manifest.collection.slug || !Array.isArray(dataset.items) || !dataset.items.length || dataset.items.length > 10000 || final.code !== `${manifest.game.slug}-${manifest.collection.slug}` || final.wiki_slug !== manifest.game.slug || final.collection_slug !== manifest.collection.slug || final.is_published === false || final.page_type !== undefined && final.page_type !== manifest.collection.pageType) throw new Error('Selected dataset, final, type and route must match the manifest.');
    if (final.canonical_path !== undefined && final.canonical_path !== route || final.universe_id !== undefined && final.universe_id !== manifest.game.universeId) throw new Error('Final canonical path/universe must match the manifest.');
    const seen = new Set();
    for (const row of dataset.items) {
      if (!slug(row.system?.slug) || seen.has(row.system.slug) || typeof row.system.section !== 'string' || !row.system.section.trim() || typeof row.item?.name !== 'string' || !row.item.name.trim()) throw new Error('Selected v2 rows require unique stable slugs, names and sections.');
      seen.add(row.system.slug);
      if (row.system.image) selectedRobloxImage(base, mediaRoot, row.system.image);
    }
    if (!Array.isArray(dataset.meta.display?.cardFields) || !Array.isArray(dataset.meta.display?.tableFields)) throw new Error('Selected QA requires explicit Cards/List authored fields.');
    const evidenceFile = resolve('images.json', {optional: true});
    const evidence = fs.existsSync(evidenceFile) ? json(evidenceFile) : null;
    collections.push({path: route, manifest, dataset, final, datasetFile, finalFile, mediaRoot, policy: acceptedImagePolicy(dataset, evidence)});
  }
  const paths = [...pages.map(page => page.path), ...collections.map(entry => entry.path)];
  const urls = new Set(batch.urls.map(url => url.path));
  if (new Set(paths).size !== paths.length || urls.size !== batch.urls.length || urls.size !== paths.length || paths.some(route => !urls.has(route))) throw new Error('Batch URLs must exactly match the selected pages.');
  const events = new Set([...identities.keys()].map(game => `wiki:${game}`).concat(collections.map(entry => `wiki_collection:${entry.path.slice('/wiki/'.length)}`)));
  if (batch.events.some(event => !events.has(`${event.type}:${event.slug}`))) throw new Error('Only selected Roblox cache identities are allowed.');
  return {pages, collections, urls: batch.urls};
}

const preferred = ['region', 'location', 'landmark', 'access', 'requirements', 'reward', 'coordinates', 'approach', 'vehicle', 'environment', 'animalForm', 'notes'];
const labels = {collectionOrder: 'Order', region: 'Region', area: 'Area', nearestLandmark: 'Nearest landmark', exactSpot: 'Exact spot', accessNotes: 'Access', cardSummary: 'Summary', location: 'Location', landmark: 'Landmark', access: 'Access', requirements: 'Requirements', reward: 'Reward', coordinates: 'Coordinates', approach: 'Approach', vehicle: 'Recommended vehicle', environment: 'Environment', animalForm: 'Animal form', notes: 'Notes'};
export function visibleRobloxFacts(display, item, view, pageType, statLabels = {}) {
  if (pageType === 'database') return collectionVisibleFacts(display, item, view, pageType, statLabels);
  // Roblox collectibles share cardFields in both views, with fixed checklist
  // labels; fieldPresentation and tableFields do not control that renderer.
  const fields = display.cardFields?.length ? display.cardFields : preferred;
  return collectionVisibleFacts({cardFields: fields}, item, view, pageType).filter(fact => fields.includes(fact.key)).map(fact => ({...fact, label: labels[fact.key] ?? fact.label}));
}

export async function cleanupRobloxAccounts(db, accounts) {
  const failures = [], attempts = [];
  for (const account of accounts) {
    try {
      if (!/^selected-roblox-qa:[0-9]+:[0-9]+:[0-9a-f-]{36}$/.test(account.owner ?? '')) throw new Error('Invalid private fixture ownership record.');
      const owner = await db.from('app_users').select('user_id,display_name,role').eq('user_id', account.userId).maybeSingle();
      if (owner.error) throw owner.error;
      if (owner.data && (owner.data.display_name !== account.owner || owner.data.role !== 'user')) throw new Error('Fixture identity is owned by another user; refusing all mutations.');
    } catch (error) {
      failures.push(`${account.project} ownership: ${error.message ?? error}`);
      attempts.push({project: account.project, step: 'ownership', status: 'failed'});
      continue;
    }
    // Revoke first, then remove only the fixture's selected progress and user.
    const targets = [['app_sessions', [['id', account.sessionId], ['user_id', account.userId]]],
      ...account.codes.map(code => ['user_checklist_progress', [['user_id', account.userId], ['checklist_slug', `wiki-collection:${code}`]]]),
      ['app_users', [['user_id', account.userId], ['display_name', account.owner], ['role', 'user']]]];
    for (const read of [false, true]) for (const [table, filters] of targets) {
      const step = `${read ? 'absence' : 'delete'}:${table}`;
      try {
        let query = read ? db.from(table).select(table === 'app_sessions' ? 'id' : 'user_id') : db.from(table).delete();
        // Absence readback must check the UUID even if the marker was changed.
        for (const [key, value] of filters) if (!read || table !== 'app_users' || key === 'user_id') query = query.eq(key, value);
        const result = await query;
        if (result.error) throw result.error;
        if (read && (!Array.isArray(result.data) || result.data.length)) throw new Error('Owned fixture absence readback failed.');
        attempts.push({project: account.project, step, status: 'passed'});
      } catch (error) {
        failures.push(`${account.project} ${step}: ${error.message ?? error}`);
        attempts.push({project: account.project, step, status: 'failed'});
      }
    }
  }
  return {failures, attempts};
}
