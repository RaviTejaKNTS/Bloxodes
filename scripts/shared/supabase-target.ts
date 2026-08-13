const PRODUCTION_SUPABASE_HOSTS = new Set([
  "database.bloxodes.com",
  "bloxodesdb.ravitejaknts.com"
]);

function parseSupabaseUrl(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function isManagedDevelopmentSupabaseUrl(value: string | undefined): boolean {
  const url = parseSupabaseUrl(value);
  return Boolean(
    url &&
      url.protocol === "https:" &&
      url.hostname.endsWith(".supabase.co") &&
      !PRODUCTION_SUPABASE_HOSTS.has(url.hostname)
  );
}

export function isProductionSupabaseUrl(value: string | undefined): boolean {
  const url = parseSupabaseUrl(value);
  return Boolean(url && PRODUCTION_SUPABASE_HOSTS.has(url.hostname));
}

export function assertManagedDevelopmentSupabaseUrl(
  value: string | undefined,
  context = "development command"
): asserts value is string {
  if (!isManagedDevelopmentSupabaseUrl(value)) {
    const host = parseSupabaseUrl(value)?.hostname ?? "unset";
    throw new Error(
      `Refusing ${context} against ${host}; expected the managed development HTTPS *.supabase.co target.`
    );
  }
}
