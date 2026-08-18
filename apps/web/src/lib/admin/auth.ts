import "server-only";

/**
 * Bearer-token guard for the personal admin API used by `apps/admin-extension`.
 * When `ADMIN_API_TOKEN` is unset the admin API does not exist (404), so a
 * deployment without the variable exposes nothing.
 */
export function checkAdminToken(request: Request): { ok: true } | { ok: false; status: 404 | 401 } {
  const expected = process.env.ADMIN_API_TOKEN?.trim();
  if (!expected) return { ok: false, status: 404 };

  const header = request.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token || token.length !== expected.length) return { ok: false, status: 401 };

  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0 ? { ok: true } : { ok: false, status: 401 };
}
