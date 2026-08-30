import { GAME_COLLECTION_GROUPS } from "./games";

export const DATABASE_ONLY_GAME_COLLECTION_SLUGS = new Set([
  "1-speed-keyboard-escape",
  "99-nights-in-the-forest",
  "brookhaven-rp",
  "dress-to-impress",
  "grow-a-garden",
  "jujutsu-shenanigans",
  "murderers-vs-sheriffs",
  "rivals",
  "sell-lemons",
  "slime-rng",
  "survive-zombie-arena",
  "the-forge",
  "wizard-alchemy",
  "bee-swarm-simulator",
  "blue-lock-rivals",
  "build-a-boat-for-treasure",
  "doors",
  "flee-the-facility",
  "tower-defense-simulator",
  "volleyball-legends",
  "welcome-to-bloxburg"
]);

const DATABASE_ONLY_GAME_COLLECTION_CODES = new Set(
  GAME_COLLECTION_GROUPS
    .filter((group) => DATABASE_ONLY_GAME_COLLECTION_SLUGS.has(group.gameSlug))
    .flatMap((group) => group.collections.map((collectionSlug) => `${group.gameSlug}-${collectionSlug}`))
);

export function isDatabaseOnlyGameCollectionGame(gameSlug: string): boolean {
  return DATABASE_ONLY_GAME_COLLECTION_SLUGS.has(gameSlug.trim().toLowerCase());
}

export function isDatabaseOnlyGameCollectionCode(code: string): boolean {
  return DATABASE_ONLY_GAME_COLLECTION_CODES.has(code.trim().toLowerCase());
}
