import assert from 'node:assert/strict';
import test from 'node:test';
import { assertFranchisePageImages, franchiseImageUrl, requireFranchiseCollectionImage, requireFranchiseHubImages } from '../franchise-image-contract.mjs';

const root = { id: 'root', namespace: 'example', slug: 'example', kind: 'franchise', parent_id: null, is_published: true, cover_image: 'https://media.bloxodes.com/root-cover.webp', hero_image: 'https://media.bloxodes.com/root-square.webp' };
const game = { ...root, id: 'game', slug: 'child', kind: 'game', parent_id: 'root', cover_image: 'https://media.bloxodes.com/child-cover.webp', hero_image: 'https://media.bloxodes.com/child-square.webp' };
const page = { game_id: 'game', slug: 'quiz', is_published: true };
async function validate(payload, { games = [root, game], stored = {} } = {}) {
  const verified = [];
  await assertFranchisePageImages({ namespace: 'example', payload, storedGames: games, loadPage: async group => stored[group], verifyImage: async image => verified.push(image) });
  return verified;
}

test('hubs and namespace roots require separate cover and square artwork', async () => {
  for (const bad of [{ cover_image: null }, { hero_image: '' }, { hero_image: root.cover_image }, { cover_image: 'https://bloxodes.com/Bloxodes.png' }]) {
    await assert.rejects(validate({ games: [{ ...root, ...bad }] }), /hub\/root requires/);
  }
  assert.equal(requireFranchiseHubImages(root).length, 2);
});

test('all cover-dependent page families use their own game, never the franchise or a sibling', async () => {
  for (const group of ['codesPages', 'tools', 'maps', 'quizzes', 'catalog', 'checklists']) {
    const row = { ...page, ...(group === 'checklists' ? { is_public: true } : {}) };
    const verified = await validate({ [group]: [row] });
    assert.ok(verified.some(image => image.url === game.cover_image));
    await assert.rejects(validate({ [group]: [row] }, { games: [root, { ...game, cover_image: null }] }), /publishing requires a cover/);
  }
});

test('a tool can have its own card artwork while other pages cannot invent image columns', async () => {
  const missingCover = { ...game, cover_image: null };
  const thumb = 'https://media.bloxodes.com/tool.webp';
  const images = await validate({ tools: [{ ...page, thumb_url: thumb }] }, { games: [root, missingCover] });
  assert.ok(images.some(image => image.url === thumb && image.role === 'card'));
  await assert.rejects(validate({ quizzes: [{ ...page, image: thumb }] }, { games: [root, missingCover] }), /publishing requires a cover/);
});

test('partial published updates inherit stored state and explicit null overrides cannot bypass checks', async () => {
  await assert.rejects(validate({ quizzes: [{ game_id: game.id, slug: page.slug, title: 'New title' }] }, { games: [root, { ...game, cover_image: null }], stored: { quizzes: page } }), /publishing requires a cover/);
  await assert.rejects(validate({ games: [{ ...game, hero_image: null }] }), /hub\/root requires/);
  await assert.rejects(validate({ wiki: [page] }, { games: [root, { ...game, hero_image: null }] }), /hub\/root requires/);
  await assert.rejects(validate({ wiki: [{ ...page, cover_image: '/Bloxodes.png' }] }), /hosted game image/);
});

test('draft rows can retain image gaps, and unpublishing is allowed', async () => {
  await validate({ quizzes: [{ ...page, is_published: false }] }, { games: [root, { ...game, cover_image: null }] });
  await validate({ games: [{ ...root, is_published: false, cover_image: null, hero_image: null }] });
});

test('the complete image plan is rejected before any availability checks run', async () => {
  let requests = 0;
  await assert.rejects(assertFranchisePageImages({ namespace: 'example', payload: { quizzes: [page] }, storedGames: [root, { ...game, cover_image: null }], loadPage: async () => null, verifyImage: async () => { requests++; } }), /publishing requires a cover/);
  assert.equal(requests, 0);
});

test('image URLs reject placeholders, credentials and unsafe schemes', () => {
  for (const image of [null, '', '/cover.webp', '//media.bloxodes.com/a.png', 'javascript:alert(1)', 'https://user:secret@example.com/a.png', 'https://bloxodes.com/Bloxodes.png?version=1', 'https://example.com/a\\b.png']) assert.equal(franchiseImageUrl(image), null);
  assert.equal(franchiseImageUrl('https://media.bloxodes.com/a.webp'), 'https://media.bloxodes.com/a.webp');
});

test('collections require an item image even when individual image gaps are accepted', () => {
  assert.throws(() => requireFranchiseCollectionImage([{ image_key: null }], 'child-items'), /at least one item image/);
  assert.doesNotThrow(() => requireFranchiseCollectionImage([{ image_key: null }, { image_key: 'wiki/example/item.webp' }], 'child-items'));
});
