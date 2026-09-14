export function pickThumbnail(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === "string" && entry.trim()) return entry;
      if (entry && typeof entry === "object" && "url" in entry) {
        const url = (entry as { url?: unknown }).url;
        if (typeof url === "string" && url.trim()) return url;
      }
    }
  }
  return null;
}

export function summarize(descriptionMd: string | null | undefined, fallback: string): string {
  if (!descriptionMd) return fallback;
  const plain = descriptionMd.replace(/[#>*_`~[\]]/g, " ").replace(/\s+/g, " ").trim();
  if (!plain) return fallback;
  if (plain.length <= 160) return plain;
  const slice = plain.slice(0, 157);
  const lastSpace = slice.lastIndexOf(" ");
  return `${lastSpace > 120 ? slice.slice(0, lastSpace) : slice}…`;
}
