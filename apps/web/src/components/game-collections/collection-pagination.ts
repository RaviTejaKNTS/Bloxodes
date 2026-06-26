import type { ReactNode } from "react";

export type CollectionPaginationItem = {
  id: string;
  name: string;
  image?: string | null;
  [key: string]: unknown;
};

export type CollectionPaginationSection<TItem extends CollectionPaginationItem> = {
  id: string;
  label: string;
  items: TItem[];
  noteHtml?: string | null;
  noteNodes?: ReactNode[] | null;
  totalItemCount?: number;
  isContinuation?: boolean;
  startPage?: number;
  startHref?: string;
};

export type CollectionPaginationInfo = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageItemCount: number;
  pageStartIndex: number;
  basePath: string;
};

export type CollectionPaginationSectionLink = {
  id: string;
  label: string;
  count: number;
  page: number;
  href: string;
};

type PageBucket<TItem extends CollectionPaginationItem> = {
  sections: CollectionPaginationSection<TItem>[];
  weight: number;
  itemCount: number;
};

const DEFAULT_TARGET_WEIGHT = 120_000;
const DEFAULT_MAX_SECTION_WEIGHT = 96_000;
const MIN_ITEMS_PER_PAGE = 24;

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(normalizeText).filter(Boolean).join(" ");
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).map(normalizeText).filter(Boolean).join(" ");
  }
  return "";
}

function estimateItemWeight(item: CollectionPaginationItem) {
  let textLength = 0;
  for (const [key, value] of Object.entries(item)) {
    if (key === "image" || key === "sourceImageUrl" || key === "wikiUrl") continue;
    textLength += normalizeText(value).length;
  }

  return 700 + textLength * 2 + (item.image ? 220 : 0);
}

function sectionWeight<TItem extends CollectionPaginationItem>(section: CollectionPaginationSection<TItem>) {
  return section.items.reduce((sum, item) => sum + estimateItemWeight(item), 0);
}

function cloneSectionWithItems<TItem extends CollectionPaginationItem>(
  section: CollectionPaginationSection<TItem>,
  items: TItem[],
  isContinuation = false
): CollectionPaginationSection<TItem> {
  return {
    ...section,
    items,
    totalItemCount: section.items.length,
    isContinuation
  };
}

function pushBucket<TItem extends CollectionPaginationItem>(buckets: PageBucket<TItem>[], bucket: PageBucket<TItem>) {
  if (!bucket.sections.length) return;
  buckets.push(bucket);
}

function splitLargeSection<TItem extends CollectionPaginationItem>(
  section: CollectionPaginationSection<TItem>,
  targetWeight: number
): PageBucket<TItem>[] {
  const buckets: PageBucket<TItem>[] = [];
  let currentItems: TItem[] = [];
  let currentWeight = 0;

  for (const item of section.items) {
    const itemWeight = estimateItemWeight(item);
    const shouldBreak =
      currentItems.length >= MIN_ITEMS_PER_PAGE && currentWeight > 0 && currentWeight + itemWeight > targetWeight;

    if (shouldBreak) {
      buckets.push({
        sections: [cloneSectionWithItems(section, currentItems, buckets.length > 0)],
        weight: currentWeight,
        itemCount: currentItems.length
      });
      currentItems = [];
      currentWeight = 0;
    }

    currentItems.push(item);
    currentWeight += itemWeight;
  }

  if (currentItems.length) {
    buckets.push({
      sections: [cloneSectionWithItems(section, currentItems, buckets.length > 0)],
      weight: currentWeight,
      itemCount: currentItems.length
    });
  }

  return buckets;
}

export function buildCollectionPagination<TItem extends CollectionPaginationItem>({
  sections,
  currentPage,
  basePath,
  targetWeight = DEFAULT_TARGET_WEIGHT,
  maxSectionWeight = DEFAULT_MAX_SECTION_WEIGHT
}: {
  sections: CollectionPaginationSection<TItem>[];
  currentPage: number;
  basePath: string;
  targetWeight?: number;
  maxSectionWeight?: number;
}) {
  const buckets: PageBucket<TItem>[] = [];
  let current: PageBucket<TItem> = { sections: [], weight: 0, itemCount: 0 };

  for (const section of sections) {
    const weight = sectionWeight(section);
    const itemCount = section.items.length;

    if (weight > maxSectionWeight) {
      pushBucket(buckets, current);
      current = { sections: [], weight: 0, itemCount: 0 };
      buckets.push(...splitLargeSection(section, targetWeight));
      continue;
    }

    const shouldStartNewPage =
      current.sections.length > 0 && current.weight + weight > targetWeight && current.itemCount >= MIN_ITEMS_PER_PAGE;

    if (shouldStartNewPage) {
      pushBucket(buckets, current);
      current = { sections: [], weight: 0, itemCount: 0 };
    }

    current.sections.push(section);
    current.weight += weight;
    current.itemCount += itemCount;
  }

  pushBucket(buckets, current);

  const totalPages = Math.max(1, buckets.length);
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const bucket = buckets[safeCurrentPage - 1] ?? { sections: [], weight: 0, itemCount: 0 };
  const totalItems = sections.reduce((sum, section) => sum + section.items.length, 0);
  const pageStartIndex = buckets
    .slice(0, safeCurrentPage - 1)
    .reduce((sum, pageBucket) => sum + pageBucket.itemCount, 0);
  const sectionPageById = new Map<string, number>();
  buckets.forEach((pageBucket, bucketIndex) => {
    pageBucket.sections.forEach((section) => {
      if (!sectionPageById.has(section.id)) {
        sectionPageById.set(section.id, bucketIndex + 1);
      }
    });
  });
  const sectionHrefById = new Map<string, string>();
  const sectionLinks = sections.map((section) => {
    const page = sectionPageById.get(section.id) ?? 1;
    const path = page === 1 ? basePath : `${basePath}/page/${page}`;
    const href = `${path}#${section.id}`;
    sectionHrefById.set(section.id, href);
    return {
      id: section.id,
      label: section.label,
      count: section.items.length,
      page,
      href
    } satisfies CollectionPaginationSectionLink;
  });
  const pageSections = bucket.sections.map((section) => ({
    ...section,
    startPage: sectionPageById.get(section.id) ?? 1,
    startHref: sectionHrefById.get(section.id) ?? `${basePath}#${section.id}`,
    totalItemCount: section.totalItemCount ?? sections.find((entry) => entry.id === section.id)?.items.length ?? section.items.length
  }));

  return {
    sections: pageSections,
    sectionLinks,
    info: {
      currentPage: safeCurrentPage,
      totalPages,
      totalItems,
      pageItemCount: bucket.itemCount,
      pageStartIndex,
      basePath
    } satisfies CollectionPaginationInfo
  };
}
