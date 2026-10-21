import { mapPublishConcurrent } from "../shared/publish-network.mjs";

const pageGroups = ['wiki', 'codesPages', 'tools', 'maps', 'quizzes', 'catalog', 'checklists'];
const published = (group, row) => row?.[group === 'checklists' ? 'is_public' : 'is_published'] === true;
// Stored franchise media uses this origin; arbitrary Supabase projects are not trusted.
const imageHosts = new Set(['media.bloxodes.com']);

export function franchiseImageUrl(value) {
  if (typeof value !== 'string' || !value.trim() || /[\s\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !imageHosts.has(url.hostname) || url.port || url.username || url.password || /\/Bloxodes(?:-(?:dark|light))?\.(png|webp|svg)$/i.test(url.pathname)) return null;
    return url.href;
  } catch { return null; }
}

export function requireFranchiseHubImages(game, label = game.slug) {
  const cover = franchiseImageUrl(game.cover_image);
  const thumbnail = franchiseImageUrl(game.hero_image);
  if (!cover || !thumbnail || cover === thumbnail) throw new Error(`${label}: publishing a hub/root requires a hosted landscape cover_image (16:10 to 2:1, ideally 16:9) and a separate square hero_image thumbnail. The Bloxodes logo is not game artwork.`);
  return [{ url: cover, role: 'cover', label }, { url: thumbnail, role: 'thumbnail', label }];
}

export function requireFranchiseCollectionImage(items, label) {
  if (!items.some(item => typeof item.image_key === 'string' && item.image_key.trim())) throw new Error(`${label}: publishing a collection requires at least one item image for cards and social previews.`);
}

/** Validate the effective post-upsert state before any publisher writes a row. */
export async function assertFranchisePageImages({ namespace, payload, storedGames, loadPage, verifyImage }) {
  const games = new Map(storedGames.map(game => [game.id, game]));
  for (const row of payload.games ?? []) games.set(row.id, { ...games.get(row.id), ...row });
  const images = [];
  let publishesRows = false;
  const root = [...games.values()].find(game => game.slug === namespace && !game.parent_id);
  if (!root) throw new Error(`${namespace}: image validation needs the owning namespace root.`);
  for (const row of payload.games ?? []) {
    const game = games.get(row.id);
    if (game.is_published) {
      publishesRows = true;
      images.push(...requireFranchiseHubImages(game));
    }
  }
  const pages = pageGroups.flatMap(group => (payload[group] ?? []).map(input => ({ group, input })));
  const storedPages = await mapPublishConcurrent(pages, ({ group, input }) => loadPage(group, input));
  for (let index = 0; index < pages.length; index++) {
    const { group, input } = pages[index];
    const row = { ...storedPages[index], ...input };
    if (!published(group, row)) continue;
    publishesRows = true;
    const game = games.get(row.game_id);
    if (!game || game.namespace !== namespace && game.namespace !== undefined) throw new Error(`${group}/${row.slug}: missing owning game for image validation.`);
    const label = `${namespace}/${group}/${row.slug}`;
    if (group === 'wiki') {
      images.push(...requireFranchiseHubImages(game, `${label} owning game`));
      if (row.cover_image != null) {
        const cover = franchiseImageUrl(row.cover_image);
        if (!cover) throw new Error(`${label}: cover_image must be a hosted game image.`);
        images.push({ url: cover, role: 'cover', label });
      }
    } else {
      // These are the actual image columns: only tools have page-owned artwork.
      const cover = (group === 'tools' && franchiseImageUrl(row.thumb_url)) || franchiseImageUrl(game.cover_image);
      if (!cover) throw new Error(`${label}: publishing requires a cover. Add ${group === 'tools' ? 'thumb_url or ' : ''}cover_image on owning game ${game.slug}.`);
      images.push({ url: cover, role: group === 'tools' && franchiseImageUrl(row.thumb_url) ? 'card' : 'cover', label });
    }
  }
  if (publishesRows && root.is_published) images.unshift(...requireFranchiseHubImages(root, `${namespace} root`));
  const seen = new Set();
  const unique = [];
  for (const image of images) {
    const key = `${image.role}:${image.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(image);
  }
  await mapPublishConcurrent(unique, verifyImage, { label: "page images" });
}
