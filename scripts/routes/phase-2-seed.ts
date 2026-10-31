import { readFileSync } from 'node:fs';
import type { RedirectRoute } from '../../apps/web/src/lib/site-route-resolver';
/** Parse the migration's literal import calls, never the expected-output fixture. */
export function phase2RedirectRows(): RedirectRoute[] {
  const sql = readFileSync(new URL('../../supabase/migrations/20261031194915_site_routes_registry.sql', import.meta.url), 'utf8');
  return [...sql.matchAll(/^select pg_temp.import_site_redirect\((.*)\);$/gm)].map(match => {
    const values = [...match[1].matchAll(/'((?:[^']|'')*)'|\b(null|true|false|\d+)\b/g)].map(m => m[1] !== undefined ? m[1].replaceAll("''", "'") : m[2] === 'null' ? null : m[2]);
    const [path, target, origin, , , kind, code, tail, self] = values;
    return {path: path!, target_url: target, origin: origin!, match_type: kind ?? 'exact', redirect_code: Number(code ?? 301), tail_mode: tail ?? 'append', match_self: self !== 'false', status: 'old', page_id: null, resolved_target: target} as RedirectRoute;
  });
}
