import { supabaseAdmin } from "@/lib/supabase";
import {
  DEFAULT_MESH_SORT,
  normalizeMeshSearch,
  normalizeMeshSort,
  type MeshSortKey
} from "@/lib/roblox-mesh-ids-search";

export const MESH_IDS_PAGE_SIZE = 40;

export type RobloxMeshId = {
  asset_id: number;
  mesh_id: number;
  texture_id: number | null;
  name: string;
  creator_name: string | null;
  creator_verified: boolean | null;
  source_rank: number;
  thumbnail_url: string | null;
  creator_store_url: string;
  roblox_created_at: string | null;
  roblox_updated_at: string | null;
  verified_at: string | null;
};

export type MeshIdsPageData = {
  meshes: RobloxMeshId[];
  total: number;
  totalPages: number;
};

const SELECT_FIELDS =
  "asset_id, mesh_id, texture_id, name, creator_name, creator_verified, source_rank, thumbnail_url, creator_store_url, roblox_created_at, roblox_updated_at, verified_at";

type OrderableQuery<T> = { order: (...args: any[]) => T };

function buildLoosePattern(value: string): string {
  const cleaned = value.replace(/[%_]/g, " ").trim();
  const pattern = cleaned.replace(/[^a-z0-9]+/gi, "%").replace(/%{2,}/g, "%");
  return `%${pattern}%`;
}

function applySort<T extends OrderableQuery<T>>(query: T, sort: MeshSortKey): T {
  if (sort === "name") {
    return query.order("name", { ascending: true }).order("asset_id", { ascending: true });
  }
  if (sort === "newest") {
    return query
      .order("roblox_created_at", { ascending: false, nullsFirst: false })
      .order("asset_id", { ascending: true });
  }
  if (sort === "oldest") {
    return query
      .order("roblox_created_at", { ascending: true, nullsFirst: false })
      .order("asset_id", { ascending: true });
  }
  if (sort === "updated") {
    return query
      .order("roblox_updated_at", { ascending: false, nullsFirst: false })
      .order("asset_id", { ascending: true });
  }
  return query.order("source_rank", { ascending: true }).order("asset_id", { ascending: true });
}

export async function loadRobloxMeshIdsPageData(
  page: number,
  { query = "", sort = DEFAULT_MESH_SORT }: { query?: string; sort?: MeshSortKey } = {}
): Promise<MeshIdsPageData> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const normalizedQuery = normalizeMeshSearch(query);
  const normalizedSort = normalizeMeshSort(sort);
  const offset = (safePage - 1) * MESH_IDS_PAGE_SIZE;
  const supabase = supabaseAdmin();
  let request = supabase
    .from("roblox_mesh_ids")
    .select(SELECT_FIELDS, { count: "exact" })
    .eq("status", "active")
    .eq("thumbnail_state", "Completed")
    .not("thumbnail_url", "is", null);

  if (normalizedQuery) {
    const filters = [
      `name.ilike.${buildLoosePattern(normalizedQuery)}`,
      `creator_name.ilike.${buildLoosePattern(normalizedQuery)}`
    ];
    if (/^\d+$/.test(normalizedQuery)) {
      filters.unshift(
        `asset_id.eq.${normalizedQuery}`,
        `mesh_id.eq.${normalizedQuery}`,
        `texture_id.eq.${normalizedQuery}`
      );
    }
    request = request.or(filters.join(","));
  }

  const { data, error, count } = await applySort(request, normalizedSort).range(
    offset,
    offset + MESH_IDS_PAGE_SIZE - 1
  );
  if (error) {
    console.error("Failed to load Roblox mesh IDs", error);
    return { meshes: [], total: 0, totalPages: 1 };
  }
  const total = count ?? data?.length ?? 0;
  return {
    meshes: (data ?? []) as RobloxMeshId[],
    total,
    totalPages: Math.max(1, Math.ceil(total / MESH_IDS_PAGE_SIZE))
  };
}
