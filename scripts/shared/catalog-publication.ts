import type { SupabaseClient } from "@supabase/supabase-js";

type CatalogPublicationRow = {
  code: string;
  is_published: boolean;
  published_at?: string | null;
};

type ExistingCatalogPublication = CatalogPublicationRow & { published_at: string | null };

export async function preserveCatalogPublicationDates<T extends CatalogPublicationRow>(
  client: SupabaseClient,
  rows: T[],
  now = new Date()
): Promise<T[]> {
  const publishedCodes = rows.filter(row => row.is_published).map(row => row.code);
  const existing = new Map<string, ExistingCatalogPublication>();
  for (let offset = 0; offset < publishedCodes.length; offset += 200) {
    const { data, error } = await client
      .from("catalog_pages")
      .select("code,is_published,published_at")
      .in("code", publishedCodes.slice(offset, offset + 200));
    if (error) throw new Error(`Failed to load catalog publication dates: ${error.message}`);
    for (const row of (data ?? []) as ExistingCatalogPublication[]) existing.set(row.code, row);
  }

  return rows.map(row => {
    if (!row.is_published) return row;
    const previous = existing.get(row.code);
    return {
      ...row,
      published_at: previous?.is_published ? previous.published_at : now.toISOString()
    };
  });
}
