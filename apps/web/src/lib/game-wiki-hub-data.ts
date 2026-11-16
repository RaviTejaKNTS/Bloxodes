import "server-only";
import { cache } from "react";
import { createGameReader } from "./shared-game-reader";

/** Share the rendering read with metadata, without a second collection query. */
export const loadGameWikiHubCollections = cache(async (namespace: string, slug: string, kind: string) =>
  kind === "franchise" ? [] : createGameReader(namespace).listPublishedSharedGameWikiCollectionsByWikiSlug(slug)
);
