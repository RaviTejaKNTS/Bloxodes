import { unwrapDatasetItems } from "@/lib/local-datasets";
import { getPublishedWikiCollectionRuntimeByCode } from "@/lib/wiki-collection-runtime";

export type GrowGarden2Crop = {
  id: string;
  name: string;
  price: string | null;
  rarity: string | null;
  harvestType: string | null;
  availability: string | null;
  whereToGet: string | null;
  image: string | null;
};

export type GrowGarden2Mutation = {
  id: string;
  name: string;
  multiplier: number | null;
  multiplierLabel: string;
  whereToGet: string | null;
  bestUse: string | null;
  image: string | null;
};

export type GrowGarden2ValueDataset = {
  crops: GrowGarden2Crop[];
  mutations: GrowGarden2Mutation[];
  updatedAt: string | null;
  sources: { label: string; url: string }[];
};

type SourceRow = {
  label?: string | null;
  url?: string | null;
  accessed?: string | null;
};

type CropRow = Partial<GrowGarden2Crop> & { slug?: string | null };
type MutationRow = {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
  multiplier?: string | null;
  whereToGet?: string | null;
  bestUse?: string | null;
  image?: string | null;
};

type DatasetJson<T> = {
  meta?: {
    schemaVersion?: number | null;
    updatedAt?: string | null;
    sources?: SourceRow[] | null;
  } | null;
  items?: Array<T | { item?: T; system?: Record<string, unknown> }> | null;
};

function parseMultiplier(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = value.replace(/x/gi, "").replace(/,/g, "").trim();
  if (!normalized || /unknown/i.test(normalized)) return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSources(rows: SourceRow[] | null | undefined) {
  return (rows ?? [])
    .map((source) => ({
      label: source.label?.trim() ?? "",
      url: source.url?.trim() ?? ""
    }))
    .filter((source) => source.label && source.url);
}

async function readJson<T>(code: string): Promise<DatasetJson<T>> {
  const runtime = await getPublishedWikiCollectionRuntimeByCode(code);
  if (!runtime) {
    throw new Error(`Required database runtime for ${code} did not load. Local fallback is disabled.`);
  }
  return runtime.document as DatasetJson<T>;
}

export async function loadGrowGarden2ValueDataset(): Promise<GrowGarden2ValueDataset> {
  const [seedJson, mutationJson] = await Promise.all([
    readJson<CropRow>("grow-a-garden-2-seeds"),
    readJson<MutationRow>("grow-a-garden-2-mutations")
  ]);

  const crops = unwrapDatasetItems(seedJson)
    .map((row): GrowGarden2Crop | null => {
      const name = row.name?.trim();
      const id = row.id?.trim() ?? row.slug?.trim();
      if (!name || !id) return null;
      return {
        id,
        name,
        price: row.price?.trim() || null,
        rarity: row.rarity?.trim() || null,
        harvestType: row.harvestType?.trim() || null,
        availability: row.availability?.trim() || null,
        whereToGet: row.whereToGet?.trim() || null,
        image: row.image?.trim() || null
      };
    })
    .filter((row): row is GrowGarden2Crop => Boolean(row));

  const mutations = unwrapDatasetItems(mutationJson)
    .map((row): GrowGarden2Mutation | null => {
      const name = row.name?.trim();
      const id = row.id?.trim() ?? row.slug?.trim();
      if (!name || !id) return null;
      const multiplierLabel = row.multiplier?.trim() || "Unknown";
      return {
        id,
        name,
        multiplier: parseMultiplier(row.multiplier),
        multiplierLabel,
        whereToGet: row.whereToGet?.trim() || null,
        bestUse: row.bestUse?.trim() || null,
        image: row.image?.trim() || null
      };
    })
    .filter((row): row is GrowGarden2Mutation => Boolean(row));

  return {
    crops,
    mutations,
    updatedAt: mutationJson.meta?.updatedAt ?? seedJson.meta?.updatedAt ?? null,
    sources: [
      ...normalizeSources(seedJson.meta?.sources),
      ...normalizeSources(mutationJson.meta?.sources)
    ]
  };
}
