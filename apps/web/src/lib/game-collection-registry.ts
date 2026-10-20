import "server-only";
import { cache } from "react";
import { publicContentCache } from "./public-content-cache";
import { supabaseAdmin } from "./supabase";
import { readGameCollectionGroups } from "./game-collections/registry";

export const listGameCollectionGroups = cache(publicContentCache(
  async () => {
    try {
      return await readGameCollectionGroups(supabaseAdmin());
    } catch (error) {
      console.error("Collection navigation registry is unavailable; omitting registry navigation.", error);
      return [];
    }
  },
  ["roblox-wiki-registry-v1"],
  { tags: ["wiki-index", "collection-index"] }
));

export async function listGameCollectionConfigs() {
  return (await listGameCollectionGroups()).flatMap(group => group.collectionConfigs);
}

export async function getGameCollectionConfigByCode(code: string) {
  return (await listGameCollectionConfigs()).find(entry => entry.code === code.trim().toLowerCase()) ?? null;
}
