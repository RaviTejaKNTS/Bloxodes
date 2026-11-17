import "server-only";
import { requestCache } from "@/lib/request-cache";
import { createGameReader } from "./shared-game-reader";

/** Share the rendering read with metadata, without a second collection query. */
export const loadGameWikiHubCollections = requestCache(async (namespace: string, slug: string, kind: string) =>
  kind === "franchise" ? [] : createGameReader(namespace).listPublishedSharedGameWikiCollectionsByWikiSlug(slug)
);
