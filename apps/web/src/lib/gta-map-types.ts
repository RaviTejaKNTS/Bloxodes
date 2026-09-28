export const GTA5_MAP_PATH = "/gta/maps/gta5";

export const GTA5_MAP_LAYERS = [
  { slug: "spaceship-parts", label: "Spaceship parts", shortLabel: "Parts", color: "#a38be4", group: "Collectibles", count: 50 },
  { slug: "letter-scraps", label: "Letter scraps", shortLabel: "Letters", color: "#df9a6c", group: "Collectibles", count: 50 },
  { slug: "nuclear-waste", label: "Nuclear waste", shortLabel: "Waste", color: "#87c9bd", group: "Collectibles", count: 30 },
  { slug: "submarine-pieces", label: "Submarine pieces", shortLabel: "Sub pieces", color: "#86a7d9", group: "Collectibles", count: 30 },
  { slug: "monkey-mosaics", label: "Monkey mosaics", shortLabel: "Mosaics", color: "#d9aa76", group: "Collectibles", count: 50 },
  { slug: "peyote-plants", label: "Peyote plants", shortLabel: "Peyote", color: "#9ec978", group: "Collectibles", count: 27 },
  { slug: "epsilon-tracts", label: "Epsilon tracts", shortLabel: "Tracts", color: "#8dbad8", group: "Collectibles", count: 10 },
  { slug: "hidden-packages", label: "Hidden packages", shortLabel: "Packages", color: "#e2c07d", group: "Collectibles", count: 15 },
  { slug: "stunt-jumps", label: "Stunt jumps", shortLabel: "Jumps", color: "#e6c26e", group: "Challenges", count: 50 },
  { slug: "under-the-bridge", label: "Under the Bridge", shortLabel: "Bridges", color: "#7bb9ad", group: "Challenges", count: 50 },
  { slug: "knife-flights", label: "Knife flights", shortLabel: "Flights", color: "#7ca8da", group: "Challenges", count: 15 },
  { slug: "landmarks", label: "Landmarks", shortLabel: "Landmarks", color: "#e6b46c", group: "Places", count: 37 },
  { slug: "services", label: "Hospitals & services", shortLabel: "Services", color: "#df8c8c", group: "Places", count: 29 },
  { slug: "transport", label: "Travel", shortLabel: "Travel", color: "#89b5d9", group: "Places", count: 13 },
  { slug: "nature", label: "Natural places", shortLabel: "Nature", color: "#9bc18c", group: "Places", count: 13 }
] as const;

export type Gta5MapLayerSlug = (typeof GTA5_MAP_LAYERS)[number]["slug"];
export type Gta5MapFact = { label: string; value: string };
export type Gta5MapMarker = {
  id: string;
  number: number;
  layer: Gta5MapLayerSlug;
  name: string;
  area: string;
  description: string;
  facts: Gta5MapFact[];
  image: string | null;
  x: number;
  y: number;
  guideUrl: string | null;
  collectionCode: string | null;
  walkthroughUrl?: string | null;
};
