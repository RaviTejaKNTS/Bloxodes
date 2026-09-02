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

export type GameCollectionCopyInput = {
  config: GameCollectionConfig;
  itemCount: number;
  columns: string[];
  imageUrls: string[];
};

export type GameCollectionCopy = {
  code: string;
  title: string;
  seo_title: string;
  meta_description: string;
  intro_md: string;
  description_md: string;
  how_it_works_md: string;
  description_json: Record<string, string>;
  faq_json: Array<{ q: string; a: string }>;
  cta_label: string;
  cta_url: string;
  wiki_md: string;
  wiki_sort_order: number;
  wiki_item_count: number;
  thumb_url: string | null;
};
