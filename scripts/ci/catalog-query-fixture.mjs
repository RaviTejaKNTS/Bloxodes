// CI-only PostgREST fixture shared by unit tests and the built-route harness.
// It evaluates filters, ordering and ranges, rather than returning canned pages.
export function catalogRows(kind, count, start = 1000) {
  return Array.from({ length: count }, (_, index) => ({
    asset_id: start + index, texture_id: start + 10000 + index,
    mesh_id: start + 20000 + index, title: `Fixture song ${start + index}`,
    name: `Fixture crosshair ${start + index}`, artist: "Fixture artist", album: "Fixture album",
    genre: "Fixture genre", description: "Fixture image", creator_name: "Fixture creator",
    duration_seconds: kind === "short" ? 10 : 60, duration_bucket: 1,
    popularity_score: 10, vote_count: 10, last_seen_at: "2026-01-01T00:00:00Z",
    rank: 1, game_sort_order: 1, source_rank: 1, curated_rank: 1, curated_score: 10,
    categories: ["faces", "anime", "posters"], status: "active", thumbnail_state: "Completed",
    thumbnail_url: "https://media.bloxodes.com/fixture.png",
    creator_store_url: `https://create.roblox.com/store/asset/${start + index}`,
    roblox_created_at: "2026-01-01T00:00:00Z", roblox_updated_at: "2026-01-01T00:00:00Z"
  }));
}

export function defaultCatalogTables() {
  // Browser searches select multiple pages but exclude other eligible rows.
  // Alphabetic order reverses the default ID tie-breaker within that subset.
  const browserRows = (kind, count, start, subsetCount) => catalogRows(kind, count, start).map((row, index) => {
    const label = `Fixture ${index < subsetCount ? "Subset" : "Other"} ${String(count - index).padStart(3, "0")}`;
    return { ...row, title: `${label} song ${row.asset_id}`, name: `${label} crosshair ${row.asset_id}` };
  });
  const music = browserRows("music", 49, 1000, 32);
  const decals = browserRows("decal", 49, 3000, 32);
  return {
    roblox_music_ids_ranked_view: [...music, ...browserRows("short", 49, 2000, 0)],
    roblox_music_ids_game_view: music.map(row => ({ ...row, game_slug: "jujutsu-shenanigans" })),
    roblox_decal_ids: [...decals, { ...decals[0], name: "Fixture Other crosshair 3999", asset_id: 3999, texture_id: null },
      { ...decals[0], asset_id: 4000, status: "inactive" },
      { ...decals[0], asset_id: 4001, thumbnail_state: "Pending" },
      { ...decals[0], asset_id: 4002, thumbnail_url: "https://example.com/UnknownImage/1.png" }],
    roblox_decal_ids_game_view: decals.map(row => ({ ...row, game_slug: "bloxstrike" })),
    roblox_mesh_ids: [...browserRows("mesh", 81, 5000, 60),
      { ...catalogRows("mesh", 1, 5999)[0], thumbnail_state: "Pending" }]
  };
}

function matches(row, column, expression) {
  const dot = expression.indexOf(".");
  const operator = expression.slice(0, dot);
  const value = expression.slice(dot + 1);
  const actual = row[column];
  switch (operator) {
    case "not": return !matches(row, column, value);
    case "is": return value === "null" ? actual == null : String(actual) === value;
    case "eq": return String(actual) === value;
    case "gt": return actual != null && Number(actual) > Number(value);
    case "gte": return actual != null && Number(actual) >= Number(value);
    case "lte": return actual != null && Number(actual) <= Number(value);
    case "ilike": {
      const pattern = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
      return new RegExp(`^${pattern}$`, "i").test(String(actual ?? ""));
    }
    case "ov": return value.replace(/[{}]/g, "").split(",").some(item => actual?.includes(item));
    case "cs": return value.replace(/[{}]/g, "").split(",").every(item => actual?.includes(item));
    default: throw new Error(`Unimplemented fixture filter: ${operator}`);
  }
}

export function queryCatalog(tableRows, params) {
  let rows = [...tableRows];
  for (const [column, expression] of params) {
    if (["select", "order", "limit", "offset"].includes(column)) continue;
    if (column === "or") {
      const terms = expression.replace(/^\(|\)$/g, "").split(",");
      rows = rows.filter(row => terms.some(term => {
        const dot = term.indexOf(".");
        return matches(row, term.slice(0, dot), term.slice(dot + 1));
      }));
    } else rows = rows.filter(row => matches(row, column, expression));
  }
  const count = rows.length;
  const orders = (params.get("order") ?? "").split(",").filter(Boolean).map(value => value.split("."));
  rows.sort((a, b) => {
    for (const [column, direction, nulls] of orders) {
      const av = a[column], bv = b[column];
      if (av === bv) continue;
      if (av == null) return nulls === "nullsfirst" ? -1 : 1;
      if (bv == null) return nulls === "nullsfirst" ? 1 : -1;
      const comparison = av < bv ? -1 : 1;
      return direction === "desc" ? -comparison : comparison;
    }
    return 0;
  });
  const offset = Number(params.get("offset") ?? 0);
  const limit = Number(params.get("limit") ?? rows.length);
  if (offset > 0 && offset >= count) {
    return { data: null, count: null, error: { code: "PGRST103", message: "Requested range not satisfiable",
      details: `An offset of ${offset} was requested, but there are only ${count} rows.`, hint: null } };
  }
  return { data: rows.slice(offset, offset + limit), count, error: null };
}
