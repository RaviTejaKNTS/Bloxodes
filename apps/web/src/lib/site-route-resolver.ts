/** TS counterpart of site_route_target / resolve_site_route in
 * supabase/migrations/20261031194915_site_routes_registry.sql:295-332.
 * Keep SQL and these path-only semantics together when changing either implementation.
 * resolved_target is computed by the view in the same database statement, so
 * page-linked aliases always follow the current live owner (never target_url).
 */
export type RedirectRoute = {
  path: string;
  status: 'old' | 'live' | 'gone';
  match_type: 'exact' | 'prefix';
  tail_mode: 'append' | 'drop' | 'free-items';
  match_self: boolean;
  page_id: string | null;
  page_type?: string | null;
  target_url: string | null;
  resolved_target: string | null;
  redirect_code: 301 | 302 | 307 | 308;
  origin: string;
  indexableGamePath?: boolean;
};
export function siteRouteTarget(row: RedirectRoute, path: string): string | null {
  if (row.status !== 'old') return null;
  if (row.page_id !== null) return row.resolved_target;
  if (row.match_type === 'exact' || row.tail_mode === 'drop') return row.target_url;
  const tail = row.path === '/' ? (path === '/' ? '' : path) : path.slice(row.path.length);
  if (row.tail_mode === 'free-items') {
    if (!tail) return row.target_url;
    const parts = tail.slice(1).split('/');
    if (parts.length === 1 || parts.length === 2) return row.target_url + tail;
    if ((parts.length === 3 && parts[1] === 'page') || (parts.length === 4 && parts[2] === 'page')) {
      // SQL parses the leading signed decimal digits, then converts to float8.
      const digits = parts[parts.length - 1].match(/^\s*([+-]?[0-9]+)/)?.[1];
      const parsed = digits === undefined ? NaN : Number(digits);
      const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
      return `${row.target_url}/${parts.slice(0, -2).join('/')}/page/${page}`;
    }
    return null;
  }
  return row.target_url + tail;
}
export function buildRedirectSnapshot(rows: RedirectRoute[]) {
  const redirects = rows;
  return {
    indexableGamePaths: new Set(rows.filter(row => row.indexableGamePath).map(row => row.path)),
    exact: new Map(redirects.filter(row => row.match_type === 'exact').map(row => [row.path, row])),
    prefixes: redirects.filter(row => row.match_type === 'prefix' && row.status === 'old').sort((a, b) => b.path.length - a.path.length)
  };
}
export type RedirectSnapshot = ReturnType<typeof buildRedirectSnapshot>;
export function resolveSiteRoute(snapshot: RedirectSnapshot, path: string) {
  const exact = snapshot.exact.get(path);
  if (exact) return { row: exact, target: siteRouteTarget(exact, path) };
  // Collection pagination is a virtual route. An exact live/gone row above
  // still wins; only a page-linked old collection may carry its numeric tail.
  const pagination = /^(.*)(\/page\/[1-9]\d*)$/.exec(path);
  if (pagination) {
    const row = snapshot.exact.get(pagination[1]);
    if (row?.status === 'old' && row.page_type === 'collection' && row.page_id !== null && row.resolved_target) {
      return { row, target: row.resolved_target + pagination[2] };
    }
  }
  for (const row of snapshot.prefixes) {
    if (!(path === row.path ? row.match_self : row.path === '/' ? path.startsWith('/') : path.startsWith(row.path + '/'))) continue;
    const target = siteRouteTarget(row, path);
    if (row.tail_mode === 'free-items' && path !== row.path && target === null) continue;
    return { row, target };
  }
  return null;
}

function decode(value: string) {
  try { return decodeURIComponent(value); } catch { return value; }
}
/** Request compatibility, deliberately separate from the SQL path resolver. */
export function registryRequestRedirect(snapshot: RedirectSnapshot, pathname: string, query: string) {
  const stripped = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
  const root = stripped.match(/^\/([^/]+)$/);
  if (root) {
    const found = resolveSiteRoute(snapshot, '/' + decode(root[1]).trim().toLowerCase());
    if (found?.target && ['article-redirect-slugs', 'slug_oldslugs'].includes(found.row.origin)) {
      return { target: found.target, query, code: found.row.redirect_code, rootAlias: true, origin: found.row.origin };
    }
  }
  // Next's built-in redirect stage removes trailing slashes before middleware.
  // Leave non-root slash handling to Next; retain the old root helper's normalization.
  if (pathname !== stripped) return null;
  let found = resolveSiteRoute(snapshot, pathname);
  // Split before decoding: an encoded slash is part of one Next page param.
  if (pathname.startsWith('/lists/') && !snapshot.exact.has(pathname)) {
    const first = decode(pathname.split('/')[2]).toLowerCase();
    found = resolveSiteRoute(snapshot, first.includes('/') ? '/lists' : '/lists/' + first);
  }
  if (pathname.startsWith('/catalog/free-roblox-items/categories/')) {
    const base = '/catalog/free-roblox-items/categories';
    const parts = pathname.slice(base.length + 1).split('/').map(decode);
    const row = snapshot.prefixes.find(row => row.path === base && row.tail_mode === 'free-items');
    if (row && !snapshot.exact.has(pathname)) {
      let target: string | null = null;
      if (parts.length <= 2) target = row.target_url + '/' + parts.map(encodeURIComponent).join('/');
      else if ((parts.length === 3 && parts[1] === 'page') || (parts.length === 4 && parts[2] === 'page')) {
        // Next keeps '+' encoded (%2B) in route params, so '+3' parsed as NaN and fell back to page 1.
        const parsed = Number.parseInt(parts[parts.length - 1].replace(/\+/g, '%2B'), 10);
        const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
        target = `${row.target_url}/${parts.slice(0, -2).map(encodeURIComponent).join('/')}/page/${page}`;
      }
      found = target ? {row, target} : null;
    }
  }
  // Next config's redirect patterns were case insensitive.
  const configMatch = resolveSiteRoute(snapshot, pathname.toLowerCase());
  if (!found && configMatch?.row.origin === 'next.config') found = configMatch;
  if (!found?.target) return null;
  const dropQuery = ['lists', 'free-items-categories'].includes(found.row.origin);
  return { target: found.target, query: dropQuery ? '' : query, code: found.row.redirect_code, rootAlias: false, origin: found.row.origin };
}
