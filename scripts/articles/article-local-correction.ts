export type LocalCorrection = { before: string; after: string };
// This is an edit-scope guard, not an article length or structure requirement.
export function applyLocalCorrections(body: string, edits: unknown): string | null {
  if (!Array.isArray(edits) || !edits.length || edits.length > 3) return null;
  let result = body;
  for (const edit of edits) {
    if (typeof edit?.before !== "string" || typeof edit?.after !== "string" || !edit.before.trim() || edit.before === edit.after) return null;
    if ([edit.before, edit.after].some(text => text.length > 800 || text.split(/\s+/).length > 100)) return null;
    if (result.split(edit.before).length !== 2) return null;
    // Local prose correction cannot silently remove media or change the heading map.
    if ([edit.before, edit.after].some(text => /!\[|^#{1,6}\s/m.test(text))) return null;
    result = result.replace(edit.before, () => edit.after);
  }
  return result;
}
