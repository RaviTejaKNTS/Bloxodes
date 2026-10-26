const monthYearFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC"
});
const monthNames = "January|February|March|April|May|June|July|August|September|October|November|December";
const dateLabel = `(?:${monthNames}|%month%) (?:\\d{4}|%year%)`;
const dateSuffix = new RegExp(
  `\\s*(?:\\(${dateLabel}\\)|\\[${dateLabel}\\]|(?:[-–—|]\\s*)?%month%\\s+%year%)$`,
  "i"
);

/** Only music/decal catalog page titles use this calendar label, never content dates. */
export function catalogIdTitle(title: string, now: Date = new Date()): string {
  const monthYear = monthYearFormatter.format(now);
  const month = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(now);
  let base = title.trim();
  let brand = "";
  let page = "";

  // Peel suffixes in either order so saved titles and repeated calls keep one date.
  while (base) {
    const withoutDate = base.replace(dateSuffix, "").trimEnd();
    if (withoutDate !== base) {
      base = withoutDate;
      continue;
    }
    const brandMatch = base.match(/\s+(?:\||[-–—])\s+Bloxodes$/i);
    if (brandMatch) {
      brand = brandMatch[0];
      base = base.slice(0, -brand.length).trimEnd();
      continue;
    }
    const pageMatch = base.match(/\s+-\s+Page\s+\d+$/i);
    if (pageMatch) {
      page = pageMatch[0];
      base = base.slice(0, -page.length).trimEnd();
      continue;
    }
    break;
  }

  base = base.replace(/%month%/gi, month).replace(/%year%/gi, String(now.getUTCFullYear()));
  return `${base} (${monthYear})${page}${brand}`;
}
