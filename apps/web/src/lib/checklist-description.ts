export type ChecklistDescriptionPart = { text: string; href?: string };

// Only editorial, site-relative links are supported. Leave other Markdown as
// literal text; descriptions never execute HTML or arbitrary URL schemes.
export function parseChecklistDescription(text: string): ChecklistDescriptionPart[] {
  const parts: ChecklistDescriptionPart[] = [];
  const pattern = /\[([^\]\n]+)\]\(([^\s)]+)\)/g;
  let offset = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > offset) parts.push({ text: text.slice(offset, index) });
    const href = match[2];
    if (/^\/(?!\/)[a-zA-Z0-9/_-]+(?:#[a-zA-Z0-9_-]+)?$/.test(href)) {
      parts.push({ text: match[1], href });
    } else {
      parts.push({ text: match[0] });
    }
    offset = index + match[0].length;
  }
  if (offset < text.length) parts.push({ text: text.slice(offset) });
  return parts;
}

export function checklistDescriptionText(text: string): string {
  return parseChecklistDescription(text).map(part => part.text).join("");
}
