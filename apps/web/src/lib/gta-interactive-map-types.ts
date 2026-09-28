export type GtaMapViewDefinition = {
  slug: string;
  label: string;
  asset: string;
  sourceTitle: string;
  sourceUrl: string;
  image: string;
  width: number;
  height: number;
};

export type GtaMapCollectionLink = {
  wikiSlug: string;
  collectionSlug: string;
};

export type GtaMapLayerDefinition = {
  slug: string;
  label: string;
  group: string;
  color: string;
  sourceTitle: string;
  sourceUrl: string;
  view: string;
  collection: GtaMapCollectionLink | null;
  categoryIds: string[] | null;
  mode: string[] | null;
  defaultEnabled: boolean;
  note?: string;
  pointCount: number;
  collectionCount: number | null;
};

export type GtaMapOption = {
  value: string;
  label: string;
};

export type GtaMapGuideDefinition = {
  wikiSlug: string;
  collectionSlug: string;
  label: string;
  note?: string;
  href: string;
};

export type GtaMapDefinition = {
  slug: string;
  wikiSlug: string;
  title: string;
  mapTitle: string;
  description: string;
  summary: string;
  route: string;
  views: GtaMapViewDefinition[];
  layers: GtaMapLayerDefinition[];
  modes: GtaMapOption[];
  defaultMode?: string | null;
  editionOptions: GtaMapOption[];
  defaultEdition?: string | null;
  variantOptions: GtaMapOption[];
  defaultVariant?: string | null;
  guideOnly: GtaMapGuideDefinition[];
  about: string[];
  mappedPointCount: number;
  retrievedAt: string;
};

export type GtaMapPointRecord = {
  id: string;
  layer: string;
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string;
  view: string;
  x: number;
  y: number;
  title: string;
  area: string;
  description: string;
  category: string;
  number: number | null;
  collectionNumber: number | null;
  collectionName: string | null;
  referenceOnly: boolean;
  mode: string[] | null;
  edition: string | null;
  variant: string | null;
  seasonal?: boolean;
  sourceImage: string | null;
};

export type GtaMapLayer = GtaMapLayerDefinition & {
  collectionCode: string | null;
  guideUrl: string | null;
  collectionAvailable: boolean;
};

export type GtaMapFact = {
  label: string;
  value: string;
};

export type GtaMapMarker = GtaMapPointRecord & {
  name: string;
  layerLabel: string;
  color: string;
  group: string;
  collectionCode: string | null;
  checkId: string | null;
  guideUrl: string | null;
  image: string | null;
  facts: GtaMapFact[];
  note: string | null;
};

export type GtaMapGuide = GtaMapGuideDefinition & {
  title: string;
  count: number;
  code: string;
};

export type GtaMapPageData = {
  config: GtaMapDefinition;
  layers: GtaMapLayer[];
  markers: GtaMapMarker[];
  guides: GtaMapGuide[];
  hubTitle: string;
  hubPath: string;
};
