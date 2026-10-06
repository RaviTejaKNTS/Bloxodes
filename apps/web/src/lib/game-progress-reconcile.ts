/** Keep completed historical items while validating this page's submitted IDs. */
export function reconcileGameProgress(submitted: string[], saved: string[], current: Set<string>, historical: Set<string>) {
  if (submitted.some(id => !current.has(id) && !historical.has(id))) return null;
  if (!submitted.length) return { stored: [], visible: [] };
  const visible = submitted.filter(id => current.has(id));
  const stored = [...new Set([...visible, ...saved.filter(id => !current.has(id)), ...submitted.filter(id => !current.has(id))])];
  return { stored, visible };
}

export function normalizeStoredGameProgress(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap(id => typeof id === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id.trim().toLowerCase()) && id.trim().length <= 200 ? [id.trim().toLowerCase()] : []))];
}
