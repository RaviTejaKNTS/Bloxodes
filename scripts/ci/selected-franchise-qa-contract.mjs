import fs from 'node:fs';
import path from 'node:path';
import {parseBatch, ownedPath} from './content-contract.mjs';

export const MANAGED_TARGET = 'https://bbtcaurrtyoukvjbxbbj.supabase.co';
export function assertSelectedQaEnvironment(env) {
  if (env.GITHUB_ACTIONS !== 'true' || env.BLOXODES_MANAGED_QA !== 'true' || env.BLOXODES_SELECTED_FRANCHISE_QA !== 'true' || env.BLOXODES_ENV_PROFILE !== 'process-only' || env.GITHUB_EVENT_NAME !== 'workflow_dispatch') throw new Error('Selected franchise QA requires explicit GitHub development dispatch.');
  for (const key of ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'ARTICLE_DEV_SUPABASE_URL', 'SUPABASE_MEDIA_PUBLIC_URL']) if (env[key] !== MANAGED_TARGET) throw new Error(`Unexpected managed target: ${key}`);
  if (env.BLOXODES_CONTENT_RELEASE || env.BLOXODES_MANAGED_RECEIPT || env.REVALIDATE_SECRET || env.BLOXODES_APPROVED_SHA || env.NODE_ENV === 'production') throw new Error('Production release inputs cannot enter selected development QA.');
  if (!/^[0-9a-f]{64}$/.test(env.BUNDLE_HASH ?? '') || env.BLOXODES_VERIFIED_BUNDLE !== env.BUNDLE_HASH) throw new Error('An immutable downloaded bundle is required.');
  if (env.TEST_BASE_URL !== 'http://bloxodes.test:3000') throw new Error('Selected QA preview must stay on the GitHub runner.');
}

// Validate even nonexistent paths before creating an empty text-only media directory.
export function bundleInput(base, relative, {directory = false, optional = false} = {}) {
  const absolute = path.resolve(ownedPath(base, relative));
  const root = fs.realpathSync(base);
  const parts = path.relative(root, absolute).split(path.sep);
  if (!parts.length || parts[0] === '..' || path.isAbsolute(parts.join(path.sep))) throw new Error('Input escapes the selected bundle.');
  let current = root;
  for (const part of parts) {
    current = path.join(current, part);
    if (!fs.existsSync(current)) continue;
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Selected inputs cannot contain symlinks.');
  }
  if (!optional && (!fs.existsSync(absolute) || (directory ? !fs.statSync(absolute).isDirectory() : !fs.statSync(absolute).isFile()))) throw new Error(`Missing selected input: ${relative}`);
  return absolute;
}
export function imagePolicy(document, evidence) {
  const missing = document.items.filter(row => !row.system?.image).map(row => row.system?.slug);
  if (!missing.length) return {requireImages: true, acceptedMissing: []};
  const gaps = evidence?.acceptedGaps;
  if (!Array.isArray(gaps) || evidence.acceptedGapCount !== missing.length || gaps.length !== missing.length || new Set(gaps.map(gap => gap.systemSlug)).size !== missing.length || gaps.some(gap => !missing.includes(gap.systemSlug) || gap.status !== 'text-only/accepted missing' || !gap.decisionReason?.trim())) throw new Error('Every missing image needs its exact reviewed accepted-gap record in images.json.');
  return {requireImages: false, acceptedMissing: missing};
}
const slug = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
/** @returns {{namespace: string, collections: Array<any>, pages: Array<{kind: string, path: string, row: any}>, games: Array<any>, urls: Array<{path: string, contains: string}>}} */
export function selectedFranchisePlan(base, input) {
  const batch = parseBatch(input);
  if (!batch.operations.length || batch.wikiReceipt) throw new Error('Select an explicit franchise content batch.');
  const namespaces = new Set(batch.operations.map(operation => operation.namespace));
  if (namespaces.size !== 1 || !slug([...namespaces][0]) || namespaces.has('roblox')) throw new Error('QA selects exactly one non-Roblox namespace.');
  const namespace = String([...namespaces][0]);
  const collections = [], pages = [], games = [];
  for (const operation of batch.operations) {
    if (!['franchise-collection', 'game-pages'].includes(operation.publisher)) throw new Error('Selected QA supports only shared identities, hubs, quizzes and franchise collections.');
    const file = bundleInput(base, operation.file);
    const payload = json(file);
    if (operation.publisher === 'game-pages') {
      if (!Object.keys(payload).length || Object.keys(payload).some(key => !['games', 'wiki', 'quizzes'].includes(key))) throw new Error('Only selected games, wiki and quizzes groups are supported.');
      for (const [group, rows] of Object.entries(payload)) {
        if (!Array.isArray(rows) || !rows.length || rows.length > 20) throw new Error('Invalid bounded page inventory.');
        for (const row of rows) {
          if (!slug(row.slug) || row.namespace !== undefined && row.namespace !== namespace || row.is_published !== true) throw new Error('Selected rows must be published, owned identities.');
          if (group === 'games') { games.push(row); continue; }
          const route = group === 'wiki' ? `/${namespace}/wiki${row.slug === namespace ? '' : `/${row.slug}`}` : `/${namespace}/quizzes/${row.slug}`;
          if (row.canonical_path !== undefined && row.canonical_path !== route) throw new Error('Unexpected selected canonical path.');
          pages.push({kind: group === 'wiki' ? 'hub' : 'quiz', path: route, row});
        }
      }
      continue;
    }
    const manifest = payload;
    if (manifest.schemaVersion !== 1 || manifest.namespace !== namespace || !slug(manifest.game?.slug) || !slug(manifest.collection?.slug) || !['database', 'collectible'].includes(manifest.collection.pageType)) throw new Error('Invalid explicit franchise manifest identity.');
    const relativeRoot = path.posix.dirname(operation.file);
    const resolve = (value, options) => {
      ownedPath('manifest', value); // Reject dot segments before joining.
      return bundleInput(base, relativeRoot === '.' ? value : `${relativeRoot}/${value}`, options);
    };
    const datasetFile = resolve(manifest.dataset), finalFile = resolve(manifest.finalJson ?? 'final.json');
    const mediaRoot = resolve(manifest.mediaRoot, {directory: true, optional: true});
    const dataset = json(datasetFile), final = json(finalFile);
    const route = `/${namespace}/wiki${manifest.game.slug === namespace ? '' : `/${manifest.game.slug}`}/${manifest.collection.slug}`;
    if (manifest.route !== route || dataset.meta?.schemaVersion !== 2 || dataset.meta.gameSlug !== manifest.game.slug || dataset.meta.collection !== manifest.collection.slug || !Array.isArray(dataset.items) || !dataset.items.length || dataset.items.length > 10000 || final.code !== `${manifest.game.slug}-${manifest.collection.slug}` || final.wiki_slug !== manifest.game.slug || final.collection_slug !== manifest.collection.slug) throw new Error('Selected dataset, final and route must match the manifest.');
    for (const row of dataset.items) if (row.system?.image) {
      const image = row.system.image.replace(/^media\//, '');
      bundleInput(base, `${path.relative(base, mediaRoot).split(path.sep).join('/')}/${image}`);
    }
    const evidenceFile = resolve('images.json', {optional: true});
    const imageEvidence = fs.existsSync(evidenceFile) ? json(evidenceFile) : null;
    const policy = imagePolicy(dataset, imageEvidence);
    collections.push({path: route, manifestFile: file, datasetFile, finalFile, mediaRoot, manifest, dataset, final, policy, imageEvidence});
  }
  const paths = [...collections.map(collection => collection.path), ...pages.map(page => page.path)];
  const urlPaths = new Set(batch.urls.map(url => url.path));
  if (!paths.length || paths.length > 20 || new Set(paths).size !== paths.length || urlPaths.size !== batch.urls.length || urlPaths.size !== paths.length || paths.some(route => !urlPaths.has(route))) throw new Error('Batch URLs must exactly match the selected page inventory.');
  if (batch.events.some(event => event.type !== 'game_content' || event.slug !== namespace)) throw new Error('Selected QA requires namespace-scoped game_content events.');
  return {namespace, collections, pages, games, urls: batch.urls};
}

export function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, stable(child)]));
  return value;
}

// Compare the whole web workspace so new build config cannot silently escape the
// proof. Only non-runtime guidance, browser tests and their config are excluded.
export function assertLiveSourceEquivalent(changedPaths) {
  const changed = changedPaths.filter(file => {
    if (file.endsWith('/AGENTS.md')) return false;
    if (file.startsWith('apps/web/')) return !file.startsWith('apps/web/e2e/') && !/^apps\/web\/(?:playwright|vitest)\.config\.[^/]+$/.test(file);
    return file.startsWith('data/') || file.startsWith('types/') ||
      /^apps\/[^/]+\/package(?:-lock)?\.json$/.test(file) ||
      /^(?:Dockerfile|\.dockerignore|\.npmrc|package(?:-lock)?\.json|(?:next|tailwind|postcss)\.config\.[^/]+|tsconfig(?:\.[^/]+)?\.json)$/.test(file) ||
      file === 'scripts/ops/run-with-production-build-env.mjs';
  });
  if (changed.length) throw new Error(`Preview runtime differs from live production: ${changed.join(', ')}`);
  return changed;
}

export function selectedReviewImages(dataset, evidence) {
  const explicit = dataset.meta.gameSlug === 'mario-kart-world'
    ? {characters: 'donkey-kong', outfits: 'donkey-kong-default'}[dataset.meta.collection] : null;
  const flagged = new Set((evidence?.items ?? []).filter(item => /transparent|contrast/i.test(item.visualReview ?? '')).map(item => item.name));
  return dataset.items.filter(row => row.system.image && (row.system.slug === explicit || flagged.has(row.item.name))).slice(0, 8).map(row => row.item.name);
}

const fieldLabel = key => key.replace(/[_-]/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(' ').filter(Boolean).map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
function fieldText(value, collectible) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(child => fieldText(child, collectible)).filter(Boolean).join('; ');
  if (typeof value === 'object') return Object.entries(value).map(([key, child]) => {
    const text = fieldText(child, collectible);
    return text ? `${!collectible && /^\d+$/.test(key) ? `Lv. ${key}` : fieldLabel(key)}: ${text}` : '';
  }).filter(Boolean).join('; ');
  if (!collectible && typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (!collectible && typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString('en-US') : '';
  const text = String(value).replace(/\s+/g, ' ').trim();
  return !collectible && /^(none|n\/a|na|null)$/i.test(text) ? '' : text;
}
/** Visible, non-identity facts for the explicit v2 display used by selected QA. */
export function collectionVisibleFacts(display, item, view, pageType, statLabels = {}) {
  if (!['cards', 'list'].includes(view)) throw new Error('Unknown collection view.');
  const collectible = pageType === 'collectible';
  const primary = collectible ? null : display.cardDescriptionField ?? display.descriptionField;
  // Collectible cards and tables intentionally share cardFields in the runtime.
  const collectibleFields = [...(display.cardFields ?? []), ...(typeof item.location === 'string' && item.location.trim() ? ['location'] : [])];
  const keys = collectible ? collectibleFields.length ? collectibleFields : ['region', 'location', 'landmark', 'access', 'requirements', 'reward', 'coordinates', 'approach', 'vehicle', 'environment', 'animalForm', 'notes']
    : [display.badgeField, ...(display.subtitleFields ?? []), ...(display[view === 'cards' ? 'cardFields' : 'tableFields'] ?? []), display.descriptionField, display.cardDescriptionField];
  return [...new Set(keys)].filter(key => key && !key.startsWith('__') && !['id', 'slug', 'name', 'image', 'tracklist'].includes(key)).flatMap(key => {
    let text = fieldText(item[key], collectible);
    const presentation = display.fieldPresentation?.[key];
    if (!text || /^https?:/i.test(text) || presentation === 'video' || presentation?.kind === 'video') return [];
    const description = key === primary;
    const configuredLabel = typeof presentation === 'object' ? presentation.label : null;
    const isStat = key !== display.badgeField && !(display.subtitleFields ?? []).includes(key) && key !== display.descriptionField && key !== display.cardDescriptionField;
    const definitionLabel = configuredLabel || (!collectible && isStat ? statLabels[key] : null) || fieldLabel(key);
    let label = description ? ['cardsummary', 'card_summary', 'summary', 'description', 'overview'].includes(key.toLowerCase()) ? 'Description' : fieldLabel(key) : definitionLabel;
    if (!collectible && !description) {
      const boolean = typeof item[key] === 'boolean' ? item[key] : /^(yes|true)$/i.test(text) ? true : /^(no|false)$/i.test(text) ? false : null;
      const lower = definitionLabel.toLowerCase();
      if (boolean !== null) {
        const fragment = subject => { const humanized = fieldLabel(subject); return humanized[0].toLowerCase() + humanized.slice(1); };
        if (['available', 'availability', 'obtainable'].includes(lower)) { text = boolean ? lower === 'obtainable' ? 'Obtainable' : 'Available' : lower === 'obtainable' ? 'Not obtainable' : 'Not available'; if (view === 'cards' && !configuredLabel) label = 'Status'; }
        else if (lower.startsWith('has ')) { text = boolean ? `Has ${fragment(definitionLabel.slice(4))}` : `No ${fragment(definitionLabel.slice(4))}`; if (view === 'cards' && !configuredLabel) label = 'Status'; }
        else if (lower.startsWith('is ')) { text = boolean ? fieldLabel(definitionLabel.slice(3)) : `Not ${fragment(definitionLabel.slice(3))}`; if (view === 'cards' && !configuredLabel) label = 'Status'; }
        else if (lower.startsWith('part of ')) { text = boolean ? `Part of ${fragment(definitionLabel.slice(8))}` : `Not part of ${fragment(definitionLabel.slice(8))}`; if (view === 'cards' && !configuredLabel) label = 'Status'; }
        else if (lower.startsWith('can ')) { text = boolean ? `Can ${fragment(definitionLabel.slice(4))}` : `Cannot ${fragment(definitionLabel.slice(4))}`; if (view === 'cards' && !configuredLabel) label = 'Status'; }
        else if (['tradable', 'tradeable', 'limited', 'craftable'].includes(lower)) { text = boolean ? fieldLabel(definitionLabel) : `Not ${fragment(definitionLabel)}`; if (view === 'cards' && !configuredLabel) label = 'Status'; }
        else text = boolean ? 'Yes' : 'No';
      } else if (view === 'cards' && !configuredLabel && ['availability', 'available', 'status'].includes(lower) && /\b(retired|removed|unavailable|not available|trade only|unobtainable|not obtainable|disabled|inactive|event|limited|seasonal|early access|exclusive|shop pool|random roll|maintain|available|current|free|default|source-backed|public|private server|obtainable|complete)\b/i.test(text)) label = 'Status';
    }
    return [{key, label, text, description}];
  });
}

// Each operation is isolated: even rejected promises cannot skip revocation,
// user deletion, another owned account, or the final absence readbacks.
export async function cleanupOwnedAccounts(db, accounts) {
  const failures = [], attempts = [];
  for (const account of accounts) {
    const scoped = (table, read) => {
      const query = read ? db.from(table).select(table === 'app_sessions' ? 'id' : 'user_id') : db.from(table).delete();
      if (table === 'app_sessions') return query.eq('id', account.sessionId).eq('user_id', account.userId);
      if (table === 'app_users') return query.eq('user_id', account.userId);
      return query.eq('namespace', account.namespace).eq('user_id', account.userId);
    };
    for (const read of [false, true]) for (const table of ['game_collection_progress', 'game_quiz_progress', 'app_sessions', 'app_users']) {
      const step = `${read ? 'absence' : 'delete'}:${table}`;
      try {
        const result = await scoped(table, read);
        if (result.error) throw result.error;
        if (read && (!Array.isArray(result.data) || result.data.length)) throw new Error('Owned fixture remains or absence readback is invalid.');
        attempts.push({project: account.project, step, status: 'passed'});
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error?.message ?? error);
        failures.push(`${account.project} ${step}: ${message}`);
        attempts.push({project: account.project, step, status: 'failed'});
      }
    }
  }
  return {failures, attempts};
}
