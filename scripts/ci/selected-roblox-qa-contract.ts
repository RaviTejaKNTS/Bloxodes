/** Shared expectations for selected Roblox backend and Playwright QA.
 * Keep this import graph free of the backend runner and its I/O dependencies.
 */
import {markdownToPlainText} from '../../apps/web/src/lib/markdown';

export class QaFailure extends Error {}
// Same target as the franchise contract, without importing its file/bundle graph.
const MANAGED_TARGET = 'https://bbtcaurrtyoukvjbxbbj.supabase.co';
export function assertEnvironment(env: Record<string, string | undefined>, downloaded = true) {
  if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || env.BLOXODES_MANAGED_QA !== 'true' || env.BLOXODES_SELECTED_ROBLOX_QA !== 'true' || env.BLOXODES_ENV_PROFILE !== 'process-only' || !env.RUNNER_TEMP || !env.GITHUB_RUN_ID || !env.GITHUB_RUN_ATTEMPT) throw new QaFailure('Selected Roblox QA requires explicit GitHub development dispatch.');
  for (const key of ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'ARTICLE_DEV_SUPABASE_URL', 'SUPABASE_MEDIA_PUBLIC_URL']) if (env[key] !== MANAGED_TARGET) throw new QaFailure(`Unexpected managed target: ${key}`);
  if (env.TEST_BASE_URL !== 'http://bloxodes.test:3000' || env.NODE_ENV === 'production' || ['BLOXODES_CONTENT_RELEASE', 'BLOXODES_MANAGED_RECEIPT', 'BLOXODES_APPROVED_SHA', 'REVALIDATE_SECRET', 'BLOXODES_SELECTED_FRANCHISE_STAGE'].some(key => env[key])) throw new QaFailure('Production/staging inputs cannot enter selected Roblox QA.');
  if (!/^[0-9a-f]{64}$/.test(env.BUNDLE_HASH ?? '') || downloaded && (env.BLOXODES_VERIFIED_BUNDLE !== env.BUNDLE_HASH || env.BATCH !== `content/releases/${env.BUNDLE_HASH}/batch.json`)) throw new QaFailure('Select the exact downloaded immutable bundle.');
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
