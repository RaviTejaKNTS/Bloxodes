export type GameCollectionGroup = {
  gameSlug: string;
  gameName: string;
  universeId?: number;
  universeNames: string[];
  collections: string[];
};

export type GameCollectionConfig = {
  code: string;
  gameSlug: string;
  gameName: string;
  slug: string;
  label: string;
  sortOrder: number;
  universeNames: string[];
};

export type GameCollectionRenderConfig = Pick<
  GameCollectionConfig,
  "code" | "gameSlug" | "gameName" | "slug" | "label" | "sortOrder"
>;
